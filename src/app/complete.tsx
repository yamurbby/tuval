import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Frame, Seal } from '../components/Plate';
import { AppText, Button, Eyebrow, MetaRow, Rule, Screen } from '../components/ui';
import { byline, exhibitionOf, exhibitionWorks, getArtwork, localize, nextArtwork, pick } from '../content/catalog';
import { formatTime } from '../game/engine';
import { useApp } from '../state/AppContext';
import { radius, space } from '../theme';

type P = { puzzle?: string; pieces?: string; target?: string; time?: string; moves?: string; best?: string; daily?: string };

export default function Complete() {
  const p = useLocalSearchParams<P>();
  const { t, theme, locale, collection, downloaded, settings } = useApp();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const [details, setDetails] = useState(false);
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(rise, { toValue: 1, duration: settings.reduceMotion ? 1 : 700, delay: 250, useNativeDriver: true }).start();
  }, [rise, settings.reduceMotion]);

  const art = getArtwork(p.puzzle);
  if (!art) return <Redirect href="/" />;
  const names = localize(art, locale);
  const ex = exhibitionOf(art);
  const works = exhibitionWorks(ex.id);
  const doneInEx = works.filter((a) => (collection[a.id] ?? []).length > 0).length;
  const next = nextArtwork(art.id);
  const nextNames = localize(next, locale);
  const contentW = Math.min(width - space(10), 600);
  const full = art.bundled || !!downloaded[art.id];

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ paddingBottom: space(8), alignItems: 'center' }}>
        <View style={[styles.wall, { backgroundColor: theme.wall }]}>
          <Eyebrow color={theme.wallInkSoft} style={{ textAlign: 'center', marginBottom: space(6) }}>
            {t('complete.title')}
          </Eyebrow>
          <Frame art={art} width={Math.min(contentW, 440)} maxHeight={height * 0.44} spotlight source={full ? art.image : art.preview} />
          <View style={{ alignItems: 'center', marginTop: space(6), gap: 2, width: contentW }} accessible accessibilityLiveRegion="polite">
            <AppText variant="title" italic color={theme.wallInk} style={{ textAlign: 'center' }}>
              {names.title}
            </AppText>
            <AppText color={theme.wallInkSoft} style={{ textAlign: 'center' }}>
              {byline(art, names)}
            </AppText>
            <AppText variant="small" color={theme.wallInkSoft} style={{ marginTop: space(1) }}>
              {t('common.pieces', { n: p.pieces ?? '' })}
            </AppText>
          </View>
        </View>

        <View style={{ width: contentW }}>
          {/* Albüme eklendi */}
          <Animated.View
            style={[
              styles.albumCard,
              { backgroundColor: theme.surface, borderColor: theme.rule, opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] },
            ]}
          >
            <Seal color={ex.seal} mark={ex.mark} size={46} faded={doneInEx < works.length} />
            <View style={{ flex: 1 }}>
              <AppText weight="600">{t('complete.addedToAlbum')}</AppText>
              <AppText variant="small" color={theme.inkSoft}>
                {t('complete.albumProgress', { ex: pick(ex.title, locale), done: doneInEx, total: works.length })}
              </AppText>
              <View style={[styles.track, { backgroundColor: theme.rule }]}>
                <View style={{ width: `${(doneInEx / works.length) * 100}%`, height: '100%', backgroundColor: ex.seal }} />
              </View>
            </View>
          </Animated.View>

          {names.note ? (
            <AppText serif italic color={theme.inkSoft} style={{ marginTop: space(5), fontSize: 17 * theme.fontScale, lineHeight: 24 * theme.fontScale }}>
              {names.note}
            </AppText>
          ) : null}

          {/* Ayrıntılar isteğe bağlı */}
          <Pressable testID="details" accessibilityRole="button" accessibilityState={{ expanded: details }} onPress={() => setDetails((d) => !d)} style={styles.toggle}>
            <AppText variant="small" color={theme.inkSoft} style={{ textDecorationLine: 'underline' }}>
              {details ? t('complete.hideDetails') : t('complete.details')}
            </AppText>
          </Pressable>
          {details ? (
            <View style={{ marginBottom: space(4) }}>
              <Rule />
              <MetaRow label={t('complete.pieces')} value={p.pieces ?? ''} />
              <MetaRow label={t('complete.time')} value={formatTime(Number(p.time) || 0) + (p.best === '1' ? ` — ${t('complete.record')}` : '')} />
              <MetaRow label={t('complete.moves')} value={p.moves ?? '0'} />
            </View>
          ) : null}

          <View style={{ gap: space(3), marginTop: space(3) }}>
            <Button
              label={next.category === art.category ? t('complete.nextInRoom') : t('complete.next')}
              sub={`${nextNames.title} · ${next.artist}`}
              onPress={() => router.replace({ pathname: '/level', params: { puzzle: next.id } })}
              testID="next"
            />
            <Button kind="secondary" icon="album" label={t('complete.openAlbum')} onPress={() => router.replace('/collection')} testID="album" />
            <Button kind="ghost" label={t('complete.again')} onPress={() => router.replace({ pathname: '/level', params: { puzzle: art.id } })} testID="again" />
            <Button kind="ghost" label={t('complete.home')} onPress={() => router.replace('/')} testID="home" />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wall: { alignSelf: 'stretch', alignItems: 'center', paddingTop: space(10), paddingBottom: space(8), paddingHorizontal: space(5) },
  albumCard: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(4), borderWidth: 1, borderRadius: radius.md, marginTop: -space(5) },
  track: { height: 3, borderRadius: 2, overflow: 'hidden', marginTop: space(2) },
  toggle: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', marginTop: space(3) },
});
