package dev.mirendex.diffen;

import android.webkit.WebView;
import androidx.activity.BackEventCompat;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.OnBackPressedDispatcher;
import androidx.annotation.NonNull;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.lang.reflect.Field;
import java.util.ArrayDeque;
import java.util.Iterator;

/**
 * Управление жестом назад.
 *
 * Открыто окно  -> наш колбэк включён, жест закрывает окно, а во время самого
 *                  свайпа мы шлём в JS прогресс предиктивной анимации (start/progress/cancel/commit),
 *                  чтобы окно на экране могло анимироваться в такт жесту.
 * Окон нет      -> все колбэки выключены, жест обрабатывает система,
 *                  поэтому Android рисует предиктивную анимацию выхода.
 */
@CapacitorPlugin(name = "BackGate")
public class BackGatePlugin extends Plugin {

    private OnBackPressedCallback callback;

    @Override
    public void load() {
        callback = new OnBackPressedCallback(false) {
            @Override
            public void handleOnBackStarted(@NonNull BackEventCompat backEvent) {
                sendPhase("start", backEvent);
            }

            @Override
            public void handleOnBackProgressed(@NonNull BackEventCompat backEvent) {
                sendPhase("progress", backEvent);
            }

            @Override
            public void handleOnBackCancelled() {
                sendPhase("cancel", null);
            }

            @Override
            public void handleOnBackPressed() {
                sendPhase("commit", null);
                fireBack();
            }
        };
        getActivity().getOnBackPressedDispatcher().addCallback(getActivity(), callback);
    }

    private void sendPhase(String phase, BackEventCompat ev) {
        JSObject o = new JSObject();
        o.put("phase", phase);
        if (ev != null) {
            o.put("progress", ev.getProgress());
            o.put("swipeEdge", ev.getSwipeEdge());
            o.put("x", ev.getTouchX());
            o.put("y", ev.getTouchY());
        }
        notifyListeners("backGesture", o);
    }

    private void fireBack() {
        getActivity().runOnUiThread(new Runnable() {
            @Override public void run() {
                try {
                    WebView wv = getBridge() != null ? getBridge().getWebView() : null;
                    if (wv != null) wv.evaluateJavascript("window.__appBack && window.__appBack();", null);
                } catch (Exception ignored) {}
            }
        });
        notifyListeners("back", new JSObject());
    }

    /** Выключает чужие колбэки (в первую очередь встроенный в Capacitor),
     *  чтобы система могла показывать предиктивную анимацию, когда мы жест не перехватываем. */
    @PluginMethod
    public void takeOver(final PluginCall call) {
        final JSObject res = new JSObject();
        getActivity().runOnUiThread(new Runnable() {
            @Override public void run() {
                int disabled = 0;
                try {
                    OnBackPressedDispatcher d = getActivity().getOnBackPressedDispatcher();
                    Field f = null;
                    for (String name : new String[]{"onBackPressedCallbacks", "mOnBackPressedCallbacks"}) {
                        try { f = OnBackPressedDispatcher.class.getDeclaredField(name); break; }
                        catch (NoSuchFieldException ignored) {}
                    }
                    if (f != null) {
                        f.setAccessible(true);
                        Object raw = f.get(d);
                        if (raw instanceof ArrayDeque) {
                            ArrayDeque<?> q = (ArrayDeque<?>) raw;
                            for (Iterator<?> it = q.iterator(); it.hasNext(); ) {
                                Object o = it.next();
                                if (o instanceof OnBackPressedCallback && o != callback) {
                                    OnBackPressedCallback c = (OnBackPressedCallback) o;
                                    if (c.isEnabled()) { c.setEnabled(false); disabled++; }
                                }
                            }
                        }
                    }
                } catch (Throwable ignored) {}
                res.put("disabled", disabled);
                call.resolve(res);
            }
        });
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        final boolean enabled = call.getBoolean("enabled", false);
        getActivity().runOnUiThread(new Runnable() {
            @Override public void run() {
                if (callback != null) callback.setEnabled(enabled);
            }
        });
        call.resolve();
    }
}
