import { useEffect, useState } from "react";
import { ModelStatus, Options, bytes } from "../../types";
import { useT } from "../../i18n";
import { MODEL_BYTES, Models } from "../useModels";

type Paths = Awaited<ReturnType<typeof window.api.paths>>;
interface Props { opts: Options; set(o: Options): void; status: ModelStatus | null; models: Models }

const SIZES: [string, string][] = [["tiny", "Tiny"], ["base", "Base"], ["small", "Small"], ["medium", "Medium"], ["large-v3-turbo", "Large v3 turbo"], ["large-v3", "Large v3"]];

export default function PerformanceSection({ opts, set, status, models }: Props) {
  const t = useT();
  const [sys, setSys] = useState<Paths["system"] | null>(null);
  useEffect(() => { window.api.paths().then((p) => setSys(p.system)); }, []);
  const device = opts.device === "cpu" ? "cpu" : "auto"; // older saved choices (mps / cuda) mean the same as Automatic
  const apple = sys?.platform === "darwin" && sys.arch === "arm64";
  const autoHint = apple ? t("Uses your Mac's graphics chip to find speakers about 10× faster.") : t("Uses an NVIDIA graphics card if the computer has one, otherwise the CPU.");
  const speakers = device === "cpu" ? ["CPU", "cpu"] : apple ? ["Apple GPU", "gpu"] : [t("NVIDIA GPU if available, otherwise CPU"), "cpu"];
  const about = !sys ? t("Detecting this computer…")
    : sys.chip ? t("This computer has {chip} with {cores} cores and {mem} GB of memory.", { chip: sys.chip, cores: sys.cores, mem: sys.memGB })
    : t("This computer has a {arch} processor with {cores} cores and {mem} GB of memory.", { arch: sys.arch, cores: sys.cores, mem: sys.memGB });

  const mlx = !!status?.mlxAvailable;
  const engine = opts.whisperEngine === "faster" ? "faster" : "auto";
  const haveMlx = !!status?.mlx?.[opts.model];
  const words = mlx && engine === "auto" && device !== "cpu" && haveMlx ? ["Apple GPU", "gpu"] : ["CPU", "cpu"];
  const note = !mlx ? t("The transcription engine can't use the graphics chip on this computer, so writing the words down runs on the CPU.")
    : haveMlx && engine === "auto" && device !== "cpu" ? t("Writing the words down uses the Apple GPU for the selected model. “Skip silence” isn't available there, so a project with it turned on uses the CPU.")
    : t("Writing the words down uses the CPU. Download the Apple GPU version of the selected model below, and keep this on Automatic, to use the graphics chip.");
  const busy = models.busy;
  return (
    <>
      <div className="card st-card">
        <h2>{t("Which part of your computer finds the speakers?")}</h2>
        <p className="st-lead">{about}</p>
        <fieldset className="st-fieldset">
          <legend className="st-sr">{t("Processor for finding speakers")}</legend>
          <label className="choice"><input type="radio" name="proc" checked={device === "auto"} onChange={() => set({ ...opts, device: "auto" })} />
            <span><b>{t("Automatic")} <span className="badge">{t("Recommended")}</span></b><small>{autoHint}</small></span></label>
          <label className="choice"><input type="radio" name="proc" checked={device === "cpu"} onChange={() => set({ ...opts, device: "cpu" })} />
            <span><b>{t("CPU only")}</b><small>{t("Slower, but the most compatible. Try it if speaker labels ever look wrong.")}</small></span></label>
        </fieldset>
        <div className="st-inset st-status" role="status">
          <b>{t("What is used now.")}</b> {t("Finding speakers:")} <span className={"st-chip " + speakers[1]}>{speakers[0]}</span> {t("Writing the words down:")} <span className={"st-chip " + words[1]}>{words[0]}</span>
          <span className="note">{note}</span>
        </div>
      </div>

      {mlx && (
        <div className="card st-card">
          <h2>{t("Which engine writes the words down?")}</h2>
          <p className="st-lead">{t("On a Mac with an Apple chip the words can be written down on the graphics chip. In our tests that was roughly 4 to 16 times faster than the CPU, with the same languages and speakers.")}</p>
          <fieldset className="st-fieldset">
            <legend className="st-sr">{t("Engine for writing the words down")}</legend>
            <label className="choice"><input type="radio" name="engine" checked={engine === "auto"} onChange={() => set({ ...opts, whisperEngine: undefined })} />
              <span><b>{t("Automatic")} <span className="badge">{t("Recommended")}</span></b><small>{t("Uses the Apple GPU when the Apple GPU version of the selected model is downloaded, otherwise the CPU.")}</small></span></label>
            <label className="choice"><input type="radio" name="engine" checked={engine === "faster"} onChange={() => set({ ...opts, whisperEngine: "faster" })} />
              <span><b>{t("Always the CPU")}</b><small>{t("Slower, but the most tested path. Try it if the Apple GPU version ever gives odd results.")}</small></span></label>
          </fieldset>
          <h3 className="st-sub">{t("Apple GPU versions of the models")}</h3>
          <p className="note">{t("Each size you want on the graphics chip needs its own download, in addition to the normal model. They are not gated and need no account.")}</p>
          <ul className="st-mlx">
            {SIZES.map(([n, label]) => {
              const have = !!status?.mlx?.[n];
              const size = status?.mlxSizes?.[n] || MODEL_BYTES[n];
              const going = busy === `download mlx-${n}`;
              return (
                <li key={n}>
                  <span className="grow"><b>{t(label)}</b>{n === opts.model && <span className="badge">{t("Selected")}</span>} <small>{have ? t("Downloaded · {size}", { size: bytes(size) }) : t("About {size}", { size: bytes(size) })}</small></span>
                  {going ? (
                    <><span className="note">{models.dl?.fraction != null ? `${Math.round(models.dl.fraction * 100)}%` : t("Starting…")}</span><button type="button" className="btn quiet small" onClick={models.cancel}>{t("Cancel")}</button></>
                  ) : have ? (
                    <button type="button" className="btn quiet small danger" disabled={!!busy} aria-label={t("Delete the Apple GPU version of {label}", { label: t(label) })} onClick={() => void models.run("delete", `mlx-${n}`)}>{t("Delete")}</button>
                  ) : (
                    <button type="button" className="btn small" disabled={!!busy} aria-label={t("Download the Apple GPU version of {label}", { label: t(label) })} onClick={() => void models.run("download", `mlx-${n}`)}>{t("Download")}</button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
