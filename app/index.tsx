import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function LibraryScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">MReader</ThemedText>
      <ThemedText style={styles.body}>No books yet. App is running. and working great </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  body: {
    marginTop: 8,
    textAlign: 'center',
  },
});
