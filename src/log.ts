import fs from "node:fs";
import path from "node:path";

export type LogEvent = { 
  ts: string; 
  level: "INFO" | "WARN" | "ERROR"; 
  event: string; 
  message: string;
};

export class RunLogger {
  public events: LogEvent[] = [];

  constructor(public jsonlPath: string) {
    fs.mkdirSync(path.dirname(jsonlPath), { recursive: true });
  }

  private write(level: LogEvent["level"], event: string, message: string) {
    const rec: LogEvent = {
      ts: new Date().toISOString(),
      level,
      event,
      message,
    };
    fs.appendFileSync(
      this.jsonlPath,
      JSON.stringify(rec) + "\n",
      "utf-8"
    );
    this.events.push(rec);
  }

  info(event: string, message: string) {
    this.write("INFO", event, message);
  }

  warn(event: string, message: string) {
    this.write("WARN", event, message);
  }

  error(event: string, message: string) {
    this.write("ERROR", event, message);
  }
}
