import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Icon } from '../components/Icon';
import { DetailCrop } from '../components/DetailCrop';
import { DropCap } from '../components/DropCap';
import { Frame } from '../components/Plate';
import { AppText, Button, Eyebrow, Header, MetaRow, Rule, Screen } from '../components/ui';
import { byline, details, exhibitionOf, getArtwork, localize, pick } from '../content/catalog';
import { mb } from '../content/download';
import { clampTarget, progress } from '../game/engine';
import { edgeStyleFor, gridFor, MAX_PIECES, MIN_PIECES, PIECE_STEP, Preset, PRESET_ORDER, presetTarget } from '../game/types';
import { useApp } from '../state/AppContext';
import { gameKey } from '../storage/persist';
import { radius, space } from '../theme';

export default function Level() {
  const { puzzle: id } = useLocalSearchParams<{ puzzle?: string }>();
  const { t, theme, collection, games, locale, highCapacity, downloaded } = useApp();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const art = getArtwork(id);

  const presets = useMemo(() => PRESET_ORDER.map((p) => ({ p, n: presetTarget(p, highCapacity) })), [highCapacity]);
  const [choice, setChoice] = useState<Preset | 'custom'>('medium');
  const [custom, setCustom] = useState(400);
  const [colophon, setColophon] = useState(false);

  if (!art) {
    return (
      <Screen>
        <Header onBack={() => router.back()} />
        <View style={styles.center}>
          <AppText variant="title">{t('game.notFound')}</AppText>
          <Button label={t('game.home')} onPress={() => router.replace('/')} style={{ marginTop: space(4) }} />
        </View>
      </Screen>
    );
  }

  const names = localize(art, locale);
  const ex = exhibitionOf(art);
  const looks = details(art);
  const hasFull = art.bundled || !!downloaded[art.id];
  const contentW = Math.min(width - space(10), 640);
  const target = choice === 'custom' ? custom : presets.find((x) => x.p === choice)!.n;
  const grid = gridFor(target, art.aspect);
  const saved = games[gameKey(art.id, target)];
  const done = collection[art.id] ?? [];
  const shape = edgeStyleFor(target) === 'classic' ? t('artwork.shapeClassic') : t('artwork.shapeIrregular');

  const start = (fresh: boolean) =>
    router.push({ pathname: '/game', params: { puzzle: art.id, pieces: String(target), fresh: fresh ? '1' : '0' } });

  const option = (key: Preset | 'custom', label: string, n: number) => {
    const g = gridFor(n, art.aspect);
    const active = choice === key;
    return (
      <Pressable
        key={key}
        testID={`preset-${key}`}
        accessibilityRole="radio"
        accessibilityState={{ checked: active }}
        accessibilityLabel={`${label}, ${t('artwork.grid', { cols: g.cols, rows: g.rows, n: g.cols * g.rows })}`}
        onPress={() => setChoice(key)}
        style={[styles.option, { borderBottomColor: theme.rule }]}
      >
        <View style={[styles.radio, { borderColor: active ? theme.ink : theme.stone }]}>
          {active ? <View style={[styles.radioDot, { backgroundColor: theme.ink }]} /> : null}
        </View>
        <AppText weight={active ? '600' : '400'} style={{ width: 72 }}>
          {label}
        </AppText>
        <AppText variant="small" color={theme.inkSoft} style={{ flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
          {t('artwork.grid', { cols: g.cols, rows: g.rows, n: g.cols * g.rows })}
        </AppText>
      </Pressable>
    );
  };

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space(2) }}>
        <Header title={pick(ex.title, locale)} onBack={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: space(10), alignItems: 'center' }}>
        {/* Salon duvarında eser */}
        <View style={[styles.wall, { backgroundColor: theme.wall }]}>
          <Frame art={art} width={Math.min(contentW, 460)} maxHeight={height * 0.46} spotlight source={hasFull ? art.image : art.preview} />
        </View>
        <View style={{ width: contentW }}>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push({ pathname: '/exhibition', params: { id: ex.id } })}
            style={{ marginTop: space(5), alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' }}
          >
            <Eyebrow color={ex.seal}>{t('artwork.inRoom', { ex: pick(ex.title, locale), n: art.room })}</Eyebrow>
          </Pressable>
          <AppText variant="display" italic style={{ marginTop: space(1) }} accessibilityRole="header">
            {names.title}
          </AppText>
          <AppText style={{ marginTop: space(1) }}>{byline(art, names)}</AppText>
          <AppText variant="small" color={theme.inkSoft} style={{ marginTop: 2 }}>
            {names.medium}
          </AppText>
          {done.length ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: space(2) }}>
              <Icon name="check" size={14} color={theme.olive} />
              <AppText variant="small" color={theme.olive}>
                {t('artwork.completedWith', { list: done.map((d) => d.pieces).join(', ') })}
              </AppText>
            </View>
          ) : null}

          {/* Küratör notu */}
          {names.note ? (
            <>
              <Eyebrow style={{ marginTop: space(8), marginBottom: space(2) }}>{t('artwork.note')}</Eyebrow>
              <DropCap text={names.note} color={ex.seal} size={19} />
            </>
          ) : null}

          {/* Yakından bak */}
          {looks.length ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space(8), marginBottom: space(1) }}>
                <Icon name="loupe" size={16} color={theme.inkSoft} />
                <Eyebrow>{t('artwork.look')}</Eyebrow>
              </View>
              <AppText variant="small" color={theme.inkSoft} style={{ marginBottom: space(2) }}>
                {t('artwork.lookHint')}
              </AppText>
              <Rule />
              {looks.map((d) => (
                <View key={d.id} style={[styles.look, { borderBottomColor: theme.rule }]} accessible accessibilityLabel={`${pick(d.title, locale)}. ${pick(d.text, locale)}`}>
                  <View style={{ width: 92, height: 92, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.paperDeep }}>
                    <DetailCrop art={art} rect={d.rect} box={88} source={hasFull ? art.image : art.preview} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText serif italic variant="h2">
                      {pick(d.title, locale)}
                    </AppText>
                    <AppText variant="small" color={theme.inkSoft}>
                      {pick(d.text, locale)}
                    </AppText>
                  </View>
                </View>
              ))}
            </>
          ) : null}

          {/* Parça sayısı */}
          <Eyebrow style={{ marginTop: space(8), marginBottom: space(1) }}>{t('artwork.pieces')}</Eyebrow>
          <Rule />
          {presets.map(({ p, n }) => option(p, t(`artwork.${p}` as never), n))}
          <View style={[styles.option, { borderBottomColor: theme.rule }]}>
            <Pressable
              testID="preset-custom"
              accessibilityRole="radio"
              accessibilityState={{ checked: choice === 'custom' }}
              onPress={() => setChoice('custom')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: 44 }}
            >
              <View style={[styles.radio, { borderColor: choice === 'custom' ? theme.ink : theme.stone }]}>
                {choice === 'custom' ? <View style={[styles.radioDot, { backgroundColor: theme.ink }]} /> : null}
              </View>
              <AppText weight={choice === 'custom' ? '600' : '400'}>{t('artwork.custom')}</AppText>
            </Pressable>
            <View style={styles.stepper}>
              <StepBtn icon="minus" label={t('artwork.less')} disabled={custom <= MIN_PIECES} onPress={() => { setChoice('custom'); setCustom((c) => clampTarget(c - PIECE_STEP)); }} testID="less" />
              <AppText weight="600" style={{ width: 52, textAlign: 'center', fontVariant: ['tabular-nums'] }} accessibilityLiveRegion="polite" testID="custom-value">
                {custom}
              </AppText>
              <StepBtn icon="plus" label={t('artwork.more')} disabled={custom >= MAX_PIECES} onPress={() => { setChoice('custom'); setCustom((c) => clampTarget(c + PIECE_STEP)); }} testID="more" />
            </View>
          </View>
          <AppText variant="small" color={theme.inkSoft} style={{ marginTop: space(3) }}>
            {t('artwork.grid', { cols: grid.cols, rows: grid.rows, n: grid.cols * grid.rows })} · {shape}
          </AppText>
          {target >= 300 ? (
            <AppText variant="small" color={theme.inkSoft} style={{ marginTop: space(1) }}>
              {t('artwork.zoomHint')}
            </AppText>
          ) : null}

          {!art.bundled && !downloaded[art.id] ? (
            <View style={{ flexDirection: 'row', gap: 6, marginTop: space(3) }}>
              <Icon name="cloud" size={16} color={theme.inkSoft} />
              <AppText variant="small" color={theme.inkSoft} style={{ flex: 1 }}>
                {t('artwork.onlineInfo', { mb: mb(art.fileSize) })}
              </AppText>
            </View>
          ) : null}

          <View style={{ gap: space(3), marginTop: space(5) }}>
            {saved ? (
              <>
                <Button label={t('artwork.resume', { p: Math.round(progress(saved) * 100) })} icon="play" onPress={() => start(false)} testID="start" />
                <Button kind="secondary" label={t('artwork.fresh')} onPress={() => start(true)} testID="fresh" />
              </>
            ) : (
              <Button label={t('artwork.start')} icon="play" onPress={() => start(true)} testID="start" />
            )}
          </View>

          {/* Künye — isteğe bağlı açılır */}
          <Pressable
            testID="colophon"
            accessibilityRole="button"
            accessibilityState={{ expanded: colophon }}
            onPress={() => setColophon((c) => !c)}
            style={[styles.accordion, { borderTopColor: theme.rule, borderBottomColor: theme.rule }]}
          >
            <Eyebrow>{t('artwork.colophon')}</Eyebrow>
            <AppText variant="small" color={theme.inkSoft} style={{ marginLeft: 'auto' }}>
              {colophon ? t('artwork.hideColophon') : t('artwork.showColophon')}
            </AppText>
          </Pressable>
          {colophon ? <>
          {locale === 'tr' ? <MetaRow label={t('artwork.original')} value={art.title} /> : null}
          <MetaRow label={t('artwork.artist')} value={art.artistBio ? `${art.artist} (${art.artistBio})` : art.artist} />
          <MetaRow label={t('artwork.date')} value={art.date} />
          <MetaRow label={t('artwork.technique')} value={names.medium} />
          <MetaRow label={t('artwork.dimensions')} value={art.dimensions} />
          <MetaRow label={t('artwork.institution')} value={art.institution} />
          <MetaRow label={t('artwork.credit')} value={art.creditLine} />
          <MetaRow label={t('artwork.accession')} value={art.accession} selectable />
          <MetaRow label={t('artwork.license')} value={art.license} />
          <MetaRow label={t('artwork.attribution')} value={art.attribution} selectable />
          <Pressable
            accessibilityRole="link"
            onPress={() => Linking.openURL(art.sourceUrl).catch(() => {})}
            style={styles.link}
            testID="source-link"
          >
            <AppText variant="small" color={theme.tile} style={{ textDecorationLine: 'underline' }}>
              {t('artwork.openSource')}
            </AppText>
            <Icon name="external" size={16} color={theme.tile} />
          </Pressable>
          </> : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function StepBtn({ icon, label, onPress, disabled, testID }: { icon: 'plus' | 'minus'; label: string; onPress: () => void; disabled?: boolean; testID?: string }) {
  const { theme } = useApp();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.step, { borderColor: theme.rule, opacity: disabled ? 0.3 : 1, backgroundColor: pressed ? theme.paperDeep : 'transparent' }]}
    >
      <Icon name={icon} size={18} color={theme.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  wall: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: space(10) },
  look: { flexDirection: 'row', gap: space(3), paddingVertical: space(3), borderBottomWidth: StyleSheet.hairlineWidth * 2, alignItems: 'center' },
  accordion: { flexDirection: 'row', alignItems: 'center', minHeight: 52, marginTop: space(10), borderTopWidth: StyleSheet.hairlineWidth * 2, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  option: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  stepper: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' },
  step: { width: 44, height: 40, borderWidth: 1, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, marginTop: space(2) },
});
