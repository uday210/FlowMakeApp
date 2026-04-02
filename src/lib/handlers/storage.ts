import type { NodeHandler } from "./types";
import { getGoogleAccessToken } from "./googleAuth";

export const handlers: Record<string, NodeHandler> = {
  "action_google_drive": async ({ config }) => {
    const accessToken = await getGoogleAccessToken(config, "https://www.googleapis.com/auth/drive");
    const action = config.action as string;
    const driveHeaders = { Authorization: `Bearer ${accessToken}` };
    if (action === "list") {
      const folderId = config.folder_id as string;
      const q = folderId ? `'${folderId}' in parents and trashed = false` : "trashed = false";
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size,modifiedTime)`, { headers: driveHeaders });
      if (!res.ok) throw new Error(`Drive list ${res.status}`);
      const d = await res.json();
      return { files: d.files, count: d.files?.length ?? 0 };
    } else if (action === "upload") {
      const fileName = config.file_name as string || "file.txt";
      const content = config.file_content as string || "";
      const mimeType = config.mime_type as string || "text/plain";
      const meta = JSON.stringify({ name: fileName, ...(config.folder_id ? { parents: [config.folder_id] } : {}) });
      const form = new FormData();
      form.append("metadata", new Blob([meta], { type: "application/json" }));
      form.append("file", new Blob([content], { type: mimeType }));
      const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST", headers: driveHeaders, body: form,
      });
      if (!res.ok) throw new Error(`Drive upload ${res.status}`);
      const d = await res.json();
      return { id: d.id, name: d.name, mimeType: d.mimeType };
    } else if (action === "get") {
      const fileId = config.file_id as string;
      if (!fileId) throw new Error("File ID is required");
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,modifiedTime,webViewLink`, { headers: driveHeaders });
      if (!res.ok) throw new Error(`Drive get ${res.status}`);
      return await res.json();
    } else if (action === "download") {
      const fileId = config.file_id as string;
      if (!fileId) throw new Error("File ID is required");
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers: driveHeaders });
      if (!res.ok) throw new Error(`Drive download ${res.status}`);
      const content = await res.text();
      return { file_id: fileId, content };
    } else if (action === "delete") {
      const fileId = config.file_id as string;
      if (!fileId) throw new Error("File ID is required");
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, { method: "DELETE", headers: driveHeaders });
      return { deleted: true, file_id: fileId };
    } else if (action === "create_folder") {
      const folderName = config.file_name as string || "New Folder";
      const meta = JSON.stringify({ name: folderName, mimeType: "application/vnd.google-apps.folder", ...(config.folder_id ? { parents: [config.folder_id] } : {}) });
      const res = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST", headers: { ...driveHeaders, "Content-Type": "application/json" }, body: meta,
      });
      if (!res.ok) throw new Error(`Drive create folder ${res.status}`);
      const d = await res.json();
      return { id: d.id, name: d.name, mimeType: d.mimeType };
    } else if (action === "copy") {
      const fileId = config.file_id as string;
      if (!fileId) throw new Error("File ID is required");
      const copyName = config.file_name as string || undefined;
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/copy`, {
        method: "POST", headers: { ...driveHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ ...(copyName ? { name: copyName } : {}), ...(config.folder_id ? { parents: [config.folder_id] } : {}) }),
      });
      if (!res.ok) throw new Error(`Drive copy ${res.status}`);
      const d = await res.json();
      return { id: d.id, name: d.name, mimeType: d.mimeType };
    } else if (action === "share") {
      const fileId = config.file_id as string;
      if (!fileId) throw new Error("File ID is required");
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
        method: "POST", headers: { ...driveHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ role: "reader", type: "anyone" }),
      });
      if (!res.ok) throw new Error(`Drive share ${res.status}`);
      const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink,webContentLink`, { headers: driveHeaders });
      const meta = await metaRes.json();
      return { shared: true, file_id: fileId, web_view_link: meta.webViewLink };
    }
    return undefined;
  },

  "action_s3": async ({ config }) => {
    const accessKeyId = config.access_key_id as string;
    const secretAccessKey = config.secret_access_key as string;
    const region = (config.region as string) || "us-east-1";
    const bucket = config.bucket as string;
    const action = config.action as string;
    const key = config.key as string;
    if (!accessKeyId || !secretAccessKey || !bucket) throw new Error("Access key, secret, and bucket are required");
    const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = await import("@aws-sdk/client-s3");
    const s3 = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
    if (action === "put") {
      const body = config.body as string || "";
      const contentType = (config.content_type as string) || "text/plain";
      if (!key) throw new Error("Object key is required");
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
      return { uploaded: true, bucket, key };
    } else if (action === "get") {
      if (!key) throw new Error("Object key is required");
      const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const body = await res.Body?.transformToString();
      return { bucket, key, body, content_type: res.ContentType };
    } else if (action === "delete") {
      if (!key) throw new Error("Object key is required");
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      return { deleted: true, bucket, key };
    } else if (action === "list") {
      const res = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: key || undefined }));
      return { objects: res.Contents?.map((o) => ({ key: o.Key, size: o.Size, last_modified: o.LastModified })) ?? [], count: res.KeyCount ?? 0 };
    }
    return undefined;
  },

  "action_dropbox": async ({ config, interpolate }) => {
    const token = config.access_token as string;
    const action = (config.action as string) || "upload_file";
    if (!token) throw new Error("Dropbox access token is required");
    const hdrs = { Authorization: `Bearer ${token}` };
    if (action === "upload_file") {
      const content = interpolate(config.content as string || "");
      const res = await fetch("https://content.dropboxapi.com/2/files/upload", { method: "POST", headers: { ...hdrs, "Content-Type": "application/octet-stream", "Dropbox-API-Arg": JSON.stringify({ path: config.path, mode: config.mode || "add", autorename: true }) }, body: content });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error_summary || `Dropbox ${res.status}`);
      return data;
    } else if (action === "get_metadata") {
      const res = await fetch("https://api.dropboxapi.com/2/files/get_metadata", { method: "POST", headers: { ...hdrs, "Content-Type": "application/json" }, body: JSON.stringify({ path: config.path }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error_summary || `Dropbox ${res.status}`);
      return data;
    } else if (action === "list_folder") {
      const res = await fetch("https://api.dropboxapi.com/2/files/list_folder", { method: "POST", headers: { ...hdrs, "Content-Type": "application/json" }, body: JSON.stringify({ path: config.path || "" }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error_summary || `Dropbox ${res.status}`);
      return data.entries;
    } else if (action === "delete") {
      const res = await fetch("https://api.dropboxapi.com/2/files/delete_v2", { method: "POST", headers: { ...hdrs, "Content-Type": "application/json" }, body: JSON.stringify({ path: config.path }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error_summary || `Dropbox ${res.status}`);
      return data;
    }
    return undefined;
  },

  "action_onedrive": async ({ config, interpolate }) => {
    const token = config.access_token as string;
    const action = (config.action as string) || "upload_file";
    if (!token) throw new Error("OneDrive access token is required");
    const hdrs = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const base = "https://graph.microsoft.com/v1.0/me/drive";
    if (action === "upload_file") {
      const content = interpolate(config.content as string || "");
      const path = config.path as string;
      const res = await fetch(`${base}/root:${path}:/content`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "text/plain" }, body: content });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `OneDrive ${res.status}`);
      return data;
    } else if (action === "get_file") {
      const itemId = config.item_id as string;
      const res = await fetch(`${base}/items/${itemId}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `OneDrive ${res.status}`);
      return data;
    } else if (action === "list_children") {
      const path = config.path as string;
      const res = await fetch(`${base}/root:${path}:/children`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `OneDrive ${res.status}`);
      return data.value;
    } else if (action === "delete_item") {
      const res = await fetch(`${base}/items/${config.item_id}`, { method: "DELETE", headers: hdrs });
      return { deleted: res.ok };
    }
    return undefined;
  },

  "action_cloudinary": async ({ config, interpolate }) => {
    const cloudName = config.cloud_name as string;
    const apiKey = config.api_key as string;
    const apiSecret = config.api_secret as string;
    const action = (config.action as string) || "upload";
    if (!cloudName || !apiKey || !apiSecret) throw new Error("Cloudinary cloud name, API key, and secret are required");
    if (action === "upload") {
      const timestamp = Math.floor(Date.now() / 1000);
      const sigStr = `timestamp=${timestamp}${apiSecret}`;
      const sigBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sigStr));
      const signature = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
      const form = new FormData();
      form.append("file", interpolate(config.file as string || ""));
      form.append("timestamp", String(timestamp));
      form.append("api_key", apiKey);
      form.append("signature", signature);
      if (config.public_id) form.append("public_id", config.public_id as string);
      if (config.folder) form.append("folder", config.folder as string);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Cloudinary ${res.status}`);
      return data;
    } else if (action === "get_resource") {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload/${config.public_id}`, { headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Cloudinary ${res.status}`);
      return data;
    } else if (action === "delete_resource") {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload`, { method: "DELETE", headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`, "Content-Type": "application/json" }, body: JSON.stringify({ public_ids: [config.public_id] }) });
      const data = await res.json();
      return data;
    }
    return undefined;
  },

  "action_box": async ({ config, interpolate }) => {
    const token = config.access_token as string;
    const action = (config.action as string) || "upload_file";
    if (!token) throw new Error("Box access token is required");
    const hdrs = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const base = "https://api.box.com/2.0";
    if (action === "upload_file") {
      const form = new FormData();
      form.append("attributes", JSON.stringify({ name: config.file_name || "file.txt", parent: { id: config.folder_id || "0" } }));
      form.append("file", new Blob([interpolate(config.content as string || "")], { type: "text/plain" }), config.file_name as string || "file.txt");
      const res = await fetch("https://upload.box.com/api/2.0/files/content", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Box ${res.status}`);
      return data.entries?.[0];
    } else if (action === "get_file") {
      const res = await fetch(`${base}/files/${config.file_id}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Box ${res.status}`);
      return data;
    } else if (action === "list_folder") {
      const res = await fetch(`${base}/folders/${config.folder_id || "0"}/items`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Box ${res.status}`);
      return data.entries;
    } else if (action === "delete_file") {
      const res = await fetch(`${base}/files/${config.file_id}`, { method: "DELETE", headers: hdrs });
      return { deleted: res.ok };
    }
    return undefined;
  },
};
