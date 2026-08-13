import { Directory, File, Paths } from 'expo-file-system';

import { createId } from '@/src/lib/id';

export function getBooksRoot(): Directory {
  return new Directory(Paths.document, 'books');
}

export function saveOriginalEpub(sourceUri: string): { bookId: string; originalPath: string } {
  const booksRoot = getBooksRoot();
  if (!booksRoot.exists) {
    booksRoot.create({ intermediates: true, idempotent: true });
  }

  const bookId = createId();
  const bookDir = new Directory(booksRoot, bookId);
  bookDir.create({ intermediates: true, idempotent: true });

  const original = new File(bookDir, 'original.epub');
  new File(sourceUri).copy(original);

  return { bookId, originalPath: original.uri };
}
