"use client";

import { useState, useCallback } from "react";
import { type NodeProps, useReactFlow } from "@xyflow/react";

export default function StickyNoteNode({ id, data, selected }: NodeProps) {
  const text = (data as Record<string, unknown>).text as string ?? "";
  const [editing, setEditing] = useState(false);
  const { setNodes } = useReactFlow();

  const save = useCallback(
    (value: string) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, text: value, config: { ...(n.data as Record<string, unknown>).config as object, text: value } } } : n
        )
      );
      setEditing(false);
    },
    [id, setNodes]
  );

  return (
    <div
      onDoubleClick={() => setEditing(true)}
      style={{
        width: 200,
        minHeight: 120,
        background: "#fef08a",
        border: selected ? "2px solid #ca8a04" : "1.5px solid #fde047",
        borderRadius: 4,
        padding: "28px 12px 12px",
        boxShadow: selected
          ? "4px 4px 16px rgba(202,138,4,0.25)"
          : "3px 3px 10px rgba(0,0,0,0.12)",
        position: "relative",
        cursor: editing ? "text" : "grab",
      }}
    >
      {/* Top bar like a real sticky note */}
      <div style={{
        position: "absolute",
        top: 0, left: 0, right: 0,
        height: 22,
        background: "#fde047",
        borderRadius: "3px 3px 0 0",
        display: "flex",
        alignItems: "center",
        paddingLeft: 8,
      }}>
        <span style={{ fontSize: 9, color: "#92400e", fontWeight: 600, letterSpacing: "0.05em", userSelect: "none" }}>
          NOTE {editing ? "— click outside to save" : "— double-click to edit"}
        </span>
      </div>

      {editing ? (
        <textarea
          autoFocus
          defaultValue={text}
          onBlur={(e) => save(e.target.value)}
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
            color: "#78350f",
            lineHeight: 1.6,
          }}
        />
      ) : (
        <p style={{
          fontSize: 12,
          color: text ? "#78350f" : "#a16207",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          margin: 0,
          minHeight: 80,
          lineHeight: 1.6,
          userSelect: "none",
        }}>
          {text || "Double-click to add a note…"}
        </p>
      )}
    </div>
  );
}
