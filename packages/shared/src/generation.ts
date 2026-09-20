/**
 * Book/article agent generation is frozen for the reading-first phase.
 * Tools and UI hooks remain callable so a future upgrade can re-enable them
 * without reshaping APIs. Runtime defaults to frozen unless the server opts in.
 */
export const GENERATION_FROZEN_MESSAGE =
  "Book generation is frozen this phase. Import an HTML document from the shelf, then read and chat against the current section.";

export const GENERATION_FROZEN_TOOLS = [
  "ask_boundary",
  "finalize_boundary",
  "draft_outline",
  "finalize_outline",
  "generate_section",
] as const;

export type GenerationFrozenTool = (typeof GENERATION_FROZEN_TOOLS)[number];

export function isGenerationFrozenTool(name: string): name is GenerationFrozenTool {
  return (GENERATION_FROZEN_TOOLS as readonly string[]).includes(name);
}
