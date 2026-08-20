export function dirname(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? '' : path.slice(0, index);
}

export function basename(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? path : path.slice(index + 1);
}

/** Resolve a relative EPUB package path against a base file path. */
export function resolvePackagePath(baseFilePath: string, relativePath: string): string {
  if (!relativePath) {
    return baseFilePath;
  }

  const [pathOnly] = relativePath.split('#');
  if (/^(?:[a-z]+:)?\/\//i.test(pathOnly) || pathOnly.startsWith('data:')) {
    return pathOnly;
  }

  if (pathOnly.startsWith('/')) {
    return pathOnly.replace(/^\/+/, '');
  }

  const baseDir = dirname(baseFilePath);
  const parts = [...(baseDir ? baseDir.split('/') : []), ...pathOnly.replace(/^\.\//, '').split('/')];
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

export function splitHref(href: string): { path: string; fragment: string | null } {
  const hash = href.indexOf('#');
  if (hash === -1) {
    return { path: href, fragment: null };
  }
  return {
    path: href.slice(0, hash),
    fragment: href.slice(hash + 1) || null,
  };
}

export function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export function textValue(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object' && '#text' in value) {
    const text = (value as { '#text'?: unknown })['#text'];
    return typeof text === 'string' ? text : null;
  }
  return null;
}
