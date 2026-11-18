/** Whether the window may navigate to `url`: only inside the app itself (the dev server's origin, or the built dist folder), never a look-alike path. */
export function isAppNavigation(appUrl: string, url: string, dev: boolean): boolean {
  let base: URL, u: URL;
  try {
    base = new URL(appUrl.endsWith("/") ? appUrl : appUrl + "/");
    u = new URL(url);
  } catch {
    return false;
  }
  return dev ? u.origin === base.origin : u.protocol === "file:" && u.pathname.startsWith(base.pathname);
}
