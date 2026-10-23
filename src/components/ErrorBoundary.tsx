import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { palette } from '../theme';

interface State {
  error: Error | null;
}

/** Beklenmeyen hatalarda boş ekran yerine anlaşılır bir mesaj gösterir. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode; title: string; body: string; retry: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.warn('[Tuval] Yakalanan hata:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: palette.paper }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: palette.ink, textAlign: 'center' }} accessibilityRole="header">
          {this.props.title}
        </Text>
        <Text style={{ fontSize: 16, color: palette.inkSoft, textAlign: 'center', marginTop: 8 }}>{this.props.body}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => this.setState({ error: null })}
          style={{ marginTop: 24, backgroundColor: palette.olive, paddingHorizontal: 24, minHeight: 52, borderRadius: 16, justifyContent: 'center' }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{this.props.retry}</Text>
        </Pressable>
      </View>
    );
  }
}
