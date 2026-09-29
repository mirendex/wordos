package dev.mirendex.diffen;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The web part says here when it has drawn the launch animation's first frame under the splash,
 * so the splash can go without the screen blinking in between.
 */
@CapacitorPlugin(name = "SplashGate")
public class SplashGatePlugin extends Plugin {

    static volatile boolean ready = false;

    @PluginMethod
    public void ready(PluginCall call) {
        ready = true;
        call.resolve();
    }
}
