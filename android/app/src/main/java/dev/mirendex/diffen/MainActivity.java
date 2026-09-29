package dev.mirendex.diffen;

import android.os.Bundle;
import android.os.SystemClock;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final long SPLASH_MS = 760; // as long as the animation in drawable/splash_logo.xml

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // the system splash is the launch animation, so it stays up until it has played out
        final long start = SystemClock.uptimeMillis();
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        splash.setKeepOnScreenCondition(() -> SystemClock.uptimeMillis() - start < SPLASH_MS);
        // no exit animation of the system's own: the web part carries on from the last frame
        splash.setOnExitAnimationListener(view -> view.remove());
        registerPlugin(BackGatePlugin.class);
        registerPlugin(VibePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
