import fs from "node:fs";
import { ensureDir } from "./fs.js";

export type LogLevel = "INFO" | "WARN" | "ERROR";

export type LogEvent = {
  ts: string;
  level: LogLevel;
  step: string;
  stage: string;
  message: string;
  extra?: Record<string, any>;
};

export class JsonlLogger {
  private filePath: string;

  constructor(logsDir: string, runId: string) {
    ensureDir(logsDir);
    this.filePath = `${logsDir}/run_${runId}.jsonl`;
  }

  private ts(): string {
    return new Date().toISOString();
  }

  log(level: LogLevel, step: string, stage: string, message: string, extra?: Record<string, any>) {
    const ev: LogEvent = { ts: this.ts(), level, step, stage, message, extra };
    fs.appendFileSync(this.filePath, JSON.stringify(ev) + "\n", "utf-8");
    // eslint-disable-next-line no-console
    console.log(`[${ev.ts}] ${ev.level} ${ev.step} ${ev.stage}: ${ev.message}`);
  }

  info(step: string, stage: string, message: string, extra?: Record<string, any>) {
    this.log("INFO", step, stage, message, extra);
  }
  warn(step: string, stage: string, message: string, extra?: Record<string, any>) {
    this.log("WARN", step, stage, message, extra);
  }
  error(step: string, stage: string, message: string, extra?: Record<string, any>) {
    this.log("ERROR", step, stage, message, extra);
  }

  getLogPath() {
    return this.filePath;
  }
}
