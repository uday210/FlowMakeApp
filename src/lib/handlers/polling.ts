import type { NodeHandler } from "./types";
import { getGoogleAccessToken } from "./googleAuth";

const lookback = (config: Record<string, unknown>) =>
  (Number(config.poll_interval) || 15) * 2 * 60 * 1000; // 2x interval in ms

export const handlers: Record<string, NodeHandler> = {

  "trigger_gmail": async ({ config }) => {
    const token = await getGoogleAccessToken(config, "https://www.googleapis.com/auth/gmail.readonly");
    if (!token) throw new Error("Gmail access token required");
    const sinceMs = Date.now() - lookback(config);
    const after = Math.floor(sinceMs / 1000);
    const label = config.label_filter as string || "INBOX";
    const q = `in:${label} after:${after}`;
    const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=20`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const listData = await listRes.json();
    if (!listRes.ok) throw new Error(listData.error?.message || `Gmail ${listRes.status}`);
    const messages = listData.messages ?? [];
    // Fetch details for each message (up to 5 to avoid rate limits)
    const details = await Promise.all(
      messages.slice(0, 5).map(async (m: { id: string }) => {
        const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        return r.ok ? r.json() : null;
      })
    );
    return { new_items: details.filter(Boolean), count: messages.length, polled_at: new Date().toISOString() };
  },

  "trigger_outlook_email": async ({ config }) => {
    const token = config.access_token as string;
    if (!token) throw new Error("Outlook access token required");
    const since = new Date(Date.now() - lookback(config)).toISOString();
    const folder = config.folder as string || "Inbox";
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/mailFolders/${folder}/messages?$filter=receivedDateTime gt ${since}&$top=20&$orderby=receivedDateTime desc`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `Outlook ${res.status}`);
    return { new_items: data.value ?? [], count: (data.value ?? []).length, polled_at: new Date().toISOString() };
  },

  "trigger_google_sheets": async ({ config, ctx }) => {
    const spreadsheetId = config.spreadsheet_id as string;
    if (!spreadsheetId) throw new Error("Spreadsheet ID required");
    const token = await getGoogleAccessToken(config, "https://www.googleapis.com/auth/spreadsheets.readonly");
    const sheetName = config.sheet_name as string || "Sheet1";
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `Sheets ${res.status}`);
    const rows = data.values ?? [];
    const headers = rows[0] ?? [];
    const dataRows = rows.slice(1);
    const totalRows = dataRows.length;

    // Track last seen row count to detect truly new rows
    const stateKey = `sheets_last_row_${spreadsheetId}_${sheetName}`;
    const lastRowCount = Number((ctx.variables as Record<string, unknown>)[stateKey] ?? 0);
    const newRows = dataRows.slice(lastRowCount).map((row: string[]) => {
      const obj: Record<string, string> = {};
      headers.forEach((h: string, i: number) => { obj[h] = row[i] ?? ""; });
      return obj;
    });
    // Store new count for next poll via variables
    (ctx.variables as Record<string, unknown>)[stateKey] = totalRows;

    return { new_items: newRows, count: newRows.length, total_rows: totalRows, polled_at: new Date().toISOString() };
  },

  "trigger_airtable_record": async ({ config }) => {
    const token = (config.access_token || config.api_key) as string;
    const baseId = config.base_id as string;
    const tableName = config.table_name as string;
    if (!token || !baseId || !tableName) throw new Error("API key, base ID, and table name required");
    const since = new Date(Date.now() - lookback(config)).toISOString();
    const view = config.view as string;
    let url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?filterByFormula=IS_AFTER({Created},'${since}')&maxRecords=20&sort[0][field]=Created&sort[0][direction]=desc`;
    if (view) url += `&view=${encodeURIComponent(view)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `Airtable ${res.status}`);
    return { new_items: data.records ?? [], count: (data.records ?? []).length, polled_at: new Date().toISOString() };
  },

  "trigger_notion_page": async ({ config }) => {
    const token = config.api_key as string;
    const databaseId = config.database_id as string;
    if (!token || !databaseId) throw new Error("Integration token and database ID required");
    const since = new Date(Date.now() - lookback(config)).toISOString();
    const body: Record<string, unknown> = {
      filter: { timestamp: "created_time", created_time: { after: since } },
      sorts: [{ timestamp: "created_time", direction: "descending" }],
      page_size: 20,
    };
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Notion-Version": "2022-06-28" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `Notion ${res.status}`);
    return { new_items: data.results ?? [], count: (data.results ?? []).length, polled_at: new Date().toISOString() };
  },

  "trigger_google_drive": async ({ config }) => {
    const token = config.access_token as string;
    if (!token) throw new Error("Access token required");
    const since = new Date(Date.now() - lookback(config)).toISOString();
    const folderId = config.folder_id as string;
    const mimeFilter = config.mime_type_filter as string;
    let q = `createdTime > '${since}' and trashed = false`;
    if (folderId) q += ` and '${folderId}' in parents`;
    if (mimeFilter) q += ` and mimeType = '${mimeFilter}'`;
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&orderBy=createdTime desc&pageSize=20&fields=files(id,name,mimeType,createdTime,webViewLink)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `Drive ${res.status}`);
    return { new_items: data.files ?? [], count: (data.files ?? []).length, polled_at: new Date().toISOString() };
  },

  "trigger_dropbox_file": async ({ config }) => {
    const token = config.access_token as string;
    if (!token) throw new Error("Access token required");
    const path = config.path as string || "";
    const since = new Date(Date.now() - lookback(config)).toISOString();
    const res = await fetch("https://api.dropboxapi.com/2/files/list_folder", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ path: path || "", recursive: false, include_media_info: false, include_deleted: false }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_summary || `Dropbox ${res.status}`);
    const newFiles = (data.entries ?? []).filter((e: Record<string, unknown>) =>
      e[".tag"] === "file" && typeof e.client_modified === "string" && e.client_modified > since
    );
    return { new_items: newFiles, count: newFiles.length, polled_at: new Date().toISOString() };
  },

  "trigger_onedrive_file": async ({ config }) => {
    const token = config.access_token as string;
    if (!token) throw new Error("Access token required");
    const since = new Date(Date.now() - lookback(config)).toISOString();
    const folderPath = config.folder_path as string || "root";
    const driveItem = folderPath === "root" || !folderPath ? "root" : `root:${folderPath}`;
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/${driveItem}/children?$filter=createdDateTime gt ${since}&$orderby=createdDateTime desc&$top=20`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `OneDrive ${res.status}`);
    return { new_items: data.value ?? [], count: (data.value ?? []).length, polled_at: new Date().toISOString() };
  },

  "trigger_trello_card": async ({ config }) => {
    const apiKey = config.api_key as string;
    const token = config.token as string;
    const boardId = config.board_id as string;
    if (!apiKey || !token || !boardId) throw new Error("API key, token, and board ID required");
    const since = new Date(Date.now() - lookback(config)).toISOString();
    const listId = config.list_id as string;
    let url: string;
    if (listId) {
      url = `https://api.trello.com/1/lists/${listId}/cards?key=${apiKey}&token=${token}&since=${since}&fields=id,name,desc,url,dateLastActivity,due,labels`;
    } else {
      url = `https://api.trello.com/1/boards/${boardId}/cards?key=${apiKey}&token=${token}&since=${since}&fields=id,name,desc,url,dateLastActivity,due,labels`;
    }
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error((data as { message?: string }).message || `Trello ${res.status}`);
    return { new_items: data, count: (data as unknown[]).length, polled_at: new Date().toISOString() };
  },

  "trigger_monday_item": async ({ config }) => {
    const apiKey = config.api_key as string;
    const boardId = config.board_id as string;
    if (!apiKey || !boardId) throw new Error("API key and board ID required");
    const since = new Date(Date.now() - lookback(config)).toISOString();
    const query = `{ boards(ids: [${boardId}]) { items_page(limit: 20) { items { id name created_at column_values { id text } } } } }`;
    const res = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    if (data.errors) throw new Error(data.errors[0]?.message || "Monday.com error");
    const allItems = data.data?.boards?.[0]?.items_page?.items ?? [];
    const newItems = allItems.filter((item: Record<string, unknown>) =>
      typeof item.created_at === "string" && item.created_at > since
    );
    return { new_items: newItems, count: newItems.length, polled_at: new Date().toISOString() };
  },

  "trigger_mailchimp_subscriber": async ({ config }) => {
    const apiKey = config.api_key as string;
    const listId = config.list_id as string;
    if (!apiKey || !listId) throw new Error("API key and list ID required");
    const dc = apiKey.split("-").pop() ?? "us1";
    const since = new Date(Date.now() - lookback(config)).toISOString();
    const res = await fetch(
      `https://${dc}.api.mailchimp.com/3.0/lists/${listId}/members?since_last_changed=${since}&count=20&sort_field=last_changed&sort_dir=DESC`,
      { headers: { Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString("base64")}` } }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || `Mailchimp ${res.status}`);
    return { new_items: data.members ?? [], count: (data.members ?? []).length, polled_at: new Date().toISOString() };
  },

  "trigger_activecampaign": async ({ config }) => {
    const apiUrl = (config.api_url as string)?.replace(/\/$/, "");
    const apiKey = config.api_key as string;
    if (!apiUrl || !apiKey) throw new Error("API URL and key required");
    const since = new Date(Date.now() - lookback(config)).toISOString().replace("T", " ").replace(".000Z", "");
    const res = await fetch(
      `${apiUrl}/api/3/contacts?filters[created_after]=${encodeURIComponent(since)}&limit=20&orders[cdate]=DESC`,
      { headers: { "Api-Token": apiKey } }
    );
    const data = await res.json();
    if (!res.ok) throw new Error((data as { message?: string }).message || `ActiveCampaign ${res.status}`);
    return { new_items: data.contacts ?? [], count: (data.contacts ?? []).length, polled_at: new Date().toISOString() };
  },

  "trigger_postgres_row": async ({ config }) => {
    const { Client } = await import("pg");
    const host = config.host as string || "localhost";
    const port = Number(config.port) || 5432;
    const database = config.database as string;
    const user = config.user as string;
    const password = config.password as string;
    const ssl = config.ssl === "true";
    const table = config.table as string;
    const idColumn = (config.id_column as string) || "id";
    const whereClause = config.where_clause as string || "";
    if (!database || !table) throw new Error("Database and table name required");
    const mins = (Number(config.poll_interval) || 15) * 2;
    const client = new Client({ host, port, database, user, password, ssl: ssl ? { rejectUnauthorized: false } : false });
    await client.connect();
    try {
      const extra = whereClause ? ` AND (${whereClause})` : "";
      const q = `SELECT * FROM ${table} WHERE ${idColumn} > (NOW() - INTERVAL '${mins} minutes')${extra} ORDER BY ${idColumn} DESC LIMIT 50`;
      const result = await client.query(q);
      return { new_items: result.rows, count: result.rowCount ?? result.rows.length, polled_at: new Date().toISOString() };
    } finally {
      await client.end();
    }
  },

  "trigger_mysql_row": async ({ config }) => {
    const mysql = await import("mysql2/promise");
    const host = config.host as string || "localhost";
    const port = Number(config.port) || 3306;
    const database = config.database as string;
    const user = config.user as string;
    const password = config.password as string;
    const table = config.table as string;
    const idColumn = (config.id_column as string) || "id";
    const whereClause = config.where_clause as string || "";
    if (!database || !table) throw new Error("Database and table name required");
    const mins = (Number(config.poll_interval) || 15) * 2;
    const conn = await mysql.createConnection({ host, port, database, user, password });
    try {
      const extra = whereClause ? ` AND (${whereClause})` : "";
      const q = `SELECT * FROM \`${table}\` WHERE \`${idColumn}\` > (NOW() - INTERVAL ${mins} MINUTE)${extra} ORDER BY \`${idColumn}\` DESC LIMIT 50`;
      const [rows] = await conn.query(q);
      const items = rows as Record<string, unknown>[];
      return { new_items: items, count: items.length, polled_at: new Date().toISOString() };
    } finally {
      await conn.end();
    }
  },

  "trigger_mongodb_document": async ({ config }) => {
    const { MongoClient, ObjectId } = await import("mongodb");
    const uri = config.uri as string;
    const database = config.database as string;
    const collection = config.collection as string;
    const filterJson = config.filter_json as string || "{}";
    if (!uri || !database || !collection) throw new Error("URI, database, and collection required");
    const mins = (Number(config.poll_interval) || 15) * 2;
    const since = new Date(Date.now() - mins * 60 * 1000);
    const client = new MongoClient(uri);
    await client.connect();
    try {
      let extraFilter: Record<string, unknown> = {};
      try { extraFilter = JSON.parse(filterJson); } catch { /* ignore invalid JSON */ }
      // Use _id ObjectId timestamp for efficient polling on default collections
      const minId = ObjectId.createFromTime(Math.floor(since.getTime() / 1000));
      const filter = { _id: { $gte: minId }, ...extraFilter };
      const docs = await client.db(database).collection(collection).find(filter).sort({ _id: -1 }).limit(50).toArray();
      return { new_items: docs, count: docs.length, polled_at: new Date().toISOString() };
    } finally {
      await client.close();
    }
  },
};
