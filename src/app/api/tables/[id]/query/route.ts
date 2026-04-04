import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Condition = {
  field: string;
  op: "=" | "!=" | ">" | "<" | ">=" | "<=" | "contains" | "not_contains" | "starts_with" | "ends_with" | "is_empty" | "is_not_empty";
  value: string;
  logic?: "AND" | "OR"; // how to combine with previous condition
};

type QueryBody = {
  columns?: string[];          // empty/absent = all
  conditions?: Condition[];
  orderBy?: string;
  orderDir?: "asc" | "desc";
  limit?: number;
};

function applyCondition(rowValue: unknown, op: Condition["op"], value: string): boolean {
  const str = String(rowValue ?? "").toLowerCase();
  const v   = value.toLowerCase();
  const num = parseFloat(String(rowValue ?? ""));
  const vNum = parseFloat(value);

  switch (op) {
    case "=":            return String(rowValue ?? "") === value || str === v;
    case "!=":           return String(rowValue ?? "") !== value && str !== v;
    case ">":            return !isNaN(num) && !isNaN(vNum) ? num > vNum : str > v;
    case "<":            return !isNaN(num) && !isNaN(vNum) ? num < vNum : str < v;
    case ">=":           return !isNaN(num) && !isNaN(vNum) ? num >= vNum : str >= v;
    case "<=":           return !isNaN(num) && !isNaN(vNum) ? num <= vNum : str <= v;
    case "contains":     return str.includes(v);
    case "not_contains": return !str.includes(v);
    case "starts_with":  return str.startsWith(v);
    case "ends_with":    return str.endsWith(v);
    case "is_empty":     return rowValue === null || rowValue === undefined || str === "";
    case "is_not_empty": return rowValue !== null && rowValue !== undefined && str !== "";
    default:             return true;
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify ownership
  const { data: tableRow } = await ctx.admin
    .from("user_tables")
    .select("id")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();
  if (!tableRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body: QueryBody = await req.json().catch(() => ({}));
  const limit = Math.min(Math.max(Number(body.limit ?? 500), 1), 5000);

  // Fetch all rows (up to 5000 — filtering + sorting done in JS)
  const { data: rows, error } = await ctx.admin
    .from("user_table_rows")
    .select("id, data, created_at")
    .eq("table_id", id)
    .limit(5000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const allRows = rows ?? [];

  // ── Apply conditions ─────────────────────────────────────────────────────────
  let result = allRows;
  const conditions = body.conditions?.filter(c => c.field && c.op) ?? [];

  if (conditions.length > 0) {
    result = allRows.filter(row => {
      let pass = applyCondition(row.data[conditions[0].field], conditions[0].op, conditions[0].value);
      for (let i = 1; i < conditions.length; i++) {
        const c = conditions[i];
        const val = applyCondition(row.data[c.field], c.op, c.value);
        pass = c.logic === "OR" ? pass || val : pass && val;
      }
      return pass;
    });
  }

  // ── Order ────────────────────────────────────────────────────────────────────
  if (body.orderBy) {
    const dir = body.orderDir === "desc" ? -1 : 1;
    result.sort((a, b) => {
      const av = a.data[body.orderBy!] ?? a[body.orderBy as keyof typeof a] ?? "";
      const bv = b.data[body.orderBy!] ?? b[body.orderBy as keyof typeof b] ?? "";
      const an = parseFloat(String(av)), bn = parseFloat(String(bv));
      if (!isNaN(an) && !isNaN(bn)) return dir * (an - bn);
      return dir * String(av).localeCompare(String(bv));
    });
  }

  // ── Limit ────────────────────────────────────────────────────────────────────
  const limited = result.slice(0, limit);

  // ── Project columns ──────────────────────────────────────────────────────────
  const cols = body.columns?.length ? body.columns : null;
  const projected = limited.map(row => {
    const data = cols ? Object.fromEntries(cols.map(c => [c, row.data[c]])) : row.data;
    return { id: row.id, ...data, created_at: row.created_at };
  });

  return NextResponse.json({
    rows: projected,
    total_matched: result.length,
    total_scanned: allRows.length,
  });
}
