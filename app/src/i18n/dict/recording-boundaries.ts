// Where one recording ends and the next begins: a known gap, an unknown gap and an overlapping handoff are shown and noted apart, and none of them changes the audio.
const S = "{n} s", MS = "{m} min {s} s";
const GAP = "Known gap", UNK = "Unknown gap", OVL = "Handoff overlap", NEW = "New recording", NOTHING = "Nothing noted";
const GAPT = "Nothing was recorded for {length} between part {a} and part {b}. The transcript continues after the gap.";
const UNKT = "Something may be missing between part {a} and part {b}, and nobody knows how much.";
const OVLT = "Part {a} and part {b} both recorded the same {length}, so a few words may be heard twice. Nothing was cut.";
const NEWT = "Part {b}, “{name}”, starts here.";
const PLAYL = "Play part {b} from its start, {time}", PLAY = "Play part {b}";
const GRP = "Boundaries between recordings", HINT = "These notes only label the transcript. They do not change the audio or the times.";
const BETW = "Between part {a} and part {b}", LGAP = "Length of the gap in seconds", LOVL = "Length of the overlap in seconds", SEC = "seconds";
const ERR = "Enter a length above 0, or choose “Unknown gap”.", LABEL = "note a boundary";
export default {
  de: {
    [S]: "{n} s", [MS]: "{m} min {s} s", [GAP]: "Bekannte Lücke", [UNK]: "Unbekannte Lücke", [OVL]: "Überlappende Übergabe", [NEW]: "Neue Aufnahme", [NOTHING]: "Nichts vermerkt",
    [GAPT]: "Zwischen Teil {a} und Teil {b} wurde {length} lang nichts aufgenommen. Das Transkript geht nach der Lücke weiter.",
    [UNKT]: "Zwischen Teil {a} und Teil {b} fehlt möglicherweise etwas, und niemand weiß, wie viel.",
    [OVLT]: "Teil {a} und Teil {b} haben dieselben {length} aufgenommen, einige Wörter sind deshalb eventuell doppelt zu hören. Es wurde nichts geschnitten.",
    [NEWT]: "Teil {b}, „{name}“, beginnt hier.", [PLAYL]: "Teil {b} von Anfang an abspielen, {time}", [PLAY]: "Teil {b} abspielen",
    [GRP]: "Übergänge zwischen den Aufnahmen", [HINT]: "Diese Vermerke beschriften nur das Transkript. Audio und Zeiten ändern sich nicht.",
    [BETW]: "Zwischen Teil {a} und Teil {b}", [LGAP]: "Länge der Lücke in Sekunden", [LOVL]: "Länge der Überlappung in Sekunden", [SEC]: "Sekunden",
    [ERR]: "Gib eine Länge über 0 ein oder wähle „Unbekannte Lücke“.", [LABEL]: "Übergang vermerken",
  },
  fr: {
    [S]: "{n} s", [MS]: "{m} min {s} s", [GAP]: "Trou connu", [UNK]: "Trou de durée inconnue", [OVL]: "Chevauchement au relais", [NEW]: "Nouvel enregistrement", [NOTHING]: "Rien de noté",
    [GAPT]: "Rien n'a été enregistré pendant {length} entre la partie {a} et la partie {b}. La transcription reprend après le trou.",
    [UNKT]: "Il manque peut-être quelque chose entre la partie {a} et la partie {b}, et personne ne sait combien.",
    [OVLT]: "La partie {a} et la partie {b} ont enregistré les mêmes {length} : quelques mots peuvent donc s'entendre deux fois. Rien n'a été coupé.",
    [NEWT]: "La partie {b}, « {name} », commence ici.", [PLAYL]: "Lire la partie {b} depuis son début, {time}", [PLAY]: "Lire la partie {b}",
    [GRP]: "Jonctions entre les enregistrements", [HINT]: "Ces notes ne servent qu'à annoter la transcription. Elles ne changent ni l'audio ni les temps.",
    [BETW]: "Entre la partie {a} et la partie {b}", [LGAP]: "Durée du trou en secondes", [LOVL]: "Durée du chevauchement en secondes", [SEC]: "secondes",
    [ERR]: "Saisissez une durée supérieure à 0, ou choisissez « Trou de durée inconnue ».", [LABEL]: "noter une jonction",
  },
  es: {
    [S]: "{n} s", [MS]: "{m} min {s} s", [GAP]: "Hueco conocido", [UNK]: "Hueco desconocido", [OVL]: "Solapamiento en el relevo", [NEW]: "Nueva grabación", [NOTHING]: "Nada anotado",
    [GAPT]: "No se grabó nada durante {length} entre la parte {a} y la parte {b}. La transcripción continúa después del hueco.",
    [UNKT]: "Puede faltar algo entre la parte {a} y la parte {b}, y nadie sabe cuánto.",
    [OVLT]: "La parte {a} y la parte {b} grabaron los mismos {length}, así que algunas palabras pueden oírse dos veces. No se cortó nada.",
    [NEWT]: "La parte {b}, «{name}», empieza aquí.", [PLAYL]: "Reproducir la parte {b} desde su inicio, {time}", [PLAY]: "Reproducir la parte {b}",
    [GRP]: "Uniones entre grabaciones", [HINT]: "Estas notas solo etiquetan la transcripción. No cambian el audio ni los tiempos.",
    [BETW]: "Entre la parte {a} y la parte {b}", [LGAP]: "Duración del hueco en segundos", [LOVL]: "Duración del solapamiento en segundos", [SEC]: "segundos",
    [ERR]: "Escribe una duración mayor que 0 o elige «Hueco desconocido».", [LABEL]: "anotar una unión",
  },
};
