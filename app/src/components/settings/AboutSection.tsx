import { useEffect, useState } from "react";
import { useT } from "../../i18n";
import { Block } from "./shared";

const FEEDBACK_URL = "https://github.com/ingridstevens/cassette/issues/new";

export default function AboutSection() {
  const t = useT();
  const [sys, setSys] = useState<{ platform: string; arch: string; memGB: number } | null>(null);
  useEffect(() => { window.api.paths().then((p) => setSys(p.system)).catch(() => {}); }, []);
  // Nothing is sent by the app: this opens the user's browser on a pre-filled GitHub form that they read, edit and submit themselves.
  const sendFeedback = () => {
    const body = `\n\n---\nCassette ${__APP_VERSION__}\n${sys ? `${sys.platform} ${sys.arch}, ${sys.memGB} GB memory` : ""}\n`;
    window.api.openExternal(`${FEEDBACK_URL}?body=${encodeURIComponent(body)}`);
  };
  return (
    <Block id="ab" title="Cassette">
      <dl className="st-meta">
        <div><dt>{t("Version")}</dt><dd>{__APP_VERSION__}</dd></div>
        <div><dt>{t("Licence")}</dt><dd>{t("Unlicense (public domain)")}</dd></div>
        <div><dt>{t("Updates")}</dt><dd>{t("Never checked automatically. Download new versions yourself.")}</dd></div>
      </dl>
      <div className="st-row">
        <button type="button" className="btn quiet small ext" onClick={sendFeedback}>{t("Send feedback")}</button>
      </div>
      <p className="note">{t("Opens a new GitHub issue in your browser, filled in with the app version, your system and its memory. You can read and change it before you send it; the app sends nothing itself, and you need a GitHub account.")}</p>
      <p className="note">{t("The source code, the licences of the models and the third-party notices are in the project folder (README.md and THIRD_PARTY_NOTICES.md).")}</p>
    </Block>
  );
}
