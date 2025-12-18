import fs from "node:fs";
import path from "node:path";

export function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

export function safeFileName(s: string): string {
  return s.replace(/[:/\\?*"<>|]/g, "-");
}

export function join(...parts: string[]) {
  return path.join(...parts);
}
