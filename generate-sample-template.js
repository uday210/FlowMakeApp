#!/usr/bin/env node
"use strict";

// Run with: node generate-sample-template.js
// Outputs: sample-invoice-template.docx in the project root

const PizZip = require("pizzip");
const fs = require("fs");
const path = require("path");

// ─── Package files ────────────────────────────────────────────────────────────

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>`;

const pkgRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="word/document.xml"/>
</Relationships>`;

const wordRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"
    Target="styles.xml"/>
  <Relationship Id="rId2"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings"
    Target="settings.xml"/>
</Relationships>`;

const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="160" w:line="259" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
</w:styles>`;

const settings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:defaultTabStop w:val="720"/>
</w:settings>`;

// ─── XML helpers ──────────────────────────────────────────────────────────────

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

function p(runs, jc = "left", spacingAfter = 160) {
  return `<w:p><w:pPr><w:jc w:val="${jc}"/><w:spacing w:after="${spacingAfter}"/></w:pPr>${runs}</w:p>`;
}

function r(text, opts = {}) {
  const rpr = [
    opts.bold ? "<w:b/>" : "",
    opts.size ? `<w:sz w:val="${opts.size}"/><w:szCs w:val="${opts.size}"/>` : "",
    opts.color ? `<w:color w:val="${opts.color}"/>` : "",
    opts.italic ? "<w:i/>" : "",
  ].join("");
  return `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ""}<w:t xml:space="preserve">${text}</w:t></w:r>`;
}

function br() {
  return `<w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:t></w:t></w:r></w:p>`;
}

function divider() {
  return `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="CCCCCC"/></w:pBdr><w:spacing w:after="160"/></w:pPr><w:r><w:t></w:t></w:r></w:p>`;
}

function tc(content, opts = {}) {
  const width = opts.width || 2000;
  const jc = opts.align || "left";
  const fill = opts.fill || "auto";
  const borders = `
        <w:tcBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>
        </w:tcBorders>`;
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${borders}<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/></w:tcPr>${p(content, jc, 80)}</w:tc>`;
}

// ─── Document body ────────────────────────────────────────────────────────────

const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>

    ${p(r("{company_name}", { bold: true, size: 40, color: "2D3748" }), "center", 40)}
    ${p(r("{company_address}", { size: 20, color: "718096" }), "center", 20)}
    ${p(r("{company_email}   |   {company_phone}", { size: 20, color: "718096" }), "center", 200)}

    ${divider()}

    ${p(r("INVOICE", { bold: true, size: 52, color: "1A202C" }), "center", 20)}
    ${br()}

    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9360" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        </w:tblBorders>
        <w:tblCellMar>
          <w:top w:w="80" w:type="dxa"/>
          <w:left w:w="80" w:type="dxa"/>
          <w:bottom w:w="80" w:type="dxa"/>
          <w:right w:w="80" w:type="dxa"/>
        </w:tblCellMar>
      </w:tblPr>
      <w:tr>
        ${tc(r("Invoice #:", { bold: true, size: 20, color: "718096" }) + r("  {invoice_number}", { bold: true, size: 22 }), { width: 4680 })}
        ${tc(r("Bill To:", { bold: true, size: 20, color: "718096" }), { width: 4680 })}
      </w:tr>
      <w:tr>
        ${tc(r("Date:", { size: 20, color: "718096" }) + r("  {invoice_date | date}", {}), { width: 4680 })}
        ${tc(r("{customer_name}", { bold: true }), { width: 4680 })}
      </w:tr>
      <w:tr>
        ${tc(r("Due Date:", { size: 20, color: "718096" }) + r("  {due_date | date}", {}), { width: 4680 })}
        ${tc(r("{customer_company}", {}), { width: 4680 })}
      </w:tr>
      <w:tr>
        ${tc(r(""), { width: 4680 })}
        ${tc(r("{customer_address}", { size: 20 }), { width: 4680 })}
      </w:tr>
      <w:tr>
        ${tc(r(""), { width: 4680 })}
        ${tc(r("{customer_email}", { size: 20, color: "4A90E2" }), { width: 4680 })}
      </w:tr>
    </w:tbl>

    ${br()}
    ${divider()}

    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9360" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>
        </w:tblBorders>
        <w:tblCellMar>
          <w:top w:w="100" w:type="dxa"/>
          <w:left w:w="120" w:type="dxa"/>
          <w:bottom w:w="100" w:type="dxa"/>
          <w:right w:w="120" w:type="dxa"/>
        </w:tblCellMar>
      </w:tblPr>
      <w:tr>
        <w:trPr><w:tblHeader/></w:trPr>
        ${tc(r("DESCRIPTION", { bold: true, size: 18, color: "FFFFFF" }), { width: 5040, fill: "2D3748", align: "left" })}
        ${tc(r("QTY", { bold: true, size: 18, color: "FFFFFF" }), { width: 1200, fill: "2D3748", align: "center" })}
        ${tc(r("UNIT PRICE", { bold: true, size: 18, color: "FFFFFF" }), { width: 1560, fill: "2D3748", align: "right" })}
        ${tc(r("AMOUNT", { bold: true, size: 18, color: "FFFFFF" }), { width: 1560, fill: "2D3748", align: "right" })}
      </w:tr>
      <w:tr>
        ${tc(r("{#items}{description}"), { width: 5040 })}
        ${tc(r("{quantity}"), { width: 1200, align: "center" })}
        ${tc(r("{unit_price | currency}"), { width: 1560, align: "right" })}
        ${tc(r("{line_total | currency}{/items}"), { width: 1560, align: "right" })}
      </w:tr>
    </w:tbl>

    ${br()}

    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9360" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        ${tc(r(""), { width: 5040 })}
        ${tc(r("Subtotal", { color: "718096" }), { width: 2520, align: "right" })}
        ${tc(r("{subtotal | currency}"), { width: 1800, align: "right" })}
      </w:tr>
      <w:tr>
        ${tc(r(""), { width: 5040 })}
        ${tc(r("Tax ({tax_rate | percent})", { color: "718096" }), { width: 2520, align: "right" })}
        ${tc(r("{tax_amount | currency}"), { width: 1800, align: "right" })}
      </w:tr>
      <w:tr>
        ${tc(r(""), { width: 5040 })}
        ${tc(r("TOTAL DUE", { bold: true, size: 26 }), { width: 2520, align: "right" })}
        ${tc(r("{total | currency}", { bold: true, size: 26, color: "2D3748" }), { width: 1800, align: "right" })}
      </w:tr>
    </w:tbl>

    ${divider()}

    ${p(r("{#has_discount}", { size: 1 }))}
    ${p(
      r("DISCOUNT APPLIED: ", { bold: true, color: "276749" }) +
      r("{discount_amount | currency}", { bold: true, size: 24, color: "276749" }),
      "right",
      80
    )}
    ${p(r("{/has_discount}", { size: 1 }))}

    ${br()}
    ${p(r("Payment Instructions", { bold: true, size: 22, color: "2D3748" }))}
    ${p(r("{payment_instructions}", { color: "4A5568" }))}

    ${br()}
    ${p(r("Notes", { bold: true, size: 22, color: "2D3748" }))}
    ${p(r("{notes}", { color: "4A5568", italic: true }))}

    ${br()}
    ${divider()}
    ${p(
      r("Thank you for your business, ", { color: "718096" }) +
      r("{customer_name}", { bold: true, color: "2D3748" }) +
      r("!", { color: "718096" }),
      "center",
      0
    )}

    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

// ─── Build ZIP ────────────────────────────────────────────────────────────────
const zip = new PizZip();
zip.file("[Content_Types].xml", contentTypes);
zip.file("_rels/.rels", pkgRels);
zip.file("word/document.xml", document);
zip.file("word/styles.xml", styles);
zip.file("word/settings.xml", settings);
zip.file("word/_rels/document.xml.rels", wordRels);

const buffer = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
const outPath = path.join(process.cwd(), "sample-invoice-template.docx");
fs.writeFileSync(outPath, buffer);

console.log("Generated: sample-invoice-template.docx");
console.log("");
console.log("Merge fields in this template:");
console.log("  {company_name}        — Your company name");
console.log("  {company_address}     — Company address");
console.log("  {company_email}       — Company email");
console.log("  {company_phone}       — Company phone");
console.log("  {invoice_number}      — Invoice # (e.g. INV-0042)");
console.log("  {invoice_date | date} — Invoice date (formatted)");
console.log("  {due_date | date}     — Due date (formatted)");
console.log("  {customer_name}       — Customer full name");
console.log("  {customer_company}    — Customer company");
console.log("  {customer_address}    — Customer address");
console.log("  {customer_email}      — Customer email");
console.log("  {#items}...{/items}   — Line items array loop");
console.log("    {description}       — Item description");
console.log("    {quantity}          — Quantity");
console.log("    {unit_price | currency} — Unit price");
console.log("    {line_total | currency} — Line total");
console.log("  {subtotal | currency} — Subtotal");
console.log("  {tax_rate | percent}  — Tax rate (e.g. 0.08 -> 8%)");
console.log("  {tax_amount | currency} — Tax amount");
console.log("  {total | currency}    — Grand total");
console.log("  {has_discount}        — Conditional: show discount block if truthy");
console.log("    {discount_amount | currency} — Discount amount");
console.log("  {payment_instructions} — Payment instructions text");
console.log("  {notes}               — Notes / terms");
