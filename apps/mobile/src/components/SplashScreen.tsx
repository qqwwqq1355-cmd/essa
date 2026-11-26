import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FONTS } from '../theme/tokens';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [progress, setProgress] = useState(18);
  const [fading, setFading] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setProgress(62), 180);
    const t2 = setTimeout(() => setProgress(100), 620);
    const t3 = setTimeout(() => setFading(true), 920);
    const t4 = setTimeout(() => onFinish(), 1260);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [onFinish]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'radial-gradient(circle at 50% 35%, #1A2418 0%, #0D120D 55%, #070908 100%)',
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.34s ease-out',
        pointerEvents: fading ? 'none' : 'auto',
        overflow: 'hidden',
      }}
    >
      {/* شبكة تكتيكية عسكرية خفيفة جداً في الخلفية */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(212,168,83,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(212,168,83,0.05) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
          pointerEvents: 'none',
        }}
      />

      {/* زوايا إطار عسكري تكتيكي */}
      <View style={styles.frameBox}>
        <View style={[styles.corner, styles.cornerTL]} />
        <View style={[styles.corner, styles.cornerTR]} />
        <View style={[styles.corner, styles.cornerBL]} />
        <View style={[styles.corner, styles.cornerBR]} />

        {/* الشعار الدائري */}
        <View style={styles.emblemRing}>
          {!imgError ? (
            <img
              src="/app-icon.jpg"
              alt="عيسى الليث"
              onError={() => setImgError(true)}
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                objectFit: 'cover',
                display: 'block',
              }}
            />
          ) : (
            <View style={styles.emblemFallback}>
              <Text style={styles.emblemLetter}>ع</Text>
            </View>
          )}
        </View>

        <Text style={styles.title}>زوامل عيسى الليث</Text>
        <Text style={styles.subtitle}>المكتبة الصوتية الرسمية</Text>

        {/* شريط التحميل التكتيكي السلس */}
        <View style={styles.loaderWrap}>
          <View style={styles.loaderTrack}>
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #9E7B34 0%, #E6BF6B 100%)',
                borderRadius: 99,
                transition: 'width 0.42s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          </View>
          <Text style={styles.loaderText}>جاري التجهيز...</Text>
        </View>
      </View>
    </div>
  );
};

const GOLD = '#D4A853';

const styles = StyleSheet.create({
  frameBox: {
    width: 272,
    paddingVertical: 32,
    paddingHorizontal: 22,
    alignItems: 'center',
    position: 'relative',
    gap: 10,
  },
  corner: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderColor: 'rgba(212, 168, 83, 0.6)',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 2,
    borderLeftWidth: 2,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 2,
    borderRightWidth: 2,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 2,
    borderRightWidth: 2,
  },
  emblemRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 2,
    borderColor: GOLD,
    backgroundColor: 'rgba(212, 168, 83, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
  emblemFallback: {
    width: 94,
    height: 94,
    borderRadius: 47,
    backgroundColor: '#182217',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emblemLetter: {
    fontFamily: FONTS.lyrics,
    fontSize: 44,
    fontWeight: '700',
    color: GOLD,
  },
  title: {
    fontFamily: FONTS.ui,
    fontSize: 24,
    fontWeight: '700',
    color: '#F4F6F2',
    letterSpacing: 0.4,
  },
  subtitle: {
    fontFamily: FONTS.ui,
    fontSize: 12.5,
    fontWeight: '600',
    color: GOLD,
    opacity: 0.9,
  },
  loaderWrap: {
    width: '100%',
    marginTop: 14,
    gap: 8,
    alignItems: 'center',
  },
  loaderTrack: {
    width: '86%',
    height: 3.5,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  loaderText: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: 'rgba(244,246,242,0.55)',
  },
});

