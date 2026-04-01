import type { NodeHandler } from "./types";
import { createServerClient } from "../supabase";

export const handlers: Record<string, NodeHandler> = {
  "action_logger": async ({ config, ctx, interpolate }) => {
    const allData = { ...ctx.triggerData, ...ctx.nodeOutputs, variables: ctx.variables };
    const logLabel = (config.label as string) || "Logger";
    const level = (config.level as string) || "info";
    const mode = (config.mode as string) || "all_data";
    let loggedData: unknown;
    if (mode === "all_data") {
      loggedData = allData;
    } else if (mode === "message") {
      loggedData = interpolate(config.message as string || "");
    } else if (mode === "fields") {
      const paths = String(config.fields || "").split(",").map((s) => s.trim()).filter(Boolean);
      const extracted: Record<string, unknown> = {};
      for (const path of paths) {
        const val = path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), allData);
        extracted[path] = val;
      }
      loggedData = extracted;
    }
    return {
      label: logLabel,
      level,
      timestamp: new Date().toISOString(),
      ...(mode !== "checkpoint" ? { data: loggedData } : {}),
    };
  },

  "action_delay": async ({ config }) => {
    const seconds = Math.min(Number(config.seconds) || 1, 60);
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    return { waited_seconds: seconds };
  },

  "action_filter": async ({ config, ctx }) => {
    const field = config.field as string;
    const operator = config.operator as string;
    const value = config.value as string;
    if (!field) throw new Error("Field is required");

    const allData = { ...ctx.triggerData, ...ctx.nodeOutputs, variables: ctx.variables };
    const fieldValue = field.split(".").reduce<unknown>((obj, key) => {
      if (obj && typeof obj === "object") return (obj as Record<string, unknown>)[key];
      return undefined;
    }, allData);

    let passed = false;
    switch (operator) {
      case "equals":      passed = String(fieldValue) === value; break;
      case "not_equals":  passed = String(fieldValue) !== value; break;
      case "contains":    passed = String(fieldValue).includes(value); break;
      case "gt":          passed = Number(fieldValue) > Number(value); break;
      case "lt":          passed = Number(fieldValue) < Number(value); break;
      case "exists":      passed = fieldValue !== undefined && fieldValue !== null; break;
      default:            passed = false;
    }

    if (!passed) throw new Error(`Filter failed: "${field}" ${operator} "${value}" was false`);
    return { passed: true, field, fieldValue };
  },

  "action_if_else": async ({ config, ctx }) => {
    const field = config.field as string;
    const operator = config.operator as string;
    const value = config.value as string;
    if (!field) throw new Error("Field is required");

    const allData = { ...ctx.triggerData, ...ctx.nodeOutputs, variables: ctx.variables };
    const fieldValue = field.split(".").reduce<unknown>((obj, key) => {
      if (obj && typeof obj === "object") return (obj as Record<string, unknown>)[key];
      return undefined;
    }, allData);

    let matched = false;
    switch (operator) {
      case "equals":     matched = String(fieldValue) === value; break;
      case "not_equals": matched = String(fieldValue) !== value; break;
      case "contains":   matched = String(fieldValue).includes(value); break;
      case "gt":         matched = Number(fieldValue) > Number(value); break;
      case "lt":         matched = Number(fieldValue) < Number(value); break;
      case "exists":     matched = fieldValue !== undefined && fieldValue !== null; break;
    }

    return { _branch: matched ? "true" : "false", matched, field, fieldValue, value };
  },

  "action_switch": async ({ config, ctx }) => {
    const field = config.field as string;
    if (!field) throw new Error("Field is required");

    const allData = { ...ctx.triggerData, ...ctx.nodeOutputs, variables: ctx.variables };
    const fieldValue = String(field.split(".").reduce<unknown>((obj, key) => {
      if (obj && typeof obj === "object") return (obj as Record<string, unknown>)[key];
      return undefined;
    }, allData) ?? "");

    let matchedHandle = "default";
    for (const k of ["case_1", "case_2", "case_3", "case_4"] as const) {
      if (config[k] && String(config[k]) === fieldValue) {
        matchedHandle = k;
        break;
      }
    }

    return { _branch: matchedHandle, field, fieldValue };
  },

  "action_transform": async ({ config, ctx }) => {
    const template = config.template as string;
    if (!template) throw new Error("Template is required");
    const allData = { ...ctx.triggerData, ...ctx.nodeOutputs, variables: ctx.variables };
    const interpolated = template.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
      const val = path.trim().split(".").reduce<unknown>((obj, key) => {
        if (obj && typeof obj === "object") return (obj as Record<string, unknown>)[key];
        return undefined;
      }, allData);
      return val !== undefined ? String(val) : "";
    });
    try {
      return JSON.parse(interpolated);
    } catch {
      return { result: interpolated };
    }
  },

  "action_iterator": async ({ config, ctx }) => {
    const allData = { ...ctx.triggerData, ...ctx.nodeOutputs, variables: ctx.variables };
    const arrayPath = (config.array_path as string) || "";
    const maxItems = Math.min(Number(config.max_items) || 100, 1000);
    let items: unknown[] = [];
    try {
      const resolved = arrayPath.trim().split(".").reduce<unknown>((o, k) => {
        if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
        return undefined;
      }, allData);
      if (Array.isArray(resolved)) items = resolved;
      else if (typeof resolved === "string") items = JSON.parse(resolved);
      else if (typeof resolved === "object" && resolved !== null) items = Object.values(resolved as object);
    } catch { /* ignore */ }
    items = items.slice(0, maxItems);
    return { items, count: items.length, first: items[0], last: items[items.length - 1] };
  },

  "action_set_variable": async ({ config, ctx }) => {
    const allData = { ...ctx.triggerData, ...ctx.nodeOutputs, variables: ctx.variables };
    const interp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => {
          if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
          return undefined;
        }, allData);
        if (val !== undefined) return String(val);
        if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
        return "";
      });
    const name = config.name as string;
    const value = interp(config.value as string || "");
    if (!name) throw new Error("Variable name is required");
    ctx.variables[name] = value;
    return { name, value, variables: { ...ctx.variables } };
  },

  "action_get_variable": async ({ config, ctx }) => {
    const name = config.name as string;
    if (!name) throw new Error("Variable name is required");
    const value = ctx.variables[name] ?? (config.default_value as string ?? null);
    return { name, value, found: name in ctx.variables };
  },

  "action_sub_workflow": async ({ config, ctx }) => {
    const subId = config.workflow_id as string;
    if (!subId) throw new Error("Workflow ID is required");
    const allData = { ...ctx.triggerData, ...ctx.nodeOutputs, variables: ctx.variables };
    let payload: Record<string, unknown> = {};
    if (config.payload) {
      try {
        const raw = (config.payload as string).replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
          const val = path.trim().split(".").reduce<unknown>((o, k) => {
            if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
            return undefined;
          }, allData);
          if (val !== undefined) return String(val);
          if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
          return "";
        });
        payload = JSON.parse(raw);
      } catch { /* ignore */ }
    }
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/execute/${subId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _trigger: "sub_workflow", caller_workflow_id: ctx.workflowId, ...payload }),
    });
    if (!res.ok) throw new Error(`Sub-workflow returned ${res.status}`);
    const data = await res.json();
    return { triggered: true, workflow_id: subId, result: data };
  },

  "action_webhook_response": async ({ config, ctx }) => {
    const allData = { ...ctx.triggerData, ...ctx.nodeOutputs, variables: ctx.variables };
    const interp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => {
          if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
          return undefined;
        }, allData);
        if (val !== undefined) {
          if (typeof val === "object" && val !== null) return JSON.stringify(val);
          return String(val);
        }
        if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
        return "";
      });
    const status = Number(config.status) || 200;
    const contentType = (config.content_type as string) || "application/json";
    const body = interp((config.body as string) || "{}");
    // Store as special context value — the execute API route reads this to return custom responses
    ctx.nodeOutputs["__webhook_response__"] = { status, contentType, body };
    return { status, body };
  },

  "action_agent_reply": async ({ config, ctx, interpolate }) => {
    const message = interpolate((config.message as string) || "");
    // Store as a special context key — execute route surfaces this to the calling agent
    ctx.nodeOutputs["__agent_reply__"] = message;
    return { reply: message };
  },

  "action_merge": async ({ ctx }) => {
    // Collect outputs from all incoming nodes and merge them into one object
    const merged: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(ctx.nodeOutputs)) {
      if (key.startsWith("__")) continue;
      Object.assign(merged, typeof val === "object" && val !== null ? val : { [key]: val });
    }
    return { merged, node_outputs: ctx.nodeOutputs };
  },

  "action_code": async ({ config, ctx }) => {
    const allData = { ...ctx.triggerData, ...ctx.nodeOutputs, variables: ctx.variables };
    const code = (config.code as string) || "";
    if (!code.trim()) throw new Error("Code is required");
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function("input", "variables", `"use strict"; ${code}`);
      const result = await fn(allData, ctx.variables);
      return result ?? { executed: true };
    } catch (err) {
      throw new Error(`Code error: ${err instanceof Error ? err.message : String(err)}`);
    }
  },

  "action_data_store": async ({ config, ctx }) => {
    const supabase = createServerClient();
    const orgId = ctx.orgId || "unknown";
    const storeName = (config.store as string) || "default";
    const action = config.action as string;
    const allData = { ...ctx.triggerData, ...ctx.nodeOutputs, variables: ctx.variables };
    const interp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => {
          if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
          return undefined;
        }, allData);
        if (val !== undefined) return String(val);
        if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
        return "";
      });
    const key = interp(config.key as string || "");
    if (action === "set") {
      const value = interp(config.value as string || "");
      await supabase.from("workflow_data").upsert(
        { org_id: orgId, store: storeName, key, value, updated_at: new Date().toISOString() },
        { onConflict: "org_id,store,key" }
      );
      return { action: "set", key, value };
    } else if (action === "get") {
      const { data } = await supabase.from("workflow_data").select("value")
        .eq("org_id", orgId).eq("store", storeName).eq("key", key).single();
      return { action: "get", key, value: data?.value ?? null, found: !!data };
    } else if (action === "delete") {
      await supabase.from("workflow_data").delete()
        .eq("org_id", orgId).eq("store", storeName).eq("key", key);
      return { action: "delete", key };
    } else if (action === "list") {
      const { data } = await supabase.from("workflow_data").select("key,value")
        .eq("org_id", orgId).eq("store", storeName);
      return { action: "list", entries: data ?? [], count: data?.length ?? 0 };
    }
    return undefined;
  },
};
