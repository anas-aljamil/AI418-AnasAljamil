/**
 * Timetable block kinds and what students see during each (CLAUDE.md Section 4): office hours
 * mean "In office", a class "In class" and a meeting "Busy" (meeting added 2026-11-11, owner
 * request). The API derives the same status; this map draws the timeline and the editor.
 */
import type { BlockKind, ManualStatus } from '@/api/types';

export const BLOCK_KINDS: BlockKind[] = ['office_hours', 'class', 'meeting'];

export const BLOCK_STATUS: Record<BlockKind, ManualStatus> = {
  office_hours: 'in_office',
  class: 'in_class',
  meeting: 'busy',
};

/** The i18n key of a kind's name ("Office hours", "Class", "Meeting"). */
export function blockKindKey(kind: BlockKind): string {
  return `prof.${kind}`;
}
