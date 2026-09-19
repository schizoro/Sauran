package online.sauran.app;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Web uygulaması ile ön plan servisi (VoiceCallService) arasındaki köprü.
 *
 * JS tarafı:
 *   SauranVoice.start({ title, text, muted })   — görüşmeye katılınca
 *   SauranVoice.setMuted({ muted })            — mikrofon durumu değişince
 *   SauranVoice.stop()                         — görüşmeden ayrılınca
 *   SauranVoice.addListener('action', e => …)  — bildirimdeki düğmeler: e.type = 'leave' | 'toggle_mic'
 */
@CapacitorPlugin(
        name = "SauranVoice",
        permissions = {
                @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
        }
)
public class SauranVoicePlugin extends Plugin {

    private BroadcastReceiver actionReceiver;

    @Override
    public void load() {
        actionReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String type = intent.getStringExtra(VoiceCallService.EXTRA_TYPE);
                if (type == null) return;
                JSObject data = new JSObject();
                data.put("type", type);
                notifyListeners("action", data, true);
            }
        };

        ContextCompat.registerReceiver(
                getContext(),
                actionReceiver,
                new IntentFilter(VoiceCallService.BROADCAST_ACTION),
                ContextCompat.RECEIVER_NOT_EXPORTED
        );
    }

    @Override
    protected void handleOnDestroy() {
        if (actionReceiver != null) {
            try { getContext().unregisterReceiver(actionReceiver); } catch (IllegalArgumentException ignored) { /* zaten kayıtlı değil */ }
            actionReceiver = null;
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void start(PluginCall call) {
        // Android 13+ : bildirim izni yoksa bir kez iste (reddedilirse servis yine çalışır, yalnızca bildirim görünmez).
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "onNotificationPermission");
            return;
        }
        startService(call);
    }

    @PermissionCallback
    private void onNotificationPermission(PluginCall call) {
        startService(call);
    }

    private void startService(PluginCall call) {
        // Android 14+ : "microphone" türünde ön plan servisi, RECORD_AUDIO izni verilmeden başlatılamaz.
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            JSObject result = new JSObject();
            result.put("started", false);
            result.put("reason", "no-microphone-permission");
            call.resolve(result);
            return;
        }

        Intent intent = new Intent(getContext(), VoiceCallService.class);
        intent.setAction(VoiceCallService.ACTION_START);
        intent.putExtra(VoiceCallService.EXTRA_TITLE, call.getString("title", "Sesli görüşme"));
        intent.putExtra(VoiceCallService.EXTRA_TEXT, call.getString("text", "Sauran"));
        intent.putExtra(VoiceCallService.EXTRA_MUTED, Boolean.TRUE.equals(call.getBoolean("muted", false)));

        try {
            ContextCompat.startForegroundService(getContext(), intent);
            JSObject result = new JSObject();
            result.put("started", true);
            call.resolve(result);
        } catch (RuntimeException error) {
            call.reject("Ön plan servisi başlatılamadı: " + error.getMessage());
        }
    }

    @PluginMethod
    public void setMuted(PluginCall call) {
        if (!VoiceCallService.running) { call.resolve(); return; }
        Intent intent = new Intent(getContext(), VoiceCallService.class);
        intent.setAction(VoiceCallService.ACTION_UPDATE);
        intent.putExtra(VoiceCallService.EXTRA_MUTED, Boolean.TRUE.equals(call.getBoolean("muted", false)));

        try {
            // ACTION_UPDATE yalnızca çalışan servisin bildirimini günceller (çalışmıyorsa yukarıda zaten çıkıldı).
            getContext().startService(intent);
        } catch (RuntimeException ignored) { /* servis çalışmıyor */ }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (!VoiceCallService.running) { call.resolve(); return; }
        Intent intent = new Intent(getContext(), VoiceCallService.class);
        intent.setAction(VoiceCallService.ACTION_STOP);
        try {
            getContext().startService(intent);
        } catch (RuntimeException ignored) { /* servis zaten çalışmıyor */ }
        call.resolve();
    }
}
