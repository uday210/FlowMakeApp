import type { NodeHandler } from "./types";

export const handlers: Record<string, NodeHandler> = {
  "action_mixpanel": async ({ config, interpolate }) => {
    const token = config.project_token as string;
    const action = (config.action as string) || "track_event";
    if (!token) throw new Error("Mixpanel project token is required");
    let props: Record<string, unknown> = {};
    try { props = JSON.parse(interpolate(config.properties as string || "{}")); } catch { /* ignore */ }
    if (action === "track_event") {
      const body = [{ event: interpolate(config.event as string || "Event"), properties: { token, distinct_id: interpolate(config.distinct_id as string || ""), ...props } }];
      const res = await fetch("https://api.mixpanel.com/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`Mixpanel ${res.status}`);
      return { tracked: true };
    } else if (action === "set_profile") {
      const body = [{ $token: token, $distinct_id: interpolate(config.distinct_id as string || ""), $set: props }];
      const res = await fetch("https://api.mixpanel.com/engage#profile-set", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return { updated: res.ok };
    }
    return undefined;
  },

  "action_amplitude": async ({ config, interpolate }) => {
    const apiKey = config.api_key as string;
    const action = (config.action as string) || "track_event";
    if (!apiKey) throw new Error("Amplitude API key is required");
    let eventProps: Record<string, unknown> = {};
    try { eventProps = JSON.parse(interpolate(config.event_properties as string || "{}")); } catch { /* ignore */ }
    let userProps: Record<string, unknown> = {};
    try { userProps = JSON.parse(interpolate(config.user_properties as string || "{}")); } catch { /* ignore */ }
    if (action === "track_event") {
      const event: Record<string, unknown> = { event_type: interpolate(config.event_type as string || "Event"), event_properties: eventProps };
      if (config.user_id) event.user_id = interpolate(config.user_id as string);
      if (config.device_id) event.device_id = config.device_id;
      if (Object.keys(userProps).length) event.user_properties = userProps;
      const res = await fetch("https://api2.amplitude.com/2/httpapi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ api_key: apiKey, events: [event] }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Amplitude ${res.status}`);
      return data;
    } else if (action === "identify") {
      const identification = { user_id: interpolate(config.user_id as string || ""), user_properties: { $set: userProps } };
      const res = await fetch(`https://api2.amplitude.com/identify?api_key=${apiKey}&identification=${encodeURIComponent(JSON.stringify(identification))}`, { method: "POST" });
      return { identified: res.ok };
    }
    return undefined;
  },

  "action_segment": async ({ config, interpolate }) => {
    const writeKey = config.write_key as string;
    const action = (config.action as string) || "track";
    if (!writeKey) throw new Error("Segment write key is required");
    const auth = Buffer.from(`${writeKey}:`).toString("base64");
    const hdrs = { Authorization: `Basic ${auth}`, "Content-Type": "application/json" };
    let props: Record<string, unknown> = {};
    try { props = JSON.parse(interpolate(config.properties as string || "{}")); } catch { /* ignore */ }
    const userId = interpolate(config.user_id as string || "");
    const anonId = config.anonymous_id as string;
    if (action === "track") {
      const body: Record<string, unknown> = { event: interpolate(config.event as string || "Event"), properties: props };
      if (userId) body.userId = userId; else body.anonymousId = anonId || "anon";
      const res = await fetch("https://api.segment.io/v1/track", { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      return { ok: res.ok };
    } else if (action === "identify") {
      const body: Record<string, unknown> = { traits: props };
      if (userId) body.userId = userId; else body.anonymousId = anonId || "anon";
      const res = await fetch("https://api.segment.io/v1/identify", { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      return { ok: res.ok };
    } else if (action === "page") {
      const body: Record<string, unknown> = { name: config.event as string, properties: props };
      if (userId) body.userId = userId; else body.anonymousId = anonId || "anon";
      const res = await fetch("https://api.segment.io/v1/page", { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      return { ok: res.ok };
    } else if (action === "group") {
      const body: Record<string, unknown> = { groupId: interpolate(config.event as string || ""), traits: props };
      if (userId) body.userId = userId;
      const res = await fetch("https://api.segment.io/v1/group", { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      return { ok: res.ok };
    }
    return undefined;
  },

  "action_posthog": async ({ config, interpolate }) => {
    const apiKey = config.api_key as string;
    const action = (config.action as string) || "capture";
    const host = (config.host as string || "https://app.posthog.com").replace(/\/$/, "");
    if (!apiKey) throw new Error("PostHog API key is required");
    let props: Record<string, unknown> = {};
    try { props = JSON.parse(interpolate(config.properties as string || "{}")); } catch { /* ignore */ }
    const distinctId = interpolate(config.distinct_id as string || "anon");
    if (action === "capture") {
      const body = { api_key: apiKey, event: interpolate(config.event as string || "Event"), distinct_id: distinctId, properties: props };
      const res = await fetch(`${host}/capture/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return { ok: res.ok };
    } else if (action === "identify") {
      const body = { api_key: apiKey, event: "$identify", distinct_id: distinctId, properties: { $set: props } };
      const res = await fetch(`${host}/capture/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return { ok: res.ok };
    }
    return undefined;
  },

  "action_google_analytics": async ({ config, interpolate }) => {
    const measurementId = config.measurement_id as string;
    const apiSecret = config.api_secret as string;
    if (!measurementId || !apiSecret) throw new Error("GA4 measurement ID and API secret are required");
    let params: Record<string, unknown> = {};
    try { params = JSON.parse(interpolate(config.params as string || "{}")); } catch { /* ignore */ }
    const body = { client_id: interpolate(config.client_id as string || "555"), events: [{ name: interpolate(config.event_name as string || "event"), params }] };
    const res = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { sent: true, status: res.status };
  },
};
