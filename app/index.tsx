import * as DocumentPicker from 'expo-document-picker';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { listSavedBooks, saveOriginalEpub, type SavedBook } from '@/src/fs/books';

export default function LibraryScreen() {
  const tint = useThemeColor({}, 'tint');
  const [books, setBooks] = useState<SavedBook[]>([]);

  const reloadBooks = useCallback(() => {
    setBooks(listSavedBooks());
  }, []);

  useEffect(() => {
    reloadBooks();
  }, [reloadBooks]);

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
      saveOriginalEpub(file.uri, file.name);
      reloadBooks();
    } catch (error) {
      Alert.alert('Import failed', error instanceof Error ? error.message : 'Could not save file');
    }
  }

  return (
    <ThemedView style={styles.container}>
      <Pressable style={[styles.button, { backgroundColor: tint }]} onPress={() => void importEpub()}>
        <ThemedText style={styles.buttonLabel} lightColor="#fff" darkColor="#11181C">
          Import
        </ThemedText>
      </Pressable>

      <FlatList
        data={books}
        keyExtractor={(item) => item.bookId}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<ThemedText style={styles.empty}>No books yet.</ThemedText>}
        renderItem={({ item }) => (
          <ThemedView style={styles.row}>
            <ThemedText type="defaultSemiBold">{item.title}</ThemedText>
          </ThemedView>
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  button: {
    alignSelf: 'flex-start',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonLabel: {
    fontWeight: '600',
  },
  list: {
    paddingTop: 16,
    gap: 8,
    flexGrow: 1,
  },
  row: {
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  empty: {
    marginTop: 32,
    textAlign: 'center',
    opacity: 0.7,
  },
});
