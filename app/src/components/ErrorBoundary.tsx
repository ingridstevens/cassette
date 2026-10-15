import { Component, type ErrorInfo, type ReactNode } from "react";
import { t } from "../i18n";

/** Without this, one render error unmounts the whole app and leaves a blank white window. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    window.api?.logError(`render error: ${error.stack ?? error.message}${info.componentStack ?? ""}`);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" style={{ padding: "80px 40px", font: "14px system-ui, sans-serif", maxWidth: 520 }}>
        <h1 style={{ fontSize: 20 }}>{t("Something went wrong.")}</h1>
        <p>{t("Your projects are safe. Reload the app to continue. The details were saved to the activity log.")}</p>
        <button type="button" className="btn" onClick={() => location.reload()}>{t("Reload")}</button>
      </div>
    );
  }
}
