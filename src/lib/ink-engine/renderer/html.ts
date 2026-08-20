import type JSZip from 'jszip';

import { resolvePackagePath } from '@/src/lib/ink-engine/path';
import { mimeFromPath, uint8ToBase64 } from '@/src/lib/ink-engine/resources/encoding';
import type { ReaderSettings } from '@/src/lib/ink-engine/types';

function themeColors(theme: ReaderSettings['theme']): { bg: string; fg: string; link: string } {
  switch (theme) {
    case 'dark':
      return { bg: '#111111', fg: '#f2f2f2', link: '#8ec7ff' };
    case 'sepia':
      return { bg: '#f4ecd8', fg: '#5b4636', link: '#0b57d0' };
    default:
      return { bg: '#ffffff', fg: '#111111', link: '#0b57d0' };
  }
}

export function buildReaderChromeCss(settings: ReaderSettings): string {
  const colors = themeColors(settings.theme);
  return `
html, body {
  margin: 0;
  padding: 0;
  background: ${colors.bg};
  color: ${colors.fg};
}
body {
  font-size: ${settings.fontSize}px;
  font-family: ${settings.fontFamily};
  line-height: ${settings.lineHeight};
  padding: ${settings.margin}px;
  text-align: ${settings.textAlignment};
  word-wrap: break-word;
  overflow-wrap: anywhere;
}
img, svg {
  max-width: 100%;
  height: auto;
}
table {
  max-width: 100%;
  border-collapse: collapse;
}
a {
  color: ${colors.link};
}
`;
}

async function readZipText(zip: JSZip, path: string): Promise<string | null> {
  const file = zip.file(path);
  if (!file) {
    return null;
  }
  return file.async('text');
}

async function readZipDataUri(zip: JSZip, path: string, mediaType?: string): Promise<string | null> {
  const file = zip.file(path);
  if (!file) {
    return null;
  }
  const bytes = await file.async('uint8array');
  const mime = mediaType ?? mimeFromPath(path);
  return `data:${mime};base64,${uint8ToBase64(bytes)}`;
}

async function rewriteCssUrls(zip: JSZip, cssPath: string, cssText: string): Promise<string> {
  const urlPattern = /url\((['"]?)([^'")]+)\1\)/gi;
  const matches = [...cssText.matchAll(urlPattern)];
  let output = cssText;

  for (const match of matches) {
    const rawUrl = match[2]?.trim();
    if (!rawUrl || rawUrl.startsWith('data:') || /^(?:[a-z]+:)?\/\//i.test(rawUrl)) {
      continue;
    }
    const resolved = resolvePackagePath(cssPath, rawUrl);
    const dataUri = await readZipDataUri(zip, resolved);
    if (dataUri) {
      output = output.replace(match[0], `url("${dataUri}")`);
    }
  }

  return output;
}

/**
 * Builds a renderable HTML document from original section XHTML.
 * The EPUB package on disk is never modified; this is a derived view.
 */
export async function buildRenderableHtml(
  zip: JSZip,
  sectionHref: string,
  xhtml: string,
  settings: ReaderSettings
): Promise<string> {
  let html = xhtml;

  // Inline stylesheets referenced by the section.
  const linkPattern = /<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi;
  const links = [...html.matchAll(linkPattern)];
  for (const match of links) {
    const tag = match[0];
    const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
    if (!hrefMatch) {
      html = html.replace(tag, '');
      continue;
    }
    const cssPath = resolvePackagePath(sectionHref, hrefMatch[1]);
    const cssText = await readZipText(zip, cssPath);
    if (!cssText) {
      html = html.replace(tag, '');
      continue;
    }
    const rewritten = await rewriteCssUrls(zip, cssPath, cssText);
    html = html.replace(tag, `<style data-ink-css="${cssPath}">${rewritten}</style>`);
  }

  // Rewrite image and SVG sources to data URIs.
  const srcPattern = /<(img|image|source)\b([^>]*)\b(?:src|xlink:href)=["']([^"']+)["']([^>]*)>/gi;
  const srcMatches = [...html.matchAll(srcPattern)];
  for (const match of srcMatches) {
    const full = match[0];
    const url = match[3];
    if (!url || url.startsWith('data:') || /^(?:[a-z]+:)?\/\//i.test(url)) {
      continue;
    }
    const resolved = resolvePackagePath(sectionHref, url);
    const dataUri = await readZipDataUri(zip, resolved);
    if (!dataUri) {
      continue;
    }
    html = html.replace(full, full.replace(url, dataUri));
  }

  const chrome = buildReaderChromeCss(settings);
  const injection = `<style data-ink-reader="true">${chrome}</style>`;

  if (/<\/head>/i.test(html)) {
    html = html.replace(/<\/head>/i, `${injection}</head>`);
  } else if (/<html\b[^>]*>/i.test(html)) {
    html = html.replace(/<html\b[^>]*>/i, (tag) => `${tag}<head>${injection}</head>`);
  } else {
    html = `<!DOCTYPE html><html><head>${injection}</head><body>${html}</body></html>`;
  }

  // Ensure WebView-friendly doctype/html wrapper when given bare fragments.
  if (!/^\s*(?:<\?xml|<\!DOCTYPE|<html)/i.test(html)) {
    html = `<!DOCTYPE html><html><head>${injection}</head><body>${html}</body></html>`;
  }

  return html;
}
