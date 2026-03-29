"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { NodeData } from "@/lib/types";
import { NODE_DEF_MAP } from "@/lib/nodeDefinitions";
import {
  Play, Globe, Clock, ArrowUpRight, Mail, MessageSquare,
  Hash, Send, Sparkles, Timer, Filter, Braces,
  GitBranch, BookOpen, Table2, Phone, MailCheck, Rss,
  CalendarDays, Calculator, Bot, Sheet,
  RefreshCw, CreditCard, ClipboardList, MailOpen, Cloud,
  PenLine, CheckCircle, XCircle, Loader2,
  Repeat2, Variable, Layers, Reply, GitMerge,
  Code2, Type, Database, HardDrive, MessageCircle,
  CheckSquare, Bell, ImageIcon, BotMessageSquare, Plug,
  DatabaseZap, Leaf, Zap, Radio, Wifi, Server, SearchCode,
  FileCode, Lock, KeyRound, FileText, Image, QrCode,
  Wind, Mic, Binary, Terminal, FolderUp, Plus, MessageSquareReply,
} from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Play, Globe, Clock, ArrowUpRight, Mail, MessageSquare,
  Hash, Send, Sparkles, Timer, Filter, Braces,
  GitBranch, BookOpen, Table2, Phone, MailCheck, Rss,
  CalendarDays, Calculator, Bot, Sheet,
  RefreshCw, CreditCard, ClipboardList, MailOpen, Cloud,
  PenLine,
  Repeat2, Variable, Layers, Reply, GitMerge,
  Code2, Type, Database, HardDrive, MessageCircle,
  CheckSquare, Bell, ImageIcon, BotMessageSquare, Plug,
  DatabaseZap, Leaf, Zap, Radio, Wifi, Server, SearchCode,
  FileCode, Lock, KeyRound, FileText, Image, QrCode,
  Wind, Mic, Binary, Terminal, FolderUp, Plus, MessageSquareReply,
};

export default function BaseNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as NodeData;
  const def = NODE_DEF_MAP[nodeData.type];
  if (!def) return null;

  const IconComponent = ICONS[def.icon as keyof typeof ICONS] || Play;
  const isTrigger = def.category === "trigger";

  const isRunning = nodeData.status === "running";
  const isSuccess = nodeData.status === "success";
  const isError = nodeData.status === "error";

  // Lighten the color slightly for background circle
  const circleColor = def.color;

  return (
    <div
      className="flex flex-col items-center select-none cursor-pointer group"
      style={{ width: 110 }}
    >
      {/* Input handle */}
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Left}
          style={{ top: "36px", left: "-6px", backgroundColor: circleColor } as React.CSSProperties}
          className="!w-3 !h-3 !border-2 !border-white !rounded-full"
        />
      )}

      {/* Circle */}
      <div className="relative flex-shrink-0">
        {/* Outer glow ring when selected */}
        {selected && (
          <div
            className="absolute inset-0 rounded-full opacity-30 blur-sm scale-110"
            style={{ backgroundColor: circleColor }}
          />
        )}

        {/* Running pulse ring */}
        {isRunning && (
          <div
            className="absolute inset-0 rounded-full animate-ping opacity-40"
            style={{ backgroundColor: circleColor }}
          />
        )}

        {/* Main circle */}
        <div
          className={`
            relative w-[72px] h-[72px] rounded-full flex items-center justify-center
            shadow-lg transition-all duration-200
            ${selected ? "shadow-xl scale-105" : "group-hover:scale-105 group-hover:shadow-xl"}
          `}
          style={{ backgroundColor: circleColor }}
        >
          {isRunning ? (
            <Loader2 size={28} className="animate-spin text-white" />
          ) : (
            <IconComponent size={28} className="text-white" />
          )}
        </div>

        {/* Status badge */}
        {isSuccess && (
          <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center shadow-sm">
            <CheckCircle size={10} className="text-white" />
          </div>
        )}
        {isError && (
          <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center shadow-sm">
            <XCircle size={10} className="text-white" />
          </div>
        )}
      </div>

      {/* Labels below circle */}
      <div className="mt-2 text-center w-full px-1">
        <p className="text-[11px] font-semibold text-gray-800 leading-tight truncate">
          {nodeData.label}
        </p>
        <p className="text-[9px] text-gray-400 leading-tight mt-0.5 line-clamp-2">
          {def.description.length > 40 ? def.description.slice(0, 38) + "…" : def.description}
        </p>
        {nodeData.error && (
          <p className="text-[9px] text-red-500 mt-0.5 truncate">{nodeData.error}</p>
        )}
      </div>

      {/* Output handles */}
      {nodeData.type === "action_if_else" ? (
        <>
          <Handle
            type="source" id="true" position={Position.Right}
            style={{ top: "26px", right: "-6px", backgroundColor: "#22c55e" } as React.CSSProperties}
            className="!w-3 !h-3 !border-2 !border-white !rounded-full"
          />
          <Handle
            type="source" id="false" position={Position.Right}
            style={{ top: "50px", right: "-6px", backgroundColor: "#f87171" } as React.CSSProperties}
            className="!w-3 !h-3 !border-2 !border-white !rounded-full"
          />
          <div className="absolute flex flex-col gap-4" style={{ right: "6px", top: "14px" }}>
            <span className="text-[8px] font-bold text-green-600 bg-green-50 border border-green-200 px-1 rounded leading-none py-0.5">T</span>
            <span className="text-[8px] font-bold text-red-400 bg-red-50 border border-red-200 px-1 rounded leading-none py-0.5">F</span>
          </div>
        </>
      ) : nodeData.type === "action_switch" ? (
        <>
          {(["case_1", "case_2", "case_3", "case_4"] as const)
            .filter((k) => nodeData.config[k])
            .map((k, i, arr) => {
              const offset = 14 + (i * 52 / Math.max(arr.length, 1));
              return (
                <Handle
                  key={k} type="source" id={k} position={Position.Right}
                  style={{ top: `${offset}px`, right: "-6px", backgroundColor: "#f59e0b" } as React.CSSProperties}
                  className="!w-3 !h-3 !border-2 !border-white !rounded-full"
                />
              );
            })}
          <Handle
            type="source" id="default" position={Position.Right}
            style={{ top: "64px", right: "-6px", backgroundColor: "#94a3b8" } as React.CSSProperties}
            className="!w-3 !h-3 !border-2 !border-white !rounded-full"
          />
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          style={{ top: "36px", right: "-6px", backgroundColor: circleColor } as React.CSSProperties}
          className="!w-3 !h-3 !border-2 !border-white !rounded-full"
        />
      )}
    </div>
  );
}
