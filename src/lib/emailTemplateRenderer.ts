export type BlockType =
  | "header"
  | "text"
  | "button"
  | "image"
  | "divider"
  | "spacer"
  | "footer"
  | "variables";

export interface HeaderBlock {
  type: "header";
  title: string;
  subtitle: string;
  bgColor: string;
  textColor: string;
  logoUrl: string;
}

export interface TextBlock {
  type: "text";
  content: string;      // supports {{variable}} and basic HTML tags
  fontSize: number;
  color: string;
  align: "left" | "center" | "right";
  bold: boolean;
}

export interface ButtonBlock {
  type: "button";
  label: string;
  url: string;          // supports {{variable}}
  bgColor: string;
  textColor: string;
  align: "left" | "center" | "right";
  fullWidth: boolean;
}

export interface ImageBlock {
  type: "image";
  src: string;
  alt: string;
  width: number;        // percentage 0-100
  align: "left" | "center" | "right";
  linkUrl: string;
}

export interface DividerBlock {
  type: "divider";
  color: string;
  thickness: number;
  margin: number;
}

export interface SpacerBlock {
  type: "spacer";
  height: number;
}

export interface FooterBlock {
  type: "footer";
  content: string;
  color: string;
  fontSize: number;
}

export type Block =
  | HeaderBlock
  | TextBlock
  | ButtonBlock
  | ImageBlock
  | DividerBlock
  | SpacerBlock
  | FooterBlock;

export interface TemplateSettings {
  bgColor: string;
  contentBgColor: string;
  fontFamily: string;
  maxWidth: number;
  accentColor: string;
}

export const DEFAULT_SETTINGS: TemplateSettings = {
  bgColor: "#f4f4f5",
  contentBgColor: "#ffffff",
  fontFamily: "Arial, sans-serif",
  maxWidth: 600,
  accentColor: "#4f46e5",
};

// ── Block defaults ──────────────────────────────────────────────────────────

export const BLOCK_DEFAULTS: Record<string, Block> = {
  header: {
    type: "header",
    title: "Your Company Name",
    subtitle: "",
    bgColor: "#4f46e5",
    textColor: "#ffffff",
    logoUrl: "",
  },
  text: {
    type: "text",
    content: "Write your message here. Use {{variable}} to insert dynamic content.",
    fontSize: 15,
    color: "#374151",
    align: "left",
    bold: false,
  },
  button: {
    type: "button",
    label: "Click Here",
    url: "{{signing_url}}",
    bgColor: "#4f46e5",
    textColor: "#ffffff",
    align: "center",
    fullWidth: false,
  },
  image: {
    type: "image",
    src: "",
    alt: "",
    width: 100,
    align: "center",
    linkUrl: "",
  },
  divider: {
    type: "divider",
    color: "#e5e7eb",
    thickness: 1,
    margin: 24,
  },
  spacer: {
    type: "spacer",
    height: 24,
  },
  footer: {
    type: "footer",
    content: "© 2025 Your Company. All rights reserved.",
    color: "#9ca3af",
    fontSize: 12,
  },
};

// ── HTML renderer ───────────────────────────────────────────────────────────

function renderBlock(block: Block, settings: TemplateSettings): string {
  const font = settings.fontFamily;

  switch (block.type) {
    case "header": {
      const b = block as HeaderBlock;
      return `
        <table width="100%" cellpadding="0" cellspacing="0" style="background:${b.bgColor};">
          <tr><td style="padding:32px 40px;text-align:center;">
            ${b.logoUrl ? `<img src="${b.logoUrl}" alt="logo" style="max-height:48px;margin-bottom:16px;display:block;margin-left:auto;margin-right:auto;">` : ""}
            <h1 style="margin:0;font-family:${font};font-size:24px;font-weight:700;color:${b.textColor};line-height:1.3;">${b.title}</h1>
            ${b.subtitle ? `<p style="margin:8px 0 0;font-family:${font};font-size:15px;color:${b.textColor};opacity:0.85;">${b.subtitle}</p>` : ""}
          </td></tr>
        </table>`;
    }

    case "text": {
      const b = block as TextBlock;
      const align = b.align || "left";
      const weight = b.bold ? "700" : "400";
      // Convert newlines to <br> for plain text content
      const content = b.content.replace(/\n/g, "<br>");
      return `
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:12px 40px;">
            <p style="margin:0;font-family:${font};font-size:${b.fontSize}px;color:${b.color};text-align:${align};font-weight:${weight};line-height:1.6;">${content}</p>
          </td></tr>
        </table>`;
    }

    case "button": {
      const b = block as ButtonBlock;
      const tableAlign = b.align === "center" ? "center" : b.align === "right" ? "right" : "left";
      const btnWidth = b.fullWidth ? 'width="100%"' : "";
      return `
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:16px 40px;text-align:${tableAlign};">
            <table cellpadding="0" cellspacing="0" style="display:inline-table;">
              <tr><td ${btnWidth} style="background:${b.bgColor};border-radius:8px;">
                <a href="${b.url}" style="display:block;padding:14px 32px;font-family:${font};font-size:15px;font-weight:700;color:${b.textColor};text-decoration:none;text-align:center;">${b.label}</a>
              </td></tr>
            </table>
          </td></tr>
        </table>`;
    }

    case "image": {
      const b = block as ImageBlock;
      if (!b.src) return "";
      const img = `<img src="${b.src}" alt="${b.alt}" style="max-width:${b.width}%;height:auto;display:block;">`;
      const wrapped = b.linkUrl ? `<a href="${b.linkUrl}">${img}</a>` : img;
      const alignStyle = b.align === "center" ? "margin:0 auto;" : b.align === "right" ? "margin-left:auto;" : "";
      return `
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:12px 40px;text-align:${b.align};">
            <div style="${alignStyle}">${wrapped}</div>
          </td></tr>
        </table>`;
    }

    case "divider": {
      const b = block as DividerBlock;
      return `
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:${b.margin}px 40px;">
            <hr style="border:none;border-top:${b.thickness}px solid ${b.color};margin:0;">
          </td></tr>
        </table>`;
    }

    case "spacer": {
      const b = block as SpacerBlock;
      return `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:${b.height}px;font-size:1px;line-height:1px;">&nbsp;</td></tr></table>`;
    }

    case "footer": {
      const b = block as FooterBlock;
      const content = b.content.replace(/\n/g, "<br>");
      return `
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:24px 40px;text-align:center;">
            <p style="margin:0;font-family:${font};font-size:${b.fontSize}px;color:${b.color};line-height:1.5;">${content}</p>
          </td></tr>
        </table>`;
    }

    default:
      return "";
  }
}

export function renderTemplateHtml(blocks: Block[], settings: Partial<TemplateSettings>): string {
  const s: TemplateSettings = { ...DEFAULT_SETTINGS, ...settings };
  const blocksHtml = blocks.map((b) => renderBlock(b, s)).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Email</title>
</head>
<body style="margin:0;padding:0;background-color:${s.bgColor};font-family:${s.fontFamily};">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:${s.bgColor};">
  <tr><td align="center" style="padding:24px 16px;">
    <table width="${s.maxWidth}" cellpadding="0" cellspacing="0" style="max-width:${s.maxWidth}px;width:100%;background-color:${s.contentBgColor};border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
      <tr><td>
${blocksHtml}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export function renderTemplatePlain(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "header": return `${(b as HeaderBlock).title}\n${"=".repeat((b as HeaderBlock).title.length)}\n${(b as HeaderBlock).subtitle}`;
        case "text": return (b as TextBlock).content;
        case "button": return `${(b as ButtonBlock).label}: ${(b as ButtonBlock).url}`;
        case "divider": return "---";
        case "footer": return (b as FooterBlock).content;
        default: return "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
}

// ── Variable interpolation ──────────────────────────────────────────────────

export function interpolateVariables(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, key) => vars[key] ?? match);
}
