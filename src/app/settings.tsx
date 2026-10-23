import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { AppText, Button, Eyebrow, Header, Screen, ToggleRow } from '../components/ui';
import { haptic, playSound } from '../feedback/feedback';
import { presetTarget } from '../game/types';
import { LanguagePref, LOCALE_NAMES } from '../i18n';
import { previewAmbient } from '../feedback/ambient';
import type { AmbientKind, PieceLayout } from '../storage/persist';
import type { ThemePref } from '../theme';
import { useApp } from '../state/AppContext';
import { radius, space } from '../theme';

export default function Settings() {
  const { t, theme, settings, setSetting, resetProgress, highCapacity, downloaded } = useApp();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const contentW = Math.min(width - space(10), 640);
  const [confirm, setConfirm] = useState<'idle' | 'ask' | 'done'>('idle');
  const langs: LanguagePref[] = ['system', 'tr', 'en'];

  return (
    <Screen>
      <Header title={t('settings.title')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: space(10), alignItems: 'center' }}>
        <View style={{ width: contentW }}>
          <Section title={t('settings.appearance')} />
          <Segment<ThemePref>
            testID="theme"
            value={settings.theme}
            onChange={(v) => setSetting('theme', v)}
            options={[
              ['system', t('settings.system')],
              ['light', t('settings.light')],
              ['dark', t('settings.dark')],
            ]}
          />

          <Section title={t('settings.ambient')} />
          <AppText variant="small" color={theme.inkSoft} style={{ marginBottom: space(1) }}>
            {t('settings.ambientHint')}
          </AppText>
          <Segment<AmbientKind>
            testID="ambient"
            value={settings.ambient}
            onChange={(v) => {
              setSetting('ambient', v);
              previewAmbient(v);
            }}
            options={[
              ['off', t('settings.ambientOff')],
              ['rain', t('settings.ambientRain')],
              ['fire', t('settings.ambientFire')],
              ['piano', t('settings.ambientPiano')],
            ]}
          />

          <Section title={t('settings.gameplay')} />
          <AppText style={{ marginBottom: 2 }}>{t('settings.layout')}</AppText>
          <AppText variant="small" color={theme.inkSoft} style={{ marginBottom: space(1) }}>
            {t('settings.layoutHint')}
          </AppText>
          <Segment<PieceLayout>
            testID="layout"
            value={settings.layout}
            onChange={(v) => setSetting('layout', v)}
            options={[
              ['table', t('settings.layoutTable')],
              ['tray', t('settings.layoutTray')],
            ]}
          />
          <View style={{ height: space(3) }} />
          <ToggleRow testID="toggle-timer" label={t('settings.showTimer')} hint={t('settings.showTimerHint')} value={settings.showTimer} onChange={(v) => setSetting('showTimer', v)} />
          <ToggleRow label={t('settings.autoEdges')} hint={t('settings.autoEdgesHint')} value={settings.autoEdges} onChange={(v) => setSetting('autoEdges', v)} />
          <ToggleRow label={t('settings.guide')} value={settings.guide} onChange={(v) => setSetting('guide', v)} />
          <ToggleRow label={t('settings.seams')} value={settings.seams} onChange={(v) => setSetting('seams', v)} />
          <AppText variant="tiny" color={theme.inkSoft} style={{ marginTop: space(2) }}>
            {t('settings.expertInfo', { n: presetTarget('expert', highCapacity) })}
          </AppText>

          <Section title={t('settings.feedback')} />
          <ToggleRow
            label={t('settings.sound')}
            value={settings.sound}
            onChange={(v) => {
              setSetting('sound', v);
              playSound('snap', v);
            }}
          />
          <ToggleRow
            label={t('settings.haptics')}
            value={settings.haptics}
            onChange={(v) => {
              setSetting('haptics', v);
              haptic('snap', v);
            }}
          />

          <Section title={t('settings.language')} />
          <Segment<LanguagePref>
            testID="lang"
            value={settings.language}
            onChange={(v) => setSetting('language', v)}
            options={langs.map((l) => [l, l === 'system' ? t('settings.system') : LOCALE_NAMES[l]] as [LanguagePref, string])}
          />

          <Section title={t('settings.accessibility')} />
          <ToggleRow label={t('settings.largeText')} value={settings.largeText} onChange={(v) => setSetting('largeText', v)} />
          <ToggleRow label={t('settings.highContrast')} value={settings.highContrast} onChange={(v) => setSetting('highContrast', v)} />
          <ToggleRow label={t('settings.reduceMotion')} value={settings.reduceMotion} onChange={(v) => setSetting('reduceMotion', v)} />

          <AppText variant="tiny" color={theme.inkSoft} style={{ marginTop: space(6) }}>
            {t('settings.downloadsInfo', { n: Object.keys(downloaded).length })}
          </AppText>

          <View style={{ marginTop: space(8), gap: space(2) }}>
            <Button
              kind="secondary"
              label={confirm === 'ask' ? t('settings.resetConfirm') : confirm === 'done' ? t('settings.resetDone') : t('settings.reset')}
              disabled={confirm === 'done'}
              onPress={() => {
                if (confirm === 'ask') {
                  resetProgress();
                  setConfirm('done');
                } else setConfirm('ask');
              }}
              style={confirm === 'ask' ? { borderColor: theme.tile } : undefined}
            />
            <AppText variant="tiny" color={theme.inkSoft} style={{ textAlign: 'center', marginTop: space(2) }}>
              {t('appName')} · {t('settings.version', { v: Constants.expoConfig?.version ?? '2.0.0' })}
            </AppText>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Segment<T extends string>({ value, onChange, options, testID }: { value: T; onChange: (v: T) => void; options: [T, string][]; testID?: string }) {
  const { theme } = useApp();
  return (
    <View style={[styles.segment, { borderColor: theme.rule }]} accessibilityRole="radiogroup">
      {options.map(([k, label]) => {
        const active = value === k;
        return (
          <Pressable
            key={k}
            testID={`${testID}-${k}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            onPress={() => onChange(k)}
            style={[styles.segBtn, { backgroundColor: active ? theme.ink : 'transparent' }]}
          >
            <AppText variant="small" weight={active ? '600' : '400'} color={active ? theme.paper : theme.ink} numberOfLines={1}>
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function Section({ title }: { title: string }) {
  return <Eyebrow style={{ marginTop: space(8), marginBottom: space(1) }}>{title}</Eyebrow>;
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.sm, padding: 3, gap: 3, marginTop: space(2) },
  segBtn: { flex: 1, minHeight: 44, borderRadius: radius.xs, alignItems: 'center', justifyContent: 'center' },
});
