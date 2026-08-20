import { File } from 'expo-file-system';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getSavedBook } from '@/src/fs/books';
import {
  InkEngine,
  DEFAULT_READER_SETTINGS,
  type InkBook,
  type ReadingLocation,
  type TocItem,
} from '@/src/lib/ink-engine';
import { resolvePackagePath, splitHref } from '@/src/lib/ink-engine/path';
import { SectionWebView } from '@/src/reader/SectionWebView';
import { TocModal } from '@/src/reader/TocModal';

export default function ReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookId = typeof id === 'string' ? id : null;
  const navigation = useNavigation();
  const tint = useThemeColor({}, 'tint');

  const libraryBook = useMemo(() => (bookId ? getSavedBook(bookId) : null), [bookId]);

  const [inkBook, setInkBook] = useState<InkBook | null>(null);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [fragment, setFragment] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [location, setLocation] = useState<ReadingLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!bookId) {
        setError('Book not found.');
        setLoading(false);
        return;
      }

      const saved = getSavedBook(bookId);
      if (!saved) {
        setError('Book not found.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const bytes = await new File(saved.originalPath).bytes();
        const book = await InkEngine.load(bytes);
        if (!cancelled) {
          setInkBook(book);
          setSectionIndex(0);
          setFragment(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not open EPUB');
          setInkBook(null);
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
  }, [bookId]);

  const spineItem = inkBook?.getSpineItem(sectionIndex) ?? null;

  useEffect(() => {
    let cancelled = false;

    async function renderSection() {
      if (!inkBook || !spineItem) {
        setHtml(null);
        return;
      }

      setRendering(true);
      try {
        const nextHtml = await inkBook.getRenderableHtml(spineItem.id, DEFAULT_READER_SETTINGS);
        if (!cancelled) {
          setHtml(nextHtml);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not render section');
          setHtml(null);
        }
      } finally {
        if (!cancelled) {
          setRendering(false);
        }
      }
    }

    void renderSection();
    return () => {
      cancelled = true;
    };
  }, [inkBook, spineItem]);

  useEffect(() => {
    if (!inkBook || !spineItem) {
      setLocation(null);
      return;
    }
    setLocation(
      inkBook.createLocation({
        sectionId: spineItem.id,
        fragment,
        progress: (spineItem.index + 1) / inkBook.getSectionCount(),
      })
    );
  }, [inkBook, spineItem, fragment]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: libraryBook?.title ?? inkBook?.metadata.title ?? 'Reader',
      headerRight: () => (
        <Pressable onPress={() => setTocOpen(true)} style={{ paddingHorizontal: 12 }}>
          <ThemedText style={{ color: tint, fontWeight: '600' }}>TOC</ThemedText>
        </Pressable>
      ),
    });
  }, [navigation, libraryBook?.title, inkBook?.metadata.title, tint]);

  const goNext = useCallback(() => {
    if (!inkBook || !spineItem) {
      return;
    }
    const next = inkBook.getNextSection(spineItem.id);
    if (!next) {
      return;
    }
    setFragment(null);
    setSectionIndex(next.index);
  }, [inkBook, spineItem]);

  const goPrev = useCallback(() => {
    if (!inkBook || !spineItem) {
      return;
    }
    const previous = inkBook.getPreviousSection(spineItem.id);
    if (!previous) {
      return;
    }
    setFragment(null);
    setSectionIndex(previous.index);
  }, [inkBook, spineItem]);

  const openTocItem = useCallback(
    (item: TocItem) => {
      if (!inkBook) {
        return;
      }
      const target = inkBook.resolveTocTarget(item);
      if (!target) {
        return;
      }
      setTocOpen(false);
      setFragment(target.fragment);
      setSectionIndex(target.section.index);
    },
    [inkBook]
  );

  const handleInternalLink = useCallback(
    (href: string) => {
      if (!inkBook || !spineItem) {
        return;
      }

      if (href.startsWith('#')) {
        setFragment(href.slice(1) || null);
        return;
      }

      const split = splitHref(href);
      const packagePath = resolvePackagePath(spineItem.href, split.path);
      const section = inkBook.findSpineByHref(packagePath);
      if (section) {
        setFragment(split.fragment);
        setSectionIndex(section.index);
      }
    },
    [inkBook, spineItem]
  );

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
        <ThemedText>Opening book…</ThemedText>
      </ThemedView>
    );
  }

  if (error || !inkBook || !spineItem) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>{error ?? 'Nothing to read.'}</ThemedText>
      </ThemedView>
    );
  }

  const atStart = sectionIndex === 0;
  const atEnd = sectionIndex >= inkBook.getSectionCount() - 1;

  return (
    <ThemedView style={styles.container}>
      <View style={styles.reader}>
        {rendering || !html ? (
          <View style={styles.centered}>
            <ActivityIndicator />
          </View>
        ) : (
          <SectionWebView
            key={`${spineItem.id}:${fragment ?? ''}:${location?.sectionId ?? ''}`}
            html={html}
            fragment={fragment}
            onInternalLink={handleInternalLink}
          />
        )}
      </View>

      <View style={styles.footer}>
        <Pressable
          style={[styles.navButton, { backgroundColor: tint, opacity: atStart ? 0.4 : 1 }]}
          disabled={atStart}
          onPress={goPrev}>
          <ThemedText style={styles.navLabel} lightColor="#fff" darkColor="#11181C">
            Prev
          </ThemedText>
        </Pressable>
        <ThemedText>
          Section {sectionIndex + 1} / {inkBook.getSectionCount()}
        </ThemedText>
        <Pressable
          style={[styles.navButton, { backgroundColor: tint, opacity: atEnd ? 0.4 : 1 }]}
          disabled={atEnd}
          onPress={goNext}>
          <ThemedText style={styles.navLabel} lightColor="#fff" darkColor="#11181C">
            Next
          </ThemedText>
        </Pressable>
      </View>

      <TocModal
        visible={tocOpen}
        items={inkBook.toc}
        onClose={() => setTocOpen(false)}
        onSelect={openTocItem}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  reader: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 16,
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
