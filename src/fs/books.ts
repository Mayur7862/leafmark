import { Directory, File, Paths } from 'expo-file-system';

import { createId } from '@/src/lib/id';

export type SavedBook = {
  bookId: string;
  title: string;
  originalName: string | null;
  originalPath: string;
  createdAt: string | null;
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

function bookFromDir(bookDir: Directory): SavedBook | null {
  const original = new File(bookDir, 'original.epub');
  if (!original.exists) {
    return null;
  }

  const meta = readMeta(bookDir);
  return {
    bookId: bookDir.name,
    title: meta ? titleFromName(meta.originalName) : 'Untitled book',
    originalName: meta?.originalName ?? null,
    originalPath: original.uri,
    createdAt: meta?.createdAt ?? null,
  };
}

export function getSavedBook(bookId: string): SavedBook | null {
  const bookDir = new Directory(getBooksRoot(), bookId);
  if (!bookDir.exists) {
    return null;
  }
  return bookFromDir(bookDir);
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
    const book = bookFromDir(item);
    if (book) {
      books.push(book);
    }
  }

  return books.reverse();
}

export function clearAllBooks(): void {
  // TEMPORARY: debug wipe for imported books (file storage, not a DB). Remove later.
  const booksRoot = getBooksRoot();
  if (booksRoot.exists) {
    booksRoot.delete();
  }
}
