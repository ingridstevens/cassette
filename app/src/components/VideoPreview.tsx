import { useEffect, useId, useRef, useState } from "react";
import { useT } from "../i18n";
import { canPreviewVideo, videoSeekTarget } from "../videoSync";
import "../styles/project.css";

interface Props { path: string; name: string; time: number; playing: boolean; rate: number }

/**
 * A small, silent picture for video projects, above the inspector. It has no controls and no sound of its own: the waveform's player is the single source of
 * playback, and this follows its play, pause, seek and speed. Off by default and remembered. Nothing is loaded until it is switched on.
 */
export default function VideoPreview({ path, name, time, playing, rate }: Props) {
  const t = useT();
  const [on, setOn] = useState(() => { try { return localStorage.getItem("videoPreview") === "1"; } catch { return false; } });
  const [failed, setFailed] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const noteId = useId();
  const toggle = () => setOn((o) => { const n = !o; try { localStorage.setItem("videoPreview", n ? "1" : "0"); } catch { /* remembered choice is a convenience only */ } return n; });
  const supported = canPreviewVideo(path, (m) => document.createElement("video").canPlayType(m));
  const show = on && supported && !failed;
  useEffect(() => { setFailed(false); }, [path]);

  useEffect(() => { const v = video.current; if (v) v.playbackRate = rate; }, [rate, show]);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const target = videoSeekTarget(v.currentTime, time, playing);
    if (target !== null) v.currentTime = target;
  }, [time, show]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (playing) void v.play().catch(() => { /* the picture is optional: if it cannot start, the audio carries on */ });
    else { v.pause(); const target = videoSeekTarget(v.currentTime, time, false); if (target !== null) v.currentTime = target; }
  }, [playing, show]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="pv-video">
      <button type="button" className={"btn quiet small" + (on ? " on" : "")} aria-pressed={on} onClick={toggle} title={t("Show a small silent picture that follows the player")}>{t("Video preview")}</button>
      {on && (!supported || failed)
        ? <p className="note pv-video-note" id={noteId} role="status">{t("Can't preview this video format here. The audio and the transcript work as usual.")}</p>
        : show && <video ref={video} className="pv-video-el" src={window.api.mediaUrl(path)} muted playsInline preload="auto" tabIndex={-1} aria-label={t("Silent preview of the video “{name}”, following the player", { name })} onError={() => setFailed(true)} />}
    </div>
  );
}
