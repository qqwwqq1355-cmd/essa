# الحفاظ على جسور JavaScript الخاصة بالمشغّل الخلفي وحفظ بطاقات الأبيات في نسخة الإنتاج
-keepattributes *Annotation*
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.essaallaith.audio.** { *; }

