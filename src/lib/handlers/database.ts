import type { NodeHandler } from "./types";

export const handlers: Record<string, NodeHandler> = {
  "action_postgres": async ({ config, ctx }) => {
    const { Client } = await import("pg");
    const pgAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
    const pgInterp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), pgAllData);
        if (val !== undefined) return String(val);
        if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
        return "";
      });
    const client = new Client({
      host: String(config.host || "localhost"),
      port: Number(config.port || 5432),
      database: String(config.database || ""),
      user: String(config.user || ""),
      password: String(config.password || ""),
      ssl: String(config.ssl) === "true" ? { rejectUnauthorized: false } : false,
    });
    await client.connect();
    try {
      const sql = pgInterp(String(config.sql || ""));
      let params: string[] = [];
      if (config.params) {
        try { params = JSON.parse(pgInterp(String(config.params))); } catch { /* ignore */ }
      }
      const result = await client.query(sql, params);
      return { rows: result.rows, rowCount: result.rowCount, fields: result.fields.map((f) => f.name) };
    } finally {
      await client.end();
    }
  },

  "action_mysql": async ({ config, ctx }) => {
    const mysql = await import("mysql2/promise");
    const myAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
    const myInterp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), myAllData);
        if (val !== undefined) return String(val);
        if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
        return "";
      });
    const connection = await mysql.createConnection({
      host: String(config.host || "localhost"),
      port: Number(config.port || 3306),
      database: String(config.database || ""),
      user: String(config.user || ""),
      password: String(config.password || ""),
      ssl: String(config.ssl) === "true" ? {} : undefined,
    });
    try {
      const sql = myInterp(String(config.sql || ""));
      let params: (string | number | boolean | null)[] = [];
      if (config.params) {
        try { params = JSON.parse(myInterp(String(config.params))); } catch { /* ignore */ }
      }
      const [rows] = await connection.execute(sql, params);
      return { rows };
    } finally {
      await connection.end();
    }
  },

  "action_mongodb": async ({ config, ctx }) => {
    const { MongoClient } = await import("mongodb");
    const mgAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
    const mgInterp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), mgAllData);
        if (val !== undefined) return String(val);
        if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
        return "";
      });
    const uri = mgInterp(String(config.uri || "mongodb://localhost:27017"));
    const mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    try {
      const db = mongoClient.db(String(config.database || ""));
      const coll = db.collection(String(config.collection || ""));
      const action = String(config.action || "find");
      const filterStr = mgInterp(String(config.filter || "{}"));
      let query: Record<string, unknown> = {};
      try { query = JSON.parse(filterStr); } catch { /* ignore */ }

      if (action === "find") {
        const limit = Number(config.limit || 20);
        const docs = await coll.find(query).limit(limit).toArray();
        return { documents: docs, count: docs.length };
      } else if (action === "findOne") {
        const doc = await coll.findOne(query);
        return { document: doc };
      } else if (action === "insertOne") {
        const docStr = mgInterp(String(config.document || "{}"));
        let doc: Record<string, unknown> = {};
        try { doc = JSON.parse(docStr); } catch { /* ignore */ }
        const res = await coll.insertOne(doc);
        return { insertedId: res.insertedId };
      } else if (action === "updateOne") {
        const updateStr = mgInterp(String(config.update || "{}"));
        let update: Record<string, unknown> = {};
        try { update = JSON.parse(updateStr); } catch { /* ignore */ }
        const res = await coll.updateOne(query, update);
        return { matchedCount: res.matchedCount, modifiedCount: res.modifiedCount };
      } else if (action === "deleteOne") {
        const res = await coll.deleteOne(query);
        return { deletedCount: res.deletedCount };
      } else if (action === "aggregate") {
        const pipelineStr = mgInterp(String(config.pipeline || "[]"));
        let pipeline: Record<string, unknown>[] = [];
        try { pipeline = JSON.parse(pipelineStr); } catch { /* ignore */ }
        const docs = await coll.aggregate(pipeline).toArray();
        return { documents: docs, count: docs.length };
      } else {
        throw new Error(`Unknown MongoDB action: ${action}`);
      }
    } finally {
      await mongoClient.close();
    }
  },

  "action_redis": async ({ config, ctx }) => {
    const { default: Redis } = await import("ioredis");
    const rdAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
    const rdInterp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), rdAllData);
        if (val !== undefined) return String(val);
        if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
        return "";
      });
    const redis = new Redis({
      host: String(config.host || "localhost"),
      port: Number(config.port || 6379),
      password: config.password ? String(config.password) : undefined,
      db: Number(config.db || 0),
    });
    try {
      const action = String(config.action || "get");
      const key = rdInterp(String(config.key || ""));
      const value = config.value ? rdInterp(String(config.value)) : "";
      const ttl = Number(config.ttl || 0);

      if (action === "get") {
        const val = await redis.get(key);
        let parsed: unknown = val;
        if (val) { try { parsed = JSON.parse(val); } catch { /* keep as string */ } }
        return { key, value: parsed };
      } else if (action === "set") {
        if (ttl > 0) {
          await redis.set(key, value, "EX", ttl);
        } else {
          await redis.set(key, value);
        }
        return { key, set: true };
      } else if (action === "del") {
        const count = await redis.del(key);
        return { key, deleted: count };
      } else if (action === "exists") {
        const exists = await redis.exists(key);
        return { key, exists: exists > 0 };
      } else if (action === "incr") {
        const val = await redis.incr(key);
        return { key, value: val };
      } else if (action === "lpush") {
        await redis.lpush(key, value);
        return { key, pushed: true };
      } else if (action === "lrange") {
        const start = Number(config.start || 0);
        const stop = Number(config.stop || -1);
        const items = await redis.lrange(key, start, stop);
        return { key, items };
      } else if (action === "hset") {
        const field = rdInterp(String(config.field || ""));
        await redis.hset(key, field, value);
        return { key, field, set: true };
      } else if (action === "hget") {
        const field = rdInterp(String(config.field || ""));
        const val = await redis.hget(key, field);
        return { key, field, value: val };
      } else if (action === "hgetall") {
        const hash = await redis.hgetall(key);
        return { key, value: hash };
      } else {
        throw new Error(`Unknown Redis action: ${action}`);
      }
    } finally {
      redis.disconnect();
    }
  },

  "action_supabase_db": async ({ config, ctx }) => {
    const sbAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
    const sbInterp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), sbAllData);
        if (val !== undefined) return String(val);
        if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
        return "";
      });
    const supabaseUrl = sbInterp(String(config.url || "")).replace(/\/$/, "");
    const supabaseKey = sbInterp(String(config.anon_key || ""));
    const table = sbInterp(String(config.table || ""));
    const action = String(config.action || "select");

    const sbHeaders: Record<string, string> = {
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    };

    if (action === "select") {
      const columns = String(config.columns || "*");
      const filterCol = config.filter_column ? sbInterp(String(config.filter_column)) : "";
      const filterVal = config.filter_value ? sbInterp(String(config.filter_value)) : "";
      const limit = Number(config.limit || 20);
      let url = `${supabaseUrl}/rest/v1/${table}?select=${columns}&limit=${limit}`;
      if (filterCol && filterVal) url += `&${filterCol}=eq.${encodeURIComponent(filterVal)}`;
      const res = await fetch(url, { headers: sbHeaders });
      if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
      const rows = await res.json() as unknown[];
      return { rows, count: rows.length };
    } else if (action === "insert") {
      const bodyStr = sbInterp(String(config.record || "{}"));
      let body: unknown = {};
      try { body = JSON.parse(bodyStr); } catch { /* ignore */ }
      const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
        method: "POST", headers: sbHeaders,
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
      return { inserted: await res.json() };
    } else if (action === "update") {
      const filterCol = sbInterp(String(config.filter_column || "id"));
      const filterVal = sbInterp(String(config.filter_value || ""));
      const bodyStr = sbInterp(String(config.record || "{}"));
      let body: unknown = {};
      try { body = JSON.parse(bodyStr); } catch { /* ignore */ }
      const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${filterCol}=eq.${encodeURIComponent(filterVal)}`, {
        method: "PATCH", headers: sbHeaders,
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
      return { updated: await res.json() };
    } else if (action === "delete") {
      const filterCol = sbInterp(String(config.filter_column || "id"));
      const filterVal = sbInterp(String(config.filter_value || ""));
      const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${filterCol}=eq.${encodeURIComponent(filterVal)}`, {
        method: "DELETE", headers: sbHeaders,
      });
      if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
      return { deleted: true };
    } else if (action === "rpc") {
      const fnName = sbInterp(String(config.function_name || ""));
      const argsStr = sbInterp(String(config.function_args || "{}"));
      let args: unknown = {};
      try { args = JSON.parse(argsStr); } catch { /* ignore */ }
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fnName}`, {
        method: "POST", headers: sbHeaders,
        body: JSON.stringify(args),
      });
      if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
      return { result: await res.json() };
    } else {
      throw new Error(`Unknown Supabase action: ${action}`);
    }
  },

  "action_elasticsearch": async ({ config, ctx }) => {
    const { Client: EsClient } = await import("@elastic/elasticsearch");
    const esAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
    const esInterp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), esAllData);
        if (val !== undefined) return String(val);
        if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
        return "";
      });

    const esClientOpts: Record<string, unknown> = { node: esInterp(String(config.node || "http://localhost:9200")) };
    if (config.api_key) {
      esClientOpts.auth = { apiKey: String(config.api_key) };
    } else if (config.username) {
      esClientOpts.auth = { username: String(config.username), password: String(config.password || "") };
    }

    const esClient = new EsClient(esClientOpts as ConstructorParameters<typeof EsClient>[0]);
    const esIndex = esInterp(String(config.index || ""));
    const esAction = String(config.action || "search");

    try {
      if (esAction === "search") {
        const queryStr = esInterp(String(config.query || '{"match_all": {}}'));
        let query: Record<string, unknown> = {};
        try { query = JSON.parse(queryStr); } catch { /* ignore */ }
        const size = Number(config.size || 10);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await esClient.search({ index: esIndex, query: query as any, size });
        const hits = (result.hits?.hits ?? []).map((h) => ({ id: h._id, score: h._score, source: h._source }));
        return { hits, total: result.hits?.total };
      } else if (esAction === "get") {
        const id = esInterp(String(config.doc_id || ""));
        const result = await esClient.get({ index: esIndex, id });
        return { id: result._id, source: result._source, found: result.found };
      } else if (esAction === "index") {
        const docStr = esInterp(String(config.document || "{}"));
        let doc: Record<string, unknown> = {};
        try { doc = JSON.parse(docStr); } catch { /* ignore */ }
        const id = config.doc_id ? esInterp(String(config.doc_id)) : undefined;
        const result = await esClient.index({ index: esIndex, id, document: doc });
        return { id: result._id, result: result.result };
      } else if (esAction === "update") {
        const id = esInterp(String(config.doc_id || ""));
        const docStr = esInterp(String(config.document || "{}"));
        let doc: Record<string, unknown> = {};
        try { doc = JSON.parse(docStr); } catch { /* ignore */ }
        const result = await esClient.update({ index: esIndex, id, doc });
        return { id: result._id, result: result.result };
      } else if (esAction === "delete") {
        const id = esInterp(String(config.doc_id || ""));
        const result = await esClient.delete({ index: esIndex, id });
        return { id: result._id, result: result.result };
      } else if (esAction === "count") {
        const queryStr = esInterp(String(config.query || '{"match_all": {}}'));
        let query: Record<string, unknown> = {};
        try { query = JSON.parse(queryStr); } catch { /* ignore */ }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await esClient.count({ index: esIndex, query: query as any });
        return { count: result.count };
      }
    } finally {
      await esClient.close();
    }
    return undefined;
  },
};
