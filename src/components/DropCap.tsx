import React from 'react';
import { StyleProp, TextStyle } from 'react-native';
import { useApp } from '../state/AppContext';
import { AppText } from './ui';

/** Dergi paragrafı: ilk harf büyük ve renkli. Metin tırnak vb. ile başlıyorsa ilk harfe kadar olan kısım birlikte büyütülür. */
export function DropCap({ text, color, size = 18, style }: { text: string; color: string; size?: number; style?: StyleProp<TextStyle> }) {
  const { theme } = useApp();
  const m = text.match(/^([^\p{L}\p{N}]*[\p{L}\p{N}])([\s\S]*)$/u);
  const head = m ? m[1] : '';
  const rest = m ? m[2] : text;
  const lh = Math.round(size * 1.42) * theme.fontScale;
  return (
    <AppText serif style={[{ fontSize: size * theme.fontScale, lineHeight: lh }, style]}>
      <AppText serif weight="600" color={color} style={{ fontSize: size * 1.65 * theme.fontScale, lineHeight: lh }}>
        {head}
      </AppText>
      {rest}
    </AppText>
  );
}
