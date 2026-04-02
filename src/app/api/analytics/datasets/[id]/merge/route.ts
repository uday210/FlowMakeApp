import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST — merge two datasets on a key
// Body: { right_id, left_key, right_key, join_type: "inner"|"left"|"right"|"outer", name }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: leftId } = await params;
  const { right_id, left_key, right_key, join_type = "inner", name } = await req.json();

  if (!right_id || !left_key || !right_key) {
    return NextResponse.json({ error: "right_id, left_key, right_key required" }, { status: 400 });
  }

  // Fetch both datasets
  const [leftRes, rightRes] = await Promise.all([
    ctx.admin.from("analytics_datasets").select("name, columns, data").eq("id", leftId).eq("org_id", ctx.orgId).single(),
    ctx.admin.from("analytics_datasets").select("name, columns, data").eq("id", right_id).eq("org_id", ctx.orgId).single(),
  ]);

  if (!leftRes.data || !rightRes.data) return NextResponse.json({ error: "Dataset not found" }, { status: 404 });

  const leftRows = leftRes.data.data as Record<string, unknown>[];
  const rightRows = rightRes.data.data as Record<string, unknown>[];

  // Build lookup map for right side
  const rightMap = new Map<unknown, Record<string, unknown>[]>();
  for (const row of rightRows) {
    const key = row[right_key];
    if (!rightMap.has(key)) rightMap.set(key, []);
    rightMap.get(key)!.push(row);
  }

  // Prefix right columns that conflict with left (excluding the join key)
  const leftCols = leftRes.data.columns as string[];
  const rightCols = (rightRes.data.columns as string[]).filter(c => c !== right_key);
  const conflicting = new Set(rightCols.filter(c => leftCols.includes(c)));

  const prefixRight = (row: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (k === right_key) continue;
      out[conflicting.has(k) ? `${rightRes.data.name}_${k}` : k] = v;
    }
    return out;
  };

  const mergedRows: Record<string, unknown>[] = [];

  if (join_type === "inner" || join_type === "left") {
    for (const leftRow of leftRows) {
      const matches = rightMap.get(leftRow[left_key]) ?? [];
      if (matches.length > 0) {
        for (const match of matches) mergedRows.push({ ...leftRow, ...prefixRight(match) });
      } else if (join_type === "left") {
        mergedRows.push({ ...leftRow });
      }
    }
  }

  if (join_type === "right") {
    const leftMap = new Map<unknown, Record<string, unknown>[]>();
    for (const row of leftRows) {
      const key = row[left_key];
      if (!leftMap.has(key)) leftMap.set(key, []);
      leftMap.get(key)!.push(row);
    }
    for (const rightRow of rightRows) {
      const matches = leftMap.get(rightRow[right_key]) ?? [];
      if (matches.length > 0) {
        for (const match of matches) mergedRows.push({ ...match, ...prefixRight(rightRow) });
      } else {
        mergedRows.push({ ...prefixRight(rightRow) });
      }
    }
  }

  if (join_type === "outer") {
    // Left side
    const matchedRightKeys = new Set<unknown>();
    for (const leftRow of leftRows) {
      const matches = rightMap.get(leftRow[left_key]) ?? [];
      if (matches.length > 0) {
        for (const match of matches) {
          mergedRows.push({ ...leftRow, ...prefixRight(match) });
          matchedRightKeys.add(match[right_key]);
        }
      } else {
        mergedRows.push({ ...leftRow });
      }
    }
    // Right-only rows
    for (const rightRow of rightRows) {
      if (!matchedRightKeys.has(rightRow[right_key])) {
        mergedRows.push({ ...prefixRight(rightRow) });
      }
    }
  }

  // Build merged column list
  const mergedCols = [...leftCols, ...rightCols.map(c => conflicting.has(c) ? `${rightRes.data.name}_${c}` : c)];

  const mergedName = name || `${leftRes.data.name} ⋈ ${rightRes.data.name}`;

  const { data, error } = await ctx.admin
    .from("analytics_datasets")
    .insert({
      org_id: ctx.orgId,
      name: mergedName,
      source_type: "merge",
      columns: mergedCols,
      row_count: mergedRows.length,
      data: mergedRows,
      parent_ids: [leftId, right_id],
    })
    .select("id, name, source_type, columns, row_count, created_at, parent_ids")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
