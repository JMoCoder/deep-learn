/** Composer send keys. Bare Enter inserts a newline; Ctrl/Cmd+Enter sends. */

export type ComposerKeyLike = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey?: boolean;
  isComposing?: boolean;
  nativeEvent?: { isComposing?: boolean };
};

export function composerKeyShouldSend(e: ComposerKeyLike): boolean {
  if (e.isComposing || e.nativeEvent?.isComposing) return false;
  if (e.key !== "Enter") return false;
  return e.ctrlKey || e.metaKey;
}
