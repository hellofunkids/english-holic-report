/** Download base64-encoded PDF data as a file in the browser. */
export function downloadPdfBase64(base64: string, filename: string): void {
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Convert base64 PDF data to a blob URL (caller is responsible for revoking). */
export function pdfBase64ToBlobUrl(base64: string): string {
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}

/** Open base64-encoded PDF data in a new browser tab. */
export function openPdfBase64(base64: string): void {
  const url = pdfBase64ToBlobUrl(base64);
  window.open(url, "_blank", "noopener,noreferrer");
  // The new tab keeps the URL alive; revoke later to free memory
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Sanitize a string for use in a filename. */
export function safeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9가-힣_-]+/g, "_").slice(0, 60);
}
