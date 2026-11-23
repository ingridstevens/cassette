// Locate recording: choose the file again when the recording was moved, renamed or restored from a backup elsewhere.
const LOC = "Locate recording…", TITLE = "Use this recording?", USE = "Use this recording";
const ASK = "This project was saved before Cassette could check recordings, so it cannot tell whether “{file}” is the right one. Compare it with the transcript first.";
const THIS = "This file: {size}, {length}", READING = "reading the length…", UNKNOWN = "length unknown", COVERS = "The transcript covers {length}.";
const ONLY = "Nothing changes except which file this project plays and exports from.";
const BUSY = "Wait for the transcription to finish, or cancel it, before choosing the recording again.";
const UNREAD = "That file could not be read as a recording. Nothing was changed.";
const DIFF = "“{file}” is not the recording “{name}” was made from, so nothing was changed. Choose the original file; it may have been renamed or moved.";
const RACE = "The project changed while you were choosing, so nothing was changed. Try again.";
const SAME = "That is the recording this project already uses.";
const SAVE = "Cassette could not save the new place of the recording, so nothing was changed: {error}. Free some disk space and try again.";
const DONE = "“{name}” now uses the recording “{file}”. The transcript, speaker names and edits are unchanged.";
export default {
  de: { [LOC]: "Aufnahme suchen…", [TITLE]: "Diese Aufnahme verwenden?", [USE]: "Diese Aufnahme verwenden",
    [ASK]: "Dieses Projekt wurde gespeichert, bevor Cassette Aufnahmen prüfen konnte. Es kann daher nicht erkennen, ob „{file}“ die richtige Datei ist. Vergleiche sie zuerst mit dem Transkript.",
    [THIS]: "Diese Datei: {size}, {length}", [READING]: "Länge wird gelesen…", [UNKNOWN]: "Länge unbekannt", [COVERS]: "Das Transkript deckt {length} ab.",
    [ONLY]: "Es ändert sich nur, welche Datei dieses Projekt abspielt und aus der es exportiert.",
    [BUSY]: "Warte, bis die Transkription fertig ist, oder brich sie ab, bevor du die Aufnahme neu wählst.",
    [UNREAD]: "Diese Datei konnte nicht als Aufnahme gelesen werden. Es wurde nichts geändert.",
    [DIFF]: "„{file}“ ist nicht die Aufnahme, aus der „{name}“ entstanden ist. Es wurde nichts geändert. Wähle die ursprüngliche Datei; sie kann umbenannt oder verschoben worden sein.",
    [RACE]: "Das Projekt hat sich während der Auswahl geändert. Es wurde nichts geändert. Versuche es erneut.",
    [SAME]: "Diese Aufnahme wird von diesem Projekt bereits verwendet.",
    [SAVE]: "Cassette konnte den neuen Ort der Aufnahme nicht speichern. Es wurde nichts geändert: {error}. Schaffe Speicherplatz und versuche es erneut.",
    [DONE]: "„{name}“ verwendet jetzt die Aufnahme „{file}“. Transkript, Sprechernamen und Änderungen sind unverändert." },
  fr: { [LOC]: "Localiser l'enregistrement…", [TITLE]: "Utiliser cet enregistrement ?", [USE]: "Utiliser cet enregistrement",
    [ASK]: "Ce projet a été enregistré avant que Cassette puisse vérifier les enregistrements : il ne peut pas savoir si « {file} » est le bon fichier. Comparez-le d'abord avec la transcription.",
    [THIS]: "Ce fichier : {size}, {length}", [READING]: "lecture de la durée…", [UNKNOWN]: "durée inconnue", [COVERS]: "La transcription couvre {length}.",
    [ONLY]: "Seul change le fichier à partir duquel ce projet lit et exporte.",
    [BUSY]: "Attendez la fin de la transcription, ou annulez-la, avant de choisir à nouveau l'enregistrement.",
    [UNREAD]: "Ce fichier n'a pas pu être lu comme enregistrement. Rien n'a été modifié.",
    [DIFF]: "« {file} » n'est pas l'enregistrement dont « {name} » est issu : rien n'a été modifié. Choisissez le fichier d'origine ; il a pu être renommé ou déplacé.",
    [RACE]: "Le projet a changé pendant votre choix : rien n'a été modifié. Réessayez.",
    [SAME]: "C'est déjà l'enregistrement utilisé par ce projet.",
    [SAVE]: "Cassette n'a pas pu enregistrer le nouvel emplacement de l'enregistrement : rien n'a été modifié ({error}). Libérez de l'espace disque et réessayez.",
    [DONE]: "« {name} » utilise maintenant l'enregistrement « {file} ». La transcription, les noms des intervenants et les modifications sont inchangés." },
  es: { [LOC]: "Localizar la grabación…", [TITLE]: "¿Usar esta grabación?", [USE]: "Usar esta grabación",
    [ASK]: "Este proyecto se guardó antes de que Cassette pudiera comprobar las grabaciones, así que no puede saber si «{file}» es el archivo correcto. Compáralo primero con la transcripción.",
    [THIS]: "Este archivo: {size}, {length}", [READING]: "leyendo la duración…", [UNKNOWN]: "duración desconocida", [COVERS]: "La transcripción cubre {length}.",
    [ONLY]: "Solo cambia el archivo desde el que este proyecto reproduce y exporta.",
    [BUSY]: "Espera a que termine la transcripción, o cancélala, antes de elegir de nuevo la grabación.",
    [UNREAD]: "Ese archivo no se pudo leer como grabación. No se cambió nada.",
    [DIFF]: "«{file}» no es la grabación de la que se creó «{name}», así que no se cambió nada. Elige el archivo original; puede haberse renombrado o movido.",
    [RACE]: "El proyecto cambió mientras elegías, así que no se cambió nada. Inténtalo de nuevo.",
    [SAME]: "Esa es la grabación que este proyecto ya usa.",
    [SAVE]: "Cassette no pudo guardar la nueva ubicación de la grabación, así que no se cambió nada: {error}. Libera espacio en el disco e inténtalo de nuevo.",
    [DONE]: "«{name}» ahora usa la grabación «{file}». La transcripción, los nombres de los hablantes y las ediciones no han cambiado." },
};
