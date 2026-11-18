/**
 * "Hide file and folder names" for the activity log. Best effort: it replaces what it recognises (paths, audio and video file names,
 * the line "Input: …", the folder in "Imported … from …") and leaves everything else. It errs on the side of hiding more.
 * It cannot know a name that sits inside ordinary text, so the setting says to check the log before sharing it.
 */
const EXT = "(?:mp3|wav|m4a|flac|ogg|opus|aac|mp4|mov|mkv|webm|json)";
// a path may contain spaces, so it is matched lazily up to a known extension; it must start where a path can start (after space, quote, colon, bracket or line start)
const PATH_WITH_EXT = new RegExp(`(?<![^\\s"'“(\\[=:])(?:[A-Za-z]:|\\\\\\\\[^\\\\\\s]+)?[\\\\/][^\\r\\n"'“”<>|?*]*?\\.${EXT}\\b`, "gi");
const BARE_NAME = new RegExp(`(?<=^|[:"'“(]\\s*|\\bfile\\s+)[^\\s"'“”<>|\\\\/:][^"'“”<>|\\\\/:\\r\\n]{0,120}?\\.${EXT}\\b`, "gi");
const OTHER_PATH = /(?<![^\s"'“([=:])(?:[A-Za-z]:\\|\\\\|\/)[^\s"'“”<>|]+/g;

export function redactNames(message: string): string {
  let m = message;
  m = m.replace(/^(Input: ).*?( \(range [^)]*\))?$/s, (_all, head: string, range?: string) => `${head}[file]${range ?? ""}`);
  m = m.replace(/^(Imported \d+ model\(s\) from ).*$/s, "$1[folder]");
  m = m.replace(PATH_WITH_EXT, "[file]");
  m = m.replace(BARE_NAME, "[file]");
  m = m.replace(OTHER_PATH, "[path]");
  return m;
}
