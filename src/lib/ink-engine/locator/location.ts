import type { ReadingLocation } from '@/src/lib/ink-engine/types';

export function createLocation(input: {
  sectionId: string;
  locator?: string | null;
  progress?: number | null;
  fragment?: string | null;
}): ReadingLocation {
  return {
    sectionId: input.sectionId,
    locator: input.locator ?? null,
    progress: input.progress ?? null,
    fragment: input.fragment ?? null,
  };
}
