package dev.mirendex.diffen;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import android.webkit.WebView;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.splashscreen.SplashScreenViewProvider;
import com.getcapacitor.BridgeActivity;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    private static final long SPLASH_MS = 380; // as long as the animation in drawable/splash_logo.xml
    private static final long SPLASH_MAX_MS = 2000; // if the web part never says it is ready

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The splash plays the first half of the launch animation, the pointer coming to rest on
        // the logo, and the web part plays the rest from that frame. So the splash stays up until
        // its animation is over and the web part has drawn the same frame under it.
        SplashGatePlugin.ready = false;
        final long start = SystemClock.uptimeMillis();
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        splash.setKeepOnScreenCondition(() -> {
            long t = SystemClock.uptimeMillis() - start;
            return t < SPLASH_MAX_MS && (t < SPLASH_MS || !SplashGatePlugin.ready);
        });
        splash.setOnExitAnimationListener(this::handOver);
        registerPlugin(BackGatePlugin.class);
        registerPlugin(VibePlugin.class);
        registerPlugin(SplashGatePlugin.class);
        super.onCreate(savedInstanceState);
    }

    // Tells the web part where the logo is on screen, so its frame lands on the splash's to the
    // pixel, and takes the splash away only once the web part has moved there.
    private void handOver(SplashScreenViewProvider splash) {
        WebView web = getBridge() == null ? null : getBridge().getWebView();
        if (web == null) {
            splash.remove();
            return;
        }
        String box = logoBox(splash.getIconView(), web);
        web.evaluateJavascript(
            "window.__splashGone=true;window.__splashDone&&window.__splashDone(" + box + ")",
            v -> web.postOnAnimation(() -> web.postOnAnimation(splash::remove))
        );
    }

    // The logo's box in css px of the web view: the drawn pixels of the splash icon, or, when they
    // can't be read, the icon's own box with the window centred in it as the drawable has it
    private String logoBox(View icon, WebView web) {
        if (icon == null || icon.getWidth() <= 0 || icon.getHeight() <= 0) return "null";
        int[] at = new int[2];
        int[] webAt = new int[2];
        icon.getLocationOnScreen(at);
        web.getLocationOnScreen(webAt);
        float d = getResources().getDisplayMetrics().density;
        int w = icon.getWidth();
        int h = icon.getHeight();
        int[] drawn = drawnBounds(icon, w, h);
        float left;
        float top;
        float right;
        float bottom;
        if (drawn != null) {
            left = drawn[0];
            top = drawn[1];
            right = drawn[2];
            bottom = drawn[3];
        } else {
            // 72 units across; the 24 x 22 window is centred, the pointer reaches 3 past it
            float u = w / 72f;
            left = w / 2f - 12 * u;
            top = h / 2f - 11 * u;
            right = left + 27 * u;
            bottom = top + 25 * u;
        }
        return String.format(
            Locale.ROOT,
            "{x:%.3f,y:%.3f,w:%.3f,h:%.3f,drawn:%b}",
            (at[0] - webAt[0] + left) / d,
            (at[1] - webAt[1] + top) / d,
            (right - left) / d,
            (bottom - top) / d,
            drawn != null
        );
    }

    // the box of the icon's non-transparent pixels, or null if nothing could be read (the icon may
    // be drawn on a surface of its own)
    private int[] drawnBounds(View icon, int w, int h) {
        try {
            Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
            icon.draw(new Canvas(bmp));
            int[] px = new int[w * h];
            bmp.getPixels(px, 0, w, 0, 0, w, h);
            bmp.recycle();
            // look in from each side and stop at the first drawn pixel
            int t = 0;
            while (t < h && rowEmpty(px, w, t)) t++;
            if (t == h) return null;
            int b = h - 1;
            while (rowEmpty(px, w, b)) b--;
            int l = 0;
            while (colEmpty(px, w, t, b, l)) l++;
            int r = w - 1;
            while (colEmpty(px, w, t, b, r)) r--;
            return new int[] { l, t, r + 1, b + 1 };
        } catch (RuntimeException e) {
            return null;
        }
    }

    private static boolean rowEmpty(int[] px, int w, int y) {
        for (int x = 0; x < w; x++) if ((px[y * w + x] >>> 24) > 128) return false;
        return true;
    }

    private static boolean colEmpty(int[] px, int w, int top, int bottom, int x) {
        for (int y = top; y <= bottom; y++) if ((px[y * w + x] >>> 24) > 128) return false;
        return true;
    }
}
