package online.sauran.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

/**
 * Sesli oda / arama sürerken çalışan ön plan (foreground) servisi.
 *
 * Android, uygulama arka plana alınınca ya da ekran kapanınca mikrofonu ve ağı kısıtlar.
 * "microphone" türünde bir ön plan servisi ve kalıcı bildirim, bu süre boyunca uygulamanın
 * (dolayısıyla WebView'daki WebRTC bağlantısının) mikrofonu kullanmaya devam etmesini sağlar.
 * Servis yalnızca web uygulaması bir görüşmeye katıldığında başlatılır, ayrılınca durdurulur.
 */
public class VoiceCallService extends Service {

    public static final String ACTION_START = "online.sauran.app.VOICE_START";
    public static final String ACTION_STOP = "online.sauran.app.VOICE_STOP";
    public static final String ACTION_UPDATE = "online.sauran.app.VOICE_UPDATE";

    /** Bildirimdeki düğmelerden uygulamaya (plugin'e) gönderilen yayın. */
    public static final String BROADCAST_ACTION = "online.sauran.app.VOICE_ACTION";
    public static final String EXTRA_TYPE = "type";
    public static final String TYPE_LEAVE = "leave";
    public static final String TYPE_TOGGLE_MIC = "toggle_mic";

    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_TEXT = "text";
    public static final String EXTRA_MUTED = "muted";

    private static final String CHANNEL_ID = "sauran_voice_call";
    private static final int NOTIFICATION_ID = 4201;
    // Unutulmuş bir servis pili bitirmesin: en fazla 6 saat sonra wake lock kendiliğinden bırakılır.
    private static final long WAKE_LOCK_TIMEOUT_MS = 6L * 60L * 60L * 1000L;

    /** Servis şu an ön planda çalışıyor mu (plugin, çalışmayan servisi yeniden başlatmasın diye). */
    public static volatile boolean running = false;

    private PowerManager.WakeLock wakeLock;
    private String title = "Sesli görüşme";
    private String text = "Sauran";
    private boolean muted = false;

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;

        if (ACTION_STOP.equals(action)) {
            running = false;
            releaseWakeLock();
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }

        if (intent != null) {
            if (intent.hasExtra(EXTRA_TITLE)) title = intent.getStringExtra(EXTRA_TITLE);
            if (intent.hasExtra(EXTRA_TEXT)) text = intent.getStringExtra(EXTRA_TEXT);
            if (intent.hasExtra(EXTRA_MUTED)) muted = intent.getBooleanExtra(EXTRA_MUTED, false);
        }

        Notification notification = buildNotification();

        if (ACTION_UPDATE.equals(action)) {
            if (!running) { stopSelf(); return START_NOT_STICKY; }
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) manager.notify(NOTIFICATION_ID, notification);
            return START_NOT_STICKY;
        }

        startInForeground(notification);
        running = true;
        acquireWakeLock();

        // Sistem servisi öldürürse kendiliğinden yeniden başlatma: web uygulaması görüşmeyi yeniden kurar.
        return START_NOT_STICKY;
    }

    private void startInForeground(Notification notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private Notification buildNotification() {
        createChannel();

        Intent open = new Intent(this, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
                this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_voice)
                .setContentTitle(title)
                .setContentText(text)
                .setContentIntent(contentIntent)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .addAction(0, muted ? "Mikrofonu aç" : "Sustur", actionIntent(TYPE_TOGGLE_MIC, 1))
                .addAction(0, "Ayrıl", actionIntent(TYPE_LEAVE, 2));

        return builder.build();
    }

    private PendingIntent actionIntent(String type, int requestCode) {
        Intent intent = new Intent(BROADCAST_ACTION)
                .setPackage(getPackageName())
                .putExtra(EXTRA_TYPE, type);
        return PendingIntent.getBroadcast(this, requestCode, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;

        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Sesli görüşme", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Sesli odadayken ya da aramadayken gösterilir.");
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
    }

    private void acquireWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) return;
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm == null) return;
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Sauran:VoiceCall");
        wakeLock.setReferenceCounted(false);
        wakeLock.acquire(WAKE_LOCK_TIMEOUT_MS);
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        wakeLock = null;
    }

    @Override
    public void onDestroy() {
        running = false;
        releaseWakeLock();
        super.onDestroy();
    }
}
