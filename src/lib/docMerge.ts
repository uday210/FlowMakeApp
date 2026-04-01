/**
 * docMerge.ts — DOCX template merge engine
 *
 * Syntax in Word templates:
 *   {field_name}                    — simple field
 *   {object.nested.field}           — dot-notation path
 *   {amount | currency}             — with formatter
 *   {amount | currency:EUR}         — formatter with option
 *   {#items}...{/items}             — loop over array
 *   {#flag}...{/flag}               — show if truthy
 *   {^flag}...{/flag}               — show if falsy / empty
 *   {.}                             — current item in simple array loop
 *   {%logo}                         — image field (value = base64 data URI or HTTPS URL)
 */

import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ImageModule = require("docxtemplater-image-module-free") as new (opts: ImageModuleOpts) => object;

interface ImageModuleOpts {
  centered?: boolean;
  getImage(tagValue: unknown): Buffer | null | Promise<Buffer | null>;
  getSize(img: Buffer, tagValue: unknown, tagName: string): [number, number];
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface DetectedField {
  key: string;        // raw tag text, e.g. "amount | currency:USD"
  path: string;       // resolved path, e.g. "amount"
  formatter: string;  // e.g. "currency:USD" or ""
  kind: "field" | "loop_start" | "loop_end" | "condition_if" | "condition_else" | "image";
}

export interface MergeResult {
  buffer: Buffer;
  warnings: string[];
}

// ── Formatter registry ────────────────────────────────────────────────────────

function applyFormatter(value: unknown, formatterExpr: string): string {
  const [name, option] = formatterExpr.trim().split(":").map(s => s.trim());

  // Resolve null/undefined early for default formatter
  if (name === "default") {
    return value == null || value === "" ? (option ?? "N/A") : String(value);
  }

  if (value == null || value === "") return "";

  const num = Number(value);
  const isNum = !isNaN(num);

  switch (name) {
    // ── Number & money ───────────────────────────────────────────────────────
    case "currency": {
      const currency = option?.toUpperCase() ?? "USD";
      if (!isNum) return String(value);
      return new Intl.NumberFormat("en-US", {
        style: "currency", currency, minimumFractionDigits: 2,
      }).format(num);
    }
    case "number": {
      if (!isNum) return String(value);
      const decimals = option ? parseInt(option, 10) : 0;
      return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(num);
    }
    case "percent": {
      if (!isNum) return String(value);
      const decimals = option ? parseInt(option, 10) : 1;
      return new Intl.NumberFormat("en-US", {
        style: "percent",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(num / 100);
    }

    // ── Date & time ──────────────────────────────────────────────────────────
    case "date": {
      const d = new Date(value as string);
      if (isNaN(d.getTime())) return String(value);
      if (option) return formatDatePattern(d, option);
      return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    }
    case "datetime": {
      const d = new Date(value as string);
      if (isNaN(d.getTime())) return String(value);
      if (option) return formatDatePattern(d, option);
      return d.toLocaleString("en-US", {
        year: "numeric", month: "long", day: "numeric",
        hour: "numeric", minute: "2-digit", hour12: true,
      });
    }
    case "time": {
      const d = new Date(value as string);
      if (isNaN(d.getTime())) return String(value);
      return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    }

    // ── Text ─────────────────────────────────────────────────────────────────
    case "uppercase":   return String(value).toUpperCase();
    case "lowercase":   return String(value).toLowerCase();
    case "capitalize":  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
    case "titlecase":   return String(value).replace(/\b\w/g, c => c.toUpperCase());
    case "trim":        return String(value).trim();
    case "truncate": {
      const len = option ? parseInt(option, 10) : 100;
      const s = String(value);
      return s.length > len ? s.slice(0, len) + "…" : s;
    }

    // ── Boolean ──────────────────────────────────────────────────────────────
    case "yesno":    return value ? "Yes" : "No";
    case "truefalse": return value ? "True" : "False";
    case "checkmark": return value ? "✓" : "✗";
    case "onoff":    return value ? "On" : "Off";

    // ── Misc ─────────────────────────────────────────────────────────────────
    case "phone": {
      const digits = String(value).replace(/\D/g, "");
      if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
      if (digits.length === 11 && digits[0] === "1") return `+1 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
      return String(value);
    }
    case "json": return JSON.stringify(value, null, 2);

    default: return String(value);
  }
}

/** Supports patterns: MM DD YYYY HH mm ss A */
function formatDatePattern(d: Date, pattern: string): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const year = d.getFullYear();
  const hours24 = d.getHours();
  const hours12 = hours24 % 12 || 12;
  const minutes = d.getMinutes();
  const seconds = d.getSeconds();
  const ampm = hours24 < 12 ? "AM" : "PM";
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const monthShort = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  return pattern
    .replace("MMMM", monthNames[d.getMonth()])
    .replace("MMM", monthShort[d.getMonth()])
    .replace("MM", pad(month))
    .replace("M", String(month))
    .replace("DD", pad(day))
    .replace("D", String(day))
    .replace("YYYY", String(year))
    .replace("YY", String(year).slice(-2))
    .replace("HH", pad(hours24))
    .replace("hh", pad(hours12))
    .replace("h", String(hours12))
    .replace("mm", pad(minutes))
    .replace("ss", pad(seconds))
    .replace("A", ampm)
    .replace("a", ampm.toLowerCase());
}

// ── Nested value resolver ──────────────────────────────────────────────────────

function getNestedValue(obj: unknown, path: string): unknown {
  if (path === "." || path === "") return obj;
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

// ── Custom docxtemplater parser ───────────────────────────────────────────────

function buildParser(data: Record<string, unknown>) {
  return (tag: string) => {
    const parts = tag.split("|").map(s => s.trim());
    const fieldPath = parts[0];
    const formatters = parts.slice(1);

    return {
      get(scope: unknown, context: { scopeList?: unknown[] }) {
        // Try current scope first, then walk up the scope chain
        let value = getNestedValue(scope, fieldPath);

        if (value === undefined && context?.scopeList) {
          for (let i = (context.scopeList.length ?? 0) - 1; i >= 0; i--) {
            value = getNestedValue(context.scopeList[i], fieldPath);
            if (value !== undefined) break;
          }
        }

        // Fall back to top-level data
        if (value === undefined) {
          value = getNestedValue(data, fieldPath);
        }

        // Apply formatters left-to-right
        let result: unknown = value;
        for (const fmt of formatters) {
          result = applyFormatter(result, fmt);
        }

        // Return empty string for nullish (prevents docxtemplater errors)
        if (result == null) return "";
        return result;
      },
    };
  };
}

// ── Image helpers ─────────────────────────────────────────────────────────────

/** Detect image dimensions from buffer header (PNG exact, others default) */
function getImageSize(buffer: Buffer): [number, number] {
  try {
    // PNG: magic bytes 89 50 4E 47, width at offset 16, height at 20
    if (buffer.length > 24 &&
        buffer[0] === 0x89 && buffer[1] === 0x50 &&
        buffer[2] === 0x4E && buffer[3] === 0x47) {
      return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
    }
  } catch { /* fallback */ }
  return [300, 200]; // JPEG / GIF / WEBP default
}

/** Resolve an image field value to a Buffer (base64 data URI or HTTPS URL) */
async function resolveImage(tagValue: unknown): Promise<Buffer | null> {
  if (Buffer.isBuffer(tagValue)) return tagValue;
  if (typeof tagValue !== "string" || !tagValue) return null;

  // data URI: data:image/png;base64,iVBORw0K...
  if (tagValue.startsWith("data:image/")) {
    const b64 = tagValue.split(",")[1];
    return b64 ? Buffer.from(b64, "base64") : null;
  }

  // HTTPS URL: fetch and return buffer
  if (/^https?:\/\//i.test(tagValue)) {
    try {
      const res = await fetch(tagValue, { signal: AbortSignal.timeout(8000) });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    } catch { /* unreachable URL */ }
  }

  return null;
}

// ── Field detection ───────────────────────────────────────────────────────────

/** Extracts all {tag} patterns from DOCX XML */
export function detectFields(docxBuffer: Buffer): DetectedField[] {
  const zip = new PizZip(docxBuffer);
  const xmlParts = ["word/document.xml", "word/header1.xml", "word/footer1.xml"];
  const tagRegex = /\{([^{}]+)\}/g;
  const seen = new Set<string>();
  const fields: DetectedField[] = [];

  for (const part of xmlParts) {
    const file = zip.file(part);
    if (!file) continue;
    const xml = file.asText();
    // Strip XML tags to get the raw text content
    const text = xml.replace(/<[^>]+>/g, "");
    let m: RegExpExecArray | null;
    while ((m = tagRegex.exec(text)) !== null) {
      const raw = m[1].trim();
      if (seen.has(raw)) continue;
      seen.add(raw);

      const isLoopStart = raw.startsWith("#");
      const isLoopEnd = raw.startsWith("/");
      const isCondElse = raw.startsWith("^");
      const isImage = raw.startsWith("%");

      if (isImage) {
        fields.push({ key: raw, path: raw.slice(1), formatter: "", kind: "image" });
      } else if (isLoopStart) {
        fields.push({ key: raw, path: raw.slice(1), formatter: "", kind: "loop_start" });
      } else if (isLoopEnd) {
        fields.push({ key: raw, path: raw.slice(1), formatter: "", kind: "loop_end" });
      } else if (isCondElse) {
        fields.push({ key: raw, path: raw.slice(1), formatter: "", kind: "condition_else" });
      } else {
        const parts = raw.split("|").map(s => s.trim());
        fields.push({
          key: raw,
          path: parts[0],
          formatter: parts.slice(1).join(" | "),
          kind: "field",
        });
      }
    }
  }

  return fields;
}

// ── Main merge function ───────────────────────────────────────────────────────

export async function mergeDocx(
  templateBuffer: Buffer,
  data: Record<string, unknown>
): Promise<MergeResult> {
  const zip = new PizZip(templateBuffer);
  const warnings: string[] = [];

  const imageModule = new ImageModule({
    centered: false,
    async getImage(tagValue: unknown) {
      const buf = await resolveImage(tagValue);
      if (!buf) warnings.push(`Image field could not be resolved: ${String(tagValue).slice(0, 60)}`);
      return buf;
    },
    getSize(img: Buffer) {
      return getImageSize(img);
    },
  });

  const doc = new Docxtemplater(zip, {
    modules: [imageModule],
    paragraphLoop: true,
    linebreaks: true,
    parser: buildParser(data),
    errorLogging: false,
  });

  doc.render(data);

  const buffer = Buffer.from(
    doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" })
  );

  return { buffer, warnings };
}

// ── Re-export types for API routes ───────────────────────────────────────────

export type { MergeResult as DocMergeResult };
