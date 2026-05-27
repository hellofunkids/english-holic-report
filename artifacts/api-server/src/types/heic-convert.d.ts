declare module "heic-convert" {
  interface HeicConvertOptions {
    buffer: ArrayBufferLike | Uint8Array;
    format: "JPEG" | "PNG";
    quality?: number;
  }
  function heicConvert(options: HeicConvertOptions): Promise<ArrayBuffer>;
  export default heicConvert;
}
