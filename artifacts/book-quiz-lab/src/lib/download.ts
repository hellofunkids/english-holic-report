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

/** Sanitize a string for use in a filename. */
export function safeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9가-힣_-]+/g, "_").slice(0, 60);
}
