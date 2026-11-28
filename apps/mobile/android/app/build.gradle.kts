import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
}

val keystorePropsFile = rootProject.file("keystore/keystore.properties")
val keystoreProps = Properties().apply {
    if (keystorePropsFile.exists()) {
        keystorePropsFile.inputStream().use { load(it) }
    }
}

val releaseStorePath = System.getenv("ANDROID_KEYSTORE_PATH")
    ?: keystoreProps.getProperty("storeFile")
    ?: "keystore/essa-release.keystore"
val releaseStorePassword = System.getenv("ANDROID_STORE_PASSWORD")
    ?: keystoreProps.getProperty("storePassword")
    ?: ""
val releaseKeyAlias = System.getenv("ANDROID_KEY_ALIAS")
    ?: keystoreProps.getProperty("keyAlias")
    ?: "essa_release"
val releaseKeyPassword = System.getenv("ANDROID_KEY_PASSWORD")
    ?: keystoreProps.getProperty("keyPassword")
    ?: ""

android {
    namespace = "com.essaallaith.audio"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.essaalleth.app"
        minSdk = 24
        targetSdk = 35
        versionCode = 2
        versionName = "1.1.0"
        resourceConfigurations += listOf("ar", "en")
        vectorDrawables.useSupportLibrary = true
    }

    signingConfigs {
        create("release") {
            val ksFile = rootProject.file(releaseStorePath)
            if (ksFile.exists() && releaseStorePassword.isNotBlank()) {
                storeFile = ksFile
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
                enableV1Signing = true
                enableV2Signing = true
                enableV3Signing = true
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            val relSigning = signingConfigs.getByName("release")
            if (relSigning.storeFile != null) {
                signingConfig = relSigning
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.media:media:1.7.0")
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-messaging-ktx")
    implementation("com.unity3d.ads:unity-ads:4.12.2")
}
