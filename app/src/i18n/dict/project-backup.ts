// Back up one project to a single file, and restore it as a new project.
const RESTORE = "Restore project backup…", BACK = "Back up project…", TAG = "(restored)";
const OK = "Backed up “{name}” ({size}) as {file}. It holds the transcript, speakers, checked quotes and the recording, and restores without the original file.";
const OKN = "Backed up “{name}” ({size}) as {file}. It holds the transcript, speakers, checked quotes and all {count} recordings, with where each one starts and any boundary notes, and restores without the original files.";
const FAIL_B = "Could not back up “{name}”: {why} Nothing was changed, and any earlier backup is still there.";
const FAIL_R = "Could not restore the backup: {why} Nothing was added, and your projects are as they were.";
const DONE = "Restored “{name}” as a new project. Its recording is now kept in Cassette’s own recordings folder.";
const COPY = "Restored as “{name}”. A project with the same identity was already here, so this one is a separate copy and the existing one is unchanged.";
const MISSING = "The recording for this project is not available.", CHANGED = "The recording changed while it was being copied. Try again.";
const UNWR = "That place cannot be written to. Choose another folder.", DISK = "There is not enough free disk space.";
const NOT = "That file is not a Cassette project backup.", DAMAGED = "The backup is damaged or incomplete.";
const NEWER = "The backup was made by a newer version of Cassette. Update Cassette and try again.", UNSAFE = "The backup names a recording path that is not safe.", WRONG = "Something went wrong.";
export default {
  de: { [RESTORE]: "Projekt-Sicherung wiederherstellen…", [BACK]: "Projekt sichern…", [TAG]: "(wiederhergestellt)",
    [OK]: "„{name}“ ({size}) als {file} gesichert. Die Datei enthält Transkript, Sprecher, markierte Zitate und die Aufnahme und lässt sich ohne die Originaldatei wiederherstellen.",
    [OKN]: "„{name}“ ({size}) als {file} gesichert. Die Datei enthält Transkript, Sprecher, markierte Zitate und alle {count} Aufnahmen samt Anfangszeit jeder Aufnahme und allen Hinweisen zu den Übergängen und lässt sich ohne die Originaldateien wiederherstellen.",
    [FAIL_B]: "„{name}“ konnte nicht gesichert werden: {why} Es wurde nichts geändert, und eine frühere Sicherung ist unverändert vorhanden.",
    [FAIL_R]: "Die Sicherung konnte nicht wiederhergestellt werden: {why} Es wurde nichts hinzugefügt, und deine Projekte sind unverändert.",
    [DONE]: "„{name}“ wurde als neues Projekt wiederhergestellt. Die Aufnahme liegt jetzt im eigenen Aufnahmenordner von Cassette.",
    [COPY]: "Wiederhergestellt als „{name}“. Ein Projekt mit derselben Kennung war schon vorhanden, deshalb ist dies eine getrennte Kopie, und das vorhandene Projekt ist unverändert.",
    [MISSING]: "Die Aufnahme zu diesem Projekt ist nicht verfügbar.", [CHANGED]: "Die Aufnahme hat sich beim Kopieren geändert. Versuche es erneut.",
    [UNWR]: "An diesen Ort kann nicht geschrieben werden. Wähle einen anderen Ordner.", [DISK]: "Es ist nicht genug freier Speicherplatz vorhanden.",
    [NOT]: "Diese Datei ist keine Cassette-Projektsicherung.", [DAMAGED]: "Die Sicherung ist beschädigt oder unvollständig.",
    [NEWER]: "Die Sicherung stammt von einer neueren Version von Cassette. Aktualisiere Cassette und versuche es erneut.", [UNSAFE]: "Die Sicherung nennt einen unsicheren Pfad für die Aufnahme.", [WRONG]: "Etwas ist schiefgelaufen." },
  fr: { [RESTORE]: "Restaurer une sauvegarde de projet…", [BACK]: "Sauvegarder le projet…", [TAG]: "(restauré)",
    [OK]: "« {name} » ({size}) sauvegardé sous {file}. Le fichier contient la transcription, les intervenants, les citations cochées et l'enregistrement, et se restaure sans le fichier d'origine.",
    [OKN]: "« {name} » ({size}) sauvegardé sous {file}. Le fichier contient la transcription, les intervenants, les citations cochées et les {count} enregistrements, avec le début de chacun et les notes sur les jonctions, et se restaure sans les fichiers d'origine.",
    [FAIL_B]: "Impossible de sauvegarder « {name} » : {why} Rien n'a été modifié, et toute sauvegarde précédente est toujours là.",
    [FAIL_R]: "Impossible de restaurer la sauvegarde : {why} Rien n'a été ajouté, et vos projets sont inchangés.",
    [DONE]: "« {name} » a été restauré comme nouveau projet. Son enregistrement est désormais conservé dans le dossier d'enregistrements de Cassette.",
    [COPY]: "Restauré sous « {name} ». Un projet de même identité était déjà présent : celui-ci en est donc une copie séparée, et le projet existant est inchangé.",
    [MISSING]: "L'enregistrement de ce projet n'est pas disponible.", [CHANGED]: "L'enregistrement a changé pendant la copie. Réessayez.",
    [UNWR]: "Impossible d'écrire à cet endroit. Choisissez un autre dossier.", [DISK]: "Il n'y a pas assez d'espace disque libre.",
    [NOT]: "Ce fichier n'est pas une sauvegarde de projet Cassette.", [DAMAGED]: "La sauvegarde est endommagée ou incomplète.",
    [NEWER]: "La sauvegarde a été créée par une version plus récente de Cassette. Mettez Cassette à jour et réessayez.", [UNSAFE]: "La sauvegarde indique un chemin d'enregistrement non sûr.", [WRONG]: "Une erreur s'est produite." },
  es: { [RESTORE]: "Restaurar copia de seguridad de un proyecto…", [BACK]: "Hacer copia de seguridad del proyecto…", [TAG]: "(restaurado)",
    [OK]: "Copia de seguridad de «{name}» ({size}) guardada como {file}. Contiene la transcripción, los hablantes, las citas marcadas y la grabación, y se restaura sin el archivo original.",
    [OKN]: "Copia de seguridad de «{name}» ({size}) guardada como {file}. Contiene la transcripción, los hablantes, las citas marcadas y las {count} grabaciones, con el inicio de cada una y las notas sobre los empalmes, y se restaura sin los archivos originales.",
    [FAIL_B]: "No se pudo hacer la copia de «{name}»: {why} No se cambió nada y cualquier copia anterior sigue ahí.",
    [FAIL_R]: "No se pudo restaurar la copia: {why} No se añadió nada y tus proyectos están como estaban.",
    [DONE]: "«{name}» se restauró como proyecto nuevo. Su grabación se guarda ahora en la carpeta de grabaciones de Cassette.",
    [COPY]: "Restaurado como «{name}». Ya había un proyecto con la misma identidad, así que este es una copia aparte y el existente no cambió.",
    [MISSING]: "La grabación de este proyecto no está disponible.", [CHANGED]: "La grabación cambió mientras se copiaba. Inténtalo de nuevo.",
    [UNWR]: "No se puede escribir en ese lugar. Elige otra carpeta.", [DISK]: "No hay suficiente espacio libre en disco.",
    [NOT]: "Ese archivo no es una copia de seguridad de un proyecto de Cassette.", [DAMAGED]: "La copia de seguridad está dañada o incompleta.",
    [NEWER]: "La copia fue creada por una versión más reciente de Cassette. Actualiza Cassette e inténtalo de nuevo.", [UNSAFE]: "La copia indica una ruta de grabación que no es segura.", [WRONG]: "Algo salió mal." },
};
