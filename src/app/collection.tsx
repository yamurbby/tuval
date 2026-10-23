import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Plate, Seal } from '../components/Plate';
import { AppText, Button, Header, ListRow, Rule, Screen } from '../components/ui';
import { ARTWORKS, Artwork, EXHIBITIONS, exhibitionWorks, localize, pick } from '../content/catalog';
import { progress } from '../game/engine';
import { useApp } from '../state/AppContext';
import { radius, space } from '../theme';

/** Sergi albümü: tamamlanan eserler kartlar halinde, boş çerçeveler sırasını bekler. */
export default function Album() {
  const { t, theme, collection, games, locale } = useApp();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const contentW = Math.min(width - space(10), 640);
  const cols = contentW > 520 ? 4 : 3;
  const gap = space(2.5);
  const cardW = (contentW - gap * (cols - 1)) / cols;
  const isDone = (a: Artwork) => (collection[a.id] ?? []).length > 0;
  const doneAll = ARTWORKS.filter(isDone).length;

  const card = (a: Artwork, i: number, seal: string) => {
    const n = localize(a, locale);
    const done = isDone(a);
    const running = Object.values(games).filter((g) => g.puzzleId === a.id);
    const p = running.length ? Math.round(Math.max(...running.map(progress)) * 100) : null;
    const label = done
      ? t('collection.completed', { list: (collection[a.id] ?? []).map((r) => r.pieces).join(', ') })
      : p != null
        ? t('collection.inProgress', { p })
        : t('collection.emptySlot');
    return (
      <Pressable
        key={a.id}
        testID={`card-${a.id}`}
        accessibilityRole="button"
        accessibilityLabel={`${i + 1}. ${n.title}. ${label}`}
        onPress={() => router.push({ pathname: '/level', params: { puzzle: a.id } })}
        style={({ pressed }) => [
          styles.card,
          {
            width: cardW,
            backgroundColor: done ? theme.surface : 'transparent',
            borderColor: done ? theme.rule : theme.stone,
            borderStyle: done ? 'solid' : 'dashed',
            opacity: pressed ? 0.75 : 1,
          },
        ]}
      >
        <View style={{ height: cardW * 0.9, alignItems: 'center', justifyContent: 'center' }}>
          {done || p != null ? (
            <Plate art={a} width={cardW - space(4)} maxHeight={cardW * 0.82} dim={!done} />
          ) : (
            <AppText serif variant="title" color={theme.stone}>
              {i + 1}
            </AppText>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: space(1.5) }}>
          {done ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: seal }} /> : null}
          <AppText variant="tiny" color={done ? theme.ink : theme.inkSoft} numberOfLines={2} style={{ flex: 1 }}>
            {done ? n.title : p != null ? `%${p}` : t('collection.emptySlot')}
          </AppText>
        </View>
      </Pressable>
    );
  };

  return (
    <Screen>
      <Header title={t('collection.title')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: space(10), alignItems: 'center' }}>
        <View style={{ width: contentW }}>
          {doneAll === 0 ? (
            <View style={{ paddingVertical: space(5), gap: space(2) }}>
              <AppText variant="title">{t('collection.emptyTitle')}</AppText>
              <AppText color={theme.inkSoft}>{t('collection.emptyBody')}</AppText>
              <Button kind="secondary" label={t('collection.browse')} onPress={() => router.replace('/')} style={{ marginTop: space(3), alignSelf: 'flex-start' }} />
            </View>
          ) : (
            <AppText variant="small" color={theme.inkSoft} style={{ marginVertical: space(3) }}>
              {t('collection.summary', { done: doneAll, total: ARTWORKS.length })}
            </AppText>
          )}

          {EXHIBITIONS.map((ex) => {
            const works = exhibitionWorks(ex.id);
            const done = works.filter(isDone).length;
            const complete = done === works.length;
            return (
              <View key={ex.id} style={{ marginTop: space(8) }} testID={`album-${ex.id}`}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/exhibition', params: { id: ex.id } })}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space(3), marginBottom: space(3) }}
                >
                  <Seal color={ex.seal} mark={ex.mark} size={44} faded={!complete} />
                  <View style={{ flex: 1 }}>
                    <AppText serif variant="h2">
                      {pick(ex.title, locale)}
                    </AppText>
                    <AppText variant="tiny" color={complete ? ex.seal : theme.inkSoft} weight={complete ? '600' : '400'}>
                      {complete ? t('collection.exhibitionDone') : t('home.exhibitionRow', { done, total: works.length })}
                    </AppText>
                  </View>
                </Pressable>
                <View style={[styles.track, { backgroundColor: theme.rule }]}>
                  <View style={{ width: `${(done / works.length) * 100}%`, height: '100%', backgroundColor: ex.seal }} />
                </View>
                <View style={[styles.grid, { gap }]}>{works.map((a, i) => card(a, i, ex.seal))}</View>
              </View>
            );
          })}

          <View style={{ marginTop: space(10) }}>
            <Rule />
            <ListRow testID="credits" title={t('credits.title')} sub="The Metropolitan Museum of Art · CC0 1.0" onPress={() => router.push('/credits')} />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  track: { height: 3, borderRadius: 2, overflow: 'hidden', marginBottom: space(4) },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { borderWidth: 1, borderRadius: radius.sm, padding: space(2), minHeight: 60 },
});
