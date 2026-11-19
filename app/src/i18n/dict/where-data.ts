// Settings > Privacy > What is stored where (real paths, one Show button per place).
const K = {
  intro: "The real places on this computer, read from the app. Nothing here can be changed; Show opens the place in your file manager.",
  rec: "Recordings made in the app, and the copy of the sample",
  recN: "Deleting the project deletes these.",
  proj: "Plus up to three rolling backups of the project list next to it (projects.json.bak1 to bak3). To erase the project list, delete projects.json and these backups.",
  peaks: "Waveform cache",
  peaksN: "The shape of each recording's sound, not the words. Safe to delete; it is made again.",
  tmp: "Temporary files",
  tmpN: "Transcript text handed to the engine, deleted right after use and emptied when the app starts. Decoded audio is held in your system's temporary folder while a job runs.",
  mod: "Downloaded models. No recordings or transcripts.",
  show: "Show {what} in the file manager",
  exp: "Exports and the anonymisation key",
  expN: "Where you chose to save them. The app keeps no list of them and never deletes them.",
};
export default {
  de: {
    [K.intro]: "Die tatsächlichen Orte auf diesem Computer, aus der App gelesen. Hier lässt sich nichts ändern; „Zeigen“ öffnet den Ort in deinem Dateimanager.",
    [K.rec]: "In der App aufgenommene Aufnahmen und die Kopie der Beispielaufnahme", [K.recN]: "Beim Löschen des Projekts werden sie mitgelöscht.",
    [K.proj]: "Dazu bis zu drei rollierende Sicherungen der Projektliste daneben (projects.json.bak1 bis bak3). Um die Projektliste zu löschen, lösche projects.json und diese Sicherungen.",
    [K.peaks]: "Wellenform-Cache", [K.peaksN]: "Die Form des Tons jeder Aufnahme, nicht die Wörter. Kann gelöscht werden; wird neu erstellt.",
    [K.tmp]: "Temporäre Dateien", [K.tmpN]: "Transkripttext, der an die Engine übergeben wird, direkt danach gelöscht und beim Start der App geleert. Dekodiertes Audio liegt während eines Auftrags im temporären Ordner deines Systems.",
    [K.mod]: "Heruntergeladene Modelle. Keine Aufnahmen oder Transkripte.", [K.show]: "{what} im Dateimanager zeigen",
    [K.exp]: "Exporte und der Anonymisierungsschlüssel", [K.expN]: "Dort, wo du sie gespeichert hast. Die App führt keine Liste darüber und löscht sie nie.",
  },
  fr: {
    [K.intro]: "Les emplacements réels sur cet ordinateur, lus depuis l’application. Rien ne peut être modifié ici ; « Afficher » ouvre l’emplacement dans votre gestionnaire de fichiers.",
    [K.rec]: "Enregistrements faits dans l’application et copie de l’exemple", [K.recN]: "Supprimer le projet les supprime.",
    [K.proj]: "Plus jusqu’à trois sauvegardes tournantes de la liste de projets à côté (projects.json.bak1 à bak3). Pour effacer la liste de projets, supprimez projects.json et ces sauvegardes.",
    [K.peaks]: "Cache des formes d’onde", [K.peaksN]: "La forme du son de chaque enregistrement, pas les mots. Peut être supprimé ; il est recréé.",
    [K.tmp]: "Fichiers temporaires", [K.tmpN]: "Texte de transcription transmis au moteur, supprimé juste après et vidé au démarrage de l’application. L’audio décodé est conservé dans le dossier temporaire du système pendant une tâche.",
    [K.mod]: "Modèles téléchargés. Aucun enregistrement ni transcription.", [K.show]: "Afficher {what} dans le gestionnaire de fichiers",
    [K.exp]: "Exports et clé d’anonymisation", [K.expN]: "À l’endroit que vous avez choisi. L’application n’en tient pas de liste et ne les supprime jamais.",
  },
  es: {
    [K.intro]: "Los lugares reales de este ordenador, leídos desde la app. Aquí no se puede cambiar nada; Mostrar abre el lugar en tu gestor de archivos.",
    [K.rec]: "Grabaciones hechas en la app y la copia del ejemplo", [K.recN]: "Al eliminar el proyecto se eliminan.",
    [K.proj]: "Más hasta tres copias de seguridad rotativas de la lista de proyectos a su lado (projects.json.bak1 a bak3). Para borrar la lista de proyectos, elimina projects.json y estas copias.",
    [K.peaks]: "Caché de formas de onda", [K.peaksN]: "La forma del sonido de cada grabación, no las palabras. Se puede borrar; se vuelve a crear.",
    [K.tmp]: "Archivos temporales", [K.tmpN]: "Texto de la transcripción entregado al motor, borrado justo después de usarlo y vaciado al iniciar la app. El audio decodificado permanece en la carpeta temporal del sistema mientras se ejecuta una tarea.",
    [K.mod]: "Modelos descargados. Sin grabaciones ni transcripciones.", [K.show]: "Mostrar {what} en el gestor de archivos",
    [K.exp]: "Exportaciones y la clave de anonimización", [K.expN]: "Donde elegiste guardarlas. La app no lleva una lista de ellas y nunca las elimina.",
  },
};
