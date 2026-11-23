// Restore points: the project is saved before a re-run, Replace all or bulk speaker move, and the restore itself can be taken back.
const A = "A copy from before “{what}” is kept.";
const N = "Cassette could not save a restore point first, so nothing was changed: {error}. Free some disk space and try again.";
const C = "The transcript changed while the restore point was being saved, so nothing was changed. Try again.";
const L = "redo a line", P = "redo part of the transcript", T = "transcribe again";
export default {
  de: { [A]: "Eine Kopie von vor „{what}“ wird aufbewahrt.", [N]: "Cassette konnte vorher keinen Wiederherstellungspunkt speichern, deshalb wurde nichts geändert: {error}. Schaffe Speicherplatz frei und versuche es erneut.", [C]: "Das Transkript hat sich geändert, während der Wiederherstellungspunkt gespeichert wurde, deshalb wurde nichts geändert. Versuche es erneut.", [L]: "Zeile neu transkribieren", [P]: "Teil des Transkripts neu transkribieren", [T]: "erneut transkribieren" },
  fr: { [A]: "Une copie d'avant « {what} » est conservée.", [N]: "Cassette n'a pas pu enregistrer de point de restauration au préalable, donc rien n'a été modifié : {error}. Libérez de l'espace disque et réessayez.", [C]: "La transcription a changé pendant l'enregistrement du point de restauration, donc rien n'a été modifié. Réessayez.", [L]: "retranscrire une ligne", [P]: "retranscrire une partie de la transcription", [T]: "transcrire à nouveau" },
  es: { [A]: "Se conserva una copia de antes de «{what}».", [N]: "Cassette no pudo guardar antes un punto de restauración, así que no se cambió nada: {error}. Libera espacio en disco e inténtalo de nuevo.", [C]: "La transcripción cambió mientras se guardaba el punto de restauración, así que no se cambió nada. Inténtalo de nuevo.", [L]: "volver a transcribir una línea", [P]: "volver a transcribir una parte de la transcripción", [T]: "transcribir de nuevo" },
};
