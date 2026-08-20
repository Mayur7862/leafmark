import { useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSavedBook } from '@/src/fs/books';

export default function BookDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const book = typeof id === 'string' ? getSavedBook(id) : null;

  if (!book) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Book not found.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">{book.title}</ThemedText>
      <ThemedText style={styles.label}>Original file</ThemedText>
      <ThemedText>{book.originalName ?? '—'}</ThemedText>
      <ThemedText style={styles.label}>Stored path</ThemedText>
      <ThemedText style={styles.path}>{book.originalPath}</ThemedText>
      <ThemedText style={styles.label}>Imported</ThemedText>
      <ThemedText>{book.createdAt ?? '—'}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 8,
  },
  label: {
    marginTop: 12,
    opacity: 0.6,
  },
  path: {
    fontSize: 13,
  },
});
