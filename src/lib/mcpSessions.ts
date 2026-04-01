/**
 * mcpSessions.ts — In-memory SSE session store for hosted MCP servers.
 * Uses globalThis to survive Next.js hot-reload in development.
 */

export interface McpSession {
  send: (event: string, data: string) => void;
  orgId: string;
  serverId: string;
  slug: string;
  createdAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __mcpSessions: Map<string, McpSession> | undefined;
}

if (!globalThis.__mcpSessions) {
  globalThis.__mcpSessions = new Map<string, McpSession>();
}

export const mcpSessions = globalThis.__mcpSessions;

/** Prune sessions older than 10 minutes */
export function pruneOldSessions() {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [id, session] of mcpSessions) {
    if (session.createdAt < cutoff) mcpSessions.delete(id);
  }
}
