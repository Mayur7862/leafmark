import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getSavedBook, type SavedBook } from '@/src/fs/books';

export default function BookDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const tint = useThemeColor({}, 'tint');
  const [book, setBook] = useState<SavedBook | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (typeof id !== 'string') {
        setBook(null);
        setLoading(false);
        return;
      }
      const next = await getSavedBook(id);
      if (!cancelled) {
        setBook(next);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
