package com.essaallaith.audio

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import androidx.media.app.NotificationCompat.MediaStyle
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * جسر أوامر الإشعار (السابق / تشغيل-إيقاف / التالي) إلى واجهة الويب داخل التطبيق
 */
object MediaCommandBus {
    @Volatile
    var listener: ((String) -> Unit)? = null

    fun dispatch(action: String) {
        listener?.invoke(action)
    }
}

/**
 * خدمة أمامية للتشغيل في الخلفية + إشعار وسائط كامل (غلاف الزامل + أزرار تحكم + شاشة القفل)
 * يعمل على Android 7.0 – Android 15+
 */
class AudioKeepAliveService : Service() {

    private var wakeLock: PowerManager.WakeLock? = null
    private var mediaSession: MediaSessionCompat? = null
    private val io = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())

    @Volatile private var title: String = ""
    @Volatile private var artist: String = "عيسى الليث"
    @Volatile private var coverUrl: String = ""
    @Volatile private var coverBitmap: Bitmap? = null
    @Volatile private var coverBitmapUrl: String? = null
    @Volatile private var isPlaying: Boolean = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        mediaSession = MediaSessionCompat(this, "EssaAllaithSession").apply {
            setCallback(object : MediaSessionCompat.Callback() {
                override fun onPlay() = MediaCommandBus.dispatch("play")
                override fun onPause() = MediaCommandBus.dispatch("pause")
                override fun onSkipToNext() = MediaCommandBus.dispatch("next")
                override fun onSkipToPrevious() = MediaCommandBus.dispatch("prev")
            })
            isActive = true
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null) {
            stopSelf()
            return START_NOT_STICKY
        }

        when (intent.action) {
            ACTION_STOP -> {
                releaseWakeLock()
                ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_PREV -> MediaCommandBus.dispatch("prev")
            ACTION_NEXT -> MediaCommandBus.dispatch("next")
            ACTION_TOGGLE -> MediaCommandBus.dispatch("toggle")
            else -> handleUpdate(intent)
        }
        return START_NOT_STICKY
    }

    private fun handleUpdate(intent: Intent) {
        title = intent.getStringExtra(EXTRA_TITLE)?.takeIf { it.isNotBlank() }
            ?: getString(R.string.app_name)
        artist = intent.getStringExtra(EXTRA_ARTIST)?.takeIf { it.isNotBlank() } ?: "عيسى الليث"
        isPlaying = intent.getBooleanExtra(EXTRA_PLAYING, true)

        val newCover = intent.getStringExtra(EXTRA_COVER).orEmpty()
        if (newCover != coverUrl) {
            coverUrl = newCover
            coverBitmap = null
            coverBitmapUrl = null
        }

        updateSession()
        publish()

        if (coverBitmapUrl != coverUrl || coverBitmap == null) {
            loadCoverAsync(coverUrl)
        }
    }

    /** يعرض الإشعار: أمامي أثناء التشغيل، وقابل للإزالة بالسحب عند الإيقاف المؤقت */
    private fun publish() {
        val notification = buildNotification()
        val serviceType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
        } else {
            0
        }

        // دائماً نستدعي startForeground أولاً (شرط startForegroundService في أندرويد)
        ServiceCompat.startForeground(this, NOTIF_ID, notification, serviceType)

        if (isPlaying) {
            acquireWakeLock()
        } else {
            releaseWakeLock()
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_DETACH)
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.notify(NOTIF_ID, notification)
        }
    }

    private fun buildNotification(): Notification {
        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val contentIntent = PendingIntent.getActivity(
            this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification_audio)
            .setContentTitle(title)
            .setContentText(artist)
            .setLargeIcon(coverBitmap)
            .setContentIntent(contentIntent)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setShowWhen(false)
            .setOngoing(isPlaying)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(
                android.R.drawable.ic_media_previous,
                "السابق",
                actionPending(ACTION_PREV, 1)
            )
            .addAction(
                if (isPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play,
                if (isPlaying) "إيقاف مؤقت" else "تشغيل",
                actionPending(ACTION_TOGGLE, 2)
            )
            .addAction(
                android.R.drawable.ic_media_next,
                "التالي",
                actionPending(ACTION_NEXT, 3)
            )

        val style = MediaStyle().setShowActionsInCompactView(0, 1, 2)
        mediaSession?.sessionToken?.let { style.setMediaSession(it) }
        builder.setStyle(style)

        return builder.build()
    }

    private fun actionPending(action: String, requestCode: Int): PendingIntent {
        val intent = Intent(this, AudioKeepAliveService::class.java).setAction(action)
        return PendingIntent.getService(
            this, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun updateSession() {
        val session = mediaSession ?: return
        val meta = MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, getString(R.string.app_name))
        coverBitmap?.let {
            meta.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, it)
            meta.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, it)
        }
        session.setMetadata(meta.build())

        val state = if (isPlaying) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED
        session.setPlaybackState(
            PlaybackStateCompat.Builder()
                .setActions(
                    PlaybackStateCompat.ACTION_PLAY or
                        PlaybackStateCompat.ACTION_PAUSE or
                        PlaybackStateCompat.ACTION_PLAY_PAUSE or
                        PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                        PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
                )
                .setState(state, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1f)
                .build()
        )
    }

    private fun decodeFallbackAppBitmap(): Bitmap? {
        return BitmapFactory.decodeResource(resources, R.drawable.ic_app_icon_fg)
            ?: BitmapFactory.decodeResource(resources, R.drawable.ic_app_icon)
    }

    /** تحميل غلاف الزامل (من أصول التطبيق المدمجة أو الإنترنت، مع صورة التطبيق كبديل) ثم تحديث الإشعار */
    private fun loadCoverAsync(url: String) {
        io.execute {
            val bitmap = try {
                loadBitmapForUrl(url)
            } catch (_: Exception) {
                null
            } ?: decodeFallbackAppBitmap()

            if (bitmap != null && url == coverUrl) {
                coverBitmap = bitmap
                coverBitmapUrl = url
                mainHandler.post {
                    updateSession()
                    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                    manager.notify(NOTIF_ID, buildNotification())
                }
            }
        }
    }

    private fun loadBitmapForUrl(url: String): Bitmap? {
        if (url.isBlank()) {
            return decodeFallbackAppBitmap()
        }
        if (url.startsWith("./offline/") || url.startsWith("offline/") || url.startsWith("/offline/")) {
            val cleanRel = url.removePrefix("./").removePrefix("/")
            return assets.open("www/$cleanRel").use { BitmapFactory.decodeStream(it) }
        }
        return downloadBitmap(url)
    }

    private fun downloadBitmap(url: String): Bitmap? {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 6000
        conn.readTimeout = 8000
        conn.instanceFollowRedirects = true
        return try {
            val bytes = conn.inputStream.use { it.readBytes() }
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
            var sample = 1
            while (bounds.outWidth / sample > 512) sample *= 2
            val opts = BitmapFactory.Options().apply { inSampleSize = sample }
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts)
        } finally {
            conn.disconnect()
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.playback_channel_name),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = getString(R.string.playback_channel_desc)
                setShowBadge(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun acquireWakeLock() {
        try {
            if (wakeLock == null) {
                val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "EssaAllaith::AudioWakeLock")
                wakeLock?.setReferenceCounted(false)
            }
            if (wakeLock?.isHeld == false) {
                wakeLock?.acquire(4L * 60L * 60L * 1000L) // حد أمان 4 ساعات
            }
        } catch (_: Exception) {
            // تجاهل
        }
    }

    private fun releaseWakeLock() {
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
            }
        } catch (_: Exception) {
            // تجاهل
        }
    }

    override fun onDestroy() {
        releaseWakeLock()
        try {
            mediaSession?.isActive = false
            mediaSession?.release()
        } catch (_: Exception) {
            // تجاهل
        }
        mediaSession = null
        io.shutdownNow()
        try {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.cancel(NOTIF_ID)
        } catch (_: Exception) {
            // تجاهل
        }
        super.onDestroy()
    }

    companion object {
        private const val CHANNEL_ID = "essa_allaith_playback"
        private const val NOTIF_ID = 1447
        private const val ACTION_UPDATE = "com.essaallaith.audio.ACTION_UPDATE"
        private const val ACTION_STOP = "com.essaallaith.audio.ACTION_STOP"
        private const val ACTION_PREV = "com.essaallaith.audio.ACTION_PREV"
        private const val ACTION_NEXT = "com.essaallaith.audio.ACTION_NEXT"
        private const val ACTION_TOGGLE = "com.essaallaith.audio.ACTION_TOGGLE"
        private const val EXTRA_TITLE = "extra_title"
        private const val EXTRA_ARTIST = "extra_artist"
        private const val EXTRA_COVER = "extra_cover"
        private const val EXTRA_PLAYING = "extra_playing"

        fun update(
            context: Context,
            title: String,
            artist: String,
            coverUrl: String,
            isPlaying: Boolean
        ) {
            val intent = Intent(context, AudioKeepAliveService::class.java).apply {
                action = ACTION_UPDATE
                putExtra(EXTRA_TITLE, title)
                putExtra(EXTRA_ARTIST, artist)
                putExtra(EXTRA_COVER, coverUrl)
                putExtra(EXTRA_PLAYING, isPlaying)
            }
            ContextCompat.startForegroundService(context, intent)
        }

        fun start(context: Context, title: String) {
            update(context, title, "عيسى الليث", "", true)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, AudioKeepAliveService::class.java))
        }
    }
}
