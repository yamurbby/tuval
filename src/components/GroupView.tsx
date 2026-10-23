import React, { useId } from 'react';
import { Image, ImageSourcePropType, Platform } from 'react-native';
import Svg, { ClipPath, Defs, G, Image as SvgImage, Path } from 'react-native-svg';
import { groupBox, PuzzleCut } from '../game/cut';

export function resolveHref(source: ImageSourcePropType): any {
  if (Platform.OS === 'web') {
    const s: any = source;
    if (typeof s === 'string') return s;
    if (s && typeof s === 'object' && 'uri' in s) return s.uri;
    if (s && typeof s === 'object' && 'default' in s) return s.default;
    const r = (Image as any).resolveAssetSource?.(s);
    return r?.uri ?? s;
  }
  return source;
}

interface Props {
  cut: PuzzleCut;
  ids: number[];
  source: ImageSourcePropType;
  /** ekran pikseli / tahta birimi */
  scale: number;
  lifted?: boolean;
  selected?: boolean;
  /** Seçim çizgisinin rengi (temaya göre) */
  ink?: string;
}

/** Bir parçayı veya birleşmiş parça grubunu görselden kırparak çizer. */
function GroupViewInner({ cut, ids, source, scale, lifted, selected, ink = '#1E2733' }: Props) {
  const raw = useId();
  const clipId = 'g' + raw.replace(/[^a-zA-Z0-9]/g, '');
  const box = groupBox(cut, ids);
  const href = resolveHref(source);
  const px = 1 / scale; // bir ekran pikseli, tahta biriminde
  return (
    <Svg width={box.w * scale} height={box.h * scale} viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} pointerEvents="none">
      <Defs>
        <ClipPath id={clipId}>
          {ids.map((id) => (
            <Path key={id} d={cut.pieces[id].path} />
          ))}
        </ClipPath>
      </Defs>
      <G transform={`translate(${(lifted ? 2.5 : 1) * px} ${(lifted ? 4 : 1.2) * px})`}>
        {ids.map((id) => (
          <Path key={id} d={cut.pieces[id].path} fill={lifted ? 'rgba(20,24,30,0.32)' : 'rgba(20,24,30,0.2)'} />
        ))}
      </G>
      <G clipPath={`url(#${clipId})`}>
        <SvgImage href={href} x={0} y={0} width={cut.boardW} height={cut.boardH} preserveAspectRatio="none" />
      </G>
      {ids.map((id) => (
        <Path
          key={id}
          d={cut.pieces[id].path}
          fill="none"
          stroke={selected ? ink : 'rgba(255,252,245,0.45)'}
          strokeWidth={(selected ? 2 : 0.8) * px}
          strokeDasharray={selected ? `${5 * px} ${3 * px}` : undefined}
        />
      ))}
    </Svg>
  );
}

export const GroupView = React.memo(GroupViewInner);
