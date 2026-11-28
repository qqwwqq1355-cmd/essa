package com.essaallaith.audio

import android.Manifest
import android.annotation.SuppressLint
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.view.Gravity
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import com.google.firebase.messaging.FirebaseMessaging
import java.io.File
import java.io.FileOutputStream

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var topBannerContainer: FrameLayout? = null
    private var admobBannerView: AdView? = null
    private var admobInterstitial: InterstitialAd? = null
    private var admobRewarded: RewardedAd? = null
    private var lastInterstitialShownAt: Long = 0L
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null

    private val openAudioLauncher =
        registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
            val result = if (uri != null) arrayOf(uri) else null
            fileChooserCallback?.onReceiveValue(result)
            fileChooserCallback = null
        }

    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { _ -> }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        requestNotificationPermissionIfNeeded()

        // الاشتراك التلقائي في إشعارات الزوامل الجديدة (Firebase Topic)
        try {
            FirebaseMessaging.getInstance().subscribeToTopic("new_tracks")
        } catch (_: Exception) {
            // تجاهل إذا لم تكن خدمات جوجل متوفرة على الجهاز
        }

        // تهيئة شبكة إعلانات Google AdMob
        initAdMob()

        // ربط أزرار الإشعار (السابق / تشغيل-إيقاف / التالي) بالتطبيق
        MediaCommandBus.listener = { action ->
            runOnUiThread {
                if (::webView.isInitialized) {
                    webView.evaluateJavascript(
                        "window.__nativeMediaAction && window.__nativeMediaAction('$action')",
                        null
                    )
                }
            }
        }

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#0A0C10"))
            overScrollMode = WebView.OVER_SCROLL_NEVER

            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                mediaPlaybackRequiresUserGesture = false
                cacheMode = WebSettings.LOAD_DEFAULT
                allowFileAccess = false
                allowContentAccess = true
                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            }

            addJavascriptInterface(AndroidBridge(), "AndroidBridge")

            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest
                ): WebResourceResponse? {
                    if (request.url.host == ASSET_HOST) {
                        return assetLoader.shouldInterceptRequest(request.url)
                    }
                    return null
                }

                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest
                ): Boolean {
                    val uri = request.url
                    if (uri.host != ASSET_HOST) {
                        try {
                            startActivity(Intent(Intent.ACTION_VIEW, uri))
                        } catch (_: Exception) {
                            // تجاهل إذا لم يوجد تطبيق مناسب
                        }
                        return true
                    }
                    return false
                }
            }

            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    webView: WebView?,
                    filePathCallback: ValueCallback<Array<Uri>>?,
                    fileChooserParams: FileChooserParams?
                ): Boolean {
                    fileChooserCallback?.onReceiveValue(null)
                    fileChooserCallback = filePathCallback
                    return try {
                        openAudioLauncher.launch(arrayOf("audio/*"))
                        true
                    } catch (_: Exception) {
                        fileChooserCallback = null
                        false
                    }
                }
            }
        }

        // تخطيط عمودي يضع الـ WebView بالأعلى وبنر Unity Ads الأصلي أسفله بسلاسة
        val rootLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#0A0C10"))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.MATCH_PARENT
            )
        }

        val bannerHolder = FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#0A0C10"))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }
        topBannerContainer = bannerHolder

        webView.layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            0,
            1f
        )
        rootLayout.addView(webView)
        rootLayout.addView(bannerHolder)
        setContentView(rootLayout)
        val initialTrackId = intent?.getStringExtra("trackId")
        val initialUrl = if (!initialTrackId.isNullOrBlank()) {
            "https://$ASSET_HOST/www/index.html?trackId=${Uri.encode(initialTrackId)}"
        } else {
            "https://$ASSET_HOST/www/index.html"
        }
        webView.loadUrl(initialUrl)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript("window.handleAppBack ? window.handleAppBack() : false") { result ->
                    if (result != "true") {
                        // تصغير التطبيق بسلاسة دون إيقاف الصوت في الخلفية
                        moveTaskToBack(true)
                    }
                }
            }
        })
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val trackId = intent.getStringExtra("trackId")
        if (!trackId.isNullOrBlank() && ::webView.isInitialized) {
            val safeId = trackId.replace("'", "")
            runOnUiThread {
                webView.evaluateJavascript(
                    "window.__openTrackFromNotification && window.__openTrackFromNotification('$safeId')",
                    null
                )
            }
        }
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    override fun onDestroy() {
        MediaCommandBus.listener = null
        try {
            AudioKeepAliveService.stop(this)
        } catch (_: Exception) {
            // تجاهل
        }
        webView.destroy()
        super.onDestroy()
    }

    inner class AndroidBridge {
        @JavascriptInterface
        fun updateNowPlaying(title: String, artist: String, coverUrl: String, isPlaying: Boolean) {
            try {
                AudioKeepAliveService.update(this@MainActivity, title, artist, coverUrl, isPlaying)
            } catch (_: Exception) {
                // تجاهل إذا منع النظام الخدمة الأمامية
            }
        }

        @JavascriptInterface
        fun onPlaybackStateChanged(isPlaying: Boolean, title: String) {
            runOnUiThread {
                try {
                    if (isPlaying) {
                        AudioKeepAliveService.start(this@MainActivity, title)
                    } else {
                        AudioKeepAliveService.stop(this@MainActivity)
                    }
                } catch (_: Exception) {
                    // تجاهل إذا منع النظام الخدمة الأمامية
                }
            }
        }

        @JavascriptInterface
        fun saveBase64Png(dataUrl: String, fileName: String) {
            try {
                val base64Part = dataUrl.substringAfter("base64,", dataUrl)
                val bytes = Base64.decode(base64Part, Base64.DEFAULT)
                val safeName = fileName.ifBlank { "issa-allaith-card.png" }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val values = ContentValues().apply {
                        put(MediaStore.Images.Media.DISPLAY_NAME, safeName)
                        put(MediaStore.Images.Media.MIME_TYPE, "image/png")
                        put(MediaStore.Images.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/IssaAllaith")
                    }
                    val uri = contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
                    if (uri != null) {
                        contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
                    }
                } else {
                    val dir = getExternalFilesDir(Environment.DIRECTORY_PICTURES) ?: filesDir
                    if (!dir.exists()) dir.mkdirs()
                    FileOutputStream(File(dir, safeName)).use { it.write(bytes) }
                }

                runOnUiThread {
                    Toast.makeText(
                        this@MainActivity,
                        "تم حفظ بطاقة الأبيات في المعرض",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            } catch (_: Exception) {
                runOnUiThread {
                    Toast.makeText(
                        this@MainActivity,
                        "تعذّر حفظ البطاقة حالياً",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
        }

        @JavascriptInterface
        fun requestNotificationPermission() {
            runOnUiThread {
                requestNotificationPermissionIfNeeded()
            }
        }

        @JavascriptInterface
        fun setTopBannerVisible(visible: Boolean) {
            runOnUiThread {
                topBannerContainer?.visibility = if (visible) View.VISIBLE else View.GONE
            }
        }

        @JavascriptInterface
        fun showInterstitialAd() {
            runOnUiThread {
                val now = System.currentTimeMillis()
                if (now - lastInterstitialShownAt < 120_000L) return@runOnUiThread
                val ad = admobInterstitial
                if (ad == null) {
                    loadAdMobInterstitial()
                    return@runOnUiThread
                }
                try {
                    lastInterstitialShownAt = now
                    admobInterstitial = null
                    ad.fullScreenContentCallback = object : FullScreenContentCallback() {
                        override fun onAdDismissedFullScreenContent() {
                            loadAdMobInterstitial()
                        }
                    }
                    ad.show(this@MainActivity)
                } catch (_: Exception) {
                    loadAdMobInterstitial()
                }
            }
        }

        @JavascriptInterface
        fun showRewardedAd(callbackId: String) {
            runOnUiThread {
                val safeId = callbackId.replace("'", "")
                val deliverReward = {
                    if (::webView.isInitialized) {
                        webView.evaluateJavascript(
                            "window.__onRewardedAdResult && window.__onRewardedAdResult('$safeId', true)",
                            null
                        )
                    }
                }
                val ad = admobRewarded
                if (ad == null) {
                    loadAdMobRewarded()
                    deliverReward()
                    return@runOnUiThread
                }
                try {
                    admobRewarded = null
                    ad.fullScreenContentCallback = object : FullScreenContentCallback() {
                        override fun onAdDismissedFullScreenContent() {
                            loadAdMobRewarded()
                            deliverReward()
                        }
                    }
                    ad.show(this@MainActivity) {
                        // المستخدم أكمل مشاهدة إعلان المكافأة
                    }
                } catch (_: Exception) {
                    loadAdMobRewarded()
                    deliverReward()
                }
            }
        }

        @JavascriptInterface
        fun exitApp() {
            runOnUiThread {
                finishAndRemoveTask()
            }
        }

        @JavascriptInterface
        fun saveBase64Mp3(dataUrl: String, fileName: String) {
            try {
                val base64Part = dataUrl.substringAfter("base64,", dataUrl)
                val bytes = Base64.decode(base64Part, Base64.DEFAULT)
                val cleanName = fileName.ifBlank { "زامل_عيسى_الليث.mp3" }
                val finalName = if (cleanName.endsWith(".mp3", ignoreCase = true)) cleanName else "$cleanName.mp3"

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val values = ContentValues().apply {
                        put(MediaStore.Audio.Media.DISPLAY_NAME, finalName)
                        put(MediaStore.Audio.Media.MIME_TYPE, "audio/mpeg")
                        put(MediaStore.Audio.Media.ARTIST, "عيسى الليث")
                        put(MediaStore.Audio.Media.IS_MUSIC, 1)
                        put(
                            MediaStore.Audio.Media.RELATIVE_PATH,
                            "${Environment.DIRECTORY_MUSIC}/عيسى الليث"
                        )
                    }
                    val uri = contentResolver.insert(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, values)
                    if (uri != null) {
                        contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
                    }
                } else {
                    @Suppress("DEPRECATION")
                    val musicRoot = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC)
                    val dir = File(musicRoot, "عيسى الليث")
                    if (!dir.exists()) dir.mkdirs()
                    val outFile = File(dir, finalName)
                    FileOutputStream(outFile).use { it.write(bytes) }
                    MediaScannerConnection.scanFile(
                        this@MainActivity,
                        arrayOf(outFile.absolutePath),
                        arrayOf("audio/mpeg"),
                        null
                    )
                }

                runOnUiThread {
                    Toast.makeText(
                        this@MainActivity,
                        "تم حفظ الزامل في مجلد: الموسيقى / عيسى الليث",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            } catch (_: Exception) {
                runOnUiThread {
                    Toast.makeText(
                        this@MainActivity,
                        "تعذّر حفظ الزامل في ذاكرة الجهاز",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
        }
    }

    private fun initAdMob() {
        try {
            MobileAds.initialize(this) {
                runOnUiThread {
                    loadAdMobBanner()
                    loadAdMobInterstitial()
                    loadAdMobRewarded()
                }
            }
        } catch (_: Exception) {
            // تجاهل
        }
    }

    private fun loadAdMobBanner() {
        val holder = topBannerContainer ?: return
        try {
            admobBannerView?.destroy()
            val adView = AdView(this).apply {
                adUnitId = ADMOB_BANNER_ID
                setAdSize(AdSize.BANNER)
            }
            admobBannerView = adView
            holder.removeAllViews()
            val params = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER_HORIZONTAL
            )
            holder.addView(adView, params)
            adView.loadAd(AdRequest.Builder().build())
        } catch (_: Exception) {
            // تجاهل
        }
    }

    private fun loadAdMobInterstitial() {
        try {
            InterstitialAd.load(
                this,
                ADMOB_INTERSTITIAL_ID,
                AdRequest.Builder().build(),
                object : InterstitialAdLoadCallback() {
                    override fun onAdLoaded(ad: InterstitialAd) {
                        admobInterstitial = ad
                    }

                    override fun onAdFailedToLoad(error: LoadAdError) {
                        admobInterstitial = null
                    }
                }
            )
        } catch (_: Exception) {
            // تجاهل
        }
    }

    private fun loadAdMobRewarded() {
        try {
            RewardedAd.load(
                this,
                ADMOB_REWARDED_ID,
                AdRequest.Builder().build(),
                object : RewardedAdLoadCallback() {
                    override fun onAdLoaded(ad: RewardedAd) {
                        admobRewarded = ad
                    }

                    override fun onAdFailedToLoad(error: LoadAdError) {
                        admobRewarded = null
                    }
                }
            )
        } catch (_: Exception) {
            // تجاهل
        }
    }

    companion object {
        private const val ASSET_HOST = "appassets.androidplatform.net"
        private const val ADMOB_BANNER_ID = "ca-app-pub-8298073076766088/5200835609"
        private const val ADMOB_INTERSTITIAL_ID = "ca-app-pub-8298073076766088/6322345586"
        private const val ADMOB_REWARDED_ID = "ca-app-pub-8298073076766088/9631035208"
    }
}

