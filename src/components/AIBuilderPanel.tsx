"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { Node, Edge } from "@xyflow/react";
import {
  X, Send, Loader2, Sparkles, Trash2, Bot, User,
  Plus, Minus, GitMerge, Settings, Zap, CheckCircle2,
} from "lucide-react";

// ─── AG-UI Event Types ────────────────────────────────────────────────────────

interface AGUIEvent {
  type:
    | "RUN_STARTED" | "RUN_FINISHED" | "RUN_ERROR"
    | "TEXT_MESSAGE_START" | "TEXT_MESSAGE_CONTENT" | "TEXT_MESSAGE_END"
    | "TOOL_CALL_START" | "TOOL_CALL_END"
    | "STATE_DELTA";
  messageId?: string;
  role?: string;
  delta?: string | StateDelta;
  toolCallId?: string;
  toolName?: string;
  result?: string;
  error?: string;
  runId?: string;
}

interface StateDelta {
  nodes?: {
    add?: Node[];
    remove?: string[];
    update?: Array<{ id: string; data?: Partial<Node["data"]>; position?: Node["position"] }>;
  };
  edges?: {
    add?: Edge[];
    remove?: string[];
  };
}

// ─── Chat message types ───────────────────────────────────────────────────────

type ChatRole = "user" | "assistant" | "tool";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  toolName?: string;
  isStreaming?: boolean;
}

// ─── Tool call indicator ──────────────────────────────────────────────────────

const TOOL_ICONS: Record<string, React.ReactNode> = {
  add_node:       <Plus size={10} />,
  remove_node:    <Minus size={10} />,
  connect_nodes:  <GitMerge size={10} />,
  configure_node: <Settings size={10} />,
  clear_workflow: <Trash2 size={10} />,
};

const TOOL_LABELS: Record<string, string> = {
  add_node:       "Adding node",
  remove_node:    "Removing node",
  connect_nodes:  "Connecting nodes",
  configure_node: "Configuring node",
  clear_workflow: "Clearing workflow",
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  workflowId: string;
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (nodes: Node[]) => void;
  onEdgesChange: (edges: Edge[]) => void;
  onClose: () => void;
  onSave: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AIBuilderPanel({
  workflowId, nodes, edges, onNodesChange, onEdgesChange, onClose, onSave,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! Describe the automation you want to build and I'll create it on the canvas for you.\n\nExample: *\"When a Stripe payment comes in, send a Slack message and add a row to Google Sheets\"*",
    },
  ]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const [builtSinceLastSave, setBuiltSinceLastSave] = useState(false);
  const onSaveRef = useRef(onSave);
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

  // Keep a mutable ref of nodes/edges so tool execution sees latest state
  const nodesRef = useRef<Node[]>(nodes);
  const edgesRef = useRef<Edge[]>(edges);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Build conversation history (only user/assistant text messages)
  const buildHistory = useCallback(() => {
    return messages
      .filter(m => m.role === "user" || (m.role === "assistant" && !m.toolName))
      .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));
  }, [messages]);

  const applyDelta = useCallback((delta: StateDelta) => {
    let currentNodes = [...nodesRef.current];
    let currentEdges = [...edgesRef.current];

    // Handle nodes
    if (delta.nodes) {
      // If clear (both add and remove are empty arrays from clear_workflow)
      const isFullClear =
        delta.nodes.add !== undefined &&
        delta.nodes.remove !== undefined &&
        delta.nodes.add.length === 0 &&
        delta.nodes.remove.length === 0;

      if (isFullClear) {
        currentNodes = [];
        currentEdges = [];
      } else {
        // Add nodes
        for (const n of delta.nodes.add ?? []) {
          if (!currentNodes.find(existing => existing.id === n.id)) {
            currentNodes.push({ ...n, type: "workflowNode" });
          }
        }
        // Remove nodes
        for (const id of delta.nodes.remove ?? []) {
          currentNodes = currentNodes.filter(n => n.id !== id);
        }
        // Update nodes
        for (const upd of delta.nodes.update ?? []) {
          currentNodes = currentNodes.map(n =>
            n.id === upd.id
              ? { ...n, ...(upd.position ? { position: upd.position } : {}), data: { ...n.data, ...(upd.data ?? {}) } }
              : n
          );
        }
      }
    }

    // Handle edges
    if (delta.edges) {
      for (const e of delta.edges.add ?? []) {
        if (!currentEdges.find(existing => existing.id === e.id)) {
          currentEdges.push({ ...e, type: "makeEdge" });
        }
      }
      for (const id of delta.edges.remove ?? []) {
        currentEdges = currentEdges.filter(e => e.id !== id);
      }
    }

    nodesRef.current = currentNodes;
    edgesRef.current = currentEdges;
    onNodesChange(currentNodes);
    onEdgesChange(currentEdges);
  }, [onNodesChange, onEdgesChange]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || running) return;

    const userMsgId = crypto.randomUUID();
    setMessages(prev => [...prev, { id: userMsgId, role: "user", content: text.trim() }]);
    setInput("");
    setRunning(true);

    try {
      const res = await fetch(`/api/workflows/${workflowId}/ai-builder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...buildHistory(), { role: "user", content: text.trim() }],
          nodes: nodesRef.current,
          edges: edgesRef.current,
        }),
      });

      if (!res.ok || !res.body) {
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(), role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        }]);
        setRunning(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      // Map from messageId → index in messages array
      const streamingMsgs: Record<string, string> = {};
      const toolMsgIds: Record<string, string> = {};

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          let event: AGUIEvent;
          try { event = JSON.parse(line.slice(6)); } catch { continue; }

          switch (event.type) {
            case "TEXT_MESSAGE_START": {
              const mid = event.messageId!;
              streamingMsgs[mid] = "";
              setMessages(prev => [...prev, {
                id: mid, role: "assistant", content: "", isStreaming: true,
              }]);
              break;
            }

            case "TEXT_MESSAGE_CONTENT": {
              const mid = event.messageId!;
              const chunk = event.delta as string;
              streamingMsgs[mid] = (streamingMsgs[mid] ?? "") + chunk;
              setMessages(prev => prev.map(m =>
                m.id === mid ? { ...m, content: streamingMsgs[mid] } : m
              ));
              break;
            }

            case "TEXT_MESSAGE_END": {
              const mid = event.messageId!;
              setMessages(prev => prev.map(m =>
                m.id === mid ? { ...m, isStreaming: false } : m
              ));
              break;
            }

            case "TOOL_CALL_START": {
              const toolMsgId = crypto.randomUUID();
              toolMsgIds[event.toolCallId!] = toolMsgId;
              setActiveTools(prev => [...prev, event.toolCallId!]);
              setMessages(prev => [...prev, {
                id: toolMsgId, role: "tool",
                toolName: event.toolName,
                content: TOOL_LABELS[event.toolName!] ?? event.toolName ?? "Tool call",
                isStreaming: true,
              }]);
              break;
            }

            case "TOOL_CALL_END": {
              const toolMsgId = toolMsgIds[event.toolCallId!];
              setActiveTools(prev => prev.filter(t => t !== event.toolCallId));
              if (toolMsgId) {
                setMessages(prev => prev.map(m =>
                  m.id === toolMsgId ? { ...m, isStreaming: false, content: event.result ?? m.content } : m
                ));
              }
              break;
            }

            case "STATE_DELTA": {
              applyDelta(event.delta as StateDelta);
              break;
            }

            case "RUN_FINISHED": {
              // Auto-save so the workflow can be Run immediately
              setTimeout(() => {
                onSaveRef.current();
                setBuiltSinceLastSave(true);
                // Hide the "Saved" badge after 3 seconds
                setTimeout(() => setBuiltSinceLastSave(false), 3000);
              }, 300);
              break;
            }

            case "RUN_ERROR": {
              setMessages(prev => [...prev, {
                id: crypto.randomUUID(), role: "assistant",
                content: `Error: ${event.error ?? "Unknown error"}`,
              }]);
              break;
            }
          }
        }
      }
    } catch {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: "assistant",
        content: "Connection error. Please try again.",
      }]);
    } finally {
      setRunning(false);
      setActiveTools([]);
    }
  }, [running, workflowId, buildHistory, applyDelta]);

  const clearChat = () => {
    setMessages([{
      id: "welcome",
      role: "assistant",
      content: "Chat cleared. Describe a new automation to build!",
    }]);
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col overflow-hidden flex-shrink-0 shadow-xl">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-violet-600 to-violet-700 flex-shrink-0">
        <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <Sparkles size={14} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white">AI Scenario Builder</p>
          <p className="text-xs text-violet-200">Powered by AG-UI Protocol</p>
        </div>
        {builtSinceLastSave && (
          <div className="flex items-center gap-0.5 text-xs text-green-300 font-medium animate-fade-in">
            <CheckCircle2 size={10} className="text-green-300" />
            Saved
          </div>
        )}
        <button
          onClick={clearChat}
          className="p-1 text-white/60 hover:text-white transition-colors rounded"
          title="Clear chat"
        >
          <Trash2 size={12} />
        </button>
        <button
          onClick={onClose}
          className="p-1 text-white/60 hover:text-white transition-colors rounded"
        >
          <X size={14} />
        </button>
      </div>

      {/* Active tool indicator */}
      {activeTools.length > 0 && (
        <div className="px-3 py-1.5 bg-violet-50 border-b border-violet-100 flex items-center gap-1.5 flex-shrink-0">
          <Zap size={10} className="text-violet-500 animate-pulse" />
          <span className="text-xs text-violet-600 font-medium">Building on canvas…</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.map(msg => (
          <div key={msg.id}>
            {msg.role === "tool" ? (
              <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all ${
                msg.isStreaming
                  ? "bg-violet-50 text-violet-600 border border-violet-100"
                  : "bg-gray-50 text-gray-500 border border-gray-100"
              }`}>
                <span className={`${msg.isStreaming ? "text-violet-500 animate-pulse" : "text-gray-400"}`}>
                  {TOOL_ICONS[msg.toolName ?? ""] ?? <Settings size={10} />}
                </span>
                <span className="truncate">{msg.content}</span>
                {msg.isStreaming && (
                  <Loader2 size={9} className="animate-spin text-violet-400 ml-auto flex-shrink-0" />
                )}
              </div>
            ) : (
              <div className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"} items-end`}>
                {/* Avatar */}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mb-0.5 ${
                  msg.role === "user" ? "bg-gray-200" : "bg-violet-100"
                }`}>
                  {msg.role === "user"
                    ? <User size={10} className="text-gray-600" />
                    : <Bot size={10} className="text-violet-600" />
                  }
                </div>

                {/* Bubble */}
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-violet-600 text-white rounded-br-sm"
                    : "bg-gray-100 text-gray-800 rounded-bl-sm"
                }`}>
                  {msg.content || (msg.isStreaming ? <span className="flex gap-0.5 py-0.5">{[0,1,2].map(i => <span key={i} className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />)}</span> : "")}
                  {msg.isStreaming && msg.content && (
                    <span className="inline-block w-0.5 h-3 bg-violet-400 ml-0.5 animate-pulse align-middle" />
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-2 border-t border-gray-100 flex-shrink-0">
        <div className="bg-gray-50 rounded-xl border border-gray-200 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100 transition-all">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="Describe your automation… (Enter to send)"
            disabled={running}
            rows={3}
            className="w-full text-xs px-3 pt-2.5 pb-1 bg-transparent outline-none resize-none text-gray-700 placeholder-gray-400 disabled:opacity-60"
          />
          <div className="flex items-center justify-between px-2 pb-2">
            <span className="text-xs text-gray-400">Shift+Enter for new line</span>
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || running}
              className="flex items-center gap-1 px-2.5 py-1 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-40 transition-all"
            >
              {running
                ? <><Loader2 size={9} className="animate-spin" /> Building…</>
                : <><Send size={9} /> Send</>
              }
            </button>
          </div>
        </div>

        {/* Quick prompts */}
        {messages.length <= 1 && (
          <div className="mt-2 space-y-1">
            {[
              "Webhook → send Slack message",
              "New Stripe payment → add Google Sheets row",
              "Schedule daily → send email report",
            ].map(p => (
              <button
                key={p}
                onClick={() => sendMessage(p)}
                disabled={running}
                className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors border border-violet-100 disabled:opacity-50 truncate"
              >
                ✦ {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
