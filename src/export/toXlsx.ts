import ExcelJS from "exceljs";
import { ensureDir } from "../utils/fs.js";

export async function exportRowsToXlsx(params: {
  rows: any[];
  outPath: string;
  sheetName?: string;
}) {
  const { rows, outPath, sheetName } = params;

  ensureDir(outPath.split("/").slice(0, -1).join("/"));

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName || "silpo_raw");

  if (rows.length === 0) {
    ws.addRow(["no_data"]);
    await wb.xlsx.writeFile(outPath);
    return;
  }

  // Header from keys of first row (stable order)
  const header = Object.keys(rows[0]);
  ws.addRow(header);

  for (const r of rows) {
    ws.addRow(header.map((k) => (r[k] === null || r[k] === undefined ? "" : r[k])));
  }

  // Basic formatting
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.columns.forEach((c) => { c.width = Math.max(12, Math.min(60, (c.header?.toString().length || 12) + 4)); });

  await wb.xlsx.writeFile(outPath);
}
