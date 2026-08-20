import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { TocItem } from '@/src/lib/ink-engine';

type Props = {
  visible: boolean;
  items: TocItem[];
  onClose: () => void;
  onSelect: (item: TocItem) => void;
};

function TocBranch({
  items,
  depth,
  onSelect,
}: {
  items: TocItem[];
  depth: number;
  onSelect: (item: TocItem) => void;
}) {
  return (
    <>
      {items.map((item) => (
        <View key={item.id}>
          <Pressable onPress={() => onSelect(item)} style={[styles.row, { paddingLeft: 12 + depth * 16 }]}>
            <ThemedText>{item.label}</ThemedText>
          </Pressable>
          {item.children.length > 0 ? (
            <TocBranch items={item.children} depth={depth + 1} onSelect={onSelect} />
          ) : null}
        </View>
      ))}
    </>
  );
}

export function TocModal({ visible, items, onClose, onSelect }: Props) {
  const tint = useThemeColor({}, 'tint');

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="subtitle">Contents</ThemedText>
          <Pressable onPress={onClose} style={[styles.close, { backgroundColor: tint }]}>
            <ThemedText style={styles.closeLabel} lightColor="#fff" darkColor="#11181C">
              Close
            </ThemedText>
          </Pressable>
        </View>
        <ScrollView>
          {items.length === 0 ? (
            <ThemedText style={styles.empty}>No table of contents.</ThemedText>
          ) : (
            <TocBranch items={items} depth={0} onSelect={onSelect} />
          )}
        </ScrollView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 48,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  close: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  closeLabel: {
    fontWeight: '600',
  },
  row: {
    paddingVertical: 12,
    paddingRight: 16,
  },
  empty: {
    padding: 16,
    opacity: 0.7,
  },
});
