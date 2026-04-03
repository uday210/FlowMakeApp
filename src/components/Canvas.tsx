"use client";

import { useCallback, useRef, useEffect, createContext, useContext } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  EdgeLabelRenderer,
  type Node,
  type Edge,
  type Connection,
  type OnConnect,
  BackgroundVariant,
  getBezierPath,
  type EdgeProps,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { v4 as uuidv4 } from "uuid";
import BaseNode from "./nodes/BaseNode";
import StickyNoteNode from "./nodes/StickyNoteNode";
import type { NodeData, NodeType } from "@/lib/types";
import { NODE_DEF_MAP } from "@/lib/nodeDefinitions";

// ─── Node status context (populated after Run Once) ──────────────────────────

const NodeStatusCtx = createContext<Record<string, string>>({});

// ─── Make.com-style animated dotted edge ─────────────────────────────────────

function MakeEdge({
  id, source, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, selected,
  markerEnd,
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  const nodeStatuses = useContext(NodeStatusCtx);
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const sourceStatus = nodeStatuses[source];
  const hasRun = Object.keys(nodeStatuses).length > 0;
  const isSuccess = hasRun && sourceStatus === "success";
  const isError   = hasRun && sourceStatus === "error";
  const isSkipped = hasRun && !sourceStatus;

  // When a run has happened, completed edges become solid — no animation
  const strokeColor = selected ? "#7c3aed"
    : isSuccess ? "#4ade80"   // green-400 — softer than pure green
    : isError   ? "#f87171"   // red-400
    : "#cbd5e1";              // default gray

  const arrowFill = selected ? "#7c3aed"
    : isSuccess ? "#4ade80"
    : isError   ? "#f87171"
    : "#94a3b8";

  return (
    <>
      {/* Selection glow */}
      {selected && (
        <path d={edgePath} fill="none" stroke="#7c3aed" strokeWidth={8} strokeOpacity={0.12} strokeLinecap="round" />
      )}
      {/* Wider invisible hit area */}
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={12} />
      {/* Main edge line */}
      <path
        d={edgePath} fill="none"
        stroke={strokeColor}
        strokeWidth={isSuccess || isError ? 2.5 : 2}
        strokeLinecap="round"
        style={{ opacity: isSkipped ? 0.3 : 1 }}
      />
      {/* Animated dashes — only shown when no run result yet */}
      {!hasRun && (
        <path
          d={edgePath} fill="none"
          stroke={selected ? "#7c3aed" : "#94a3b8"}
          strokeWidth={2.5} strokeLinecap="round"
          strokeDasharray="6 16"
          style={{ animation: "makeEdgeDash 1.2s linear infinite" }}
        />
      )}
      {markerEnd && (
        <defs>
          <marker id={`arrow-${id}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill={arrowFill} />
          </marker>
        </defs>
      )}
      {/* Delete button at midpoint */}
      <EdgeLabelRenderer>
        <div
          className="edge-delete-btn nodrag nopan"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEdges((eds) => eds.filter((e) => e.id !== id));
            }}
            title="Delete connection"
            style={{
              width: 18, height: 18, borderRadius: "50%",
              background: selected ? "#7c3aed" : "#e2e8f0",
              border: selected ? "1.5px solid #6d28d9" : "1.5px solid #cbd5e1",
              color: selected ? "#fff" : "#64748b",
              fontSize: 10, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              lineHeight: 1,
              opacity: selected ? 1 : 0,
              transition: "opacity 0.15s, background 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
            onMouseLeave={(e) => { if (!selected) (e.currentTarget as HTMLButtonElement).style.opacity = "0"; }}
          >
            ×
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const NODE_TYPES = { workflowNode: BaseNode, stickyNote: StickyNoteNode };
const EDGE_TYPES = { makeEdge: MakeEdge };

const DEFAULT_EDGE_OPTIONS: Partial<Edge> = {
  type: "makeEdge",
  animated: false,
};

// ─── Canvas ───────────────────────────────────────────────────────────────────

interface CanvasProps {
  initialNodes: Node[];
  initialEdges: Edge[];
  onNodesChange?: (nodes: Node[]) => void;
  onEdgesChange?: (edges: Edge[]) => void;
  onNodeSelect?: (node: Node | null) => void;
  nodeDataPatch?: { nodeId: string; data: Partial<NodeData> } | null;
  onNodePatchApplied?: () => void;
  /** Keyed by node_id → "success" | "error" | "skipped". Pass {} to reset. */
  nodeStatuses?: Record<string, string>;
  /** When version increments, Canvas replaces its internal state with these nodes/edges */
  externalInject?: { nodes: Node[]; edges: Edge[]; version: number } | null;
}

export default function Canvas({
  initialNodes,
  initialEdges,
  onNodesChange,
  onEdgesChange,
  onNodeSelect,
  nodeDataPatch,
  onNodePatchApplied,
  nodeStatuses = {},
  externalInject,
}: CanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const lastInjectedVersion = useRef(-1);

  const [nodes, setNodes, onNodesChangeInternal] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState(
    initialEdges.map((e) => ({ ...e, type: e.type ?? "makeEdge" }))
  );

  // External inject: when version increments, replace internal state
  useEffect(() => {
    if (!externalInject) return;
    if (externalInject.version === lastInjectedVersion.current) return;
    lastInjectedVersion.current = externalInject.version;
    setNodes(externalInject.nodes.map(n => ({ ...n, type: n.type ?? "workflowNode" })));
    setEdges(externalInject.edges.map(e => ({ ...e, type: e.type ?? "makeEdge" })));
  }, [externalInject]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!nodeDataPatch) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeDataPatch.nodeId ? { ...n, data: { ...n.data, ...nodeDataPatch.data } } : n
      )
    );
    onNodePatchApplied?.();
  }, [nodeDataPatch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { onNodesChange?.(nodes); }, [nodes]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { onEdgesChange?.(edges); }, [edges]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Copy / Paste (Ctrl+C / Ctrl+V) ─────────────────────────────────────────
  const clipboardNodes = useRef<Node[]>([]);
  const clipboardEdges = useRef<Edge[]>([]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore when typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        const selected = nodes.filter((n) => n.selected);
        if (selected.length === 0) return;
        const selectedIds = new Set(selected.map((n) => n.id));
        clipboardNodes.current = selected;
        // Copy edges that connect two selected nodes
        clipboardEdges.current = edges.filter(
          (e) => selectedIds.has(e.source) && selectedIds.has(e.target)
        );
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        if (clipboardNodes.current.length === 0) return;
        const OFFSET = 40;
        const idMap: Record<string, string> = {};
        const newNodes = clipboardNodes.current.map((n) => {
          const newId = uuidv4();
          idMap[n.id] = newId;
          return {
            ...n,
            id: newId,
            selected: false,
            position: { x: n.position.x + OFFSET, y: n.position.y + OFFSET },
          };
        });
        const newEdges = clipboardEdges.current.map((e) => ({
          ...e,
          id: uuidv4(),
          type: e.type ?? "makeEdge",
          source: idMap[e.source] ?? e.source,
          target: idMap[e.target] ?? e.target,
        }));
        setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), ...newNodes]);
        setEdges((eds) => [...eds, ...newEdges]);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nodes, edges, setNodes, setEdges]);

  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, type: "makeEdge", animated: false }, eds));
    },
    [setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => { onNodeSelect?.(node); }, [onNodeSelect]);
  const onPaneClick = useCallback(() => { onNodeSelect?.(null); }, [onNodeSelect]);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const nodeType = e.dataTransfer.getData("application/nodeType") as NodeType;
      if (!nodeType || !reactFlowWrapper.current) return;
      const def = NODE_DEF_MAP[nodeType];
      if (!def) return;
      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = { x: e.clientX - bounds.left - 55, y: e.clientY - bounds.top - 55 };
      const newNode: Node = {
        id: uuidv4(),
        type: nodeType === "sticky_note" ? "stickyNote" : "workflowNode",
        position,
        data: {
          label: def.label,
          type: nodeType,
          config: { ...def.defaultConfig },
          status: "idle",
        } satisfies NodeData,
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  return (
    <NodeStatusCtx.Provider value={nodeStatuses}>
      <div ref={reactFlowWrapper} className="flex-1 h-full">
        {/* CSS for edge animation */}
        <style>{`
          @keyframes makeEdgeDash {
            from { stroke-dashoffset: 22; }
            to   { stroke-dashoffset: 0; }
          }
          .react-flow__handle {
            transition: transform 0.15s;
          }
          .react-flow__handle:hover {
            transform: scale(1.4);
          }
          .react-flow__node {
            filter: drop-shadow(0 2px 6px rgba(0,0,0,0.10));
          }
          .react-flow__node.selected {
            filter: drop-shadow(0 4px 16px rgba(124,58,237,0.25));
          }
        `}</style>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChangeInternal}
          onEdgesChange={onEdgesChangeInternal}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
          fitView
          fitViewOptions={{ padding: 0.4 }}
          deleteKeyCode="Backspace"
          minZoom={0.3}
          maxZoom={2}
          className="bg-[#f8f9fc]"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={28}
            size={1.2}
            color="#d4d8e2"
          />
          <Controls
            className="!bg-white !shadow-md !rounded-xl !border !border-gray-200"
            showInteractive={false}
          />
          <Panel position="bottom-center">
            <div className="text-[10px] text-gray-400 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
              Drag from sidebar to add · Click node to configure · Ctrl+C/V to copy/paste · Backspace to delete
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </NodeStatusCtx.Provider>
  );
}
