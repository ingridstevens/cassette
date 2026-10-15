/** One list of transcription models, so every screen calls a model the same thing. */
export const WHISPER_MODELS: { id: string; name: string; tag?: "Fast" | "Balanced" | "Most accurate"; like: string }[] = [
  { id: "tiny", name: "Tiny", like: "Fastest, rough" },
  { id: "base", name: "Base", tag: "Fast", like: "Fast, basic accuracy" },
  { id: "small", name: "Small", tag: "Balanced", like: "Good balance" },
  { id: "medium", name: "Medium", like: "More accurate, slower" },
  { id: "large-v3-turbo", name: "Large v3 turbo", tag: "Most accurate", like: "Fast, nearly as accurate as Large v3" },
  { id: "large-v3", name: "Large v3", like: "Most accurate, slowest" },
];
/** The three sizes the start sheet offers first. */
export const RECOMMENDED = WHISPER_MODELS.filter((m) => m.tag);
export const modelName = (id: string) => WHISPER_MODELS.find((m) => m.id === id)?.name ?? id;
