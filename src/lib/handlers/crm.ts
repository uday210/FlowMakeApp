import type { NodeHandler } from "./types";
import { getGoogleAccessToken } from "./googleAuth";

export const handlers: Record<string, NodeHandler> = {
  "trigger_salesforce": async ({ config, node }) => {
    // Combined handler — trigger_salesforce handles polling
    let access_token: string;
    let instance_url: string;

    if (config.access_token) {
      // OAuth connection — tokens already merged from connection config
      access_token = config.access_token as string;
      instance_url = config.instance_url as string;
      if (!instance_url) throw new Error("instance_url missing from OAuth connection config");
    } else {
      // Client credentials or password flow
      const env = (config.environment as string) || "production";
      const authFlow = (config.auth_flow as string) || "password";

      const loginUrl = (() => {
        const custom = (config.login_url as string)?.trim().replace(/\/$/, "");
        if (custom) return custom;
        if (env === "sandbox") return "https://test.salesforce.com";
        return "https://login.salesforce.com";
      })();

      const clientId = config.client_id as string;
      const clientSecret = config.client_secret as string;
      if (!clientId || !clientSecret) throw new Error("client_id and client_secret are required");

      const tokenParams = new URLSearchParams({ client_id: clientId, client_secret: clientSecret });
      if (authFlow === "client_credentials") {
        tokenParams.set("grant_type", "client_credentials");
      } else {
        const username = config.username as string;
        const password = (config.password as string) + ((config.security_token as string) || "");
        if (!username) throw new Error("Username is required for password flow");
        tokenParams.set("grant_type", "password");
        tokenParams.set("username", username);
        tokenParams.set("password", password);
      }

      const tokenRes = await fetch(`${loginUrl}/services/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenParams.toString(),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.access_token) {
        throw new Error(tokenData.error_description || `Salesforce auth failed: ${tokenRes.status}`);
      }
      access_token = tokenData.access_token as string;
      instance_url = tokenData.instance_url as string;
    }
    const sfHeaders = {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    };
    const apiBase = `${instance_url}/services/data/v59.0`;

    // Polling trigger
    const sfObject = (config.object as string) || "Lead";
    const event = (config.event as string) || "new_record";
    const filter = config.filter as string;
    // Use poll_interval to determine the look-back window (×2 for overlap to avoid missing records)
    const pollMins = Math.max(1, Number(config.poll_interval) || 5);
    const since = new Date(Date.now() - 2 * pollMins * 60 * 1000).toISOString().replace(/\.\d+Z$/, "Z");

    let soql = "";
    if (event === "new_record" || event === "new_lead") {
      soql = `SELECT Id, Name, CreatedDate FROM ${sfObject} WHERE CreatedDate > ${since}`;
    } else if (event === "record_updated" || event === "opportunity_stage") {
      soql = `SELECT Id, Name, LastModifiedDate${event === "opportunity_stage" ? ", StageName" : ""} FROM ${sfObject} WHERE LastModifiedDate > ${since}`;
    }
    if (filter) soql += ` AND ${filter}`;
    soql += " ORDER BY CreatedDate DESC LIMIT 50";

    const res = await fetch(`${apiBase}/query?q=${encodeURIComponent(soql)}`, { headers: sfHeaders });
    const data = await res.json();
    if (!res.ok) throw new Error(data[0]?.message || `Salesforce query failed: ${res.status}`);

    // No new records → skip downstream execution
    if (!data.totalSize || data.totalSize === 0) {
      return { _skip: true, event, object: sfObject, total: 0, records: [] };
    }

    // Return the first/latest record as the trigger output so downstream nodes
    // receive a single record's fields (fan-out per record not yet supported)
    const firstRecord = data.records[0];
    return {
      event,
      object: sfObject,
      total: data.totalSize,
      records: data.records,
      // Spread top-level so fields like {{trigger.Id}}, {{trigger.Name}} work directly
      ...firstRecord,
    };

    void node;
  },

  "action_salesforce": async ({ config, node }) => {
    let access_token: string;
    let instance_url: string;

    if (config.access_token) {
      // OAuth connection — tokens already merged from connection config
      access_token = config.access_token as string;
      instance_url = config.instance_url as string;
      if (!instance_url) throw new Error("instance_url missing from OAuth connection config");
    } else {
      // Client credentials or password flow
      const env = (config.environment as string) || "production";
      const authFlow = (config.auth_flow as string) || "password";

      const loginUrl = (() => {
        const custom = (config.login_url as string)?.trim().replace(/\/$/, "");
        if (custom) return custom;
        if (env === "sandbox") return "https://test.salesforce.com";
        return "https://login.salesforce.com";
      })();

      const clientId = config.client_id as string;
      const clientSecret = config.client_secret as string;
      if (!clientId || !clientSecret) throw new Error("client_id and client_secret are required");

      const tokenParams = new URLSearchParams({ client_id: clientId, client_secret: clientSecret });
      if (authFlow === "client_credentials") {
        tokenParams.set("grant_type", "client_credentials");
      } else {
        const username = config.username as string;
        const password = (config.password as string) + ((config.security_token as string) || "");
        if (!username) throw new Error("Username is required for password flow");
        tokenParams.set("grant_type", "password");
        tokenParams.set("username", username);
        tokenParams.set("password", password);
      }

      const tokenRes = await fetch(`${loginUrl}/services/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenParams.toString(),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.access_token) {
        throw new Error(tokenData.error_description || `Salesforce auth failed: ${tokenRes.status}`);
      }
      access_token = tokenData.access_token as string;
      instance_url = tokenData.instance_url as string;
    }
    const sfHeaders = {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    };
    const apiBase = `${instance_url}/services/data/v59.0`;

    const sfObject = (config.object as string) || "Lead";
    const action = (config.action as string) || "create";
    const recordId = config.record_id as string;

    if (action === "create") {
      let fields: Record<string, unknown> = {};
      try { fields = JSON.parse(config.fields as string); } catch { throw new Error("Fields must be valid JSON"); }
      const res = await fetch(`${apiBase}/sobjects/${sfObject}`, {
        method: "POST", headers: sfHeaders, body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data[0]?.message || `Create failed: ${res.status}`);
      return { id: data.id, success: data.success, object: sfObject };

    } else if (action === "update") {
      if (!recordId) throw new Error("Record ID is required for update");
      let fields: Record<string, unknown> = {};
      try { fields = JSON.parse(config.fields as string); } catch { throw new Error("Fields must be valid JSON"); }
      const res = await fetch(`${apiBase}/sobjects/${sfObject}/${recordId}`, {
        method: "PATCH", headers: sfHeaders, body: JSON.stringify(fields),
      });
      if (res.status === 204) {
        return { success: true, id: recordId, object: sfObject };
      } else {
        const data = await res.json();
        throw new Error(data[0]?.message || `Update failed: ${res.status}`);
      }

    } else if (action === "get") {
      if (!recordId) throw new Error("Record ID is required");
      const res = await fetch(`${apiBase}/sobjects/${sfObject}/${recordId}`, { headers: sfHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data[0]?.message || `Get failed: ${res.status}`);
      return data;

    } else if (action === "query") {
      const soql = config.soql as string;
      if (!soql) throw new Error("SOQL query is required");
      const res = await fetch(`${apiBase}/query?q=${encodeURIComponent(soql)}`, { headers: sfHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data[0]?.message || `Query failed: ${res.status}`);
      return { total: data.totalSize, records: data.records, done: data.done };

    } else if (action === "delete") {
      if (!recordId) throw new Error("Record ID is required for delete");
      const res = await fetch(`${apiBase}/sobjects/${sfObject}/${recordId}`, {
        method: "DELETE", headers: sfHeaders,
      });
      if (res.status === 204) {
        return { success: true, deleted_id: recordId };
      } else {
        const data = await res.json();
        throw new Error(data[0]?.message || `Delete failed: ${res.status}`);
      }
    }

    void node;
    return undefined;
  },

  "action_hubspot": async ({ config }) => {
    const apiKey = config.api_key as string;
    const action = config.action as string;
    const propertiesRaw = config.properties as string;
    if (!apiKey) throw new Error("HubSpot token is required");
    const hsHeaders = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
    let properties: Record<string, unknown> = {};
    try { properties = JSON.parse(propertiesRaw || "{}"); } catch { /* empty */ }

    if (action === "create_contact") {
      const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
        method: "POST", headers: hsHeaders, body: JSON.stringify({ properties }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `HubSpot ${res.status}`);
      return { id: data.id, type: "contact", properties: data.properties };
    } else if (action === "create_deal") {
      const res = await fetch("https://api.hubapi.com/crm/v3/objects/deals", {
        method: "POST", headers: hsHeaders, body: JSON.stringify({ properties }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `HubSpot ${res.status}`);
      return { id: data.id, type: "deal", properties: data.properties };
    } else if (action === "create_company") {
      const res = await fetch("https://api.hubapi.com/crm/v3/objects/companies", {
        method: "POST", headers: hsHeaders, body: JSON.stringify({ properties }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `HubSpot ${res.status}`);
      return { id: data.id, type: "company", properties: data.properties };
    } else if (action === "update_contact") {
      const recordId = config.record_id as string;
      if (!recordId) throw new Error("Record ID is required for update");
      const res = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${recordId}`, {
        method: "PATCH", headers: hsHeaders, body: JSON.stringify({ properties }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `HubSpot ${res.status}`);
      return { id: data.id, updated: true };
    } else if (action === "search_contacts") {
      const query = (properties.query as string) || "";
      const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
        method: "POST", headers: hsHeaders,
        body: JSON.stringify({ query, limit: 10, properties: ["email", "firstname", "lastname"] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `HubSpot ${res.status}`);
      return { total: data.total, results: data.results };
    }
    return undefined;
  },

  "action_jira": async ({ config }) => {
    const domain = config.domain as string;
    const email = config.email as string;
    const apiToken = config.api_token as string;
    const action = config.action as string;
    if (!domain || !email || !apiToken) throw new Error("Jira domain, email, and API token are required");
    const auth = Buffer.from(`${email}:${apiToken}`).toString("base64");
    const jiraHeaders = { Authorization: `Basic ${auth}`, "Content-Type": "application/json", Accept: "application/json" };
    const baseUrl = `https://${domain}/rest/api/3`;

    const jiraDoc = (text: string) => ({ type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: text }] }] });

    if (action === "create_issue") {
      const projectKey = config.project_key as string;
      if (!projectKey) throw new Error("Project key is required");
      const res = await fetch(`${baseUrl}/issue`, {
        method: "POST", headers: jiraHeaders,
        body: JSON.stringify({
          fields: {
            project: { key: projectKey },
            summary: config.summary || "New issue",
            description: jiraDoc(String(config.description || "")),
            issuetype: { name: config.issue_type || "Task" },
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.errorMessages?.[0] || `Jira ${res.status}`);
      return { id: data.id, key: data.key, url: `https://${domain}/browse/${data.key}` };
    } else if (action === "get_issue") {
      const issueKey = config.issue_key as string;
      if (!issueKey) throw new Error("Issue key is required");
      const res = await fetch(`${baseUrl}/issue/${issueKey}`, { headers: jiraHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.errorMessages?.[0] || `Jira ${res.status}`);
      return { id: data.id, key: data.key, summary: data.fields?.summary, status: data.fields?.status?.name, assignee: data.fields?.assignee?.displayName };
    } else if (action === "add_comment") {
      const issueKey = config.issue_key as string;
      if (!issueKey) throw new Error("Issue key is required");
      const res = await fetch(`${baseUrl}/issue/${issueKey}/comment`, {
        method: "POST", headers: jiraHeaders,
        body: JSON.stringify({ body: jiraDoc(String(config.description || "")) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.errorMessages?.[0] || `Jira ${res.status}`);
      return { comment_id: data.id, issue_key: issueKey };
    } else if (action === "list_issues_jql") {
      const jql = config.jql as string || `project = ${config.project_key || "PROJ"} ORDER BY created DESC`;
      const res = await fetch(`${baseUrl}/search?jql=${encodeURIComponent(jql)}&maxResults=20&fields=summary,status,assignee,priority`, { headers: jiraHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.errorMessages?.[0] || `Jira ${res.status}`);
      return { total: data.total, issues: data.issues?.map((i: Record<string, unknown>) => {
        const f = i.fields as Record<string, unknown>;
        return { id: i.id, key: i.key, summary: (f?.summary as string), status: (f?.status as Record<string, unknown>)?.name, assignee: (f?.assignee as Record<string, unknown>)?.displayName };
      }) };
    } else if (action === "transition_issue") {
      const issueKey = config.issue_key as string;
      const transitionId = config.transition_id as string;
      if (!issueKey || !transitionId) throw new Error("Issue key and transition ID are required");
      const res = await fetch(`${baseUrl}/issue/${issueKey}/transitions`, {
        method: "POST", headers: jiraHeaders, body: JSON.stringify({ transition: { id: transitionId } }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.errorMessages?.[0] || `Jira ${res.status}`); }
      return { transitioned: true, issue_key: issueKey, transition_id: transitionId };
    } else if (action === "assign_issue") {
      const issueKey = config.issue_key as string;
      const assigneeId = config.assignee_id as string;
      if (!issueKey) throw new Error("Issue key is required");
      const res = await fetch(`${baseUrl}/issue/${issueKey}/assignee`, {
        method: "PUT", headers: jiraHeaders, body: JSON.stringify({ accountId: assigneeId || null }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.errorMessages?.[0] || `Jira ${res.status}`); }
      return { assigned: true, issue_key: issueKey };
    } else if (action === "list_transitions") {
      const issueKey = config.issue_key as string;
      if (!issueKey) throw new Error("Issue key is required");
      const res = await fetch(`${baseUrl}/issue/${issueKey}/transitions`, { headers: jiraHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.errorMessages?.[0] || `Jira ${res.status}`);
      return { transitions: data.transitions?.map((t: Record<string, unknown>) => ({ id: t.id, name: t.name })) };
    } else if (action === "list_projects") {
      const res = await fetch(`${baseUrl}/project?maxResults=50`, { headers: jiraHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(`Jira ${res.status}`);
      return { projects: data.map?.((p: Record<string, unknown>) => ({ id: p.id, key: p.key, name: p.name })) ?? data, count: Array.isArray(data) ? data.length : 0 };
    }
    return undefined;
  },

  "action_linear": async ({ config }) => {
    const apiKey = config.api_key as string;
    const action = config.action as string;
    if (!apiKey) throw new Error("Linear API key is required");
    const linearHeaders = { Authorization: apiKey, "Content-Type": "application/json" };

    const linearGql = async (query: string, variables: Record<string, unknown>) => {
      const res = await fetch("https://api.linear.app/graphql", {
        method: "POST", headers: linearHeaders, body: JSON.stringify({ query, variables }),
      });
      const data = await res.json();
      if (data.errors) throw new Error(data.errors[0]?.message || "Linear error");
      return data.data;
    };

    if (action === "create_issue") {
      const d = await linearGql(
        `mutation($teamId:String!,$title:String!,$description:String,$priority:Int,$stateId:String) {
          issueCreate(input:{teamId:$teamId,title:$title,description:$description,priority:$priority,stateId:$stateId}) {
            success issue { id identifier title url }
          }
        }`,
        { teamId: config.team_id, title: config.title, description: config.description || "", priority: Number(config.priority) || 0, stateId: config.state_id || undefined }
      );
      const issue = d?.issueCreate?.issue;
      return { id: issue?.id, key: issue?.identifier, title: issue?.title, url: issue?.url };
    } else if (action === "update_issue") {
      const issueId = config.issue_id as string;
      if (!issueId) throw new Error("Issue ID is required for update");
      await linearGql(
        `mutation($id:String!,$title:String,$description:String,$stateId:String) {
          issueUpdate(id:$id,input:{title:$title,description:$description,stateId:$stateId}) { success }
        }`,
        { id: issueId, title: config.title, description: config.description, stateId: config.state_id || undefined }
      );
      return { updated: true, id: issueId };
    } else if (action === "get_issue") {
      const issueId = config.issue_id as string;
      if (!issueId) throw new Error("Issue ID is required");
      const d = await linearGql(
        `query($id:String!) { issue(id:$id) { id identifier title description state { name } assignee { name email } priority } }`,
        { id: issueId }
      );
      return d?.issue;
    } else if (action === "list_issues") {
      const teamId = config.team_id as string;
      const d = await linearGql(
        `query($teamId:String) { issues(filter:{team:{id:{eq:$teamId}}},first:20) { nodes { id identifier title state { name } priority } } }`,
        { teamId: teamId || undefined }
      );
      return { issues: d?.issues?.nodes, count: d?.issues?.nodes?.length };
    } else if (action === "get_teams") {
      const d = await linearGql(
        `query { teams { nodes { id name key } } }`,
        {}
      );
      return { teams: d?.teams?.nodes, count: d?.teams?.nodes?.length };
    } else if (action === "assign_issue") {
      const issueId = config.issue_id as string;
      const assigneeId = config.assignee_id as string;
      if (!issueId) throw new Error("Issue ID is required");
      await linearGql(
        `mutation($id:String!,$assigneeId:String) { issueUpdate(id:$id,input:{assigneeId:$assigneeId}) { success } }`,
        { id: issueId, assigneeId: assigneeId || null }
      );
      return { assigned: true, issue_id: issueId, assignee_id: assigneeId };
    } else if (action === "get_states") {
      const teamId = config.team_id as string;
      const d = await linearGql(
        `query($teamId:String!) { team(id:$teamId) { states { nodes { id name type position } } } }`,
        { teamId }
      );
      return { states: d?.team?.states?.nodes };
    }
    return undefined;
  },

  "action_notion": async ({ config }) => {
    const token = config.token as string;
    if (!token) throw new Error("Integration token is required");
    const notionAction = (config.action as string) || "create_page";
    const notionHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Notion-Version": "2022-06-28" };

    if (notionAction === "create_page") {
      const databaseId = config.database_id as string;
      const title = config.title as string;
      if (!databaseId || !title) throw new Error("Database ID and title are required");
      const res = await fetch("https://api.notion.com/v1/pages", {
        method: "POST", headers: notionHeaders,
        body: JSON.stringify({
          parent: { database_id: databaseId },
          properties: { title: { title: [{ text: { content: title } }] } },
          children: config.content ? [{ object: "block", type: "paragraph", paragraph: { rich_text: [{ text: { content: config.content } }] } }] : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Notion ${res.status}`);
      return { page_id: data.id, url: data.url, title };
    } else if (notionAction === "get_page") {
      const pageId = config.page_id as string;
      if (!pageId) throw new Error("Page ID is required");
      const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, { headers: notionHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Notion ${res.status}`);
      return { page_id: data.id, url: data.url, archived: data.archived, properties: data.properties };
    } else if (notionAction === "update_page") {
      const pageId = config.page_id as string;
      const newTitle = config.title as string;
      if (!pageId) throw new Error("Page ID is required");
      const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: "PATCH", headers: notionHeaders,
        body: JSON.stringify({ properties: { title: { title: [{ text: { content: newTitle || "" } }] } } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Notion ${res.status}`);
      return { page_id: data.id, url: data.url, updated: true };
    } else if (notionAction === "query_database") {
      const databaseId = config.database_id as string;
      if (!databaseId) throw new Error("Database ID is required");
      let filterObj: Record<string, unknown> | undefined;
      try { if (config.filter) filterObj = JSON.parse(config.filter as string); } catch { /* ignore */ }
      const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: "POST", headers: notionHeaders,
        body: JSON.stringify({ ...(filterObj ? { filter: filterObj } : {}), page_size: 20 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Notion ${res.status}`);
      return { results: data.results, count: data.results?.length, has_more: data.has_more };
    } else if (notionAction === "search") {
      const query = (config.query as string) || "";
      const res = await fetch("https://api.notion.com/v1/search", {
        method: "POST", headers: notionHeaders,
        body: JSON.stringify({ query, page_size: 10 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Notion ${res.status}`);
      return { results: data.results, count: data.results?.length };
    } else if (notionAction === "append_blocks") {
      const pageId = config.page_id as string;
      const content = config.content as string || "";
      if (!pageId) throw new Error("Page ID is required");
      const res = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
        method: "PATCH", headers: notionHeaders,
        body: JSON.stringify({ children: [{ object: "block", type: "paragraph", paragraph: { rich_text: [{ text: { content } }] } }] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Notion ${res.status}`);
      return { appended: true, block_count: data.results?.length };
    }
    return undefined;
  },

  "action_airtable": async ({ config }) => {
    // Support both OAuth access_token and manual API token
    const token = (config.access_token || config.token) as string;
    const baseId = config.base_id as string;
    const table = config.table as string;
    if (!token || !baseId || !table) throw new Error("Token, base ID, and table are required");
    const atAction = (config.action as string) || "create_record";
    const atHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const atBase = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`;

    if (atAction === "create_record") {
      let parsed: unknown;
      try { parsed = JSON.parse(config.fields as string); } catch { throw new Error("Fields must be valid JSON"); }
      // Support array of objects (batch) or single object
      if (Array.isArray(parsed)) {
        const records = parsed.map((f) => ({ fields: f as Record<string, unknown> }));
        const res = await fetch(atBase, { method: "POST", headers: atHeaders, body: JSON.stringify({ records, typecast: true }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data.error) || `Airtable ${res.status}`);
        return { records: data.records, count: data.records?.length };
      } else {
        const res = await fetch(atBase, { method: "POST", headers: atHeaders, body: JSON.stringify({ fields: parsed, typecast: true }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data.error) || `Airtable ${res.status}`);
        return { record_id: data.id, fields: data.fields };
      }
    } else if (atAction === "list_records") {
      const maxRecords = Number(config.max_records) || 20;
      const filter = config.filter_formula as string;
      const url = `${atBase}?maxRecords=${maxRecords}${filter ? `&filterByFormula=${encodeURIComponent(filter)}` : ""}`;
      const res = await fetch(url, { headers: atHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Airtable ${res.status}`);
      return { records: data.records, count: data.records?.length };
    } else if (atAction === "get_record") {
      const recordId = config.record_id as string;
      if (!recordId) throw new Error("Record ID is required");
      const res = await fetch(`${atBase}/${recordId}`, { headers: atHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Airtable ${res.status}`);
      return { record_id: data.id, fields: data.fields };
    } else if (atAction === "update_record") {
      const recordId = config.record_id as string;
      if (!recordId) throw new Error("Record ID is required");
      let fields: Record<string, unknown> = {};
      try { fields = JSON.parse(config.fields as string); } catch { throw new Error("Fields must be valid JSON"); }
      const res = await fetch(`${atBase}/${recordId}`, { method: "PATCH", headers: atHeaders, body: JSON.stringify({ fields }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Airtable ${res.status}`);
      return { record_id: data.id, fields: data.fields, updated: true };
    } else if (atAction === "delete_record") {
      const recordId = config.record_id as string;
      if (!recordId) throw new Error("Record ID is required");
      const res = await fetch(`${atBase}/${recordId}`, { method: "DELETE", headers: atHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Airtable ${res.status}`);
      return { deleted: data.deleted, record_id: data.id };
    } else if (atAction === "search_records") {
      const filter = config.filter_formula as string;
      const maxRecords = Number(config.max_records) || 20;
      const url = `${atBase}?maxRecords=${maxRecords}${filter ? `&filterByFormula=${encodeURIComponent(filter)}` : ""}`;
      const res = await fetch(url, { headers: atHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Airtable ${res.status}`);
      return { records: data.records, count: data.records?.length };
    }
    return undefined;
  },

  "action_github": async ({ config }) => {
    const token = config.token as string;
    const action = config.action as string;
    const owner = config.owner as string;
    const repo = config.repo as string;
    if (!token || !owner || !repo) throw new Error("Token, owner, and repo are required");
    const ghHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "FlowMake" };

    if (action === "create_issue") {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
        method: "POST", headers: ghHeaders,
        body: JSON.stringify({ title: config.title, body: config.body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `GitHub ${res.status}`);
      return { number: data.number, url: data.html_url, title: data.title };
    } else if (action === "close_issue") {
      const issueNum = config.issue_number as string;
      if (!issueNum) throw new Error("Issue number is required");
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNum}`, {
        method: "PATCH", headers: ghHeaders, body: JSON.stringify({ state: "closed" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `GitHub ${res.status}`);
      return { number: data.number, state: data.state, url: data.html_url };
    } else if (action === "get_repo") {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: ghHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `GitHub ${res.status}`);
      return { name: data.full_name, stars: data.stargazers_count, forks: data.forks_count, description: data.description };
    } else if (action === "list_issues") {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=20`, { headers: ghHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `GitHub ${res.status}`);
      return { count: data.length, issues: data.map((i: Record<string, unknown>) => ({ number: i.number, title: i.title, state: i.state, url: i.html_url })) };
    } else if (action === "create_pr") {
      const head = config.head as string;
      const base = (config.base as string) || "main";
      if (!head) throw new Error("Head branch is required");
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
        method: "POST", headers: ghHeaders,
        body: JSON.stringify({ title: config.title, body: config.body || "", head, base }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `GitHub ${res.status}`);
      return { number: data.number, url: data.html_url, title: data.title, state: data.state };
    } else if (action === "list_prs") {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=20`, { headers: ghHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `GitHub ${res.status}`);
      return { count: data.length, prs: data.map((p: Record<string, unknown>) => ({ number: p.number, title: p.title, state: p.state, url: p.html_url })) };
    } else if (action === "get_file") {
      const filePath = config.file_path as string;
      if (!filePath) throw new Error("File path is required");
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, { headers: ghHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `GitHub ${res.status}`);
      const content = data.encoding === "base64" ? Buffer.from(data.content, "base64").toString("utf-8") : data.content;
      return { path: data.path, sha: data.sha, content, size: data.size };
    } else if (action === "create_file") {
      const filePath = config.file_path as string;
      const fileContent = config.file_content as string || "";
      if (!filePath) throw new Error("File path is required");
      const encoded = Buffer.from(fileContent).toString("base64");
      const checkRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, { headers: ghHeaders });
      const checkData = checkRes.ok ? await checkRes.json() : null;
      const body: Record<string, unknown> = { message: config.title || `Update ${filePath}`, content: encoded };
      if (checkData?.sha) body.sha = checkData.sha;
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
        method: "PUT", headers: ghHeaders, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `GitHub ${res.status}`);
      return { path: data.content?.path, sha: data.content?.sha, created: !checkData?.sha };
    } else if (action === "create_release") {
      const tagName = config.tag_name as string;
      if (!tagName) throw new Error("Tag name is required");
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
        method: "POST", headers: ghHeaders,
        body: JSON.stringify({ tag_name: tagName, name: config.title || tagName, body: config.body || "", draft: false, prerelease: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `GitHub ${res.status}`);
      return { id: data.id, tag: data.tag_name, url: data.html_url, upload_url: data.upload_url };
    }
    return undefined;
  },

  "action_sheets": async ({ config }) => {
    const spreadsheetId = config.spreadsheet_id as string;
    const sheetsAction = (config.action as string) || "append_row";
    const range = (config.range as string) || "Sheet1!A1";
    if (!spreadsheetId) throw new Error("Spreadsheet ID is required");

    const accessToken = await getGoogleAccessToken(config, "https://www.googleapis.com/auth/spreadsheets");
    const sheetsHeaders = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
    const sheetsBase = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;

    // Normalize values: accepts 2D array OR array of objects (e.g. from My Table node)
    const includeHeaders = config.include_headers === "true" || config.include_headers === true;
    const EXCLUDED_KEYS = new Set(["id", "_created_at"]);
    const normalizeValues = (raw: unknown): unknown[][] => {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!Array.isArray(parsed)) throw new Error("Values must be a JSON array");
      if (parsed.length === 0) return [];
      if (typeof parsed[0] === "object" && !Array.isArray(parsed[0]) && parsed[0] !== null) {
        const keys = Object.keys(parsed[0] as object).filter(k => !EXCLUDED_KEYS.has(k));
        const rows = parsed.map((obj: Record<string, unknown>) => keys.map(k => obj[k] ?? ""));
        return includeHeaders ? [keys, ...rows] : rows;
      }
      return parsed as unknown[][];
    };

    if (sheetsAction === "append_row") {
      const values = normalizeValues(config.values);
      const res = await fetch(`${sheetsBase}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`, {
        method: "POST", headers: sheetsHeaders, body: JSON.stringify({ values }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Sheets ${res.status}`);
      return { updated_range: data.updates?.updatedRange, rows_added: data.updates?.updatedRows };
    } else if (sheetsAction === "get_values") {
      const res = await fetch(`${sheetsBase}/values/${encodeURIComponent(range)}`, { headers: sheetsHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Sheets ${res.status}`);
      return { range: data.range, values: data.values, row_count: data.values?.length ?? 0 };
    } else if (sheetsAction === "update_values") {
      let values: unknown[][];
      try { values = normalizeValues(config.values); } catch { throw new Error("Values must be a valid JSON array"); }
      const res = await fetch(`${sheetsBase}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
        method: "PUT", headers: sheetsHeaders, body: JSON.stringify({ values }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Sheets ${res.status}`);
      return { updated_range: data.updatedRange, updated_rows: data.updatedRows, updated_cells: data.updatedCells };
    } else if (sheetsAction === "clear_range") {
      const res = await fetch(`${sheetsBase}/values/${encodeURIComponent(range)}:clear`, { method: "POST", headers: sheetsHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Sheets ${res.status}`);
      return { cleared_range: data.clearedRange };
    } else if (sheetsAction === "get_spreadsheet") {
      const res = await fetch(`${sheetsBase}?fields=spreadsheetId,properties,sheets.properties`, { headers: sheetsHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Sheets ${res.status}`);
      return { id: data.spreadsheetId, title: data.properties?.title, sheets: data.sheets?.map((s: Record<string, unknown>) => (s.properties as Record<string, unknown>)) };
    }
    return undefined;
  },

  "action_google_calendar": async ({ config, ctx }) => {
    const accessToken = await getGoogleAccessToken(config, "https://www.googleapis.com/auth/calendar");
    const action = config.action as string;
    const calendarId = (config.calendar_id as string) || "primary";
    const calHeaders = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
    if (action === "list") {
      const maxResults = Number(config.max_results) || 10;
      const now = new Date().toISOString();
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${encodeURIComponent(now)}&maxResults=${maxResults}&singleEvents=true&orderBy=startTime`,
        { headers: calHeaders }
      );
      if (!res.ok) throw new Error(`Calendar list ${res.status}`);
      const d = await res.json();
      return { events: d.items, count: d.items?.length ?? 0 };
    } else if (action === "create") {
      const allData = { ...ctx.triggerData, ...ctx.nodeOutputs, variables: ctx.variables };
      const localInterp = (s: string) => s.replace(/\{\{([^}]+)\}\}/g, (_, p: string) => {
        const v = p.trim().split(".").reduce<unknown>((o, k) => o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined, allData);
        return v !== undefined ? String(v) : "";
      });
      const attendees = ((config.attendees as string) || "").split(",").map((e) => e.trim()).filter(Boolean).map((email) => ({ email }));
      const event = {
        summary: localInterp(config.summary as string || ""),
        description: localInterp(config.description as string || ""),
        start: { dateTime: localInterp(config.start as string || ""), timeZone: "UTC" },
        end: { dateTime: localInterp(config.end as string || ""), timeZone: "UTC" },
        ...(attendees.length > 0 ? { attendees } : {}),
      };
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        { method: "POST", headers: calHeaders, body: JSON.stringify(event) }
      );
      if (!res.ok) throw new Error(`Calendar create ${res.status}`);
      const d = await res.json();
      return { id: d.id, summary: d.summary, htmlLink: d.htmlLink, start: d.start, end: d.end };
    } else if (action === "get") {
      const eventId = config.event_id as string;
      if (!eventId) throw new Error("Event ID is required");
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, { headers: calHeaders });
      if (!res.ok) throw new Error(`Calendar get ${res.status}`);
      const d = await res.json();
      return { id: d.id, summary: d.summary, description: d.description, start: d.start, end: d.end, htmlLink: d.htmlLink };
    } else if (action === "update") {
      const eventId = config.event_id as string;
      if (!eventId) throw new Error("Event ID is required");
      const allData2 = { ...ctx.triggerData, ...ctx.nodeOutputs, variables: ctx.variables };
      const interp2 = (s: string) => s.replace(/\{\{([^}]+)\}\}/g, (_, p: string) => {
        const v = p.trim().split(".").reduce<unknown>((o, k) => o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined, allData2);
        return v !== undefined ? String(v) : "";
      });
      const patchBody: Record<string, unknown> = {};
      if (config.summary) patchBody.summary = interp2(config.summary as string);
      if (config.description) patchBody.description = interp2(config.description as string);
      if (config.start) patchBody.start = { dateTime: interp2(config.start as string), timeZone: "UTC" };
      if (config.end) patchBody.end = { dateTime: interp2(config.end as string), timeZone: "UTC" };
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
        method: "PATCH", headers: calHeaders, body: JSON.stringify(patchBody),
      });
      if (!res.ok) throw new Error(`Calendar update ${res.status}`);
      const d = await res.json();
      return { id: d.id, summary: d.summary, updated: true };
    } else if (action === "delete") {
      const eventId = config.event_id as string;
      if (!eventId) throw new Error("Event ID is required");
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, { method: "DELETE", headers: calHeaders });
      return { deleted: true, event_id: eventId };
    } else if (action === "list_calendars") {
      const res = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", { headers: calHeaders });
      if (!res.ok) throw new Error(`Calendar list ${res.status}`);
      const d = await res.json();
      return { calendars: d.items?.map((c: Record<string, unknown>) => ({ id: c.id, summary: c.summary, primary: c.primary })), count: d.items?.length };
    } else if (action === "quick_add") {
      const text = config.quick_add_text as string;
      if (!text) throw new Error("Quick add text is required");
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/quickAdd?text=${encodeURIComponent(text)}`, {
        method: "POST", headers: calHeaders,
      });
      if (!res.ok) throw new Error(`Calendar quick add ${res.status}`);
      const d = await res.json();
      return { id: d.id, summary: d.summary, start: d.start, end: d.end };
    }
    return undefined;
  },

  "action_stripe": async ({ config }) => {
    const secretKey = config.secret_key as string;
    const action = config.action as string;
    if (!secretKey) throw new Error("Stripe secret key is required");
    const stripeHeaders = { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" };

    if (action === "create_payment_intent") {
      const amount = Number(config.amount);
      if (!amount || isNaN(amount)) throw new Error("Amount is required");
      const body = new URLSearchParams({ amount: String(amount), currency: (config.currency as string) || "usd" });
      if (config.customer_id) body.append("customer", config.customer_id as string);
      const res = await fetch("https://api.stripe.com/v1/payment_intents", { method: "POST", headers: stripeHeaders, body: body.toString() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { id: data.id, client_secret: data.client_secret, amount: data.amount, currency: data.currency, status: data.status };
    } else if (action === "get_payment_intent") {
      const piId = config.payment_intent_id as string;
      if (!piId) throw new Error("Payment Intent ID is required");
      const res = await fetch(`https://api.stripe.com/v1/payment_intents/${piId}`, { headers: stripeHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { id: data.id, amount: data.amount, currency: data.currency, status: data.status };
    } else if (action === "create_customer") {
      const body = new URLSearchParams();
      if (config.customer_email) body.append("email", config.customer_email as string);
      if (config.customer_name) body.append("name", config.customer_name as string);
      const res = await fetch("https://api.stripe.com/v1/customers", { method: "POST", headers: stripeHeaders, body: body.toString() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { id: data.id, email: data.email, name: data.name };
    } else if (action === "update_customer") {
      const customerId = config.customer_id as string;
      if (!customerId) throw new Error("Customer ID is required");
      const body = new URLSearchParams();
      if (config.customer_email) body.append("email", config.customer_email as string);
      if (config.customer_name) body.append("name", config.customer_name as string);
      const res = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, { method: "POST", headers: stripeHeaders, body: body.toString() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { id: data.id, email: data.email, name: data.name, updated: true };
    } else if (action === "list_charges") {
      const res = await fetch("https://api.stripe.com/v1/charges?limit=10", { headers: stripeHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { count: data.data?.length, charges: data.data?.map((c: Record<string, unknown>) => ({ id: c.id, amount: c.amount, currency: c.currency, status: c.status })) };
    } else if (action === "get_charge") {
      const chargeId = config.payment_intent_id as string;
      if (!chargeId) throw new Error("Charge ID is required");
      const res = await fetch(`https://api.stripe.com/v1/charges/${chargeId}`, { headers: stripeHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { id: data.id, amount: data.amount, currency: data.currency, status: data.status, paid: data.paid, receipt_url: data.receipt_url };
    } else if (action === "create_refund") {
      const chargeId = config.payment_intent_id as string;
      if (!chargeId) throw new Error("Charge or Payment Intent ID is required");
      const body = new URLSearchParams({ charge: chargeId });
      if (config.amount) body.append("amount", String(Number(config.amount)));
      const res = await fetch("https://api.stripe.com/v1/refunds", { method: "POST", headers: stripeHeaders, body: body.toString() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { id: data.id, amount: data.amount, currency: data.currency, status: data.status };
    } else if (action === "create_subscription") {
      const customerId = config.customer_id as string;
      const priceId = config.price_id as string;
      if (!customerId || !priceId) throw new Error("Customer ID and Price ID are required");
      const body = new URLSearchParams({ customer: customerId });
      body.append("items[0][price]", priceId);
      const res = await fetch("https://api.stripe.com/v1/subscriptions", { method: "POST", headers: stripeHeaders, body: body.toString() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { id: data.id, status: data.status, current_period_end: data.current_period_end, customer: data.customer };
    } else if (action === "cancel_subscription") {
      const subId = config.subscription_id as string;
      if (!subId) throw new Error("Subscription ID is required");
      const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, { method: "DELETE", headers: stripeHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { id: data.id, status: data.status, canceled: true };
    } else if (action === "create_checkout_session") {
      const priceId = config.price_id as string;
      const successUrl = config.success_url as string || "https://example.com/success";
      const cancelUrl = config.cancel_url as string || "https://example.com/cancel";
      if (!priceId) throw new Error("Price ID is required");
      const body = new URLSearchParams({
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": String(Number(config.quantity) || 1),
        mode: (config.mode as string) || "payment",
        success_url: successUrl,
        cancel_url: cancelUrl,
      });
      if (config.customer_id) body.append("customer", config.customer_id as string);
      if (config.customer_email) body.append("customer_email", config.customer_email as string);
      const res = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: stripeHeaders, body: body.toString() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { id: data.id, url: data.url, status: data.status };

    // ── Payment Links ──────────────────────────────────────────────────────────
    } else if (action === "create_payment_link") {
      const priceId = config.price_id as string;
      if (!priceId) throw new Error("Price ID is required");
      const body = new URLSearchParams({
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": String(Number(config.quantity) || 1),
      });
      if (config.after_completion_url) {
        body.append("after_completion[type]", "redirect");
        body.append("after_completion[redirect][url]", config.after_completion_url as string);
      }
      const res = await fetch("https://api.stripe.com/v1/payment_links", { method: "POST", headers: stripeHeaders, body: body.toString() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { id: data.id, url: data.url, active: data.active };
    } else if (action === "get_payment_link") {
      const plId = config.payment_link_id as string;
      if (!plId) throw new Error("Payment Link ID is required");
      const res = await fetch(`https://api.stripe.com/v1/payment_links/${plId}`, { headers: stripeHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { id: data.id, url: data.url, active: data.active };
    } else if (action === "deactivate_payment_link") {
      const plId = config.payment_link_id as string;
      if (!plId) throw new Error("Payment Link ID is required");
      const res = await fetch(`https://api.stripe.com/v1/payment_links/${plId}`, { method: "POST", headers: stripeHeaders, body: "active=false" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { id: data.id, active: data.active };

    // ── Products ───────────────────────────────────────────────────────────────
    } else if (action === "create_product") {
      const name = config.product_name as string;
      if (!name) throw new Error("Product name is required");
      const body = new URLSearchParams({ name });
      if (config.product_description) body.append("description", config.product_description as string);
      if (config.product_images) body.append("images[0]", config.product_images as string);
      const res = await fetch("https://api.stripe.com/v1/products", { method: "POST", headers: stripeHeaders, body: body.toString() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { id: data.id, name: data.name, description: data.description, active: data.active };
    } else if (action === "get_product") {
      const productId = config.product_id as string;
      if (!productId) throw new Error("Product ID is required");
      const res = await fetch(`https://api.stripe.com/v1/products/${productId}`, { headers: stripeHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { id: data.id, name: data.name, description: data.description, active: data.active };
    } else if (action === "update_product") {
      const productId = config.product_id as string;
      if (!productId) throw new Error("Product ID is required");
      const body = new URLSearchParams();
      if (config.product_name) body.append("name", config.product_name as string);
      if (config.product_description) body.append("description", config.product_description as string);
      const res = await fetch(`https://api.stripe.com/v1/products/${productId}`, { method: "POST", headers: stripeHeaders, body: body.toString() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { id: data.id, name: data.name, description: data.description, updated: true };
    } else if (action === "list_products") {
      const limit = Number(config.limit) || 10;
      const res = await fetch(`https://api.stripe.com/v1/products?limit=${limit}&active=true`, { headers: stripeHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { count: data.data?.length, products: data.data?.map((p: Record<string, unknown>) => ({ id: p.id, name: p.name, description: p.description, active: p.active })) };
    } else if (action === "delete_product") {
      const productId = config.product_id as string;
      if (!productId) throw new Error("Product ID is required");
      const res = await fetch(`https://api.stripe.com/v1/products/${productId}`, { method: "DELETE", headers: stripeHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { id: data.id, deleted: data.deleted };

    // ── Prices ─────────────────────────────────────────────────────────────────
    } else if (action === "create_price") {
      const productId = config.product_id as string;
      const amount = Number(config.amount);
      if (!productId) throw new Error("Product ID is required");
      if (!amount || isNaN(amount)) throw new Error("Amount is required");
      const body = new URLSearchParams({
        product: productId,
        unit_amount: String(amount),
        currency: (config.currency as string) || "usd",
      });
      if (config.recurring_interval) {
        body.append("recurring[interval]", config.recurring_interval as string);
      }
      const res = await fetch("https://api.stripe.com/v1/prices", { method: "POST", headers: stripeHeaders, body: body.toString() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { id: data.id, unit_amount: data.unit_amount, currency: data.currency, type: data.type, recurring: data.recurring };
    } else if (action === "list_prices") {
      const productId = config.product_id as string;
      const url = productId ? `https://api.stripe.com/v1/prices?product=${productId}&limit=20` : "https://api.stripe.com/v1/prices?limit=20";
      const res = await fetch(url, { headers: stripeHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { count: data.data?.length, prices: data.data?.map((p: Record<string, unknown>) => ({ id: p.id, unit_amount: p.unit_amount, currency: p.currency, type: p.type })) };

    // ── Customer Management ────────────────────────────────────────────────────
    } else if (action === "get_customer") {
      const customerId = config.customer_id as string;
      if (!customerId) throw new Error("Customer ID is required");
      const res = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, { headers: stripeHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { id: data.id, email: data.email, name: data.name, balance: data.balance, created: data.created };
    } else if (action === "list_customers") {
      const limit = Number(config.limit) || 10;
      const url = config.customer_email
        ? `https://api.stripe.com/v1/customers?email=${encodeURIComponent(config.customer_email as string)}&limit=${limit}`
        : `https://api.stripe.com/v1/customers?limit=${limit}`;
      const res = await fetch(url, { headers: stripeHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { count: data.data?.length, customers: data.data?.map((c: Record<string, unknown>) => ({ id: c.id, email: c.email, name: c.name })) };
    } else if (action === "delete_customer") {
      const customerId = config.customer_id as string;
      if (!customerId) throw new Error("Customer ID is required");
      const res = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, { method: "DELETE", headers: stripeHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { id: data.id, deleted: data.deleted };

    // ── Subscriptions ──────────────────────────────────────────────────────────
    } else if (action === "get_subscription") {
      const subId = config.subscription_id as string;
      if (!subId) throw new Error("Subscription ID is required");
      const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, { headers: stripeHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { id: data.id, status: data.status, customer: data.customer, current_period_end: data.current_period_end };
    } else if (action === "list_subscriptions") {
      const limit = Number(config.limit) || 10;
      const url = config.customer_id
        ? `https://api.stripe.com/v1/subscriptions?customer=${config.customer_id}&limit=${limit}`
        : `https://api.stripe.com/v1/subscriptions?limit=${limit}`;
      const res = await fetch(url, { headers: stripeHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { count: data.data?.length, subscriptions: data.data?.map((s: Record<string, unknown>) => ({ id: s.id, status: s.status, customer: s.customer })) };
    } else if (action === "update_subscription") {
      const subId = config.subscription_id as string;
      if (!subId) throw new Error("Subscription ID is required");
      const body = new URLSearchParams();
      if (config.price_id) body.append("items[0][price]", config.price_id as string);
      if (config.quantity) body.append("items[0][quantity]", String(Number(config.quantity)));
      if (config.proration_behavior) body.append("proration_behavior", config.proration_behavior as string);
      const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, { method: "POST", headers: stripeHeaders, body: body.toString() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { id: data.id, status: data.status, updated: true };
    } else if (action === "pause_subscription") {
      const subId = config.subscription_id as string;
      if (!subId) throw new Error("Subscription ID is required");
      const body = new URLSearchParams({ "pause_collection[behavior]": "void" });
      const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, { method: "POST", headers: stripeHeaders, body: body.toString() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { id: data.id, status: data.status, paused: true };
    } else if (action === "resume_subscription") {
      const subId = config.subscription_id as string;
      if (!subId) throw new Error("Subscription ID is required");
      const body = new URLSearchParams({ "pause_collection": "" });
      const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, { method: "POST", headers: stripeHeaders, body: body.toString() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { id: data.id, status: data.status, resumed: true };

    // ── Invoices ───────────────────────────────────────────────────────────────
    } else if (action === "create_invoice") {
      const customerId = config.customer_id as string;
      if (!customerId) throw new Error("Customer ID is required");
      const body = new URLSearchParams({ customer: customerId });
      if (config.description) body.append("description", config.description as string);
      if (config.days_until_due) body.append("days_until_due", String(Number(config.days_until_due)));
      const res = await fetch("https://api.stripe.com/v1/invoices", { method: "POST", headers: stripeHeaders, body: body.toString() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { id: data.id, status: data.status, amount_due: data.amount_due, hosted_invoice_url: data.hosted_invoice_url };
    } else if (action === "get_invoice") {
      const invoiceId = config.invoice_id as string;
      if (!invoiceId) throw new Error("Invoice ID is required");
      const res = await fetch(`https://api.stripe.com/v1/invoices/${invoiceId}`, { headers: stripeHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { id: data.id, status: data.status, amount_due: data.amount_due, amount_paid: data.amount_paid, hosted_invoice_url: data.hosted_invoice_url, invoice_pdf: data.invoice_pdf };
    } else if (action === "list_invoices") {
      const limit = Number(config.limit) || 10;
      const url = config.customer_id
        ? `https://api.stripe.com/v1/invoices?customer=${config.customer_id}&limit=${limit}`
        : `https://api.stripe.com/v1/invoices?limit=${limit}`;
      const res = await fetch(url, { headers: stripeHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { count: data.data?.length, invoices: data.data?.map((i: Record<string, unknown>) => ({ id: i.id, status: i.status, amount_due: i.amount_due, hosted_invoice_url: i.hosted_invoice_url })) };
    } else if (action === "send_invoice") {
      const invoiceId = config.invoice_id as string;
      if (!invoiceId) throw new Error("Invoice ID is required");
      const res = await fetch(`https://api.stripe.com/v1/invoices/${invoiceId}/send`, { method: "POST", headers: stripeHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { id: data.id, status: data.status, sent: true };
    } else if (action === "finalize_invoice") {
      const invoiceId = config.invoice_id as string;
      if (!invoiceId) throw new Error("Invoice ID is required");
      const res = await fetch(`https://api.stripe.com/v1/invoices/${invoiceId}/finalize`, { method: "POST", headers: stripeHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { id: data.id, status: data.status, hosted_invoice_url: data.hosted_invoice_url, invoice_pdf: data.invoice_pdf };
    } else if (action === "void_invoice") {
      const invoiceId = config.invoice_id as string;
      if (!invoiceId) throw new Error("Invoice ID is required");
      const res = await fetch(`https://api.stripe.com/v1/invoices/${invoiceId}/void`, { method: "POST", headers: stripeHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { id: data.id, status: data.status, voided: true };
    } else if (action === "pay_invoice") {
      const invoiceId = config.invoice_id as string;
      if (!invoiceId) throw new Error("Invoice ID is required");
      const res = await fetch(`https://api.stripe.com/v1/invoices/${invoiceId}/pay`, { method: "POST", headers: stripeHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { id: data.id, status: data.status, paid: data.paid };

    // ── Payment Intents (extended) ─────────────────────────────────────────────
    } else if (action === "cancel_payment_intent") {
      const piId = config.payment_intent_id as string;
      if (!piId) throw new Error("Payment Intent ID is required");
      const res = await fetch(`https://api.stripe.com/v1/payment_intents/${piId}/cancel`, { method: "POST", headers: stripeHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { id: data.id, status: data.status, canceled: true };
    } else if (action === "list_payment_intents") {
      const limit = Number(config.limit) || 10;
      const url = config.customer_id
        ? `https://api.stripe.com/v1/payment_intents?customer=${config.customer_id}&limit=${limit}`
        : `https://api.stripe.com/v1/payment_intents?limit=${limit}`;
      const res = await fetch(url, { headers: stripeHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { count: data.data?.length, payment_intents: data.data?.map((pi: Record<string, unknown>) => ({ id: pi.id, amount: pi.amount, currency: pi.currency, status: pi.status })) };

    // ── Coupons & Discounts ────────────────────────────────────────────────────
    } else if (action === "create_coupon") {
      const body = new URLSearchParams();
      if (config.coupon_percent_off) body.append("percent_off", String(Number(config.coupon_percent_off)));
      if (config.coupon_amount_off) body.append("amount_off", String(Number(config.coupon_amount_off)));
      if (config.coupon_duration) body.append("duration", config.coupon_duration as string);
      if (config.coupon_id) body.append("id", config.coupon_id as string);
      const res = await fetch("https://api.stripe.com/v1/coupons", { method: "POST", headers: stripeHeaders, body: body.toString() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { id: data.id, percent_off: data.percent_off, amount_off: data.amount_off, duration: data.duration };
    } else if (action === "apply_coupon") {
      const customerId = config.customer_id as string;
      const couponId = config.coupon_id as string;
      if (!customerId || !couponId) throw new Error("Customer ID and Coupon ID are required");
      const body = new URLSearchParams({ coupon: couponId });
      const res = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, { method: "POST", headers: stripeHeaders, body: body.toString() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { id: data.id, discount: data.discount, applied: true };

    // ── Balance & Payouts ──────────────────────────────────────────────────────
    } else if (action === "retrieve_balance") {
      const res = await fetch("https://api.stripe.com/v1/balance", { headers: stripeHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return {
        available: data.available?.map((b: Record<string, unknown>) => ({ amount: b.amount, currency: b.currency })),
        pending: data.pending?.map((b: Record<string, unknown>) => ({ amount: b.amount, currency: b.currency })),
      };
    } else if (action === "list_payouts") {
      const limit = Number(config.limit) || 10;
      const res = await fetch(`https://api.stripe.com/v1/payouts?limit=${limit}`, { headers: stripeHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { count: data.data?.length, payouts: data.data?.map((p: Record<string, unknown>) => ({ id: p.id, amount: p.amount, currency: p.currency, status: p.status, arrival_date: p.arrival_date })) };

    // ── Disputes ───────────────────────────────────────────────────────────────
    } else if (action === "list_disputes") {
      const limit = Number(config.limit) || 10;
      const res = await fetch(`https://api.stripe.com/v1/disputes?limit=${limit}`, { headers: stripeHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
      return { count: data.data?.length, disputes: data.data?.map((d: Record<string, unknown>) => ({ id: d.id, amount: d.amount, currency: d.currency, status: d.status, reason: d.reason })) };
    }
    return undefined;
  },

  "action_typeform": async ({ config }) => {
    const token = config.api_key as string;
    const action = (config.action as string) || "get_responses";
    const formId = config.form_id as string;
    if (!token || !formId) throw new Error("Typeform token and form ID are required");
    const hdrs = { Authorization: `Bearer ${token}` };
    if (action === "get_responses") {
      const res = await fetch(`https://api.typeform.com/forms/${formId}/responses?page_size=${config.page_size || 25}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.description || `Typeform ${res.status}`);
      return data;
    } else if (action === "get_form") {
      const res = await fetch(`https://api.typeform.com/forms/${formId}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.description || `Typeform ${res.status}`);
      return data;
    }
    return undefined;
  },

  "action_calendly": async ({ config }) => {
    const token = config.api_token as string;
    const action = (config.action as string) || "list_events";
    if (!token) throw new Error("Calendly API token is required");
    const hdrs = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    if (action === "get_user") {
      const res = await fetch("https://api.calendly.com/users/me", { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Calendly ${res.status}`);
      return data.resource;
    } else if (action === "list_events") {
      // Need user URI first
      const meRes = await fetch("https://api.calendly.com/users/me", { headers: hdrs });
      const me = await meRes.json();
      const userUri = me.resource?.uri;
      const url = `https://api.calendly.com/scheduled_events?user=${encodeURIComponent(userUri)}&count=${config.count || 20}${config.status ? `&status=${config.status}` : ""}`;
      const res = await fetch(url, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Calendly ${res.status}`);
      return data;
    } else if (action === "get_event") {
      const res = await fetch(`https://api.calendly.com/scheduled_events/${config.event_uuid}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Calendly ${res.status}`);
      return data.resource;
    }
    return undefined;
  },

  "action_clearbit": async ({ config, interpolate }) => {
    const token = config.api_key as string;
    const action = (config.action as string) || "enrich_person";
    if (!token) throw new Error("Clearbit API key is required");
    const auth = Buffer.from(`${token}:`).toString("base64");
    const hdrs = { Authorization: `Basic ${auth}` };
    if (action === "enrich_person") {
      const res = await fetch(`https://person.clearbit.com/v2/people/find?email=${encodeURIComponent(interpolate(config.email as string || ""))}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Clearbit ${res.status}`);
      return data;
    } else if (action === "enrich_company") {
      const res = await fetch(`https://company.clearbit.com/v2/companies/find?domain=${encodeURIComponent(interpolate(config.domain as string || ""))}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Clearbit ${res.status}`);
      return data;
    } else if (action === "find_company") {
      const res = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(interpolate(config.domain as string || ""))}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(`Clearbit ${res.status}`);
      return data;
    }
    return undefined;
  },

  "action_hunter": async ({ config, interpolate }) => {
    const token = config.api_key as string;
    const action = (config.action as string) || "find_email";
    if (!token) throw new Error("Hunter.io API key is required");
    if (action === "find_email") {
      const url = `https://api.hunter.io/v2/email-finder?domain=${encodeURIComponent(config.domain as string || "")}&first_name=${encodeURIComponent(interpolate(config.first_name as string || ""))}&last_name=${encodeURIComponent(interpolate(config.last_name as string || ""))}&api_key=${token}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.errors?.[0]?.details || `Hunter ${res.status}`);
      return data.data;
    } else if (action === "verify_email") {
      const res = await fetch(`https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(interpolate(config.email as string || ""))}&api_key=${token}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.errors?.[0]?.details || `Hunter ${res.status}`);
      return data.data;
    } else if (action === "domain_search") {
      const res = await fetch(`https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(config.domain as string || "")}&api_key=${token}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.errors?.[0]?.details || `Hunter ${res.status}`);
      return data.data;
    }
    return undefined;
  },

  "action_pipedrive": async ({ config, interpolate }) => {
    const token = config.api_key as string;
    const action = (config.action as string) || "create_deal";
    if (!token) throw new Error("Pipedrive API token is required");
    const base = `https://api.pipedrive.com/v1`;
    const auth = `api_token=${token}`;
    const hdrs = { "Content-Type": "application/json" };
    if (action === "create_deal") {
      const body: Record<string, unknown> = { title: interpolate(config.title as string || "New Deal") };
      if (config.value) body.value = config.value;
      if (config.currency) body.currency = config.currency;
      const res = await fetch(`${base}/deals?${auth}`, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Pipedrive ${res.status}`);
      return data.data;
    } else if (action === "create_person") {
      const body: Record<string, unknown> = { name: interpolate(config.name as string || "") };
      if (config.email) body.email = [{ value: interpolate(config.email as string), primary: true }];
      if (config.phone) body.phone = [{ value: config.phone, primary: true }];
      const res = await fetch(`${base}/persons?${auth}`, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Pipedrive ${res.status}`);
      return data.data;
    } else if (action === "create_organization") {
      const body = { name: interpolate(config.name as string || "") };
      const res = await fetch(`${base}/organizations?${auth}`, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Pipedrive ${res.status}`);
      return data.data;
    } else if (action === "update_deal") {
      const body: Record<string, unknown> = {};
      if (config.title) body.title = interpolate(config.title as string);
      const res = await fetch(`${base}/deals/${config.record_id}?${auth}`, { method: "PUT", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Pipedrive ${res.status}`);
      return data.data;
    } else if (action === "search_persons") {
      const res = await fetch(`${base}/persons/search?${auth}&term=${encodeURIComponent(config.email as string || "")}`, { headers: hdrs });
      const data = await res.json();
      return data.data?.items || [];
    }
    return undefined;
  },
};
