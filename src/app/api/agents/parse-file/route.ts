import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// pdf-parse uses canvas APIs internally; polyfill the missing browser globals
// so it doesn't throw in the Next.js Node.js runtime
function polyfillForPdfParse() {
  const g = global as unknown as Record<string, unknown>;
  if (!g.DOMMatrix) g.DOMMatrix = class DOMMatrix { constructor() { return this; } };
  if (!g.Path2D) g.Path2D = class Path2D {};
  if (!g.ImageData) g.ImageData = class ImageData {};
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const name = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());

    let text = "";

    if (name.endsWith(".pdf")) {
      polyfillForPdfParse();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PDFParse } = require("pdf-parse") as {
        PDFParse: new (opts: { data: Buffer }) => { getText(): Promise<{ text: string }> };
      };
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      text = result.text;
    } else {
      // All other formats — decode as UTF-8 text
      text = new TextDecoder("utf-8").decode(buffer);
    }

    // Normalise whitespace
    text = text.replace(/\r\n/g, "\n").replace(/\t/g, " ").trim();

    return NextResponse.json({ text, filename: file.name, size: file.size });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to parse file";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
