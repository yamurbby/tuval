import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Plate } from '../components/Plate';
import { AppText, Header, Rule, Screen } from '../components/ui';
import { ARTWORKS, byline, CATEGORIES, CategoryId, getExhibition, localize, pick } from '../content/catalog';
import { useApp } from '../state/AppContext';
import { space } from '../theme';

export default function Gallery() {
  const { t, theme, collection, locale } = useApp();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const [cat, setCat] = useState<CategoryId | 'all'>('all');
  const items = cat === 'all' ? ARTWORKS : ARTWORKS.filter((a) => a.category === cat);
  const contentW = Math.min(width - space(10), 640);

  return (
    <Screen>
      <Header title={t('gallery.title')} onBack={() => router.back()} />
      <FlatList
        data={items}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ paddingBottom: space(8), alignItems: 'center' }}
        ListHeaderComponent={
          <View style={{ width: contentW }}>
            {/* Bölümler: satır kaydırmalı metin sekmeleri (yatay kaydırma yok) */}
            <View style={styles.tabs} accessibilityRole="tablist">
              {(['all', ...CATEGORIES] as const).map((c) => {
                const active = c === cat;
                return (
                  <Pressable
                    key={c}
                    testID={`cat-${c}`}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    onPress={() => setCat(c)}
                    style={styles.tab}
                  >
                    <AppText variant="small" weight={active ? '600' : '400'} color={active ? theme.ink : theme.inkSoft}>
                      {c === 'all' ? t('gallery.all') : pick(getExhibition(c)!.title, locale)}
                    </AppText>
                    <View style={{ height: 1.5, marginTop: 4, backgroundColor: active ? theme.tile : 'transparent' }} />
                  </Pressable>
                );
              })}
            </View>
            <AppText variant="tiny" color={theme.inkSoft} style={{ marginBottom: space(2) }}>
              {t('gallery.count', { n: items.length })}
            </AppText>
            <Rule />
          </View>
        }
        ListEmptyComponent={
          <AppText color={theme.inkSoft} style={{ marginTop: space(8) }}>
            {t('gallery.empty')}
          </AppText>
        }
        renderItem={({ item }) => {
          const n = localize(item, locale);
          const done = (collection[item.id] ?? []).length > 0;
          return (
            <Pressable
              testID={`art-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${n.title}, ${item.artist}, ${n.date}`}
              onPress={() => router.push({ pathname: '/level', params: { puzzle: item.id } })}
              style={({ pressed }) => [styles.entry, { width: contentW, borderBottomColor: theme.rule, opacity: pressed ? 0.85 : 1 }]}
            >
              {/* Geniş önizleme: eser kendi oranında, kırpılmadan */}
              <Plate art={item} width={contentW} maxHeight={height * 0.55} />
              <View style={styles.caption}>
                <AppText variant="tiny" color={theme.inkSoft} style={{ width: 28, marginTop: 4 }}>
                  {item.number}
                </AppText>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText serif variant="h2" italic>
                    {n.title}
                  </AppText>
                  <AppText variant="small">{byline(item, n)}</AppText>
                  <AppText variant="small" color={theme.inkSoft}>
                    {n.medium}
                  </AppText>
                  <AppText variant="tiny" color={theme.inkSoft}>
                    {pick(getExhibition(item.category)!.title, locale)} · The Met · CC0{done ? ` · ${t('complete.title')}` : ''}{!item.bundled ? ` · ${t('exhibition.onlineBadge')}` : ''}
                  </AppText>
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
  tabs: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space(4), rowGap: space(1), marginBottom: space(3) },
  tab: { minHeight: 40, justifyContent: 'flex-end' },
  entry: { paddingVertical: space(6), borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  caption: { flexDirection: 'row', marginTop: space(3) },
});
