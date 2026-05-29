function base64ToBlob(base64: string, type = "application/pdf"): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

function anchorDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Save/share a PDF in a way that works on both desktop and mobile.
 *
 * On mobile (iOS Safari / Android Chrome) a programmatic `<a download>` blob
 * click is usually ignored, so we use the Web Share API with a File — this
 * opens the native share sheet, letting the user save to Files / Photos or
 * send it anywhere. Must be called from inside a user gesture (e.g. onClick).
 *
 * Returns true if the native share sheet was used (including when the user
 * dismissed it), false if it fell back to a normal browser download.
 */
export async function savePdfBase64(
  base64: string,
  filename: string,
): Promise<boolean> {
  const blob = base64ToBlob(base64);

  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[]; title?: string }) => Promise<void>;
  };

  if (typeof File !== "undefined" && nav.canShare && nav.share) {
    try {
      const file = new File([blob], filename, { type: "application/pdf" });
      if (nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: filename });
        return true;
      }
    } catch (err) {
      const name = (err as { name?: string } | null)?.name;
      if (name === "AbortError") return true; // user dismissed the sheet
      // otherwise fall through to a regular download
    }
  }

  anchorDownload(blob, filename);
  return false;
}

/** Best-effort auto download right after generation (mainly for desktop). */
export function downloadPdfBase64(base64: string, filename: string): void {
  anchorDownload(base64ToBlob(base64), filename);
}

export function openPdfBase64(base64: string): void {
  const blob = base64ToBlob(base64);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** True on phones/tablets where the share sheet is the better save path. */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}
