import type { NodeHandler } from "./types";

export const handlers: Record<string, NodeHandler> = {
  "action_gitlab": async ({ config, interpolate }) => {
    const token = config.api_token as string;
    const baseUrl = (config.base_url as string || "https://gitlab.com").replace(/\/$/, "");
    const projectId = encodeURIComponent(config.project_id as string || "");
    const action = (config.action as string) || "create_issue";
    if (!token || !projectId) throw new Error("GitLab token and project ID are required");
    const hdrs = { "PRIVATE-TOKEN": token, "Content-Type": "application/json" };
    const api = `${baseUrl}/api/v4/projects/${projectId}`;
    if (action === "create_issue") {
      const body: Record<string, unknown> = { title: interpolate(config.title as string || "") };
      if (config.description) body.description = interpolate(config.description as string);
      if (config.labels) body.labels = config.labels;
      const res = await fetch(`${api}/issues`, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `GitLab ${res.status}`);
      return data;
    } else if (action === "update_issue") {
      const body: Record<string, unknown> = {};
      if (config.title) body.title = interpolate(config.title as string);
      if (config.description) body.description = interpolate(config.description as string);
      const res = await fetch(`${api}/issues/${config.iid}`, { method: "PUT", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `GitLab ${res.status}`);
      return data;
    } else if (action === "create_mr") {
      const body = { title: interpolate(config.title as string || ""), source_branch: config.source_branch, target_branch: config.target_branch || "main", description: interpolate(config.description as string || "") };
      const res = await fetch(`${api}/merge_requests`, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `GitLab ${res.status}`);
      return data;
    } else if (action === "list_issues") {
      const res = await fetch(`${api}/issues?state=opened`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `GitLab ${res.status}`);
      return data;
    }
    return undefined;
  },

  "action_sentry": async ({ config }) => {
    const token = config.auth_token as string;
    const org = config.org_slug as string;
    const action = (config.action as string) || "list_issues";
    if (!token || !org) throw new Error("Sentry auth token and org slug are required");
    const hdrs = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const base = "https://sentry.io/api/0";
    if (action === "list_issues") {
      const url = config.project_slug ? `${base}/projects/${org}/${config.project_slug}/issues/` : `${base}/organizations/${org}/issues/`;
      const res = await fetch(url, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Sentry ${res.status}`);
      return data;
    } else if (action === "get_issue") {
      const res = await fetch(`${base}/issues/${config.issue_id}/`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Sentry ${res.status}`);
      return data;
    } else if (action === "update_issue") {
      const body = { status: config.status as string };
      const res = await fetch(`${base}/issues/${config.issue_id}/`, { method: "PUT", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Sentry ${res.status}`);
      return data;
    }
    return undefined;
  },

  "action_datadog": async ({ config, interpolate }) => {
    const apiKey = config.api_key as string;
    const action = (config.action as string) || "submit_metric";
    if (!apiKey) throw new Error("Datadog API key is required");
    const hdrs = { "DD-API-KEY": apiKey, "Content-Type": "application/json" };
    if (action === "submit_metric") {
      const now = Math.floor(Date.now() / 1000);
      let tags: string[] = [];
      try { tags = JSON.parse(config.tags as string || "[]"); } catch { /* ignore */ }
      const body = { series: [{ metric: config.metric_name as string, type: config.metric_type as string || "gauge", points: [[now, parseFloat(config.metric_value as string || "0")]], tags }] };
      const res = await fetch("https://api.datadoghq.com/api/v2/series", { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.errors?.[0] || `Datadog ${res.status}`); }
      return { submitted: true, metric: config.metric_name };
    } else if (action === "create_event") {
      const body = { title: interpolate(config.event_title as string || ""), text: interpolate(config.event_text as string || "") };
      const res = await fetch("https://api.datadoghq.com/api/v1/events", { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.errors?.[0] || `Datadog ${res.status}`);
      return data.event;
    }
    return undefined;
  },

  "action_pagerduty": async ({ config, interpolate }) => {
    const apiKey = config.api_key as string;
    const action = (config.action as string) || "create_incident";
    if (!apiKey) throw new Error("PagerDuty API key is required");
    const hdrs = { Authorization: `Token token=${apiKey}`, "Content-Type": "application/json", Accept: "application/vnd.pagerduty+json;version=2", From: "automation@flowmake.app" };
    if (action === "trigger_alert") {
      const body = { routing_key: config.routing_key as string, event_action: "trigger", payload: { summary: interpolate(config.title as string || "Alert"), source: "FlowMake", severity: config.severity as string || "error", custom_details: { details: interpolate(config.body as string || "") } } };
      const res = await fetch("https://events.pagerduty.com/v2/enqueue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `PagerDuty ${res.status}`);
      return data;
    } else if (action === "create_incident") {
      const body = { incident: { type: "incident", title: interpolate(config.title as string || "Incident"), service: { id: config.service_id as string, type: "service_reference" } } };
      const res = await fetch("https://api.pagerduty.com/incidents", { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `PagerDuty ${res.status}`);
      return data.incident;
    } else if (action === "resolve_incident") {
      const body = { incident: { type: "incident", status: "resolved" } };
      const res = await fetch(`https://api.pagerduty.com/incidents/${config.incident_id}`, { method: "PUT", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `PagerDuty ${res.status}`);
      return data.incident;
    }
    return undefined;
  },

  "action_vercel": async ({ config }) => {
    const token = config.access_token as string;
    const action = (config.action as string) || "list_deployments";
    if (!token) throw new Error("Vercel access token is required");
    const teamQuery = config.team_id ? `?teamId=${config.team_id}` : "";
    const hdrs = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    if (action === "list_deployments") {
      const url = config.project_id ? `https://api.vercel.com/v6/deployments?projectId=${config.project_id}${config.team_id ? `&teamId=${config.team_id}` : ""}` : `https://api.vercel.com/v6/deployments${teamQuery}`;
      const res = await fetch(url, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Vercel ${res.status}`);
      return data.deployments;
    } else if (action === "get_deployment") {
      const res = await fetch(`https://api.vercel.com/v13/deployments/${config.deployment_id}${teamQuery}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Vercel ${res.status}`);
      return data;
    } else if (action === "list_projects") {
      const res = await fetch(`https://api.vercel.com/v9/projects${teamQuery}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Vercel ${res.status}`);
      return data.projects;
    }
    return undefined;
  },

  "action_circleci": async ({ config }) => {
    const token = config.api_token as string;
    const action = (config.action as string) || "trigger_pipeline";
    if (!token) throw new Error("CircleCI API token is required");
    const hdrs = { "Circle-Token": token, "Content-Type": "application/json" };
    if (action === "trigger_pipeline") {
      const body: Record<string, unknown> = {};
      if (config.branch) body.branch = config.branch;
      let params: Record<string, unknown> = {};
      try { params = JSON.parse(config.parameters as string || "{}"); } catch { /* ignore */ }
      if (Object.keys(params).length) body.parameters = params;
      const res = await fetch(`https://circleci.com/api/v2/project/${config.project_slug}/pipeline`, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `CircleCI ${res.status}`);
      return data;
    } else if (action === "get_pipeline") {
      const res = await fetch(`https://circleci.com/api/v2/pipeline/${config.pipeline_id}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `CircleCI ${res.status}`);
      return data;
    } else if (action === "get_workflow") {
      const res = await fetch(`https://circleci.com/api/v2/workflow/${config.workflow_id}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `CircleCI ${res.status}`);
      return data;
    }
    return undefined;
  },

  "action_bitbucket": async ({ config, interpolate }) => {
    const username = config.username as string;
    const appPassword = config.app_password as string;
    const workspace = config.workspace as string;
    const repoSlug = config.repo_slug as string;
    const action = (config.action as string) || "create_issue";
    if (!username || !appPassword || !workspace || !repoSlug) throw new Error("Bitbucket credentials, workspace, and repo are required");
    const auth = Buffer.from(`${username}:${appPassword}`).toString("base64");
    const hdrs = { Authorization: `Basic ${auth}`, "Content-Type": "application/json" };
    const base = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}`;
    if (action === "create_issue") {
      const body: Record<string, unknown> = { title: interpolate(config.title as string || "") };
      if (config.content) body.content = { raw: interpolate(config.content as string) };
      if (config.priority) body.priority = config.priority;
      const res = await fetch(`${base}/issues`, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Bitbucket ${res.status}`);
      return data;
    } else if (action === "get_issue") {
      const res = await fetch(`${base}/issues/${config.issue_id}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Bitbucket ${res.status}`);
      return data;
    } else if (action === "list_commits") {
      const res = await fetch(`${base}/commits`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Bitbucket ${res.status}`);
      return data.values;
    }
    return undefined;
  },

  "action_ssh": async ({ config, ctx }) => {
    const sshAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
    const sshInterp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), sshAllData);
        if (val !== undefined) return String(val);
        if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
        return "";
      });
    const { Client: SshClient } = await import("ssh2");
    const host = sshInterp(String(config.host || ""));
    const command = sshInterp(String(config.command || ""));
    const connOpts: Record<string, unknown> = {
      host,
      port: Number(config.port || 22),
      username: String(config.username || "root"),
      readyTimeout: Number(config.timeout || 30000),
    };
    if (config.private_key) {
      connOpts.privateKey = String(config.private_key);
    } else {
      connOpts.password = String(config.password || "");
    }

    return await new Promise((resolve, reject) => {
      const conn = new SshClient();
      conn.on("ready", () => {
        conn.exec(command, (err, stream) => {
          if (err) { conn.end(); return reject(err); }
          let stdout = "";
          let stderr = "";
          stream.on("close", (code: number) => {
            conn.end();
            resolve({ stdout, stderr, exit_code: code, command });
          });
          stream.on("data", (d: Buffer) => { stdout += d.toString(); });
          stream.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
        });
      });
      conn.on("error", (err) => reject(err));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conn.connect(connOpts as any);
    });
  },

  "action_ftp": async ({ config, ctx }) => {
    const ftpAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
    const ftpInterp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), ftpAllData);
        if (val !== undefined) return String(val);
        if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
        return "";
      });
    const ftp = await import("basic-ftp");
    const client = new ftp.Client();
    try {
      await client.access({
        host: ftpInterp(String(config.host || "")),
        port: Number(config.port || 21),
        user: String(config.username || "anonymous"),
        password: String(config.password || ""),
        secure: String(config.secure) === "true",
      });
      const action = String(config.action || "list");
      const remotePath = ftpInterp(String(config.remote_path || "/"));

      if (action === "list") {
        const list = await client.list(remotePath);
        return { files: list.map((f) => ({ name: f.name, size: f.size, type: f.type, date: f.date })) };
      } else if (action === "upload") {
        const content = ftpInterp(String(config.local_content || ""));
        const filename = String(config.local_filename || "upload.txt");
        const buf = Buffer.from(content.replace(/^data:[^;]+;base64,/, ""), content.startsWith("data:") ? "base64" : "utf8");
        const { Readable } = await import("stream");
        await client.uploadFrom(Readable.from(buf), remotePath.endsWith("/") ? remotePath + filename : remotePath);
        return { uploaded: true, path: remotePath };
      } else if (action === "download") {
        const { PassThrough } = await import("stream");
        const pt = new PassThrough();
        const chunks: Buffer[] = [];
        pt.on("data", (c: Buffer) => chunks.push(c));
        await client.downloadTo(pt, remotePath);
        const buf = Buffer.concat(chunks);
        return { content: buf.toString("utf8"), base64: buf.toString("base64"), size_bytes: buf.length };
      } else if (action === "delete") {
        await client.remove(remotePath);
        return { deleted: true, path: remotePath };
      } else if (action === "rename") {
        await client.rename(remotePath, ftpInterp(String(config.dest_path || "")));
        return { renamed: true };
      } else if (action === "mkdir") {
        await client.ensureDir(remotePath);
        return { created: true, path: remotePath };
      }
    } finally {
      client.close();
    }
    return undefined;
  },

  "action_sftp": async ({ config, ctx }) => {
    const sfAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
    const sfInterp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), sfAllData);
        if (val !== undefined) return String(val);
        if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
        return "";
      });
    const SftpClient = (await import("ssh2-sftp-client")).default;
    const sftp = new SftpClient();
    try {
      const connOpts: Record<string, unknown> = {
        host: sfInterp(String(config.host || "")),
        port: Number(config.port || 22),
        username: String(config.username || "root"),
      };
      if (config.private_key) connOpts.privateKey = String(config.private_key);
      else connOpts.password = String(config.password || "");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await sftp.connect(connOpts as any);
      const action = String(config.action || "list");
      const remotePath = sfInterp(String(config.remote_path || "/"));

      if (action === "list") {
        const list = await sftp.list(remotePath);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return { files: list.map((f: any) => ({ name: f.name, size: f.size, type: f.type, modifyTime: f.modifyTime })) };
      } else if (action === "upload") {
        const content = sfInterp(String(config.file_content || ""));
        const isBase64 = content.startsWith("data:") || !content.includes("\n") && content.length % 4 === 0;
        const buf = isBase64 ? Buffer.from(content.replace(/^data:[^;]+;base64,/, ""), "base64") : Buffer.from(content, "utf8");
        const filename = sfInterp(String(config.filename || "upload.txt"));
        const destPath = remotePath.endsWith("/") ? remotePath + filename : remotePath;
        const { Readable } = await import("stream");
        await sftp.put(Readable.from(buf), destPath);
        return { uploaded: true, path: destPath };
      } else if (action === "download") {
        const buf = await sftp.get(remotePath) as Buffer;
        return { content: buf.toString("utf8"), base64: buf.toString("base64"), size_bytes: buf.length };
      } else if (action === "delete") {
        await sftp.delete(remotePath);
        return { deleted: true, path: remotePath };
      } else if (action === "mkdir") {
        await sftp.mkdir(remotePath, true);
        return { created: true, path: remotePath };
      } else if (action === "rename") {
        await sftp.rename(remotePath, sfInterp(String(config.dest_path || "")));
        return { renamed: true };
      }
    } finally {
      await sftp.end();
    }
    return undefined;
  },
};
