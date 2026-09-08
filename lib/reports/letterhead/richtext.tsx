import { Text, View, Image } from "@react-pdf/renderer";
import type { Style, StyleProp } from "@react-pdf/types";
import sharp from "sharp";

// The editor's toolbar produces a constrained tag surface: <b>/<strong>,
// <i>/<em>, <u>, <span style="..."> (font family/size/color, applied by
// the toolbar via a manual Selection-Range wrap rather than execCommand,
// so it's always this shape — never legacy <font> tags), <ul><li>, <br>,
// block-level <div>/<p> from pressing Enter, and <img> from the image
// button. Anything else (a pasted <span> with unknown attributes, say) is
// treated as a transparent wrapper — its attributes are ignored but its
// children still render, so a stray tag never loses content.

export type TextStyle = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  fontFamily?: string;
  fontSize?: number;
};

type TextRun = { text: string; style: TextStyle };
type TextAlign = "left" | "center" | "right" | "justify";

export type BlockNode =
  | { type: "paragraph"; runs: TextRun[]; align?: TextAlign }
  | { type: "listItem"; runs: TextRun[] }
  | { type: "image"; src: string; width?: number; height?: number };

type RawNode =
  | { type: "text"; value: string }
  | { type: "element"; tag: string; attrs: Record<string, string>; children: RawNode[] };

const BLOCK_TAGS = new Set(["div", "p"]);
const VOID_TAGS = new Set(["br", "hr", "img"]);
const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#?\w+);/g, (match, name: string) => ENTITIES[name] ?? match);
}

function parseAttrs(tagSource: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrPattern = /([a-zA-Z-]+)\s*=\s*"([^"]*)"|([a-zA-Z-]+)\s*=\s*'([^']*)'/g;
  let match: RegExpExecArray | null;
  while ((match = attrPattern.exec(tagSource))) {
    const name = (match[1] ?? match[3]).toLowerCase();
    const value = match[2] ?? match[4] ?? "";
    attrs[name] = decodeEntities(value);
  }
  return attrs;
}

/** Tokenizes and parses the editor's HTML into a tree — no DOM available
 * server-side (this runs inside the API route, not a browser), so this is
 * a small hand-rolled scanner rather than a real HTML parser. It only
 * needs to understand the tags listed above. */
function parseHtml(html: string): RawNode[] {
  const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^<>]*)?)\/?>/g;
  const root: RawNode[] = [];
  const stack: { tag: string; attrs: Record<string, string>; children: RawNode[] }[] = [];

  function currentChildren(): RawNode[] {
    return stack.length > 0 ? stack[stack.length - 1].children : root;
  }

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(html))) {
    const text = html.slice(lastIndex, match.index);
    if (text) currentChildren().push({ type: "text", value: decodeEntities(text) });
    lastIndex = tagPattern.lastIndex;

    const [fullTag, tagName, attrSource] = match;
    const tag = tagName.toLowerCase();
    const isClosing = fullTag.startsWith("</");
    const isSelfClosing = fullTag.endsWith("/>") || VOID_TAGS.has(tag);

    if (isClosing) {
      // Pop back to (and including) the matching open tag, tolerating
      // mismatched/unclosed tags rather than throwing on odd markup.
      const openIndex = [...stack].reverse().findIndex((n) => n.tag === tag);
      if (openIndex !== -1) {
        const popCount = stack.length - (stack.length - 1 - openIndex);
        for (let i = 0; i < popCount; i++) {
          const node = stack.pop()!;
          currentChildren().push({
            type: "element",
            tag: node.tag,
            attrs: node.attrs,
            children: node.children,
          });
        }
      }
    } else if (isSelfClosing) {
      currentChildren().push({ type: "element", tag, attrs: parseAttrs(attrSource), children: [] });
    } else {
      stack.push({ tag, attrs: parseAttrs(attrSource), children: [] });
    }
  }
  const tail = html.slice(lastIndex);
  if (tail) currentChildren().push({ type: "text", value: decodeEntities(tail) });
  // Unclosed tags at the end — flush them in open order.
  while (stack.length > 0) {
    const node = stack.pop()!;
    (stack.length > 0 ? stack[stack.length - 1].children : root).push({
      type: "element",
      tag: node.tag,
      attrs: node.attrs,
      children: node.children,
    });
  }
  return root;
}

function parseInlineCssStyle(styleAttr: string): Partial<TextStyle> {
  const result: Partial<TextStyle> = {};
  for (const decl of styleAttr.split(";")) {
    const sep = decl.indexOf(":");
    if (sep === -1) continue;
    const prop = decl.slice(0, sep).trim().toLowerCase();
    const val = decl.slice(sep + 1).trim();
    if (!prop || !val) continue;
    if (prop === "color") {
      result.color = val;
    } else if (prop === "font-family") {
      result.fontFamily = val.split(",")[0].replace(/["']/g, "").trim();
    } else if (prop === "font-size") {
      const m = /^([\d.]+)(pt|px)?$/.exec(val);
      if (m) {
        const num = parseFloat(m[1]);
        result.fontSize = m[2] === "px" ? num * 0.75 : num;
      }
    } else if (prop === "font-weight") {
      if (val === "bold" || (Number.isFinite(Number(val)) && Number(val) >= 600)) result.bold = true;
    } else if (prop === "font-style") {
      if (val === "italic" || val === "oblique") result.italic = true;
    } else if (prop === "text-decoration" || prop === "text-decoration-line") {
      if (val.includes("underline")) result.underline = true;
    }
  }
  return result;
}

/** TipTap's TextAlign extension puts `text-align` directly on the block
 * element's own style attribute (`<p style="text-align: center">`), not on
 * a nested TextStyle span — read separately from parseInlineCssStyle. */
function parseBlockAlign(styleAttr: string | undefined): TextAlign | undefined {
  if (!styleAttr) return undefined;
  const m = /text-align\s*:\s*(left|center|right|justify)/i.exec(styleAttr);
  return m ? (m[1].toLowerCase() as TextAlign) : undefined;
}

const LEGACY_FONT_SIZE_PT: Record<string, number> = {
  "1": 8,
  "2": 10,
  "3": 12,
  "4": 14,
  "5": 18,
  "6": 24,
  "7": 36,
};

function mergeElementStyle(
  tag: string,
  attrs: Record<string, string>,
  inherited: TextStyle,
): TextStyle {
  let style: TextStyle = { ...inherited };
  if (tag === "b" || tag === "strong") style.bold = true;
  if (tag === "i" || tag === "em") style.italic = true;
  if (tag === "u") style.underline = true;
  if (tag === "font") {
    if (attrs.color) style.color = attrs.color;
    if (attrs.face) style.fontFamily = attrs.face.split(",")[0].replace(/["']/g, "").trim();
    if (attrs.size && LEGACY_FONT_SIZE_PT[attrs.size]) style.fontSize = LEGACY_FONT_SIZE_PT[attrs.size];
  }
  if (attrs.style) style = { ...style, ...parseInlineCssStyle(attrs.style) };
  return style;
}

type ParseCtx = { blocks: BlockNode[]; pending: TextRun[] };

function flushPending(ctx: ParseCtx, align?: TextAlign) {
  if (ctx.pending.length > 0) {
    ctx.blocks.push({ type: "paragraph", runs: ctx.pending, ...(align ? { align } : {}) });
    ctx.pending = [];
  }
}

/** Like emit(), but for content that belongs on a single line no matter how
 * it's block-wrapped — used inside <li> so a list item's <p> wrapper (or
 * any nested block) never starts a new paragraph block of its own. */
function flattenToRuns(node: RawNode, style: TextStyle, runs: TextRun[]) {
  if (node.type === "text") {
    if (node.value.length > 0) runs.push({ text: node.value, style });
    return;
  }
  if (node.tag === "br") {
    runs.push({ text: "\n", style });
    return;
  }
  if (node.tag === "img") return;
  const nextStyle = mergeElementStyle(node.tag, node.attrs, style);
  for (const child of node.children) flattenToRuns(child, nextStyle, runs);
}

function emit(node: RawNode, style: TextStyle, ctx: ParseCtx) {
  if (node.type === "text") {
    if (node.value.length > 0) ctx.pending.push({ text: node.value, style });
    return;
  }
  if (node.tag === "br") {
    ctx.pending.push({ text: "\n", style });
    return;
  }
  if (node.tag === "img") {
    flushPending(ctx);
    if (node.attrs.src) ctx.blocks.push({ type: "image", src: node.attrs.src });
    return;
  }
  if (node.tag === "ul" || node.tag === "ol") {
    flushPending(ctx);
    for (const child of node.children) {
      if (child.type === "element" && child.tag === "li") {
        // TipTap always wraps a list item's text in its own <p> (its
        // document schema requires block content inside <li>) — flatten
        // that wrapper away instead of treating it as a new block, or the
        // item would come out as an empty bullet followed by a stray
        // unbulleted paragraph.
        const runs: TextRun[] = [];
        for (const c of child.children) flattenToRuns(c, style, runs);
        ctx.blocks.push({ type: "listItem", runs });
      }
    }
    return;
  }
  if (BLOCK_TAGS.has(node.tag)) {
    const align = parseBlockAlign(node.attrs.style);
    flushPending(ctx);
    if (node.children.length === 0) {
      // TipTap represents a deliberate blank line as an empty <p></p> — a
      // run of only whitespace still gives it real line height in the PDF
      // instead of silently collapsing the spacing the user typed.
      ctx.blocks.push({
        type: "paragraph",
        runs: [{ text: " ", style }],
        ...(align ? { align } : {}),
      });
    } else {
      for (const child of node.children) emit(child, style, ctx);
      flushPending(ctx, align);
    }
    return;
  }
  // Inline formatting tag (b/i/u/span/font) or an unknown transparent tag.
  const nextStyle = mergeElementStyle(node.tag, node.attrs, style);
  for (const child of node.children) emit(child, nextStyle, ctx);
}

export function parseLetterBody(html: string): BlockNode[] {
  const raw = parseHtml(html);
  const ctx: ParseCtx = { blocks: [], pending: [] };
  for (const node of raw) emit(node, {}, ctx);
  flushPending(ctx);
  return ctx.blocks;
}

const MAX_IMAGE_HEIGHT_PT = 420;
// Inserted images come from the browser (canvas-exported PNGs at CSS
// pixel size) — treated at a nominal 96dpi when converting to points, the
// same assumption the reference letterhead's own CSS mockup makes.
const PX_TO_PT = 72 / 96;

/** Decodes each embedded image once (server-side, via sharp — the same
 * library already used for the background artwork and logo assets) to
 * get its intrinsic size, then computes a display size that fits inside
 * the letter's content box without ever upscaling beyond the source. */
export async function resolveImageBlocks(
  blocks: BlockNode[],
  maxWidthPt: number,
): Promise<BlockNode[]> {
  return Promise.all(
    blocks.map(async (block) => {
      if (block.type !== "image") return block;
      const commaIndex = block.src.indexOf(",");
      if (commaIndex === -1) return { ...block, width: 0, height: 0 };
      try {
        const buffer = Buffer.from(block.src.slice(commaIndex + 1), "base64");
        const meta = await sharp(buffer).metadata();
        const pxWidth = meta.width ?? 0;
        const pxHeight = meta.height ?? 0;
        if (!pxWidth || !pxHeight) return { ...block, width: 0, height: 0 };
        let widthPt = Math.min(pxWidth * PX_TO_PT, maxWidthPt);
        let heightPt = widthPt * (pxHeight / pxWidth);
        if (heightPt > MAX_IMAGE_HEIGHT_PT) {
          heightPt = MAX_IMAGE_HEIGHT_PT;
          widthPt = heightPt * (pxWidth / pxHeight);
        }
        return { ...block, width: widthPt, height: heightPt };
      } catch {
        return { ...block, width: 0, height: 0 };
      }
    }),
  );
}

function runToStyle(run: TextRun): Style {
  const style: Style = {};
  if (run.style.bold) style.fontWeight = 700;
  if (run.style.italic) style.fontStyle = "italic";
  if (run.style.underline) style.textDecoration = "underline";
  if (run.style.color) style.color = run.style.color;
  if (run.style.fontFamily) style.fontFamily = run.style.fontFamily;
  if (run.style.fontSize) style.fontSize = run.style.fontSize;
  return style;
}

function RunText({ run }: { run: TextRun }) {
  return <Text style={runToStyle(run)}>{run.text}</Text>;
}

/** Renders parsed letter body blocks — a paragraph per block, bullet items
 * indented with a leading dot, and images placed at their resolved size
 * (see resolveImageBlocks) — matching the reference letterhead's style. */
export function LetterBody({
  blocks,
  paragraphStyle,
  listItemStyle,
  bulletStyle,
}: {
  blocks: BlockNode[];
  paragraphStyle: StyleProp;
  listItemStyle: StyleProp;
  bulletStyle: StyleProp;
}) {
  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === "image") {
          if (!block.width || !block.height) return null;
          return (
            <View key={i} style={{ marginBottom: 10 }}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image is not an HTML <img> */}
              <Image src={block.src} style={{ width: block.width, height: block.height }} />
            </View>
          );
        }
        if (block.type === "listItem") {
          return (
            <View key={i} style={listItemStyle}>
              <Text style={bulletStyle}>{"•"}</Text>
              <Text style={{ flex: 1 }}>
                {block.runs.map((run, j) => (
                  <RunText key={j} run={run} />
                ))}
              </Text>
            </View>
          );
        }
        return (
          <Text
            key={i}
            style={block.align ? [paragraphStyle, { textAlign: block.align }] : paragraphStyle}
          >
            {block.runs.map((run, j) => (
              <RunText key={j} run={run} />
            ))}
          </Text>
        );
      })}
    </>
  );
}
