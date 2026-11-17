/** "12:30", "1:02:03" or plain seconds ("90", "90.5") to seconds; null when it is not a time. */
export function parseTime(text: string): number | null {
  const s = text.trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  const m = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const [a, b, c] = [Number(m[1]), Number(m[2]), m[3] == null ? null : Number(m[3])];
  if (b > 59 || (c != null && c > 59)) return null;
  return c == null ? a * 60 + b : a * 3600 + b * 60 + c;
}
