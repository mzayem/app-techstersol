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
import { parseLetterBody, LetterBody } from "@/lib/reports/letterhead/richtext";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

// The reference letterhead template calls for "Segoe UI"/Inter — Helvetica
// (react-pdf's built-in default, used by every other report in this app)
// doesn't match, so Inter is registered from local files fetched once into
// public/fonts/ rather than resolved over the network on every render.
const fontsDir = path.join(process.cwd(), "public", "fonts");
Font.register({
  family: "Inter",
  fonts: [
    { src: path.join(fontsDir, "Inter-Regular.ttf"), fontWeight: 400 },
    { src: path.join(fontsDir, "Inter-SemiBold.ttf"), fontWeight: 600 },
    { src: path.join(fontsDir, "Inter-Bold.ttf"), fontWeight: 700 },
    { src: path.join(fontsDir, "Inter-Italic.ttf"), fontWeight: 400, fontStyle: "italic" },
  ],
});

// Content box matches the reference HTML template's .content box exactly
// (13mm/52mm/184mm/220mm converted to points: 1mm = 2.8346456693pt) — the
// header/corner accents/watermark/footer are all baked into the rasterized
// background image (see getLetterheadBackgroundPng), so this box only has
// to stay clear of them.
const styles = StyleSheet.create({
  page: {
    paddingTop: 147.4,
    paddingBottom: 70.9,
    paddingHorizontal: 36.85,
    fontSize: 10.5,
    fontFamily: "Inter",
    color: "#1b1b1b",
  },
  // See lib/reports/pdf.tsx for why lineHeight never lives on `page`.
  body: { lineHeight: 1.7 },
  background: {
    position: "absolute",
    top: 0,
    left: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
  },
  label: { fontSize: 13, fontWeight: 600, color: "#1b1b1b", marginBottom: 12 },
  date: { fontSize: 10.5, color: "#555555", marginBottom: 18 },
  content: {},
  paragraph: { marginBottom: 10, textAlign: "justify" },
  listItem: { flexDirection: "row", marginBottom: 8, paddingLeft: 4 },
  bullet: { width: 12, color: "#1b1b1b" },
  regards: { marginTop: 24 },
  signOffBlock: { marginTop: 8 },
  signatureImage: { width: 120, height: 46 },
  stampImage: { width: 82, height: 82 },
  signRow: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  signOffName: { marginTop: 6, fontSize: 10.5, fontWeight: 700, color: "#1b1b1b" },
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
  signOff: LetterheadSignOff;
};

function LetterheadDocument({
  data,
  backgroundDataUrl,
  signatureDataUrl,
  stampDataUrl,
}: {
  data: LetterheadData;
  backgroundDataUrl: string | null;
  signatureDataUrl: string | null;
  stampDataUrl: string | null;
}) {
  const blocks = parseLetterBody(data.bodyHtml);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {backgroundDataUrl && (
          // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image is not an HTML <img>
          <Image src={backgroundDataUrl} style={styles.background} fixed />
        )}

        <View style={styles.body}>
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

          {/* wrap=false keeps the sign-off atomic — if it doesn't fit in
              what's left of the current page it moves as a whole to the
              next one, so a multi-page letter always ends with the full
              regards/signature/stamp block together on its last page. */}
          <View style={styles.regards} wrap={false}>
            <Text>Regards,</Text>
            <View style={styles.signOffBlock}>
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
        </View>
      </Page>
    </Document>
  );
}

export async function renderLetterheadPdf(data: LetterheadData): Promise<Buffer> {
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

  return renderToBuffer(
    <LetterheadDocument
      data={data}
      backgroundDataUrl={backgroundDataUrl}
      signatureDataUrl={signatureDataUrl}
      stampDataUrl={stampDataUrl}
    />,
  );
}
