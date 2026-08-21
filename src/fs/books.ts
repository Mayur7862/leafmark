import { createId } from '@/src/lib/id';
import {
  copyEpubToOriginals,
  deleteUriIfPossible,
  ensureLibraryFolders,
  getSavedLibraryFolders,
  readBytesFromUri,
  readTextUri,
  writeTextUri,
  type LibraryFolders,
} from '@/src/fs/libraryRoot';

export type SavedBook = {
  bookId: string;
  title: string;
  originalName: string | null;
  originalPath: string;
  createdAt: string | null;
};

type LibraryIndex = {
  books: SavedBook[];
};

function titleFromName(originalName: string): string {
  return originalName.replace(/\.epub$/i, '') || originalName;
}

function safeStorageBaseName(bookId: string, originalName: string): string {
  const base = originalName
    .replace(/\.epub$/i, '')
    .replace(/[^a-zA-Z0-9._ -]+/g, '_')
    .trim()
    .slice(0, 60);
  return `${bookId}__${base || 'book'}`;
}

async function loadIndexFromFolders(folders: LibraryFolders): Promise<LibraryIndex> {
  const raw = await readTextUri(folders.libraryJsonUri);
  if (!raw) {
    return { books: [] };
  }
  try {
    const parsed = JSON.parse(raw) as LibraryIndex;
    return { books: Array.isArray(parsed.books) ? parsed.books : [] };
  } catch {
    return { books: [] };
  }
}

async function writeIndex(folders: LibraryFolders, index: LibraryIndex): Promise<void> {
  await writeTextUri(folders.libraryJsonUri, JSON.stringify(index, null, 2));
}

/** Saves the untouched original EPUB into mreader/original_epubs. */
export async function saveOriginalEpub(
  sourceUri: string,
  originalName: string
): Promise<{ bookId: string; originalPath: string }> {
  // Shows setup alert + folder picker on Android if not configured yet.
  const folders = await ensureLibraryFolders();
  const index = await loadIndexFromFolders(folders);
  const bookId = createId();
  const originalPath = await copyEpubToOriginals(
    folders.originalsUri,
    sourceUri,
    safeStorageBaseName(bookId, originalName)
  );

  const book: SavedBook = {
    bookId,
    title: titleFromName(originalName),
    originalName,
    originalPath,
    createdAt: new Date().toISOString(),
  };

  index.books.unshift(book);
  await writeIndex(folders, index);

  return { bookId, originalPath };
}

export async function listSavedBooks(): Promise<SavedBook[]> {
  const folders = await getSavedLibraryFolders();
  if (!folders) {
    return [];
  }
  const index = await loadIndexFromFolders(folders);
  return index.books;
}

export async function getSavedBook(bookId: string): Promise<SavedBook | null> {
  const folders = await getSavedLibraryFolders();
  if (!folders) {
    return null;
  }
  const index = await loadIndexFromFolders(folders);
  return index.books.find((book) => book.bookId === bookId) ?? null;
}

export async function readBookBytes(bookId: string): Promise<Uint8Array> {
  const book = await getSavedBook(bookId);
  if (!book) {
    throw new Error('Book not found.');
  }
  return readBytesFromUri(book.originalPath);
}

/** TEMPORARY: wipe library index + original EPUB files. */
export async function clearAllBooks(): Promise<void> {
  const folders = await getSavedLibraryFolders();
  if (!folders) {
    return;
  }
  const index = await loadIndexFromFolders(folders);
  await Promise.all(index.books.map((book) => deleteUriIfPossible(book.originalPath)));
  await writeIndex(folders, { books: [] });
}

export function describeLibraryLocation(): string {
  return 'mreader/original_epubs';
}
