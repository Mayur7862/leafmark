import { File } from 'expo-file-system';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getSavedBook } from '@/src/fs/books';
import { parseEpub, type ParsedEpub } from '@/src/reader/parseEpub';

export default function ReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const tint = useThemeColor({}, 'tint');
  const book = typeof id === 'string' ? getSavedBook(id) : null;

  const [parsed, setParsed] = useState<ParsedEpub | null>(null);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!book) {
        setError('Book not found.');
        setLoading(false);
        return;
      }

      try {
        const bytes = await new File(book.originalPath).bytes();
        const next = await parseEpub(bytes);
        if (!cancelled) {
          setParsed(next);
          setChapterIndex(0);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not open EPUB');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [book]);

  const chapter = parsed?.chapters[chapterIndex];

  useLayoutEffect(() => {
    navigation.setOptions({
      title: chapter?.title ?? book?.title ?? 'Reader',
    });
  }, [navigation, chapter?.title, book?.title]);

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
        <ThemedText>Opening book…</ThemedText>
      </ThemedView>
    );
  }

  if (error || !parsed || !chapter) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>{error ?? 'Nothing to read.'}</ThemedText>
      </ThemedView>
    );
  }

  const atStart = chapterIndex === 0;
  const atEnd = chapterIndex >= parsed.chapters.length - 1;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText style={styles.body}>{chapter.text}</ThemedText>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.navButton, { backgroundColor: tint, opacity: atStart ? 0.4 : 1 }]}
          disabled={atStart}
          onPress={() => setChapterIndex((value) => Math.max(0, value - 1))}>
          <ThemedText style={styles.navLabel} lightColor="#fff" darkColor="#11181C">
            Prev
          </ThemedText>
        </Pressable>
        <ThemedText>
          {chapterIndex + 1} / {parsed.chapters.length}
        </ThemedText>
        <Pressable
          style={[styles.navButton, { backgroundColor: tint, opacity: atEnd ? 0.4 : 1 }]}
          disabled={atEnd}
          onPress={() => setChapterIndex((value) => Math.min(parsed.chapters.length - 1, value + 1))}>
          <ThemedText style={styles.navLabel} lightColor="#fff" darkColor="#11181C">
            Next
          </ThemedText>
        </Pressable>
      </View>
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
    gap: 12,
    padding: 16,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  body: {
    fontSize: 18,
    lineHeight: 28,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#8884',
  },
  navButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  navLabel: {
    fontWeight: '600',
  },
});
