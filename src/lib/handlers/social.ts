import type { NodeHandler } from "./types";

export const handlers: Record<string, NodeHandler> = {
  "action_twitter": async ({ config, interpolate }) => {
    const bearerToken = config.bearer_token as string;
    const action = (config.action as string) || "create_tweet";
    if (!bearerToken) throw new Error("Twitter Bearer Token is required");
    const hdrs = { Authorization: `Bearer ${bearerToken}`, "Content-Type": "application/json" };
    if (action === "create_tweet") {
      const res = await fetch("https://api.twitter.com/2/tweets", { method: "POST", headers: hdrs, body: JSON.stringify({ text: interpolate(config.text as string || "") }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Twitter ${res.status}`);
      return data.data;
    } else if (action === "get_user") {
      const res = await fetch(`https://api.twitter.com/2/users/by/username/${config.username}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Twitter ${res.status}`);
      return data.data;
    } else if (action === "search_tweets") {
      const res = await fetch(`https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(config.query as string || "")}&max_results=10`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Twitter ${res.status}`);
      return data;
    }
    return undefined;
  },

  "action_linkedin": async ({ config, interpolate }) => {
    const token = config.access_token as string;
    const action = (config.action as string) || "create_post";
    if (!token) throw new Error("LinkedIn access token is required");
    const hdrs = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    if (action === "get_profile") {
      const res = await fetch("https://api.linkedin.com/v2/userinfo", { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `LinkedIn ${res.status}`);
      return data;
    } else if (action === "create_post") {
      // Get author urn first
      const meRes = await fetch("https://api.linkedin.com/v2/userinfo", { headers: hdrs });
      const me = await meRes.json();
      const urn = `urn:li:person:${me.sub}`;
      const body = { author: urn, lifecycleState: "PUBLISHED", specificContent: { "com.linkedin.ugc.ShareContent": { shareCommentary: { text: interpolate(config.text as string || "") }, shareMediaCategory: "NONE" } }, visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" } };
      const res = await fetch("https://api.linkedin.com/v2/ugcPosts", { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `LinkedIn ${res.status}`);
      return data;
    }
    return undefined;
  },

  "action_youtube": async ({ config }) => {
    const apiKey = config.api_key as string;
    const action = (config.action as string) || "get_video";
    if (!apiKey) throw new Error("YouTube API key is required");
    const base = "https://www.googleapis.com/youtube/v3";
    if (action === "get_video") {
      const res = await fetch(`${base}/videos?part=snippet,statistics&id=${config.video_id}&key=${apiKey}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `YouTube ${res.status}`);
      return data.items?.[0];
    } else if (action === "search_videos") {
      const res = await fetch(`${base}/search?part=snippet&q=${encodeURIComponent(config.query as string || "")}&maxResults=${config.max_results || 10}&type=video&key=${apiKey}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `YouTube ${res.status}`);
      return data.items;
    } else if (action === "get_channel") {
      const res = await fetch(`${base}/channels?part=snippet,statistics&id=${config.channel_id}&key=${apiKey}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `YouTube ${res.status}`);
      return data.items?.[0];
    }
    return undefined;
  },
};
