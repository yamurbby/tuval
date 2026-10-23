import React from 'react';
import { Image, ImageSourcePropType, View } from 'react-native';
import type { Artwork } from '../content/catalog';
import type { FracRect } from '../content/types';

/** Eserin bir bölgesini (0–1 kesirli dikdörtgen) verilen kutuya sığdırarak gösterir. */
export function DetailCrop({ art, rect, box, source }: { art: Artwork; rect: FracRect; box: number; source?: ImageSourcePropType }) {
  const regionAspect = (rect.w * art.aspect) / rect.h;
  const w = regionAspect >= 1 ? box : box * regionAspect;
  const h = regionAspect >= 1 ? box / regionAspect : box;
  const fullW = w / rect.w;
  const fullH = h / rect.h;
  return (
    <View style={{ width: w, height: h, overflow: 'hidden', backgroundColor: art.palette[0] }}>
      <Image
        source={source ?? art.preview}
        style={{ position: 'absolute', left: -rect.x * fullW, top: -rect.y * fullH, width: fullW, height: fullH }}
        resizeMode="stretch"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}
