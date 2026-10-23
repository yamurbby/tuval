// İnce çizgili, sade ikon seti (24x24). Oyuncak hissi vermemesi için dolgu yok.
import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'back'
  | 'chevronRight'
  | 'chevronLeft'
  | 'menu'
  | 'image'
  | 'sort'
  | 'shuffle'
  | 'plus'
  | 'minus'
  | 'fit'
  | 'external'
  | 'check'
  | 'close'
  | 'settings'
  | 'play'
  | 'restart'
  | 'home'
  | 'clock'
  | 'edges'
  | 'groups'
  | 'grid'
  | 'book'
  | 'loupe'
  | 'sound'
  | 'download'
  | 'album'
  | 'cloud';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 22, color = '#1E2733', strokeWidth = 1.5 }: Props) {
  const p = { stroke: color, strokeWidth, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  let body: React.ReactNode;
  switch (name) {
    case 'back':
    case 'chevronLeft':
      body = <Path d="M14.5 5.5 8 12l6.5 6.5" {...p} />;
      break;
    case 'chevronRight':
      body = <Path d="M9.5 5.5 16 12l-6.5 6.5" {...p} />;
      break;
    case 'menu':
      body = <Path d="M5 8h14M5 12h14M5 16h14" {...p} />;
      break;
    case 'image':
      body = (
        <>
          <Rect x={4} y={5} width={16} height={14} rx={1} {...p} />
          <Path d="m4.5 16 4.5-4.5 3.5 3.5 2.5-2.5 4.5 4.5" {...p} />
          <Circle cx={15.5} cy={9} r={1.3} {...p} />
        </>
      );
      break;
    case 'sort':
      body = <Path d="M7 5v14M4 16l3 3 3-3M17 19V5M14 8l3-3 3 3" {...p} />;
      break;
    case 'shuffle':
      body = <Path d="M4 7h3c4 0 5 10 9 10h4M4 17h3c1.5 0 2.6-1.4 3.4-3.2M13.3 9.4C14 8 15 7 16.5 7H20M17.5 4.5 20 7l-2.5 2.5M17.5 14.5 20 17l-2.5 2.5" {...p} />;
      break;
    case 'plus':
      body = <Path d="M12 5v14M5 12h14" {...p} />;
      break;
    case 'minus':
      body = <Path d="M5 12h14" {...p} />;
      break;
    case 'fit':
      body = <Path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" {...p} />;
      break;
    case 'external':
      body = <Path d="M14 4h6v6M20 4l-8.5 8.5M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" {...p} />;
      break;
    case 'check':
      body = <Path d="m5 12.5 4.5 4.5L19 7.5" {...p} />;
      break;
    case 'close':
      body = <Path d="M6 6l12 12M18 6 6 18" {...p} />;
      break;
    case 'settings':
      body = (
        <>
          <Path d="M4 7h9M17 7h3M4 17h3M11 17h9" {...p} />
          <Circle cx={15} cy={7} r={2} {...p} />
          <Circle cx={9} cy={17} r={2} {...p} />
        </>
      );
      break;
    case 'play':
      body = <Path d="M8 5.5v13l10-6.5z" {...p} />;
      break;
    case 'restart':
      body = <Path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v4h4" {...p} />;
      break;
    case 'home':
      body = <Path d="M4 11 12 4.5l8 6.5M6.5 9.5V19h11V9.5" {...p} />;
      break;
    case 'clock':
      body = (
        <>
          <Circle cx={12} cy={12} r={8} {...p} />
          <Path d="M12 8v4l2.5 1.5" {...p} />
        </>
      );
      break;
    case 'edges':
      body = (
        <>
          <Rect x={4} y={4} width={16} height={16} rx={1} {...p} />
          <Rect x={8.5} y={8.5} width={7} height={7} {...p} strokeDasharray="1.5 2" />
        </>
      );
      break;
    case 'groups':
      body = <Path d="M4 5h7v7H4zM11 9h4v-4h5v7h-5v4h-4z" {...p} />;
      break;
    case 'grid':
      body = <Path d="M4 4h16v16H4zM4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16" {...p} />;
      break;
    case 'book':
      body = <Path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zM12 6.5v13" {...p} />;
      break;
    case 'loupe':
      body = (
        <>
          <Circle cx={10.5} cy={10.5} r={5.5} {...p} />
          <Path d="m15 15 4.5 4.5" {...p} />
        </>
      );
      break;
    case 'sound':
      body = <Path d="M5 9.5h3l4-3.5v12l-4-3.5H5zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" {...p} />;
      break;
    case 'download':
      body = <Path d="M12 4.5v10M7.5 10.5 12 15l4.5-4.5M5 19.5h14" {...p} />;
      break;
    case 'album':
      body = (
        <>
          <Rect x={4.5} y={4} width={15} height={16} rx={1} {...p} />
          <Path d="M8 8h3.5v3.5H8zM12.5 8H16v3.5h-3.5zM8 12.5h3.5V16H8z" {...p} />
        </>
      );
      break;
    case 'cloud':
      body = <Path d="M7.5 18a4 4 0 0 1-.6-7.95A5.5 5.5 0 0 1 17.6 9.6 4.2 4.2 0 0 1 17 18z" {...p} />;
      break;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      {body}
    </Svg>
  );
}
