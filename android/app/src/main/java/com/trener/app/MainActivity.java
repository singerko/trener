package com.trener.app;

import android.media.AudioManager;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Bundle;
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

    private MediaSession mediaSession;
    private long lastMediaButtonAtMs = 0;

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
    public void onDestroy() {
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

        setWorkoutPlaybackState(false);

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
            MainActivity.this.setWorkoutPlaybackState(running);
        }
    }

    private void setWorkoutPlaybackState(boolean running) {
        if (mediaSession == null) return;

        int state = running ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED;
        PlaybackState playbackState = new PlaybackState.Builder()
            .setActions(
                PlaybackState.ACTION_PLAY
                    | PlaybackState.ACTION_PAUSE
                    | PlaybackState.ACTION_PLAY_PAUSE
            )
            .setState(state, PlaybackState.PLAYBACK_POSITION_UNKNOWN, 1.0f)
            .build();

        mediaSession.setPlaybackState(playbackState);
    }

    private boolean isMediaPlayPauseKey(KeyEvent event) {
        if (event == null) return false;

        int keyCode = event.getKeyCode();
        return keyCode == KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE
            || keyCode == KeyEvent.KEYCODE_MEDIA_PLAY
            || keyCode == KeyEvent.KEYCODE_MEDIA_PAUSE;
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
