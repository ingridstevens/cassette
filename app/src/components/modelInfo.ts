import { langName } from "../languages";
/** One list of transcription models, so every screen calls a model the same thing. */
export const WHISPER_MODELS: { id: string; name: string; tag?: "Fast" | "Balanced" | "Most accurate"; like: string }[] = [
  { id: "tiny", name: "Tiny", like: "Fastest, rough" },
  { id: "base", name: "Base", tag: "Fast", like: "Fast, basic accuracy" },
  { id: "small", name: "Small", tag: "Balanced", like: "Good balance" },
  { id: "medium", name: "Medium", like: "More accurate, slower" },
  { id: "large-v3-turbo", name: "Large v3 turbo", tag: "Balanced", like: "Fast, nearly as accurate as Large v3" },
  { id: "large-v3", name: "Large v3", tag: "Most accurate", like: "Most accurate, slowest" },
];
/** Other speech engines, shown beside the Whisper sizes where they can run (Apple Silicon Macs). */
export const ENGINE_MODELS: { id: string; name: string; tag?: "Fast" | "Balanced" | "Most accurate"; like: string }[] = [
  { id: "parakeet-v3", name: "Parakeet v3", like: "Very fast. 25 European languages, not Arabic or Persian" },
];
export const isEngineModel = (id: string) => ENGINE_MODELS.some((m) => m.id === id);
/** The tagged sizes the start sheet offers first, Large v3 included. */
export const RECOMMENDED = WHISPER_MODELS.filter((m) => m.tag);
export const isMoonshine = (id: string) => id.startsWith("moonshine-");
/** "Moonshine · German": one model per language, named from the language code in its id. */
export const moonshineName = (id: string) => `Moonshine · ${langName(id.slice("moonshine-".length))}`;
export const modelName = (id: string) => isMoonshine(id) ? moonshineName(id) :  WHISPER_MODELS.find((m) => m.id === id)?.name ?? ENGINE_MODELS.find((m) => m.id === id)?.name ?? id;
