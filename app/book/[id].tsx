import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getSavedBook } from '@/src/fs/books';

export default function BookDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const tint = useThemeColor({}, 'tint');
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
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">{book.title}</ThemedText>

        <Pressable
          style={[styles.readButton, { backgroundColor: tint }]}
          onPress={() => router.push(`/reader/${book.bookId}`)}>
          <ThemedText style={styles.readLabel} lightColor="#fff" darkColor="#11181C">
            Read
          </ThemedText>
        </Pressable>

        <ThemedText style={styles.label}>Original file</ThemedText>
        <ThemedText>{book.originalName ?? '—'}</ThemedText>
        <ThemedText style={styles.label}>Stored path</ThemedText>
        <ThemedText style={styles.path}>{book.originalPath}</ThemedText>
        <ThemedText style={styles.label}>Imported</ThemedText>
        <ThemedText>{book.createdAt ?? '—'}</ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
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
  readButton: {
    marginTop: 16,
    marginBottom: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  readLabel: {
    fontWeight: '600',
  },
});
