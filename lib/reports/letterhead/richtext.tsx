import { Text, View } from "@react-pdf/renderer";
import type { StyleProp } from "@react-pdf/types";

// The editor's toolbar only ever produces this tag surface (Bold via
// document.execCommand("bold"), which Chrome renders as <b> or <strong>;
// bullets via insertUnorderedList, which produces <ul><li>; new lines from
// pressing Enter, which Chrome wraps each in its own <div>). Anything else
// (a pasted <span>, say) is treated as a transparent wrapper — its
// attributes are ignored but its children still render, so a stray tag
// never loses content, it just loses whatever styling it would have added.

type InlineNode =
  | { type: "text"; value: string }
  | { type: "mark"; style: "bold" | "italic"; children: InlineNode[] };

type BlockNode =
  | { type: "paragraph"; children: InlineNode[] }
  | { type: "listItem"; children: InlineNode[] };

type RawNode =
  | { type: "text"; value: string }
  | { type: "element"; tag: string; children: RawNode[] };

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

/** Tokenizes and parses the editor's HTML into a tree — no DOM available
 * server-side (this runs inside the API route, not a browser), so this is
 * a small hand-rolled scanner rather than a real HTML parser. It only
 * needs to understand the tags listed above. */
function parseHtml(html: string): RawNode[] {
  const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
  const root: RawNode[] = [];
  const stack: { tag: string; children: RawNode[] }[] = [];

  function currentChildren(): RawNode[] {
    return stack.length > 0 ? stack[stack.length - 1].children : root;
  }

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(html))) {
    const text = html.slice(lastIndex, match.index);
    if (text) currentChildren().push({ type: "text", value: decodeEntities(text) });
    lastIndex = tagPattern.lastIndex;

    const [fullTag, tagName] = match;
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
          currentChildren().push({ type: "element", tag: node.tag, children: node.children });
        }
      }
    } else if (isSelfClosing) {
      currentChildren().push({ type: "element", tag, children: [] });
    } else {
      stack.push({ tag, children: [] });
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
      children: node.children,
    });
  }
  return root;
}

function toInline(node: RawNode): InlineNode[] {
  if (node.type === "text") {
    return node.value.length > 0 ? [{ type: "text", value: node.value }] : [];
  }
  if (node.tag === "br") return [{ type: "text", value: "\n" }];
  if (node.tag === "b" || node.tag === "strong") {
    return [{ type: "mark", style: "bold", children: node.children.flatMap(toInline) }];
  }
  if (node.tag === "i" || node.tag === "em") {
    return [{ type: "mark", style: "italic", children: node.children.flatMap(toInline) }];
  }
  // Unknown/transparent tag — keep its content, drop the wrapper.
  return node.children.flatMap(toInline);
}

/** Flattens the parsed tree into a flat list of paragraphs/list items —
 * contentEditable's actual output nests everything one level deep at most
 * in practice (a `<ul>` of `<li>`s, or a run of top-level `<div>`s), so a
 * single pass handles every real case without needing full recursion into
 * block-in-block nesting. */
function toBlocks(nodes: RawNode[]): BlockNode[] {
  const blocks: BlockNode[] = [];
  let pendingInline: InlineNode[] = [];

  function flushParagraph() {
    if (pendingInline.length > 0) {
      blocks.push({ type: "paragraph", children: pendingInline });
      pendingInline = [];
    }
  }

  for (const node of nodes) {
    if (node.type === "text") {
      pendingInline.push(...toInline(node));
      continue;
    }
    if (node.tag === "ul" || node.tag === "ol") {
      flushParagraph();
      for (const child of node.children) {
        if (child.type === "element" && child.tag === "li") {
          blocks.push({ type: "listItem", children: child.children.flatMap(toInline) });
        }
      }
      continue;
    }
    if (BLOCK_TAGS.has(node.tag)) {
      flushParagraph();
      const inline = node.children.flatMap(toInline);
      if (inline.length > 0) blocks.push({ type: "paragraph", children: inline });
      continue;
    }
    // Inline-level tag (b/i/br/unknown) sitting at the top level.
    pendingInline.push(...toInline(node));
  }
  flushParagraph();
  return blocks;
}

export function parseLetterBody(html: string): BlockNode[] {
  return toBlocks(parseHtml(html));
}

function InlineRun({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((node, i) => {
        if (node.type === "text") return <Text key={i}>{node.value}</Text>;
        return (
          <Text
            key={i}
            style={
              node.style === "bold"
                ? { fontWeight: 700 }
                : { fontStyle: "italic" }
            }
          >
            <InlineRun nodes={node.children} />
          </Text>
        );
      })}
    </>
  );
}

/** Renders parsed letter body blocks — a paragraph per block, bullet items
 * indented with a leading dot, matching the reference letterhead's list
 * style. */
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
        if (block.type === "listItem") {
          return (
            <View key={i} style={listItemStyle}>
              <Text style={bulletStyle}>{"•"}</Text>
              <Text style={{ flex: 1 }}>
                <InlineRun nodes={block.children} />
              </Text>
            </View>
          );
        }
        return (
          <Text key={i} style={paragraphStyle}>
            <InlineRun nodes={block.children} />
          </Text>
        );
      })}
    </>
  );
}
