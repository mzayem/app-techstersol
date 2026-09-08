// Shared between the server-side PDF renderer (which registers these
// families with react-pdf from local .ttf files) and the client-side
// editor toolbar (whose dropdowns must only ever offer values the
// renderer can actually resolve) — pure data, safe to import from both.

export const LETTERHEAD_FONT_FAMILIES = [
  { value: "Segoe UI", label: "Segoe UI" },
  { value: "Arial", label: "Arial" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Georgia", label: "Georgia" },
  { value: "Courier New", label: "Courier New" },
  { value: "Verdana", label: "Verdana" },
] as const;

export type LetterheadFontFamily = (typeof LETTERHEAD_FONT_FAMILIES)[number]["value"];

export const LETTERHEAD_FONT_SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32] as const;

export const LETTERHEAD_LINE_SPACINGS = [
  { value: 1, label: "Single" },
  { value: 1.15, label: "1.15" },
  { value: 1.5, label: "1.5" },
  { value: 1.7, label: "1.7 (default)" },
  { value: 2, label: "Double" },
] as const;

export const LETTERHEAD_DEFAULT_LINE_HEIGHT = 1.7;
