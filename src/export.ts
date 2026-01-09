import fs from "fs";
import path from "path";
import XLSX from "xlsx";

export function exportCsv(exportsDir: string, header: string[], rows: any[]) {
  fs.mkdirSync(exportsDir, { recursive: true });
  const out = path.join(exportsDir, "latest.csv");
  const lines = [
    header.join(","),
    ...rows.map(r => header.map(h => JSON.stringify(r[h] ?? "")).join(","))
  ];
  fs.writeFileSync(out, lines.join("\n"), "utf-8");
  return out;
}

export function exportXlsx(exportsDir: string, header: string[], rows: any[]) {
  fs.mkdirSync(exportsDir, { recursive: true });
  const ws = XLSX.utils.json_to_sheet(rows, { header });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "observations");
  const out = path.join(exportsDir, "latest.xlsx");
  XLSX.writeFile(wb, out);
  return out;
}
