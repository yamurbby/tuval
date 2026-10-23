import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Icon } from '../components/Icon';
import { DropCap } from '../components/DropCap';
import { Frame, Seal } from '../components/Plate';
import { AppText, Button, Eyebrow, Header, Rule, Screen } from '../components/ui';
import { byline, exhibitionWorks, getExhibition, localize, pick } from '../content/catalog';
import { downloadAll, mb } from '../content/download';
import { progress } from '../game/engine';
import { useApp } from '../state/AppContext';
import { radius, space } from '../theme';

export default function ExhibitionScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t, theme, locale, collection, games, downloaded, markDownloaded } = useApp();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const contentW = Math.min(width - space(10), 600);
  const ex = getExhibition(id);
  const [dl, setDl] = useState<{ a: number; b: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const cancelled = useRef(false);
  useEffect(
    () => () => {
      cancelled.current = true;
    },
    [],
  );

  if (!ex) {
    return (
      <Screen>
        <Header onBack={() => router.back()} />
        <AppText variant="title" style={{ marginTop: space(8) }}>
          {t('exhibition.notFound')}
        </AppText>
      </Screen>
    );
  }
  const works = exhibitionWorks(ex.id);
  const online = works.filter((a) => !a.bundled);
  const missing = online.filter((a) => !downloaded[a.id]);
  const missingMb = mb(missing.reduce((s, a) => s + a.fileSize, 0));
  const done = works.filter((a) => (collection[a.id] ?? []).length > 0).length;

  const startDownload = async () => {
    setFailed(false);
    let n = 0;
    setDl({ a: 0, b: missing.length });
    const bad = await downloadAll(
      missing,
      (a) => {
        n += 1;
        markDownloaded([a.id]);
        if (!cancelled.current) setDl({ a: n, b: missing.length });
      },
      () => cancelled.current,
    );
    if (cancelled.current) return;
    setDl(null);
    setFailed(bad.length > 0);
  };

  return (
    <Screen>
      <Header title={pick(ex.title, locale)} onBack={() => router.back()} />
      <FlatList
        data={works}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ paddingBottom: space(10), alignItems: 'center' }}
        ListHeaderComponent={
          <View style={{ width: contentW, paddingTop: space(4) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
              <Seal color={ex.seal} mark={ex.mark} size={52} faded={done < works.length} />
              <View style={{ flex: 1 }}>
                <Eyebrow>{pick(ex.span, locale)}</Eyebrow>
                <AppText variant="small" color={theme.inkSoft} style={{ marginTop: 2 }}>
                  {t('home.exhibitionRow', { done, total: works.length })}
                </AppText>
              </View>
            </View>
            <AppText variant="display" style={{ marginTop: space(4) }} accessibilityRole="header">
              {pick(ex.title, locale)}
            </AppText>
            <DropCap text={pick(ex.intro, locale)} color={ex.seal} size={18} style={{ marginTop: space(3) }} />

            {online.length ? (
              <View style={[styles.panel, { backgroundColor: theme.paperDeep }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
                  <Icon name={missing.length ? 'cloud' : 'check'} size={20} color={theme.inkSoft} />
                  <AppText variant="small" color={theme.inkSoft} style={{ flex: 1 }} accessibilityLiveRegion="polite">
                    {dl
                      ? t('exhibition.downloading', { a: dl.a, b: dl.b })
                      : missing.length
                        ? t('exhibition.online', { n: missing.length })
                        : t('exhibition.downloaded')}
                  </AppText>
                </View>
                {failed ? (
                  <AppText variant="small" color={theme.tile} style={{ marginTop: space(2) }}>
                    {t('exhibition.downloadFailed')}
                  </AppText>
                ) : null}
                {missing.length && !dl ? (
                  <Button kind="secondary" icon="download" label={t('exhibition.download', { mb: missingMb })} onPress={startDownload} style={{ marginTop: space(3) }} testID="download" />
                ) : null}
                {dl ? (
                  <View style={[styles.bar, { backgroundColor: theme.rule }]}>
                    <View style={{ width: `${(dl.a / Math.max(1, dl.b)) * 100}%`, height: '100%', backgroundColor: theme.olive }} />
                  </View>
                ) : null}
              </View>
            ) : null}
            <Rule style={{ marginTop: space(6) }} />
          </View>
        }
        renderItem={({ item, index }) => {
          const n = localize(item, locale);
          const recs = collection[item.id] ?? [];
          const running = Object.values(games).filter((g) => g.puzzleId === item.id);
          const status = recs.length
            ? t('collection.completed', { list: recs.map((r) => r.pieces).join(', ') })
            : running.length
              ? t('collection.inProgress', { p: Math.round(Math.max(...running.map(progress)) * 100) })
              : !item.bundled && !downloaded[item.id]
                ? `${t('exhibition.onlineBadge')} · ${mb(item.fileSize)} MB`
                : t('collection.notStarted');
          return (
            <Pressable
              testID={`art-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${index + 1}. ${n.title}, ${byline(item, n)}. ${status}`}
              onPress={() => router.push({ pathname: '/level', params: { puzzle: item.id } })}
              style={({ pressed }) => [styles.entry, { width: contentW, borderBottomColor: theme.rule, opacity: pressed ? 0.85 : 1 }]}
            >
              <View style={[styles.wallCard, { backgroundColor: theme.paperDeep }]}>
                <Frame art={item} width={contentW - space(16)} maxHeight={height * 0.42} />
              </View>
              <View style={styles.caption}>
                <AppText variant="small" color={ex.seal} weight="600" style={{ width: 30, marginTop: 5, fontVariant: ['tabular-nums'] }}>
                  {String(index + 1).padStart(2, '0')}
                </AppText>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText serif variant="h2" italic>
                    {n.title}
                  </AppText>
                  <AppText variant="small" color={theme.inkSoft}>
                    {byline(item, n)}
                  </AppText>
                  {n.note ? (
                    <AppText serif color={theme.ink} numberOfLines={3} style={{ marginTop: space(1.5), fontSize: 16.5 * theme.fontScale, lineHeight: 23 * theme.fontScale }}>
                      {n.note}
                    </AppText>
                  ) : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: space(1.5) }}>
                    {recs.length ? <Icon name="check" size={14} color={theme.olive} /> : null}
                    {!recs.length && !item.bundled && !downloaded[item.id] ? <Icon name="cloud" size={14} color={theme.inkSoft} /> : null}
                    <AppText variant="tiny" color={recs.length ? theme.olive : theme.inkSoft}>
                      {status}
                    </AppText>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: { marginTop: space(6), padding: space(4), borderRadius: radius.md },
  bar: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: space(3) },
  entry: { paddingVertical: space(6), borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  wallCard: { paddingVertical: space(8), alignItems: 'center', borderRadius: radius.xs },
  caption: { flexDirection: 'row', marginTop: space(4) },
});
