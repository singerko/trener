package com.trener.app;

import android.os.Bundle;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String BACK_HANDLER_SCRIPT =
        "(function(){return !!(window.TrenerBack && window.TrenerBack.handle && window.TrenerBack.handle());})()";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(WorkoutSharePlugin.class);
        super.onCreate(savedInstanceState);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                handleNativeBackPressed();
            }
        });
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
