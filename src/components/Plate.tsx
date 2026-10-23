import React from 'react';
import { Image, ImageSourcePropType, StyleProp, Text, View, ViewStyle } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import type { Artwork } from '../content/catalog';
import { useApp } from '../state/AppContext';

function fit(aspect: number, width: number, maxHeight?: number) {
  let w = width;
  let h = w / aspect;
  if (maxHeight && h > maxHeight) {
    h = maxHeight;
    w = h * aspect;
  }
  return { w, h };
}

/**
 * Eser "levhası": görseli kendi en-boy oranında, kırpmadan gösterir.
 * Listelerde uygulamayla gelen küçük önizleme kullanılır (çevrimiçi eserler de internetsiz görünür).
 */
export function Plate({
  art,
  width,
  maxHeight,
  style,
  full,
  dim,
}: {
  art: Artwork;
  width: number;
  maxHeight?: number;
  style?: StyleProp<ViewStyle>;
  /** Tam çözünürlüklü görseli kullan */
  full?: boolean;
  /** Soluk (henüz tamamlanmamış) */
  dim?: boolean;
}) {
  const { theme } = useApp();
  const { w, h } = fit(art.aspect, width, maxHeight);
  return (
    <View style={[{ alignSelf: 'center' }, style]}>
      <Image
        source={full ? art.image : art.preview}
        style={{ width: w, height: h, backgroundColor: art.palette[0], opacity: dim ? 0.38 : 1 }}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 1, backgroundColor: theme.shadow }} />
    </View>
  );
}

/**
 * Çerçeveli eser: ince ahşap çerçeve, kâğıt paspartu ve isteğe bağlı spot ışığı.
 * Salon duvarında (koyu zemin) kullanılmak üzere tasarlandı; açık temada da çalışır.
 */
export function Frame({
  art,
  width,
  maxHeight,
  style,
  source,
  spotlight,
  matRatio = 0.06,
}: {
  art: Artwork;
  /** Çerçeve dahil toplam genişlik sınırı */
  width: number;
  maxHeight?: number;
  style?: StyleProp<ViewStyle>;
  source?: ImageSourcePropType;
  spotlight?: boolean;
  matRatio?: number;
}) {
  const { theme } = useApp();
  // Çerçeve ve paspartu kalınlığı kısa kenara göre
  const probe = fit(art.aspect, width, maxHeight);
  const short = Math.min(probe.w, probe.h);
  const border = Math.max(3, Math.round(short * 0.022));
  const mat = Math.max(6, Math.round(short * matRatio));
  const inner = fit(art.aspect, width - 2 * (border + mat), maxHeight ? maxHeight - 2 * (border + mat) : undefined);
  const outerW = inner.w + 2 * (border + mat);
  const outerH = inner.h + 2 * (border + mat);
  return (
    <View style={[{ alignSelf: 'center', width: outerW, height: outerH }, style]}>
      {spotlight ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: -outerW * 0.35, top: -outerH * 0.45, width: outerW * 1.7, height: outerH * 1.75 }}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            <Defs>
              <RadialGradient id="spot" cx="50%" cy="40%" rx="50%" ry="50%">
                <Stop offset="0" stopColor="#FFE9C2" stopOpacity={theme.isDark ? 0.2 : 0.22} />
                <Stop offset="0.55" stopColor="#FFE2B0" stopOpacity={0.07} />
                <Stop offset="1" stopColor="#FFE2B0" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse cx="50" cy="44" rx="50" ry="48" fill="url(#spot)" />
          </Svg>
        </View>
      ) : null}
      {/* gölge */}
      <View style={{ position: 'absolute', left: 3, top: 6, width: outerW, height: outerH, backgroundColor: theme.frameShadow, borderRadius: 1 }} />
      <View
        style={{
          width: outerW,
          height: outerH,
          backgroundColor: theme.mat,
          borderWidth: border,
          borderColor: theme.frame,
          padding: mat,
          borderRadius: 1,
        }}
      >
        <Image
          source={source ?? art.preview}
          style={{ width: inner.w, height: inner.h, backgroundColor: art.palette[0] }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
        {/* paspartunun iç kenar gölgesi */}
        <View pointerEvents="none" style={{ position: 'absolute', left: mat - 1, top: mat - 1, width: inner.w + 2, height: inner.h + 2, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' }} />
      </View>
    </View>
  );
}

/** Sergi mührü: renkli yuvarlak, iki harf. Albüm ve sergi başlıklarında. */
export function Seal({ color, mark, size = 40, faded }: { color: string; mark: string; size?: number; faded?: boolean }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: faded ? 'transparent' : color,
        borderWidth: 1.5,
        borderColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ position: 'absolute', width: size - 7, height: size - 7, borderRadius: (size - 7) / 2, borderWidth: 1, borderColor: faded ? color : 'rgba(255,255,255,0.45)' }} />
      <SealText mark={mark} size={size} color={faded ? color : '#FFF8EC'} />
    </View>
  );
}

function SealText({ mark, size, color }: { mark: string; size: number; color: string }) {
  // AppText kullanmıyoruz: yazı ölçeğinden bağımsız sabit boy
  return (
    <Text
      allowFontScaling={false}
      style={{ color, fontSize: size * 0.36, lineHeight: size * 0.44, fontFamily: 'EBGaramond_600SemiBold', fontWeight: undefined }}
    >
      {mark}
    </Text>
  );
}
