export type BookMetadata = {
  title: string;
  authors: string[];
  language: string | null;
  identifier: string | null;
  coverHref: string | null;
};

export type ManifestItem = {
  id: string;
  href: string;
  mediaType: string;
  properties: string[];
};

export type SpineItem = {
  id: string;
  index: number;
  href: string;
  mediaType: string;
  linear: boolean;
};

export type TocItem = {
  id: string;
  label: string;
  href: string;
  sectionId: string | null;
  fragment: string | null;
  children: TocItem[];
};

export type ReadingLocation = {
  sectionId: string;
  /** Practical locator today; designed to grow into CFI later. */
  locator: string | null;
  progress: number | null;
  fragment: string | null;
};

export type ReaderSettings = {
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  margin: number;
  theme: 'light' | 'dark' | 'sepia';
  textAlignment: 'left' | 'justify';
};

export type SectionDocument = {
  id: string;
  index: number;
  href: string;
  /** Original XHTML from the EPUB. Never mutate this string in place of the package. */
  xhtml: string;
};

export type HighlightRef = {
  bookId: string;
  sectionId: string;
  startLocator: string;
  endLocator: string;
  selectedText: string;
};

export type BookmarkRef = {
  bookId: string;
  location: ReadingLocation;
};

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  fontSize: 18,
  fontFamily: 'Georgia, serif',
  lineHeight: 1.6,
  margin: 16,
  theme: 'light',
  textAlignment: 'left',
};
