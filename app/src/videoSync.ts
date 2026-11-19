/** The small video preview follows the one real player (the waveform's audio element): it never plays sound of its own and never leads. */

/** How far the picture may drift from the audio before it is moved (seconds): looser while playing, so it is not nudged all the time. */
export const DRIFT_PLAYING = 0.3;
export const DRIFT_PAUSED = 0.04;

/** The time the video should jump to, or null when it is close enough already. */
export function videoSeekTarget(videoTime: number, audioTime: number, playing: boolean): number | null {
  if (!Number.isFinite(audioTime) || audioTime < 0) return null;
  return Math.abs(videoTime - audioTime) > (playing ? DRIFT_PLAYING : DRIFT_PAUSED) ? audioTime : null;
}

/** Container -> MIME type, for asking the browser whether it can play the picture. */
const MIME: Record<string, string> = { mp4: "video/mp4", mov: "video/quicktime", mkv: "video/x-matroska", webm: "video/webm" };

/** False when the browser engine reports it cannot play this container (often mkv and mov); the preview then says so instead of showing a broken box. */
export function canPreviewVideo(path: string, canPlayType: (mime: string) => string): boolean {
  const ext = /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase() ?? "";
  const mime = MIME[ext];
  if (!mime) return false;
  try { return canPlayType(mime) !== ""; } catch { return false; }
}
