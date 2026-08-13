import { Alert, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function LibraryScreen() {
  const tint = useThemeColor({}, 'tint');

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">MReader</ThemedText>
      <ThemedText style={styles.body}>No books yet. App is running. and working great </ThemedText>
      <Pressable
        style={[styles.button, { backgroundColor: tint }]}
        onPress={() => Alert.alert('Import', 'Import not wired yet.')}>
        <ThemedText style={styles.buttonLabel} lightColor="#fff" darkColor="#11181C">
          Import
        </ThemedText>
      </Pressable>
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
  button: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonLabel: {
    fontWeight: '600',
  },
});
