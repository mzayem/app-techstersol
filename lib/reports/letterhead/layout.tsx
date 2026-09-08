import path from "node:path";

import {
  Document,
  Page,
  View,
  Text,
  Image,
  Font,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

import { getLetterheadBackgroundPng } from "@/lib/reports/logo";
import { getSignatureAssets } from "@/lib/reports/signature";
import {
  parseLetterBody,
  resolveImageBlocks,
  LetterBody,
  type BlockNode,
} from "@/lib/reports/letterhead/richtext";
import { LETTERHEAD_DEFAULT_LINE_HEIGHT } from "@/lib/reports/letterhead/fonts";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = 521.58; // PAGE_WIDTH minus the 36.85pt margins below.

// The reference letterhead template's font stack leads with "Segoe UI" —
// Helvetica (react-pdf's built-in default, used by every other report in
// this app) doesn't match it, so the real system font files (present on
// this Windows machine at C:\Windows\Fonts) are registered from local
// copies in public/fonts/ for an exact match. A small curated set beyond
// Segoe UI is also registered so the editor's font-family picker has real
// choices — see lib/reports/letterhead/fonts.ts for the shared list.
const fontsDir = path.join(process.cwd(), "public", "fonts");
function registerFamily(family: string, baseName: string, hasSemiBold = false) {
  Font.register({
    family,
    fonts: [
      { src: path.join(fontsDir, `${baseName}-Regular.ttf`), fontWeight: 400 },
      ...(hasSemiBold
        ? [
            {
              src: path.join(fontsDir, `${baseName}-SemiBold.ttf`),
              fontWeight: 600,
            },
          ]
        : []),
      { src: path.join(fontsDir, `${baseName}-Bold.ttf`), fontWeight: 700 },
      {
        src: path.join(fontsDir, `${baseName}-Italic.ttf`),
        fontWeight: 400,
        fontStyle: "italic",
      },
      {
        src: path.join(fontsDir, `${baseName}-BoldItalic.ttf`),
        fontWeight: 700,
        fontStyle: "italic",
      },
    ],
  });
}
registerFamily("Segoe UI", "SegoeUI", true);
registerFamily("Arial", "Arial");
registerFamily("Times New Roman", "TimesNewRoman");
registerFamily("Georgia", "Georgia");
registerFamily("Courier New", "CourierNew");
registerFamily("Verdana", "Verdana");

// The header wordmark/tagline/contact block and the footer address are
// real PDF text (not baked into the background raster) so they stay crisp
// and selectable — set in the letterhead's actual brand fonts (Poppins,
// Montserrat, Inter) and positioned at the exact coordinates from the
// reference design. The reference embedded these as pre-subsetted woff2
// files, but those tripped a crash in pdfkit's font subset encoder
// ("Offset is outside the bounds of the DataView") — so these are full,
// unmodified copies of the same three (freely licensed) Google Fonts
// instead, fetched once into public/fonts/.
Font.register({
  family: "LH Poppins",
  fonts: [
    { src: path.join(fontsDir, "LH-Poppins-Regular.ttf"), fontWeight: 400 },
    { src: path.join(fontsDir, "LH-Poppins-Medium.ttf"), fontWeight: 500 },
    { src: path.join(fontsDir, "LH-Poppins-Bold.ttf"), fontWeight: 700 },
  ],
});
Font.register({
  family: "LH Montserrat",
  fonts: [{ src: path.join(fontsDir, "LH-Montserrat-Bold.ttf"), fontWeight: 700 }],
});
Font.register({
  family: "LH Inter",
  fonts: [{ src: path.join(fontsDir, "LH-Inter-Regular.ttf"), fontWeight: 400 }],
});

const styles = StyleSheet.create({
  page: {
    paddingTop: 147.4,
    paddingBottom: 70.9,
    paddingHorizontal: 36.85,
    fontSize: 10.5,
    fontFamily: "Segoe UI",
    color: "#1b1b1b",
  },
  background: {
    position: "absolute",
    top: 0,
    left: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
  },
  // Exact coordinates/sizes/tracking from the reference letterhead's HTML
  // mockup (public/letterhead.html — do not tweak these by eye).
  wordmark: {
    position: "absolute",
    left: 99.664,
    top: 60.992,
    fontSize: 16.467,
    letterSpacing: 1.188,
    fontFamily: "LH Poppins",
    fontWeight: 400,
    color: "#000000",
  },
  wordmarkBold: { fontWeight: 700 },
  tagline: {
    position: "absolute",
    left: 102.039,
    top: 77.759,
    fontSize: 9.177,
    fontFamily: "LH Poppins",
    fontWeight: 500,
    color: "#000000",
  },
  web: {
    position: "absolute",
    left: 390.53,
    top: 57.204,
    fontSize: 10.001,
    letterSpacing: 0.4,
    fontFamily: "LH Montserrat",
    fontWeight: 700,
    color: "#000000",
  },
  phone: {
    position: "absolute",
    left: 390.17,
    top: 74.734,
    fontSize: 10.001,
    letterSpacing: -0.206,
    fontFamily: "LH Inter",
    color: "#000000",
  },
  email: {
    position: "absolute",
    left: 390.17,
    top: 88.594,
    fontSize: 10.001,
    letterSpacing: -0.208,
    fontFamily: "LH Inter",
    color: "#000000",
  },
  addr: {
    position: "absolute",
    left: 42.486,
    top: 806.223,
    fontSize: 13.002,
    letterSpacing: -0.298,
    fontFamily: "LH Inter",
    color: "#000000",
  },
  label: { fontSize: 13, fontWeight: 600, color: "#1b1b1b", marginBottom: 12 },
  date: { fontSize: 10.5, color: "#555555", marginBottom: 18 },
  content: {},
  paragraph: { marginBottom: 10, textAlign: "justify" },
  listItem: { flexDirection: "row", marginBottom: 8, paddingLeft: 4 },
  bullet: { width: 12, color: "#1b1b1b" },
  signOffBlock: { marginTop: 24 },
  signatureImage: { width: 120, height: 46 },
  stampImage: { width: 82, height: 82 },
  signRow: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  signOffName: {
    marginTop: 6,
    fontSize: 10.5,
    fontWeight: 700,
    color: "#1b1b1b",
  },
  signOffRole: { fontSize: 9.5, color: "#555555" },
  blankLine: {
    marginTop: 6,
    width: 200,
    borderBottomWidth: 1,
    borderBottomColor: "#9ca3af",
  },
  blankLabel: { marginTop: 3, fontSize: 8, color: "#9ca3af" },
});

export type LetterheadSignOff = {
  mode: "blank" | "filled";
  name: string;
  role: string;
  includeSignature: boolean;
};

export type LetterheadData = {
  label: string;
  date: string;
  bodyHtml: string;
  /** Line spacing applied to the whole letter body — a single document-wide
   * setting (matching a "Line Spacing" control in a normal word processor),
   * not a per-paragraph one. Defaults to the reference template's 1.7. */
  lineHeight?: number;
  signOff: LetterheadSignOff;
};

function LetterheadDocument({
  data,
  blocks,
  backgroundDataUrl,
  signatureDataUrl,
  stampDataUrl,
}: {
  data: LetterheadData;
  blocks: BlockNode[];
  backgroundDataUrl: string | null;
  signatureDataUrl: string | null;
  stampDataUrl: string | null;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {backgroundDataUrl && (
          // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image is not an HTML <img>
          <Image src={backgroundDataUrl} style={styles.background} fixed />
        )}

        <Text style={styles.wordmark} fixed>
          TECHSTER<Text style={styles.wordmarkBold}>SOL</Text>
        </Text>
        <Text style={styles.tagline} fixed>
          BRING IDEAS TO LIFE
        </Text>
        <Text style={styles.web} fixed>
          WWW.TECHSTERSOL.COM
        </Text>
        <Text style={styles.phone} fixed>
          +92-306-6940981
        </Text>
        <Text style={styles.email} fixed>
          info@techstersol.com
        </Text>
        <Text style={styles.addr} fixed>
          H 34A Gulshen Iqbal Town, Bahawalpur
        </Text>

        {/* See lib/reports/pdf.tsx for why lineHeight never lives on `page`. */}
        <View
          style={{
            lineHeight: data.lineHeight ?? LETTERHEAD_DEFAULT_LINE_HEIGHT,
          }}
        >
          <Text style={styles.label}>{data.label.toUpperCase()}</Text>
          <Text style={styles.date}>{data.date}</Text>

          <View style={styles.content}>
            <LetterBody
              blocks={blocks}
              paragraphStyle={styles.paragraph}
              listItemStyle={styles.listItem}
              bulletStyle={styles.bullet}
            />
          </View>

          {/* The letter's own closing line ("Regards," etc.) is written by
              the user as part of the body above — this block is only the
              signature itself. wrap=false keeps it atomic: if it doesn't
              fit in what's left of the current page it moves as a whole to
              the next one, so a multi-page letter always ends with the
              full signature/stamp block together on its last page. */}
          <View style={styles.signOffBlock} wrap={false}>
            {data.signOff.includeSignature ? (
              <View style={styles.signRow}>
                {signatureDataUrl && (
                  // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image is not an HTML <img>
                  <Image src={signatureDataUrl} style={styles.signatureImage} />
                )}
                {stampDataUrl && (
                  // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image is not an HTML <img>
                  <Image src={stampDataUrl} style={styles.stampImage} />
                )}
              </View>
            ) : null}
            {data.signOff.mode === "filled" ? (
              <View>
                <Text style={styles.signOffName}>{data.signOff.name}</Text>
                <Text style={styles.signOffRole}>{data.signOff.role}</Text>
              </View>
            ) : (
              <View>
                <View style={styles.blankLine} />
                <Text style={styles.blankLabel}>Name</Text>
                <View style={styles.blankLine} />
                <Text style={styles.blankLabel}>Role</Text>
              </View>
            )}
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function renderLetterheadPdf(
  data: LetterheadData,
): Promise<Buffer> {
  const backgroundPng = await getLetterheadBackgroundPng();
  const backgroundDataUrl = backgroundPng
    ? `data:image/png;base64,${backgroundPng.toString("base64")}`
    : null;

  let signatureDataUrl: string | null = null;
  let stampDataUrl: string | null = null;
  if (data.signOff.includeSignature) {
    const assets = getSignatureAssets();
    signatureDataUrl = assets.signature;
    stampDataUrl = assets.stamp;
  }

  const rawBlocks = parseLetterBody(data.bodyHtml);
  const blocks = await resolveImageBlocks(rawBlocks, CONTENT_WIDTH);

  return renderToBuffer(
    <LetterheadDocument
      data={data}
      blocks={blocks}
      backgroundDataUrl={backgroundDataUrl}
      signatureDataUrl={signatureDataUrl}
      stampDataUrl={stampDataUrl}
    />,
  );
}
