import { XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';

export type EpubChapter = {
  id: string;
  href: string;
  title: string;
  text: string;
};

export type ParsedEpub = {
  title: string;
  chapters: EpubChapter[];
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function joinPath(baseDir: string, relative: string): string {
  if (!baseDir) {
    return relative;
  }
  const cleaned = relative.replace(/^\.\//, '');
  const parts = `${baseDir}/${cleaned}`.split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') {
      continue;
    }
    if (part === '..') {
      out.pop();
      continue;
    }
    out.push(part);
  }
  return out.join('/');
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function chapterTitleFromHtml(html: string, fallback: string): string {
  const match = html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
  if (!match) {
    return fallback;
  }
  const title = htmlToText(match[1]);
  return title || fallback;
}

export async function parseEpub(bytes: Uint8Array): Promise<ParsedEpub> {
  const zip = await JSZip.loadAsync(bytes);

  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) {
    throw new Error('Invalid EPUB: missing container.xml');
  }

  const containerXml = await containerFile.async('text');
  const container = xmlParser.parse(containerXml);
  const rootfile =
    container?.container?.rootfiles?.rootfile?.['@_full-path'] ??
    asArray(container?.container?.rootfiles?.rootfile)[0]?.['@_full-path'];

  if (!rootfile || typeof rootfile !== 'string') {
    throw new Error('Invalid EPUB: missing rootfile');
  }

  const opfFile = zip.file(rootfile);
  if (!opfFile) {
    throw new Error('Invalid EPUB: missing OPF');
  }

  const opfDir = rootfile.includes('/') ? rootfile.slice(0, rootfile.lastIndexOf('/')) : '';
  const opfXml = await opfFile.async('text');
  const opf = xmlParser.parse(opfXml);
  const pkg = opf.package ?? opf['opf:package'];
  if (!pkg) {
    throw new Error('Invalid EPUB: missing package');
  }

  const metadata = pkg.metadata ?? {};
  const titleRaw = metadata['dc:title'] ?? metadata.title;
  const title =
    typeof titleRaw === 'string'
      ? titleRaw
      : typeof titleRaw?.['#text'] === 'string'
        ? titleRaw['#text']
        : 'Untitled';

  const manifestItems = asArray(pkg.manifest?.item);
  const hrefById = new Map<string, string>();
  for (const item of manifestItems) {
    const id = item?.['@_id'];
    const href = item?.['@_href'];
    if (typeof id === 'string' && typeof href === 'string') {
      hrefById.set(id, href);
    }
  }

  const spineRefs = asArray(pkg.spine?.itemref);
  const chapters: EpubChapter[] = [];

  for (let index = 0; index < spineRefs.length; index += 1) {
    const idref = spineRefs[index]?.['@_idref'];
    if (typeof idref !== 'string') {
      continue;
    }

    const href = hrefById.get(idref);
    if (!href) {
      continue;
    }

    const chapterPath = joinPath(opfDir, href);
    const chapterFile = zip.file(chapterPath);
    if (!chapterFile) {
      continue;
    }

    const html = await chapterFile.async('text');
    const text = htmlToText(html);
    if (!text) {
      continue;
    }

    chapters.push({
      id: idref,
      href: chapterPath,
      title: chapterTitleFromHtml(html, `Chapter ${chapters.length + 1}`),
      text,
    });
  }

  if (chapters.length === 0) {
    throw new Error('No readable chapters found');
  }

  return { title, chapters };
}
