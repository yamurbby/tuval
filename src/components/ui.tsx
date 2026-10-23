// Temel arayüz bileşenleri — katalog tipografisi, ince ayırıcılar, sakin düğmeler.
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../state/AppContext';
import { font, fonts, radius, space, TOUCH } from '../theme';
import { Icon, IconName } from './Icon';

type Variant = keyof typeof font;

export function AppText({
  variant = 'body',
  color,
  weight,
  serif,
  italic,
  style,
  ...rest
}: TextProps & {
  variant?: Variant;
  color?: string;
  weight?: '400' | '500' | '600' | '700';
  serif?: boolean;
  italic?: boolean;
}) {
  const { theme } = useApp();
  const useSerif = serif ?? (variant === 'display' || variant === 'title');
  const size = font[variant] * theme.fontScale * (useSerif ? 1.08 : 1);
  const family = useSerif
    ? italic
      ? fonts.serifItalic
      : weight === '600' || weight === '700'
        ? fonts.serifSemi
        : weight === '500'
          ? fonts.serifMedium
          : fonts.serif
    : undefined;
  const s: TextStyle = {
    color: color ?? theme.ink,
    fontSize: size,
    lineHeight: Math.round(size * (useSerif ? 1.22 : 1.4)),
    fontFamily: family,
    fontWeight: useSerif ? undefined : (weight ?? '400'),
    fontStyle: !useSerif && italic ? 'italic' : undefined,
  };
  return <Text maxFontSizeMultiplier={1.35} {...rest} style={[s, style]} />;
}

/** Küçük, harf aralıklı bölüm etiketi */
export function Eyebrow({ children, color, style }: { children: string; color?: string; style?: StyleProp<TextStyle> }) {
  const { theme, locale } = useApp();
  return (
    <AppText variant="tiny" weight="600" color={color ?? theme.inkSoft} style={[{ letterSpacing: 1.4 }, style]} accessibilityRole="header">
      {children.toLocaleUpperCase(locale)}
    </AppText>
  );
}

export function Rule({ style }: { style?: StyleProp<ViewStyle> }) {
  const { theme } = useApp();
  return <View style={[{ height: StyleSheet.hairlineWidth * 2, backgroundColor: theme.rule }, style]} />;
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  icon?: IconName;
  kind?: 'primary' | 'secondary' | 'ghost';
  sub?: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  testID?: string;
}

export function Button({ label, onPress, icon, kind = 'primary', sub, style, disabled, testID }: ButtonProps) {
  const { theme } = useApp();
  const bg = kind === 'primary' ? theme.olive : 'transparent';
  const fg = kind === 'primary' ? theme.onPrimary : theme.ink;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={sub ? `${label}. ${sub}` : label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          borderColor: kind === 'secondary' ? theme.ink : 'transparent',
          borderWidth: kind === 'secondary' ? 1 : 0,
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {icon ? <Icon name={icon} color={fg} size={20} /> : null}
      <View style={{ flexShrink: 1, alignItems: 'center' }}>
        <AppText weight="600" color={fg} numberOfLines={1} style={{ letterSpacing: 0.3 }}>
          {label}
        </AppText>
        {sub ? (
          <AppText variant="tiny" color={kind === 'primary' ? theme.onPrimarySoft : theme.inkSoft} numberOfLines={1}>
            {sub}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  disabled,
  active,
  testID,
  size = TOUCH,
  showLabel,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
  testID?: string;
  size?: number;
  showLabel?: boolean;
}) {
  const { theme } = useApp();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        {
          minWidth: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: showLabel ? 'column' : 'row',
          gap: 2,
          borderRadius: radius.md,
          backgroundColor: active ? theme.ink : pressed ? theme.paperDeep : 'transparent',
          opacity: disabled ? 0.35 : 1,
        },
      ]}
    >
      <Icon name={icon} color={active ? theme.paper : theme.ink} />
      {showLabel ? (
        <AppText variant="tiny" color={active ? theme.paper : theme.inkSoft} numberOfLines={1}>
          {label}
        </AppText>
      ) : null}
    </Pressable>
  );
}

export function Header({ title, onBack, right }: { title?: string; onBack?: () => void; right?: React.ReactNode }) {
  const { t } = useApp();
  return (
    <View style={styles.header}>
      {onBack ? <IconButton icon="back" label={t('common.back')} onPress={onBack} testID="back" /> : <View style={{ width: TOUCH }} />}
      <AppText serif variant="h2" style={{ flex: 1, textAlign: 'center' }} numberOfLines={1} accessibilityRole="header">
        {title ?? ''}
      </AppText>
      {right ?? <View style={{ width: TOUCH }} />}
    </View>
  );
}

export function Screen({ children, style, padded = true }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const insets = useSafeAreaInsets();
  const { theme } = useApp();
  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: theme.paper,
          paddingTop: insets.top,
          paddingBottom: Math.max(insets.bottom, space(2)),
          paddingLeft: insets.left + (padded ? space(5) : 0),
          paddingRight: insets.right + (padded ? space(5) : 0),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Katalog satırı: başlık + alt metin + ok, altında ince çizgi */
export function ListRow({
  title,
  sub,
  onPress,
  left,
  testID,
  right,
}: {
  title: string;
  sub?: string;
  onPress: () => void;
  left?: React.ReactNode;
  testID?: string;
  right?: React.ReactNode;
}) {
  const { theme } = useApp();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={sub ? `${title}. ${sub}` : title}
      onPress={onPress}
      style={({ pressed }) => [styles.listRow, { borderBottomColor: theme.rule, opacity: pressed ? 0.6 : 1 }]}
    >
      {left}
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText serif variant="h2" numberOfLines={2}>
          {title}
        </AppText>
        {sub ? (
          <AppText variant="small" color={theme.inkSoft} numberOfLines={2}>
            {sub}
          </AppText>
        ) : null}
      </View>
      {right ?? <Icon name="chevronRight" color={theme.stone} />}
    </Pressable>
  );
}

export function ToggleRow({
  label,
  hint,
  value,
  onChange,
  testID,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  testID?: string;
}) {
  const { theme, t } = useApp();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={[styles.row, { borderBottomColor: theme.rule }]}
    >
      <View style={{ flex: 1 }}>
        <AppText>{label}</AppText>
        {hint ? (
          <AppText variant="small" color={theme.inkSoft}>
            {hint}
          </AppText>
        ) : null}
      </View>
      <AppText variant="tiny" color={theme.inkSoft} style={{ marginRight: 6 }}>
        {value ? t('common.on') : t('common.off')}
      </AppText>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.rule, true: theme.olive }}
        thumbColor={theme.isDark ? '#F1ECE3' : theme.surface}
        {...({ activeThumbColor: theme.isDark ? '#F1ECE3' : theme.surface } as object)}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  );
}

export function Loading({ label }: { label: string }) {
  const { theme } = useApp();
  return (
    <View style={[styles.center, { backgroundColor: theme.paper }]} accessibilityLiveRegion="polite">
      <ActivityIndicator color={theme.olive} />
      <AppText color={theme.inkSoft} style={{ marginTop: space(3) }}>
        {label}
      </AppText>
    </View>
  );
}

/** Eser künyesi satırı: etiket / değer */
export function MetaRow({ label, value, selectable }: { label: string; value: string; selectable?: boolean }) {
  const { theme } = useApp();
  if (!value) return null;
  return (
    <View style={[styles.meta, { borderBottomColor: theme.rule }]} accessible accessibilityLabel={`${label}: ${value}`}>
      <AppText variant="small" color={theme.inkSoft} style={{ width: 104 }}>
        {label}
      </AppText>
      <AppText variant="small" style={{ flex: 1 }} selectable={selectable}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
    paddingHorizontal: space(5),
    minHeight: 52,
    borderRadius: radius.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingVertical: space(2), minHeight: TOUCH + space(4) },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingVertical: space(4),
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    minHeight: 64,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space(3),
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    gap: space(2),
  },
  meta: { flexDirection: 'row', gap: space(3), paddingVertical: space(2.5), borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space(6) },
});
