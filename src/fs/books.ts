import { Directory, File, Paths } from 'expo-file-system';

import { createId } from '@/src/lib/id';

export type SavedBook = {
  bookId: string;
  title: string;
};

type BookMeta = {
  originalName: string;
  createdAt: string;
};

export function getBooksRoot(): Directory {
  return new Directory(Paths.document, 'books');
}

function titleFromName(originalName: string): string {
  return originalName.replace(/\.epub$/i, '') || originalName;
}

function writeMeta(bookDir: Directory, originalName: string): void {
  const meta = new File(bookDir, 'meta.json');
  if (!meta.exists) {
    meta.create();
  }
  const data: BookMeta = {
    originalName,
    createdAt: new Date().toISOString(),
  };
  meta.write(JSON.stringify(data));
}

function readMeta(bookDir: Directory): BookMeta | null {
  const meta = new File(bookDir, 'meta.json');
  if (!meta.exists) {
    return null;
  }
  try {
    return JSON.parse(meta.textSync()) as BookMeta;
  } catch {
    return null;
  }
}

export function saveOriginalEpub(
  sourceUri: string,
  originalName: string
): { bookId: string; originalPath: string } {
  const booksRoot = getBooksRoot();
  if (!booksRoot.exists) {
    booksRoot.create({ intermediates: true, idempotent: true });
  }

  const bookId = createId();
  const bookDir = new Directory(booksRoot, bookId);
  bookDir.create({ intermediates: true, idempotent: true });

  const original = new File(bookDir, 'original.epub');
  new File(sourceUri).copy(original);
  writeMeta(bookDir, originalName);

  return { bookId, originalPath: original.uri };
}

export function listSavedBooks(): SavedBook[] {
  const booksRoot = getBooksRoot();
  if (!booksRoot.exists) {
    return [];
  }

  const books: SavedBook[] = [];
  for (const item of booksRoot.list()) {
    if (!(item instanceof Directory)) {
      continue;
    }
    const meta = readMeta(item);
    books.push({
      bookId: item.name,
      title: meta ? titleFromName(meta.originalName) : 'Untitled book',
    });
  }

  return books.reverse();
}
