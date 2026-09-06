/** Minimal RFC4180-ish CSV parser: handles quoted fields (with embedded
 * commas or newlines) and escaped quotes ("" inside a quoted field), and
 * normalizes CRLF/LF line endings. Good enough for hand-authored finance
 * import sheets — not a general-purpose CSV library. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  function pushField() {
    row.push(field);
    field = "";
  }
  function pushRow() {
    pushField();
    rows.push(row);
    row = [];
  }

  while (i < len) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      pushField();
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      pushRow();
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

function csvEscape(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Builds a downloadable CSV string (header + sample rows) from a set of
 * column keys, e.g. for an "import" dialog's sample-file download. */
export function buildSampleCsv(
  columnKeys: string[],
  sampleRows: Record<string, string>[],
) {
  const header = columnKeys.map(csvEscape).join(",");
  const dataRows = sampleRows.map((row) =>
    columnKeys.map((key) => csvEscape(row[key] ?? "")).join(","),
  );
  return [header, ...dataRows].join("\r\n");
}
