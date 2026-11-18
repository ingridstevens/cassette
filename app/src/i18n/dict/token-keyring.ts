// Token storage on Linux without a password keyring (Settings > Privacy).
const W = "This computer has no password keyring, so the token would be stored readable. Install and unlock a keyring (GNOME Keyring or KWallet), or paste the token each time.";
const C = "Not encrypted: this computer has no password keyring. Last 4 characters: {hint}";
export default {
  de: { [W]: "Dieser Computer hat keinen Passwort-Schlüsselbund, deshalb würde der Token lesbar gespeichert. Installiere und entsperre einen Schlüsselbund (GNOME Keyring oder KWallet) oder füge den Token jedes Mal neu ein.", [C]: "Nicht verschlüsselt: Dieser Computer hat keinen Passwort-Schlüsselbund. Letzte 4 Zeichen: {hint}" },
  fr: { [W]: "Cet ordinateur n'a pas de trousseau de mots de passe : le jeton serait donc enregistré en clair. Installez et déverrouillez un trousseau (GNOME Keyring ou KWallet), ou collez le jeton à chaque fois.", [C]: "Non chiffré : cet ordinateur n'a pas de trousseau de mots de passe. 4 derniers caractères : {hint}" },
  es: { [W]: "Este ordenador no tiene un llavero de contraseñas, así que el token se guardaría legible. Instala y desbloquea un llavero (GNOME Keyring o KWallet), o pega el token cada vez.", [C]: "Sin cifrar: este ordenador no tiene un llavero de contraseñas. Últimos 4 caracteres: {hint}" },
};
