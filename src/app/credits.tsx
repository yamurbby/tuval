import { useRouter } from 'expo-router';
import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { AppText, Header, Rule, Screen } from '../components/ui';
import { ARTWORKS, localize } from '../content/catalog';
import { useApp } from '../state/AppContext';
import { space } from '../theme';

/** Kaynaklar ve lisanslar: her eserin künyesi, kaynak bağlantısı ve lisansı */
export default function Credits() {
  const { t, theme, locale } = useApp();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const contentW = Math.min(width - space(10), 640);
  const open = (url: string) => Linking.openURL(url).catch(() => {});

  return (
    <Screen>
      <Header title={t('credits.title')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: space(10) }}>
        <View style={{ width: contentW }}>
          <AppText color={theme.inkSoft} style={{ marginVertical: space(4) }}>
            {t('credits.intro')}
          </AppText>
          <View style={{ flexDirection: 'row', gap: space(5), marginBottom: space(4) }}>
            <Link label={t('credits.licenseOpen')} onPress={() => open(ARTWORKS[0].licenseUrl)} />
            <Link label={t('credits.policyOpen')} onPress={() => open(ARTWORKS[0].licensePolicyUrl)} />
          </View>
          <Rule />
          {ARTWORKS.map((a) => {
            const n = localize(a, locale);
            return (
              <View key={a.id} style={[styles.item, { borderBottomColor: theme.rule }]}>
                <AppText variant="tiny" color={theme.inkSoft}>
                  {a.number}
                </AppText>
                <AppText serif italic variant="body" style={{ fontSize: 18 * theme.fontScale }}>
                  {n.title}
                </AppText>
                <AppText variant="small">{a.attribution}</AppText>
                <AppText variant="tiny" color={theme.inkSoft}>
                  {a.accession} · {a.license}
                </AppText>
                <AppText variant="tiny" color={theme.inkSoft}>
                  {t('credits.verified', { date: a.verifiedAt })}
                </AppText>
                <Link label={t('credits.open')} onPress={() => open(a.sourceUrl)} />
              </View>
            );
          })}
          <AppText variant="tiny" color={theme.inkSoft} style={{ marginTop: space(6) }}>
            {t('credits.app')}
          </AppText>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  const { theme } = useApp();
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={{ minHeight: 40, justifyContent: 'center', alignSelf: 'flex-start' }}>
      <AppText variant="small" color={theme.tile} style={{ textDecorationLine: 'underline' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { paddingVertical: space(4), gap: 3, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
});
