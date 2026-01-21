package com.santase.game;

import android.os.Build;
import android.os.Bundle;
import android.view.Window;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Configure status bar appearance
        configureSystemBars();
    }
    
    private void configureSystemBars() {
        Window window = getWindow();
        
        // Set status bar icons to light (white) for dark backgrounds
        WindowInsetsControllerCompat windowInsetsController = 
            WindowCompat.getInsetsController(window, window.getDecorView());
        if (windowInsetsController != null) {
            // false = light icons (for dark backgrounds)
            windowInsetsController.setAppearanceLightStatusBars(false);
            windowInsetsController.setAppearanceLightNavigationBars(false);
        }
        
        // For Android 10+ (API 29+), disable navigation bar contrast enforcement
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setNavigationBarContrastEnforced(false);
        }
    }
}
