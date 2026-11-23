// The banner shown while saving the project list fails (full disk, locked file).
const K = "Your changes could not be saved: {error}. Free some disk space, then keep working; Cassette tries again with every change.";
const R = "Retry save";
export default {
  de: { [K]: "Deine Änderungen konnten nicht gespeichert werden: {error}. Schaffe Speicherplatz frei und arbeite weiter; Cassette versucht es bei jeder Änderung erneut.", [R]: "Speichern wiederholen" },
  fr: { [K]: "Vos modifications n'ont pas pu être enregistrées : {error}. Libérez de l'espace disque, puis continuez ; Cassette réessaie à chaque modification.", [R]: "Réessayer d'enregistrer" },
  es: { [K]: "No se pudieron guardar tus cambios: {error}. Libera espacio en disco y sigue trabajando; Cassette lo intenta de nuevo con cada cambio.", [R]: "Reintentar guardado" },
};
