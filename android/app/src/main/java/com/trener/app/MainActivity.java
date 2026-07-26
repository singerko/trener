package com.trener.app;

import android.media.AudioManager;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.KeyEvent;
import android.webkit.JavascriptInterface;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String BACK_HANDLER_SCRIPT =
        "(function(){return !!(window.TrenerBack && window.TrenerBack.handle && window.TrenerBack.handle());})()";
    private static final String APP_PAUSED_SCRIPT =
        "(function(){window.dispatchEvent(new CustomEvent('trener:app-paused',{detail:{source:'android'}}));return true;})()";
    private static final long MEDIA_BUTTON_DEBOUNCE_MS = 650;
    // Shokz/headset buttons are delivered through Android media routing, not directly
    // to React. During long quiet exercises Android may stop preferring our session,
    // so we periodically refresh the active playback state while a workout is open.
    private static final long MEDIA_SESSION_REFRESH_MS = 45_000;

    private MediaSession mediaSession;
    private final Handler mediaSessionHandler = new Handler(Looper.getMainLooper());
    private final Runnable mediaSessionRefreshRunnable = new Runnable() {
        @Override
        public void run() {
            if (!workoutMediaActive || mediaSession == null) {
                return;
            }

            applyWorkoutMediaState(workoutMediaActive, workoutMediaRunning);
            mediaSessionHandler.postDelayed(this, MEDIA_SESSION_REFRESH_MS);
        }
    };
    private long lastMediaButtonAtMs = 0;
    private boolean workoutMediaActive = false;
    private boolean workoutMediaRunning = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(WorkoutSharePlugin.class);
        super.onCreate(savedInstanceState);
        setupJavascriptBridge();
        setupMediaSession();

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                handleNativeBackPressed();
            }
        });
    }

    @Override
    public void onPause() {
        dispatchAppPaused();
        super.onPause();
    }

    @Override
    public void onResume() {
        super.onResume();
        if (workoutMediaActive) {
            applyWorkoutMediaState(workoutMediaActive, workoutMediaRunning);
            startMediaSessionRefresh();
        }
    }

    @Override
    public void onDestroy() {
        mediaSessionHandler.removeCallbacks(mediaSessionRefreshRunnable);

        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
            mediaSession = null;
        }

        super.onDestroy();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (isMediaPlayPauseKey(event) && event.getAction() == KeyEvent.ACTION_UP) {
            if (isPhoneAudioActive()) {
                return super.dispatchKeyEvent(event);
            }

            dispatchMediaCommand(commandForMediaKey(event));
            return true;
        }

        return super.dispatchKeyEvent(event);
    }

    private void setupMediaSession() {
        mediaSession = new MediaSession(this, "TrenerMediaSession");
        // Keep both media buttons and transport controls claimed. The React handler
        // decides whether this means start or pause; native code only keeps the
        // headset event routed into the WebView.
        mediaSession.setFlags(
            MediaSession.FLAG_HANDLES_MEDIA_BUTTONS
                | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS
        );
        mediaSession.setCallback(new MediaSession.Callback() {
            @Override
            public boolean onMediaButtonEvent(android.content.Intent mediaButtonIntent) {
                KeyEvent event = mediaButtonIntent.getParcelableExtra(android.content.Intent.EXTRA_KEY_EVENT);
                if (isMediaPlayPauseKey(event) && event.getAction() == KeyEvent.ACTION_UP) {
                    if (isPhoneAudioActive()) {
                        return super.onMediaButtonEvent(mediaButtonIntent);
                    }

                    dispatchMediaCommand(commandForMediaKey(event));
                    return true;
                }

                return super.onMediaButtonEvent(mediaButtonIntent);
            }

            @Override
            public void onPlay() {
                if (isPhoneAudioActive()) return;
                dispatchMediaCommand("play");
            }

            @Override
            public void onPause() {
                if (isPhoneAudioActive()) return;
                dispatchMediaCommand("pause");
            }
        });

        setWorkoutMediaState(false, false);

        mediaSession.setActive(true);
    }

    private void setupJavascriptBridge() {
        if (bridge == null || bridge.getWebView() == null) {
            return;
        }

        bridge.getWebView().addJavascriptInterface(new WorkoutMediaBridge(), "TrenerNativeMedia");
    }

    private class WorkoutMediaBridge {
        @JavascriptInterface
        public void setWorkoutPlaybackState(boolean running) {
            MainActivity.this.setWorkoutMediaState(running, running);
        }

        @JavascriptInterface
        public void setWorkoutMediaState(boolean active, boolean running) {
            MainActivity.this.setWorkoutMediaState(active, running);
        }
    }

    private void setWorkoutMediaState(boolean active, boolean running) {
        if (mediaSession == null) return;

        if (Looper.myLooper() != Looper.getMainLooper()) {
            mediaSessionHandler.post(() -> setWorkoutMediaState(active, running));
            return;
        }

        workoutMediaActive = active;
        workoutMediaRunning = running;
        applyWorkoutMediaState(active, running);

        // Active means the workout screen is still relevant, including IDLE/PAUSED.
        // Running only affects the visible playback state. Keeping PAUSED active
        // lets Shokz start the next exercise instead of falling through to another
        // audio app after a long pause or timed exercise.
        if (active) {
            startMediaSessionRefresh();
        } else {
            mediaSessionHandler.removeCallbacks(mediaSessionRefreshRunnable);
        }
    }

    private void applyWorkoutMediaState(boolean active, boolean running) {
        if (mediaSession == null) return;

        int state = running ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED;
        PlaybackState playbackState = new PlaybackState.Builder()
            .setActions(
                PlaybackState.ACTION_PLAY
                    | PlaybackState.ACTION_PAUSE
                    | PlaybackState.ACTION_PLAY_PAUSE
            )
            .setState(state, PlaybackState.PLAYBACK_POSITION_UNKNOWN, 1.0f, SystemClock.elapsedRealtime())
            .build();

        mediaSession.setActive(active);
        mediaSession.setPlaybackState(playbackState);
    }

    private void startMediaSessionRefresh() {
        mediaSessionHandler.removeCallbacks(mediaSessionRefreshRunnable);
        mediaSessionHandler.postDelayed(mediaSessionRefreshRunnable, MEDIA_SESSION_REFRESH_MS);
    }

    private boolean isMediaPlayPauseKey(KeyEvent event) {
        if (event == null) return false;

        int keyCode = event.getKeyCode();
        return keyCode == KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE
            || keyCode == KeyEvent.KEYCODE_MEDIA_PLAY
            || keyCode == KeyEvent.KEYCODE_MEDIA_PAUSE
            || keyCode == KeyEvent.KEYCODE_HEADSETHOOK;
    }

    private String commandForMediaKey(KeyEvent event) {
        if (event == null) return "toggle";

        int keyCode = event.getKeyCode();
        if (keyCode == KeyEvent.KEYCODE_MEDIA_PLAY) return "play";
        if (keyCode == KeyEvent.KEYCODE_MEDIA_PAUSE) return "pause";
        return "toggle";
    }

    private void dispatchMediaCommand(String command) {
        if (bridge == null || bridge.getWebView() == null) {
            return;
        }

        long now = System.currentTimeMillis();
        if (now - lastMediaButtonAtMs < MEDIA_BUTTON_DEBOUNCE_MS) {
            return;
        }
        lastMediaButtonAtMs = now;

        String script = "(function(){window.dispatchEvent(new CustomEvent('trener:media-button',{detail:{source:'android',command:'"
            + command
            + "'}}));return true;})()";
        bridge.getWebView().post(() -> bridge.getWebView().evaluateJavascript(script, null));
    }

    private boolean isPhoneAudioActive() {
        AudioManager audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
        if (audioManager == null) return false;

        int mode = audioManager.getMode();
        return mode == AudioManager.MODE_RINGTONE
            || mode == AudioManager.MODE_IN_CALL
            || mode == AudioManager.MODE_IN_COMMUNICATION;
    }

    private void dispatchAppPaused() {
        if (bridge == null || bridge.getWebView() == null) {
            return;
        }

        bridge.getWebView().post(() -> bridge.getWebView().evaluateJavascript(APP_PAUSED_SCRIPT, null));
    }

    private void handleNativeBackPressed() {
        if (bridge == null || bridge.getWebView() == null) {
            moveTaskToBack(true);
            return;
        }

        bridge.getWebView().evaluateJavascript(BACK_HANDLER_SCRIPT, handled -> {
            if (!"true".equals(handled)) {
                moveTaskToBack(true);
            }
        });
    }
}
