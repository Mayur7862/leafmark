import { XMLParser } from 'fast-xml-parser';
import type JSZip from 'jszip';

import { asArray, dirname, resolvePackagePath, splitHref, textValue } from '@/src/lib/ink-engine/path';
import type { BookMetadata, ManifestItem, SpineItem, TocItem } from '@/src/lib/ink-engine/types';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: false,
});

export type ParsedPackage = {
  opfPath: string;
  opfDir: string;
  metadata: BookMetadata;
  manifest: ManifestItem[];
  manifestById: Map<string, ManifestItem>;
  spine: SpineItem[];
  toc: TocItem[];
};

function parseProperties(value: unknown): string[] {
  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }
  return value.split(/\s+/).filter(Boolean);
}

function findNavHref(manifest: ManifestItem[]): string | null {
  const nav = manifest.find((item) => item.properties.includes('nav'));
  return nav?.href ?? null;
}

function collectNavItems(
  node: unknown,
  opfDir: string,
  spineByHref: Map<string, SpineItem>,
  counter: { value: number }
): TocItem[] {
  const items: TocItem[] = [];
  const list = asArray((node as { li?: unknown })?.li);

  for (const li of list) {
    if (!li || typeof li !== 'object') {
      continue;
    }

    const entry = li as {
      a?: { '@_href'?: string; '#text'?: string } | string;
      ol?: unknown;
      span?: { '#text'?: string } | string;
    };

    const anchor = entry.a;
    const label =
      (typeof anchor === 'string' ? anchor : textValue(anchor) ?? textValue(anchor?.['#text'])) ||
      (typeof entry.span === 'string' ? entry.span : textValue(entry.span)) ||
      'Untitled';

    const hrefRaw = typeof anchor === 'object' ? anchor?.['@_href'] : undefined;
    let sectionId: string | null = null;
    let fragment: string | null = null;
    let href = '';

    if (typeof hrefRaw === 'string' && hrefRaw.length > 0) {
      const split = splitHref(hrefRaw);
      const packagePath = resolvePackagePath(opfDir ? `${opfDir}/nav.xhtml` : 'nav.xhtml', split.path);
      href = split.fragment ? `${packagePath}#${split.fragment}` : packagePath;
      fragment = split.fragment;
      sectionId = spineByHref.get(packagePath)?.id ?? null;
    }

    counter.value += 1;
    items.push({
      id: `toc-${counter.value}`,
      label: label.replace(/\s+/g, ' ').trim(),
      href,
      sectionId,
      fragment,
      children: entry.ol ? collectNavItems(entry.ol, opfDir, spineByHref, counter) : [],
    });
  }

  return items;
}

async function parseNavToc(
  zip: JSZip,
  navPath: string,
  opfDir: string,
  spine: SpineItem[]
): Promise<TocItem[]> {
  const file = zip.file(navPath);
  if (!file) {
    return [];
  }

  const xml = await file.async('text');
  const parsed = xmlParser.parse(xml);
  const html = parsed.html ?? parsed;
  const body = html.body ?? html;
  const navCandidates = [
    ...asArray(body?.nav),
    ...asArray(html?.nav),
  ];

  const tocNav =
    navCandidates.find((nav) => {
      if (!nav || typeof nav !== 'object') {
        return false;
      }
      const attrs = nav as Record<string, unknown>;
      const type = attrs['@_epub:type'] ?? attrs['@_type'];
      return type === 'toc' || attrs['@_role'] === 'doc-toc';
    }) ?? navCandidates[0];

  if (!tocNav) {
    return [];
  }

  const spineByHref = new Map(spine.map((item) => [item.href, item]));
  return collectNavItems(tocNav.ol ?? tocNav, opfDir, spineByHref, { value: 0 });
}

function parseMetadata(raw: Record<string, unknown>, manifest: ManifestItem[], opfDir: string): BookMetadata {
  const title =
    textValue(raw['dc:title']) ??
    textValue(raw.title) ??
    'Untitled';

  const creators = asArray(raw['dc:creator'] ?? raw.creator)
    .map((item) => textValue(item))
    .filter((item): item is string => Boolean(item));

  const language = textValue(raw['dc:language'] ?? raw.language);
  const identifier = textValue(raw['dc:identifier'] ?? raw.identifier);

  const coverMeta = asArray(raw.meta).find((item) => {
    if (!item || typeof item !== 'object') {
      return false;
    }
    return (item as { '@_name'?: string })['@_name'] === 'cover';
  }) as { '@_content'?: string } | undefined;

  let coverHref: string | null = null;
  if (coverMeta?.['@_content']) {
    const coverItem = manifest.find((item) => item.id === coverMeta['@_content']);
    coverHref = coverItem?.href ?? null;
  }
  if (!coverHref) {
    const coverProp = manifest.find((item) => item.properties.includes('cover-image'));
    coverHref = coverProp?.href ?? null;
  }
  if (coverHref) {
    coverHref = resolvePackagePath(opfDir ? `${opfDir}/content.opf` : 'content.opf', coverHref);
  }

  return {
    title,
    authors: creators,
    language,
    identifier,
    coverHref,
  };
}

export async function parsePackage(zip: JSZip): Promise<ParsedPackage> {
  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) {
    throw new Error('Invalid EPUB: missing META-INF/container.xml');
  }

  const container = xmlParser.parse(await containerFile.async('text'));
  const rootfile =
    container?.container?.rootfiles?.rootfile?.['@_full-path'] ??
    asArray(container?.container?.rootfiles?.rootfile)[0]?.['@_full-path'];

  if (typeof rootfile !== 'string' || !rootfile) {
    throw new Error('Invalid EPUB: missing rootfile');
  }

  const opfFile = zip.file(rootfile);
  if (!opfFile) {
    throw new Error(`Invalid EPUB: missing OPF at ${rootfile}`);
  }

  const opfDir = dirname(rootfile);
  const opf = xmlParser.parse(await opfFile.async('text'));
  const pkg = opf.package ?? opf['opf:package'];
  if (!pkg) {
    throw new Error('Invalid EPUB: missing package element');
  }

  const manifest: ManifestItem[] = asArray(pkg.manifest?.item).flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }
    const id = (item as { '@_id'?: string })['@_id'];
    const hrefAttr = (item as { '@_href'?: string })['@_href'];
    const mediaType = (item as { '@_media-type'?: string })['@_media-type'] ?? 'application/octet-stream';
    if (typeof id !== 'string' || typeof hrefAttr !== 'string') {
      return [];
    }
    const href = resolvePackagePath(rootfile, hrefAttr);
    return [
      {
        id,
        href,
        mediaType,
        properties: parseProperties((item as { '@_properties'?: string })['@_properties']),
      },
    ];
  });

  const manifestById = new Map(manifest.map((item) => [item.id, item]));

  const spine: SpineItem[] = asArray(pkg.spine?.itemref).flatMap((item, index) => {
    if (!item || typeof item !== 'object') {
      return [];
    }
    const idref = (item as { '@_idref'?: string })['@_idref'];
    if (typeof idref !== 'string') {
      return [];
    }
    const manifestItem = manifestById.get(idref);
    if (!manifestItem) {
      return [];
    }
    const linearAttr = (item as { '@_linear'?: string })['@_linear'];
    return [
      {
        id: idref,
        index,
        href: manifestItem.href,
        mediaType: manifestItem.mediaType,
        linear: linearAttr !== 'no',
      },
    ];
  });

  if (spine.length === 0) {
    throw new Error('Invalid EPUB: empty spine');
  }

  const metadata = parseMetadata((pkg.metadata ?? {}) as Record<string, unknown>, manifest, opfDir);

  const navHref = findNavHref(manifest);
  const toc = navHref ? await parseNavToc(zip, navHref, opfDir, spine) : [];

  return {
    opfPath: rootfile,
    opfDir,
    metadata,
    manifest,
    manifestById,
    spine,
    toc,
  };
}
