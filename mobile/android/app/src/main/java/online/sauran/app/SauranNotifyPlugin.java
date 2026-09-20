package online.sauran.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Uygulama arka plandayken (ama çalışırken) mesaj / arama / istek bildirimlerini sistem
 * bildirim çubuğunda gösteren köprü. Uygulama tamamen kapalıyken bildirim için ayrıca
 * sunucudan gönderilen push (FCM) gerekir.
 *
 * JS tarafı:
 *   SauranNotify.requestPermission()                 -> { granted }
 *   SauranNotify.notify({ title, body, tag, url })   -> { shown }
 *   SauranNotify.cancel({ tag })
 *   SauranNotify.addListener('tap', e => …)          -> e.url (bildirime dokunulunca)
 */
@CapacitorPlugin(
        name = "SauranNotify",
        permissions = {
                @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
        }
)
public class SauranNotifyPlugin extends Plugin {

    public static final String EXTRA_URL = "sauran_url";
    private static final String CHANNEL_ID = "sauran_messages";
    private static final int NOTIFICATION_ID = 1;

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "onPermissionResult");
            return;
        }
        resolveState(call);
    }

    @PermissionCallback
    private void onPermissionResult(PluginCall call) {
        resolveState(call);
    }

    private void resolveState(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", NotificationManagerCompat.from(getContext()).areNotificationsEnabled());
        call.resolve(result);
    }

    @PluginMethod
    public void notify(PluginCall call) {
        Context context = getContext();
        JSObject result = new JSObject();

        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) {
            result.put("shown", false);
            call.resolve(result);
            return;
        }

        createChannel(context);

        String tag = call.getString("tag", "sauran");
        String url = call.getString("url", "/");

        Intent open = new Intent(context, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra(EXTRA_URL, url);
        PendingIntent contentIntent = PendingIntent.getActivity(
                context, Math.abs(tag.hashCode()), open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        boolean isCall = "call".equals(tag);
        String body = call.getString("body", "");

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_message)
                .setContentTitle(call.getString("title", "Sauran"))
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setContentIntent(contentIntent)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(isCall ? NotificationCompat.CATEGORY_CALL : NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE);

        try {
            NotificationManagerCompat.from(context).notify(tag, NOTIFICATION_ID, builder.build());
            result.put("shown", true);
        } catch (SecurityException error) {
            result.put("shown", false);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        String tag = call.getString("tag");
        if (tag != null) NotificationManagerCompat.from(getContext()).cancel(tag, NOTIFICATION_ID);
        call.resolve();
    }

    /**
     * Uygulamanın ön/arka plan durumunu Activity yaşam döngüsünden bildirir. WebView'da document.hasFocus() /
     * visibilityState arka planda güvenilir değildir; bildirim gösterme kararı bu bilgiye dayanır.
     */
    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        JSObject data = new JSObject();
        data.put("active", false);
        notifyListeners("appState", data, true);
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        JSObject data = new JSObject();
        data.put("active", true);
        notifyListeners("appState", data, true);
    }

    /** Uygulama açıkken bir bildirime dokunulduğunda (singleTask -> onNewIntent). */
    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (intent == null) return;

        String url = intent.getStringExtra(EXTRA_URL);
        if (url == null) return;

        JSObject data = new JSObject();
        data.put("url", url);
        notifyListeners("tap", data, true);
    }

    private void createChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;

        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Mesajlar ve aramalar", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Yeni mesaj, arkadaşlık isteği ve gelen arama bildirimleri.");
        manager.createNotificationChannel(channel);
    }
}
