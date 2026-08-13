import * as DocumentPicker from 'expo-document-picker';
import { Alert, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { saveOriginalEpub } from '@/src/fs/books';

async function importEpub() {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/epub+zip',
    copyToCacheDirectory: true,
  });

  if (result.canceled) {
    return;
  }

  try {
    const file = result.assets[0];
    const saved = saveOriginalEpub(file.uri);
    Alert.alert('Saved original', `${file.name}\n${saved.originalPath}`);
  } catch (error) {
    Alert.alert('Import failed', error instanceof Error ? error.message : 'Could not save file');
  }
}

export default function LibraryScreen() {
  const tint = useThemeColor({}, 'tint');

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">MReader</ThemedText>
      <ThemedText style={styles.body}>No books yet. App is running. and working great </ThemedText>
      <Pressable style={[styles.button, { backgroundColor: tint }]} onPress={() => void importEpub()}>
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
