import fs from "fs";
import path from "path";

export class JsonlLogger {
  private file: string;

  constructor(file: string) {
    this.file = file;
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }

  private ts(): string {
    return new Date().toISOString();
  }

  log(level: "INFO" | "WARN" | "ERROR", event: string, fields: Record<string, any>) {
    const rec = { ts: this.ts(), level, event, ...fields };
    fs.appendFileSync(this.file, JSON.stringify(rec) + "\n", "utf-8");
  }

  info(event: string, fields: Record<string, any> = {}) { this.log("INFO", event, fields); }
  warn(event: string, fields: Record<string, any> = {}) { this.log("WARN", event, fields); }
  error(event: string, fields: Record<string, any> = {}) { this.log("ERROR", event, fields); }
}
