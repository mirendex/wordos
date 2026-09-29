package dev.mirendex.diffen;

import android.content.Context;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * A short pulse with its own strength. @capacitor/haptics can only set how long the motor runs,
 * so the strength setting had to be faked with the length; this sets the amplitude itself.
 * Only phones whose motor can vary its amplitude (Android 8+) support it, and info() says so.
 */
@CapacitorPlugin(name = "Vibe")
public class VibePlugin extends Plugin {

    private Vibrator vibrator() {
        Context ctx = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager m = (VibratorManager) ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return m == null ? null : m.getDefaultVibrator();
        }
        return (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
    }

    @PluginMethod
    public void info(PluginCall call) {
        JSObject res = new JSObject();
        boolean amplitude = false;
        Vibrator v = vibrator();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            amplitude = v != null && v.hasVibrator() && v.hasAmplitudeControl();
        }
        res.put("amplitude", amplitude);
        call.resolve(res);
    }

    @PluginMethod
    public void pulse(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.reject("no amplitude control");
            return;
        }
        Vibrator v = vibrator();
        if (v == null || !v.hasVibrator() || !v.hasAmplitudeControl()) {
            call.reject("no amplitude control");
            return;
        }
        int ms = Math.max(1, call.getInt("ms", 2));
        int amp = Math.max(1, Math.min(255, call.getInt("amp", 64)));
        // full strength is sent as the system's own default amplitude, exactly as the length-only call
        // of @capacitor/haptics did: a phone can treat a number of 255 as weaker than that
        int level = amp >= 255 ? VibrationEffect.DEFAULT_AMPLITUDE : amp;
        v.vibrate(VibrationEffect.createOneShot(ms, level));
        call.resolve();
    }
}
