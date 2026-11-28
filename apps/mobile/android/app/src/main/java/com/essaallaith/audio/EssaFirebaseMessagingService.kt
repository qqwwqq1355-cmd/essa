package com.essaallaith.audio

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import java.net.HttpURLConnection
import java.net.URL

class EssaFirebaseMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        val data = remoteMessage.data
        val trackId = data["trackId"] ?: ""
        val title = remoteMessage.notification?.title
            ?: data["title"]
            ?: "🔥 زامل جديد — عيسى الليث"
        val body = remoteMessage.notification?.body
            ?: data["body"]
            ?: "استمع الآن إلى الزامل الجديد مع الكلمات كاملة"
        val imageUrl = remoteMessage.notification?.imageUrl?.toString()
            ?: data["image"]

        showRichNotification(title, body, trackId, imageUrl)
    }

    private fun showRichNotification(
        title: String,
        body: String,
        trackId: String,
        imageUrl: String?
    ) {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        ensureChannel(manager)

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            if (trackId.isNotBlank()) {
                putExtra("trackId", trackId)
            }
        }

        val pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT or
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
        val pendingIntent = PendingIntent.getActivity(
            this,
            trackId.hashCode(),
            intent,
            pendingFlags
        )

        val appIconBitmap = BitmapFactory.decodeResource(resources, R.drawable.ic_app_icon)
        val coverBitmap = downloadBitmap(imageUrl)

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_app_icon)
            .setLargeIcon(coverBitmap ?: appIconBitmap)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setContentIntent(pendingIntent)

        if (coverBitmap != null) {
            builder.setStyle(
                NotificationCompat.BigPictureStyle()
                    .bigPicture(coverBitmap)
                    .bigLargeIcon(appIconBitmap)
                    .setSummaryText(body)
            )
        } else {
            builder.setStyle(NotificationCompat.BigTextStyle().bigText(body))
        }

        val notifId = if (trackId.isNotBlank()) trackId.hashCode() else System.currentTimeMillis().toInt()
        manager.notify(notifId, builder.build())
    }

    private fun downloadBitmap(urlStr: String?): Bitmap? {
        if (urlStr.isNullOrBlank()) return null
        return try {
            val conn = URL(urlStr).openConnection() as HttpURLConnection
            conn.connectTimeout = 5000
            conn.readTimeout = 5000
            conn.doInput = true
            conn.connect()
            conn.inputStream.use { BitmapFactory.decodeStream(it) }
        } catch (_: Exception) {
            null
        }
    }

    private fun ensureChannel(manager: NotificationManager) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "زوامل جديدة — عيسى الليث",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "إشعارات فورية عند صدور زامل جديد في قناة عيسى الليث"
                enableVibration(true)
            }
            manager.createNotificationChannel(channel)
        }
    }

    companion object {
        const val CHANNEL_ID = "new_tracks"
    }
}

