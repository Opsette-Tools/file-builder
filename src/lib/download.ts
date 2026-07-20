/**
 * download.ts — one reliable browser-download path, shared by every mode.
 *
 * Getting a programmatic blob download to actually save (and not get swallowed
 * by the SPA/service worker, or dropped as "non-user-initiated" after an await)
 * took real hardening in the Bundle mode. That logic lives here now so Organize,
 * Sign & Fill, and any future mode reuse the exact same battle-tested path
 * instead of re-deriving it.
 */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  a.target = "_self";
  a.style.display = "none";
  document.body.appendChild(a);
  // A real MouseEvent (not bare .click()) is reliably treated as user-initiated
  // even after an await, so the download isn't quietly dropped.
  a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  // Keep the object URL alive briefly so the browser finishes reading the blob
  // before we revoke it.
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 4000);
}
