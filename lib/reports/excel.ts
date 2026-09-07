import ExcelJS from "exceljs";

import { COMPANY_INFO } from "@/lib/invoices/constants";
import { getReportLogoPng } from "@/lib/reports/logo";
import type { ReportSpec, ReportCell } from "@/lib/reports/types";

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF3F4F6" },
};

const TOTALS_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF3F4F6" },
};

function writeCell(cell: ExcelJS.Cell, value: ReportCell, numFmt?: string) {
  if (value === null || value === undefined) {
    cell.value = null;
    return;
  }
  if (value instanceof Date) {
    cell.value = value;
    cell.numFmt = numFmt ?? "dd mmm yyyy";
  } else if (typeof value === "number") {
    cell.value = value;
    cell.numFmt = numFmt ?? "#,##0.00";
  } else {
    cell.value = value;
  }
}

export async function renderReportExcel(spec: ReportSpec): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = COMPANY_INFO.name;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Report", {
    pageSetup: { orientation: "landscape", fitToPage: true },
  });

  const columnCount = spec.columns.length;
  const lastColLetter = sheet.getColumn(columnCount).letter;

  const logoPng = await getReportLogoPng();
  let headerRows = 2;
  if (logoPng) {
    const imageId = workbook.addImage({
      base64: `data:image/png;base64,${logoPng.toString("base64")}`,
      extension: "png",
    });
    sheet.addImage(imageId, {
      tl: { col: 0, row: 0.1 },
      ext: { width: 150, height: 30 },
    });
  }

  sheet.mergeCells(`A1:${lastColLetter}1`);
  const titleCell = sheet.getCell("A1");
  titleCell.value = spec.title;
  titleCell.font = { size: 16, bold: true, color: { argb: "FF111827" } };
  titleCell.alignment = { horizontal: "right", vertical: "middle" };
  sheet.getRow(1).height = 26;

  sheet.mergeCells(`A2:${lastColLetter}2`);
  const companyCell = sheet.getCell("A2");
  companyCell.value = `${COMPANY_INFO.name} — ${COMPANY_INFO.addressLines.join(", ")} — ${COMPANY_INFO.website}`;
  companyCell.font = { size: 9, color: { argb: "FF6B7280" } };
  companyCell.alignment = { horizontal: "right" };

  if (spec.subtitle) {
    headerRows = 3;
    sheet.mergeCells(`A3:${lastColLetter}3`);
    const subtitleCell = sheet.getCell("A3");
    subtitleCell.value = spec.subtitle;
    subtitleCell.font = { size: 9, italic: true, color: { argb: "FF4B5563" } };
    subtitleCell.alignment = { horizontal: "right" };
  }

  const blankRowIndex = headerRows + 1;
  const headerRowIndex = blankRowIndex + 1;
  const headerRow = sheet.getRow(headerRowIndex);
  spec.columns.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.label;
    cell.font = { bold: true, size: 9, color: { argb: "FF1F3864" } };
    cell.fill = HEADER_FILL;
    cell.alignment = { horizontal: column.align ?? "left", vertical: "middle" };
    cell.border = { bottom: { style: "thin", color: { argb: "FFD1D5DB" } } };
  });
  headerRow.commit();
  sheet.views = [{ state: "frozen", ySplit: headerRowIndex }];
  sheet.autoFilter = {
    from: { row: headerRowIndex, column: 1 },
    to: { row: headerRowIndex, column: columnCount },
  };

  spec.rows.forEach((row, rowIndex) => {
    const excelRow = sheet.getRow(headerRowIndex + 1 + rowIndex);
    spec.columns.forEach((column, colIndex) => {
      const cell = excelRow.getCell(colIndex + 1);
      writeCell(cell, row[column.key], column.numFmt);
      cell.alignment = { horizontal: column.align ?? "left" };
    });
  });

  if (spec.totals) {
    const totalsRow = sheet.getRow(headerRowIndex + 1 + spec.rows.length);
    spec.columns.forEach((column, colIndex) => {
      const cell = totalsRow.getCell(colIndex + 1);
      writeCell(cell, spec.totals![column.key], column.numFmt);
      cell.font = { bold: true };
      cell.fill = TOTALS_FILL;
      cell.alignment = { horizontal: column.align ?? "left" };
      cell.border = { top: { style: "thin", color: { argb: "FF111827" } } };
    });
  }

  sheet.columns.forEach((column, index) => {
    const label = spec.columns[index]?.label ?? "";
    const longestValue = spec.rows.reduce((max, row) => {
      const raw = row[spec.columns[index].key];
      const text =
        raw instanceof Date
          ? raw.toLocaleDateString()
          : String(raw ?? "");
      return Math.max(max, text.length);
    }, label.length);
    column.width = Math.min(Math.max(longestValue + 2, 12), 40);
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
