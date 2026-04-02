import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// POST — fetch rows from an external DB connection or internal Supabase table
// Body: { connection_id?, table_name?, sql?, name, source_type: "database"|"supabase_table" }
export async function POST(req: NextRequest) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { connection_id, connection_string, table_name, sql, name, source_type, limit = 5000 } = body;

  let rows: Record<string, unknown>[] = [];

  if (source_type === "supabase_table") {
    // Query internal Supabase table
    if (!table_name) return NextResponse.json({ error: "table_name required" }, { status: 400 });
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const admin = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await admin.from(table_name).select("*").eq("org_id", ctx.orgId).limit(limit);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    rows = (data ?? []) as Record<string, unknown>[];
  } else if (source_type === "database" && (connection_id || connection_string)) {
    let config: Record<string, unknown>;
    let dbType: string;

    if (connection_string) {
      // Parse raw connection string
      const isMySQL = connection_string.startsWith("mysql://");
      dbType = isMySQL ? "mysql" : "postgres";
      const url = new URL(connection_string);
      config = {
        type: dbType,
        host: url.hostname,
        port: url.port || (isMySQL ? "3306" : "5432"),
        database: url.pathname.slice(1),
        user: url.username,
        password: url.password,
      };
    } else {
      // Fetch connection config
      const { data: conn } = await ctx.admin.from("connections").select("config").eq("id", connection_id).eq("org_id", ctx.orgId).single();
      if (!conn) return NextResponse.json({ error: "Connection not found" }, { status: 404 });
      config = conn.config as Record<string, unknown>;
      dbType = (config.type as string) ?? (config.db_type as string);
    }

    if (dbType === "postgres" || dbType === "postgresql") {
      const { Client } = await import("pg");
      const client = new Client({
        host: config.host as string,
        port: Number(config.port ?? 5432),
        database: config.database as string,
        user: config.user as string ?? config.username as string,
        password: config.password as string,
        ssl: config.ssl ? { rejectUnauthorized: false } : false,
      });
      await client.connect();
      const query = sql || `SELECT * FROM ${table_name} LIMIT ${limit}`;
      const result = await client.query(query);
      rows = result.rows;
      await client.end();
    } else if (dbType === "mysql") {
      const mysql = await import("mysql2/promise");
      const connection = await mysql.createConnection({
        host: config.host as string,
        port: Number(config.port ?? 3306),
        database: config.database as string,
        user: config.user as string ?? config.username as string,
        password: config.password as string,
      });
      const query = sql || `SELECT * FROM ${table_name} LIMIT ${limit}`;
      const [result] = await connection.execute(query);
      rows = result as Record<string, unknown>[];
      await connection.end();
    } else {
      return NextResponse.json({ error: `Unsupported DB type: ${dbType}` }, { status: 400 });
    }
  } else {
    return NextResponse.json({ error: "Invalid source_type or missing connection_id" }, { status: 400 });
  }

  if (rows.length === 0) return NextResponse.json({ error: "No rows returned" }, { status: 400 });

  const columns = Object.keys(rows[0]);

  const { data, error } = await ctx.admin
    .from("analytics_datasets")
    .insert({
      org_id: ctx.orgId,
      name: name || table_name || "DB Query",
      source_type,
      columns,
      row_count: rows.length,
      data: rows,
      parent_ids: [],
    })
    .select("id, name, source_type, columns, row_count, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
