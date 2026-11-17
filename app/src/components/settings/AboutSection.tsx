import { useT } from "../../i18n";
import { Block } from "./shared";

export default function AboutSection() {
  const t = useT();
  return (
    <Block id="ab" title="Cassette">
      <dl className="st-meta">
        <div><dt>{t("Version")}</dt><dd>{__APP_VERSION__}</dd></div>
        <div><dt>{t("Licence")}</dt><dd>{t("Unlicense (public domain)")}</dd></div>
        <div><dt>{t("Updates")}</dt><dd>{t("Never checked automatically. Download new versions yourself.")}</dd></div>
      </dl>
      <p className="note">{t("The source code, the licences of the models and the third-party notices are in the project folder (README.md and THIRD_PARTY_NOTICES.md).")}</p>
    </Block>
  );
}
