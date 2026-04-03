"use client";

import { useState, useCallback } from "react";
import { type NodeProps, useReactFlow } from "@xyflow/react";

export default function StickyNoteNode({ id, data, selected }: NodeProps) {
  const text = (data as Record<string, unknown>).text as string ?? "";
  const [editing, setEditing] = useState(false);
  const { updateNodeData } = useReactFlow();

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLTextAreaElement>) => {
      updateNodeData(id, { text: e.target.value });
      setEditing(false);
    },
    [id, updateNodeData]
  );

  return (
    <div
      onDoubleClick={() => setEditing(true)}
      style={{
        width: 200,
        minHeight: 100,
        background: "#fef9c3",
        border: selected ? "2px solid #ca8a04" : "1.5px solid #fde047",
        borderRadius: 8,
        padding: 10,
        boxShadow: selected
          ? "0 4px 16px rgba(202,138,4,0.18)"
          : "0 2px 8px rgba(0,0,0,0.08)",
        fontFamily: "inherit",
        cursor: editing ? "text" : "grab",
        position: "relative",
      }}
    >
      {/* Folded corner decoration */}
      <div style={{
        position: "absolute", top: 0, right: 0,
        width: 0, height: 0,
        borderStyle: "solid",
        borderWidth: "0 14px 14px 0",
        borderColor: "transparent #fde047 transparent transparent",
        borderRadius: "0 8px 0 0",
      }} />

      {editing ? (
        <textarea
          autoFocus
          defaultValue={text}
          onBlur={handleBlur}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            minHeight: 80,
            background: "transparent",
            border: "none",
            outline: "none",
            resize: "none",
            fontFamily: "inherit",
            fontSize: 12,
            color: "#713f12",
            lineHeight: 1.5,
          }}
        />
      ) : (
        <p style={{
          fontSize: 12,
          color: text ? "#713f12" : "#a16207",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          margin: 0,
          minHeight: 80,
          lineHeight: 1.5,
        }}>
          {text || "Double-click to add a note…"}
        </p>
      )}
    </div>
  );
}
