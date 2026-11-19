// Polite screen-reader announcements for running, finished and failed transcriptions.
const A = "{stage}: {percent} percent";
const B = "Finished transcribing “{name}”.";
const C = "Transcribing “{name}” did not finish. Open it for details.";
export default {
  de: { [A]: "{stage}: {percent} Prozent", [B]: "„{name}“ ist fertig transkribiert.", [C]: "Die Transkription von „{name}“ wurde nicht abgeschlossen. Öffne sie für Details." },
  fr: { [A]: "{stage} : {percent} pour cent", [B]: "La transcription de « {name} » est terminée.", [C]: "La transcription de « {name} » n'a pas abouti. Ouvrez-la pour les détails." },
  es: { [A]: "{stage}: {percent} por ciento", [B]: "Terminó la transcripción de «{name}».", [C]: "La transcripción de «{name}» no terminó. Ábrela para ver los detalles." },
};
