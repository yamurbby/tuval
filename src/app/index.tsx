import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Icon } from '../components/Icon';
import { Frame, Plate, Seal } from '../components/Plate';
import { AppText, Eyebrow, IconButton, ListRow, Rule, Screen } from '../components/ui';
import {
  ARTWORKS,
  byline,
  dailyArtwork,
  EXHIBITIONS,
  exhibitionWorks,
  getArtwork,
  localize,
  monthExhibition,
  pick,
  todayKey,
} from '../content/catalog';
import { pieceCount, progress } from '../game/engine';
import { useApp } from '../state/AppContext';
import { radius, space } from '../theme';

export default function Home() {
  const { t, theme, games, collection, daily, storageWarning, locale } = useApp();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const contentW = Math.min(width - space(10), 560);

  const show = monthExhibition();
  const showWorks = exhibitionWorks(show.id);
  const hero = showWorks.find((a) => a.bundled) ?? showWorks[0];
  const today = dailyArtwork(todayKey());
  const todayNames = localize(today.artwork, locale);
  const todayDone = !!daily[today.date];
  const inProgress = Object.values(games)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 3);
  const isDone = (id: string) => (collection[id] ?? []).length > 0;
  const doneCount = ARTWORKS.filter((a) => isDone(a.id)).length;

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ paddingBottom: space(8), alignItems: 'center' }} showsVerticalScrollIndicator={false}>
        <View style={{ width: contentW }}>
          <View style={styles.masthead}>
            <View style={{ flex: 1 }}>
              <AppText variant="display" accessibilityRole="header" style={{ letterSpacing: 0.5 }}>
                {t('appName')}
              </AppText>
              <AppText variant="small" color={theme.inkSoft}>
                {t('subtitle')}
              </AppText>
            </View>
            <IconButton icon="album" label={t('home.album')} onPress={() => router.push('/collection')} testID="album-icon" />
            <IconButton icon="settings" label={t('home.settings')} onPress={() => router.push('/settings')} testID="settings-icon" />
          </View>
          {storageWarning ? (
            <AppText variant="small" color={theme.inkSoft} style={{ marginBottom: space(3) }} accessibilityLiveRegion="polite">
              {t('errors.storage')}
            </AppText>
          ) : null}
        </View>

        {/* Bu ayın sergisi — salon duvarı, spot ışığı altında çerçeveli eser */}
        <Pressable
          testID="month-show"
          accessibilityRole="button"
          accessibilityLabel={`${t('home.monthShow')}: ${pick(show.title, locale)}. ${t('home.enter')}`}
          onPress={() => router.push({ pathname: '/exhibition', params: { id: show.id } })}
          style={({ pressed }) => [styles.wall, { backgroundColor: theme.wall, opacity: pressed ? 0.92 : 1 }]}
        >
          <View style={{ width: contentW, alignItems: 'center' }}>
            <Eyebrow color={theme.wallInkSoft} style={{ marginBottom: space(6), textAlign: 'center' }}>
              {t('home.monthShow')}
            </Eyebrow>
            <Frame art={hero} width={Math.min(contentW * 0.82, 400)} maxHeight={Math.max(220, height * 0.38)} spotlight source={hero.bundled ? hero.image : hero.preview} />
            <View style={[styles.brass, { backgroundColor: theme.brass }]} />
            <AppText variant="title" color={theme.wallInk} style={{ textAlign: 'center', marginTop: space(5) }}>
              {pick(show.title, locale)}
            </AppText>
            <AppText variant="small" color={theme.wallInkSoft} style={{ textAlign: 'center', marginTop: 2 }}>
              {pick(show.span, locale)} · {t('exhibition.works', { n: showWorks.length })}
            </AppText>
            <AppText serif italic color={theme.wallInkSoft} numberOfLines={3} style={{ textAlign: 'center', marginTop: space(3), fontSize: 17 * theme.fontScale, lineHeight: 23 * theme.fontScale }}>
              {pick(show.intro, locale)}
            </AppText>
            <View style={[styles.enter, { borderColor: theme.brass }]}>
              <AppText variant="small" weight="600" color={theme.wallInk} style={{ letterSpacing: 0.6 }}>
                {t('home.enter')}
              </AppText>
              <Icon name="chevronRight" size={18} color={theme.wallInk} />
            </View>
          </View>
        </Pressable>

        <View style={{ width: contentW }}>
          {/* Günün eseri */}
          <Eyebrow style={{ marginTop: space(8), marginBottom: space(1) }}>{t('home.today')}</Eyebrow>
          <Rule />
          <ListRow
            testID="daily"
            title={todayNames.title}
            sub={`${byline(today.artwork, todayNames)} · ${todayDone ? t('home.todayDone') : t('home.todayStart', { n: today.target })}`}
            onPress={() => router.push({ pathname: '/game', params: { puzzle: today.artwork.id, pieces: String(today.target), daily: today.date } })}
            left={<Plate art={today.artwork} width={64} maxHeight={64} />}
            right={todayDone ? <Icon name="check" color={theme.olive} /> : <Icon name="play" color={theme.tile} />}
          />

          {inProgress.length ? (
            <>
              <Eyebrow style={{ marginTop: space(8), marginBottom: space(1) }}>{t('home.inProgress')}</Eyebrow>
              <Rule />
              {inProgress.map((g) => {
                const a = getArtwork(g.puzzleId);
                if (!a) return null;
                const n = localize(a, locale);
                return (
                  <ListRow
                    key={`${g.puzzleId}:${g.target}:${g.daily ?? ''}`}
                    testID="continue"
                    title={n.title}
                    sub={t('home.continueRow', { pieces: pieceCount(g), p: Math.round(progress(g) * 100) })}
                    onPress={() => router.push({ pathname: '/game', params: { puzzle: g.puzzleId, pieces: String(g.target), daily: g.daily ?? '' } })}
                    left={<Plate art={a} width={52} maxHeight={52} />}
                  />
                );
              })}
            </>
          ) : null}

          {/* Sergiler */}
          <Eyebrow style={{ marginTop: space(8), marginBottom: space(1) }}>{t('home.exhibitions')}</Eyebrow>
          <Rule />
          {EXHIBITIONS.map((ex) => {
            const works = exhibitionWorks(ex.id);
            const done = works.filter((a) => isDone(a.id)).length;
            return (
              <ListRow
                key={ex.id}
                testID={`ex-${ex.id}`}
                title={pick(ex.title, locale)}
                sub={`${pick(ex.span, locale)} · ${t('home.exhibitionRow', { done, total: works.length })}`}
                onPress={() => router.push({ pathname: '/exhibition', params: { id: ex.id } })}
                left={<Seal color={ex.seal} mark={ex.mark} size={42} faded={done < works.length} />}
              />
            );
          })}

          <View style={{ marginTop: space(8) }}>
            <Rule />
            <ListRow testID="collection" title={t('home.album')} sub={t('home.albumHint', { done: doneCount, total: ARTWORKS.length })} onPress={() => router.push('/collection')} />
            <ListRow testID="play" title={t('home.browse')} sub={t('home.browseHint', { n: ARTWORKS.length })} onPress={() => router.push('/gallery')} />
            <ListRow testID="credits" title={t('home.credits')} sub="The Metropolitan Museum of Art · CC0 1.0" onPress={() => router.push('/credits')} />
            <ListRow testID="settings" title={t('home.settings')} onPress={() => router.push('/settings')} />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  masthead: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: space(6), paddingBottom: space(5), gap: space(1) },
  wall: { alignSelf: 'stretch', alignItems: 'center', paddingTop: space(8), paddingBottom: space(8), paddingHorizontal: space(5) },
  brass: { width: 54, height: 3, borderRadius: radius.xs, marginTop: space(5), opacity: 0.85 },
  enter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space(5),
    minHeight: 46,
    paddingHorizontal: space(5),
    borderWidth: 1,
    borderRadius: radius.pill,
  },
});
