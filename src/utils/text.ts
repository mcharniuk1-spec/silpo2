export function cleanSpaces(s: string): string {
  return s.replace(/\s+/g, " ").replace(/[\r\n\t]/g, " ").trim();
}

export function toNum(s: string): number {
  return Number(String(s).replace(",", "."));
}
