package online.sauran.app;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.media.AudioDeviceCallback;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
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

    // ── Ses yönlendirme (hoparlör / ahize / Bluetooth / kablolu / USB) ve yakınlık algılama ──
    // Yalnızca görüşme sırasında ve kullanıcı bir rota seçtiğinde ses modunu değiştirir; görüşme bitince eski hâline döner.
    private AudioManager audioManager;
    private AudioDeviceCallback deviceCallback;
    private PowerManager.WakeLock proximityLock;
    private boolean modeChanged = false;
    private int previousMode = AudioManager.MODE_NORMAL;

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

        audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        if (audioManager != null) {
            deviceCallback = new AudioDeviceCallback() {
                @Override public void onAudioDevicesAdded(AudioDeviceInfo[] added) { notifyListeners("audioRoutesChanged", new JSObject()); }
                @Override public void onAudioDevicesRemoved(AudioDeviceInfo[] removed) { notifyListeners("audioRoutesChanged", new JSObject()); }
            };
            audioManager.registerAudioDeviceCallback(deviceCallback, new Handler(Looper.getMainLooper()));
        }
    }

    @Override
    protected void handleOnDestroy() {
        restoreAudioRouting();
        if (audioManager != null && deviceCallback != null) {
            try { audioManager.unregisterAudioDeviceCallback(deviceCallback); } catch (RuntimeException ignored) { /* kayıtlı değil */ }
            deviceCallback = null;
        }
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
        restoreAudioRouting();
        if (!VoiceCallService.running) { call.resolve(); return; }
        Intent intent = new Intent(getContext(), VoiceCallService.class);
        intent.setAction(VoiceCallService.ACTION_STOP);
        try {
            getContext().startService(intent);
        } catch (RuntimeException ignored) { /* servis zaten çalışmıyor */ }
        call.resolve();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Ses rotaları
    // ─────────────────────────────────────────────────────────────────────────

    private static String routeType(AudioDeviceInfo d) {
        switch (d.getType()) {
            case AudioDeviceInfo.TYPE_BUILTIN_SPEAKER: return "speaker";
            case AudioDeviceInfo.TYPE_BUILTIN_EARPIECE: return "earpiece";
            case AudioDeviceInfo.TYPE_BLUETOOTH_SCO: return "bluetooth";
            case AudioDeviceInfo.TYPE_WIRED_HEADSET:
            case AudioDeviceInfo.TYPE_WIRED_HEADPHONES: return "wired";
            case AudioDeviceInfo.TYPE_USB_HEADSET:
            case AudioDeviceInfo.TYPE_USB_DEVICE: return "usb";
            default:
                if (Build.VERSION.SDK_INT >= 31 && d.getType() == AudioDeviceInfo.TYPE_BLE_HEADSET) return "bluetooth";
                return null;
        }
    }

    /** Görüşme sırasında seçilebilecek çıkış aygıtları (yalnızca tanınan türler). */
    private java.util.List<AudioDeviceInfo> candidateDevices() {
        java.util.List<AudioDeviceInfo> out = new java.util.ArrayList<>();
        if (audioManager == null) return out;
        if (Build.VERSION.SDK_INT >= 31) {
            for (AudioDeviceInfo d : audioManager.getAvailableCommunicationDevices()) if (routeType(d) != null) out.add(d);
        } else {
            for (AudioDeviceInfo d : audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) if (routeType(d) != null) out.add(d);
        }
        return out;
    }

    private String activeRouteId(java.util.List<AudioDeviceInfo> devices) {
        if (audioManager == null) return null;
        if (modeChanged) {
            if (Build.VERSION.SDK_INT >= 31) {
                AudioDeviceInfo current = audioManager.getCommunicationDevice();
                if (current != null) return String.valueOf(current.getId());
            } else {
                String wanted = audioManager.isSpeakerphoneOn() ? "speaker" : (audioManager.isBluetoothScoOn() ? "bluetooth" : null);
                for (AudioDeviceInfo d : devices) {
                    String type = routeType(d);
                    if (wanted != null ? wanted.equals(type) : ("wired".equals(type) || "usb".equals(type) || "earpiece".equals(type))) return String.valueOf(d.getId());
                }
            }
        }
        // Henüz rota seçilmedi: WebView sesi varsayılan olarak hoparlörden çalar.
        for (AudioDeviceInfo d : devices) if ("speaker".equals(routeType(d))) return String.valueOf(d.getId());
        return devices.isEmpty() ? null : String.valueOf(devices.get(0).getId());
    }

    @PluginMethod
    public void getAudioRoutes(PluginCall call) {
        if (audioManager == null) { call.reject("AudioManager yok"); return; }
        java.util.List<AudioDeviceInfo> devices = candidateDevices();
        JSArray routes = new JSArray();
        for (AudioDeviceInfo d : devices) {
            JSObject route = new JSObject();
            route.put("id", String.valueOf(d.getId()));
            route.put("type", routeType(d));
            CharSequence name = d.getProductName();
            route.put("name", name == null ? "" : name.toString());
            routes.put(route);
        }
        JSObject result = new JSObject();
        result.put("routes", routes);
        result.put("active", activeRouteId(devices));
        call.resolve(result);
    }

    @PluginMethod
    public void setAudioRoute(PluginCall call) {
        if (audioManager == null) { call.reject("AudioManager yok"); return; }
        String id = call.getString("id");
        AudioDeviceInfo target = null;
        for (AudioDeviceInfo d : candidateDevices()) if (String.valueOf(d.getId()).equals(id)) { target = d; break; }
        if (target == null) { call.reject("Rota bulunamadı"); return; }

        try {
            if (!modeChanged) {
                previousMode = audioManager.getMode();
                audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
                modeChanged = true;
            }

            String type = routeType(target);
            boolean ok = true;
            if (Build.VERSION.SDK_INT >= 31) {
                ok = audioManager.setCommunicationDevice(target);
            } else if ("bluetooth".equals(type)) {
                audioManager.setSpeakerphoneOn(false);
                audioManager.startBluetoothSco();
                audioManager.setBluetoothScoOn(true);
            } else {
                audioManager.stopBluetoothSco();
                audioManager.setBluetoothScoOn(false);
                audioManager.setSpeakerphoneOn("speaker".equals(type));
            }

            // WhatsApp benzeri: yalnızca ahize seçiliyken ekran kulağa yaklaşınca kapanır.
            setProximity("earpiece".equals(type));

            JSObject result = new JSObject();
            result.put("active", String.valueOf(target.getId()));
            result.put("applied", ok);
            call.resolve(result);
        } catch (RuntimeException error) {
            call.reject("Ses rotası değiştirilemedi: " + error.getMessage());
        }
    }

    private void setProximity(boolean enabled) {
        try {
            if (enabled) {
                if (proximityLock == null) {
                    PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
                    if (pm == null || !pm.isWakeLockLevelSupported(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK)) return; // cihazda yakınlık sensörü yok
                    proximityLock = pm.newWakeLock(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK, "Sauran:Proximity");
                    proximityLock.setReferenceCounted(false);
                }
                if (!proximityLock.isHeld()) proximityLock.acquire(6L * 60L * 60L * 1000L);
            } else if (proximityLock != null && proximityLock.isHeld()) {
                proximityLock.release();
            }
        } catch (RuntimeException ignored) { /* yakınlık kilidi alınamadı: ses yönlendirmesi yine çalışır */ }
    }

    /** Görüşme bitince/eklenti kapanınca ses modunu ve rotayı eski hâline getirir; yakınlık kilidini bırakır. */
    private void restoreAudioRouting() {
        setProximity(false);
        if (audioManager == null || !modeChanged) return;
        try {
            if (Build.VERSION.SDK_INT >= 31) {
                audioManager.clearCommunicationDevice();
            } else {
                audioManager.stopBluetoothSco();
                audioManager.setBluetoothScoOn(false);
                audioManager.setSpeakerphoneOn(false);
            }
            audioManager.setMode(previousMode);
        } catch (RuntimeException ignored) { /* zaten eski hâlde */ }
        modeChanged = false;
    }
}
