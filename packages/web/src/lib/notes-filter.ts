import type { NoteKind, NoteRecord } from "@quantum/shared";

export type NotesScope = "section" | "book";
export type NotesKindFilter = "all" | NoteKind;

export function filterNotes(
  notes: NoteRecord[],
  opts: {
    scope: NotesScope;
    kind: NotesKindFilter;
    sectionId: string | null;
  },
): NoteRecord[] {
  return notes.filter((note) => {
    if (opts.scope === "section") {
      if (!opts.sectionId || note.sectionId !== opts.sectionId) return false;
    }
    if (opts.kind !== "all" && note.kind !== opts.kind) return false;
    return true;
  });
}
