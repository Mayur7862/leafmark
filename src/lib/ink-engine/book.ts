import JSZip from 'jszip';

import { createLocation } from '@/src/lib/ink-engine/locator/location';
import { parsePackage } from '@/src/lib/ink-engine/parser/package';
import { splitHref } from '@/src/lib/ink-engine/path';
import { buildRenderableHtml } from '@/src/lib/ink-engine/renderer/html';
import type {
  BookMetadata,
  ManifestItem,
  ReaderSettings,
  ReadingLocation,
  SectionDocument,
  SpineItem,
  TocItem,
} from '@/src/lib/ink-engine/types';
import { DEFAULT_READER_SETTINGS } from '@/src/lib/ink-engine/types';

export class InkBook {
  readonly metadata: BookMetadata;
  readonly toc: TocItem[];
  readonly spine: SpineItem[];
  readonly manifest: ManifestItem[];

  private readonly zip: JSZip;
  private readonly spineById: Map<string, SpineItem>;
  private readonly spineByHref: Map<string, SpineItem>;

  constructor(
    zip: JSZip,
    data: {
      metadata: BookMetadata;
      toc: TocItem[];
      spine: SpineItem[];
      manifest: ManifestItem[];
    }
  ) {
    this.zip = zip;
    this.metadata = data.metadata;
    this.toc = data.toc;
    this.spine = data.spine;
    this.manifest = data.manifest;
    this.spineById = new Map(data.spine.map((item) => [item.id, item]));
    this.spineByHref = new Map(data.spine.map((item) => [item.href, item]));
  }

  getSectionCount(): number {
    return this.spine.length;
  }

  getSpineItem(index: number): SpineItem | null {
    return this.spine[index] ?? null;
  }

  getSpineItemById(sectionId: string): SpineItem | null {
    return this.spineById.get(sectionId) ?? null;
  }

  getNextSection(sectionId: string): SpineItem | null {
    const current = this.spineById.get(sectionId);
    if (!current) {
      return null;
    }
    return this.spine[current.index + 1] ?? null;
  }

  getPreviousSection(sectionId: string): SpineItem | null {
    const current = this.spineById.get(sectionId);
    if (!current) {
      return null;
    }
    return this.spine[current.index - 1] ?? null;
  }

  findSpineByHref(href: string): SpineItem | null {
    const { path } = splitHref(href);
    return this.spineByHref.get(path) ?? null;
  }

  async getSection(index: number): Promise<SectionDocument> {
    const item = this.getSpineItem(index);
    if (!item) {
      throw new Error(`Spine index out of range: ${index}`);
    }
    return this.readSection(item);
  }

  async getSectionById(sectionId: string): Promise<SectionDocument> {
    const item = this.getSpineItemById(sectionId);
    if (!item) {
      throw new Error(`Unknown section: ${sectionId}`);
    }
    return this.readSection(item);
  }

  async getRenderableHtml(
    sectionId: string,
    settings: ReaderSettings = DEFAULT_READER_SETTINGS
  ): Promise<string> {
    const section = await this.getSectionById(sectionId);
    return buildRenderableHtml(this.zip, section.href, section.xhtml, settings);
  }

  createLocation(input: {
    sectionId: string;
    locator?: string | null;
    progress?: number | null;
    fragment?: string | null;
  }): ReadingLocation {
    if (!this.spineById.has(input.sectionId)) {
      throw new Error(`Unknown section for location: ${input.sectionId}`);
    }
    return createLocation(input);
  }

  resolveTocTarget(item: TocItem): { section: SpineItem; fragment: string | null } | null {
    if (item.sectionId) {
      const section = this.spineById.get(item.sectionId);
      if (section) {
        return { section, fragment: item.fragment };
      }
    }
    if (item.href) {
      const section = this.findSpineByHref(item.href);
      if (section) {
        return { section, fragment: item.fragment ?? splitHref(item.href).fragment };
      }
    }
    return null;
  }

  private async readSection(item: SpineItem): Promise<SectionDocument> {
    const file = this.zip.file(item.href);
    if (!file) {
      throw new Error(`Missing spine resource: ${item.href}`);
    }
    const xhtml = await file.async('text');
    return {
      id: item.id,
      index: item.index,
      href: item.href,
      xhtml,
    };
  }
}

export class InkEngine {
  static async load(source: Uint8Array | ArrayBuffer): Promise<InkBook> {
    const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
    const zip = await JSZip.loadAsync(bytes);
    const parsed = await parsePackage(zip);
    return new InkBook(zip, {
      metadata: parsed.metadata,
      toc: parsed.toc,
      spine: parsed.spine,
      manifest: parsed.manifest,
    });
  }
}
