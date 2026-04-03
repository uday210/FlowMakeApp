"use client";

import { useState } from "react";
import { Stamp, X } from "lucide-react";

const WATERMARK_PRESETS = ["CONFIDENTIAL", "DRAFT", "COPY", "SAMPLE"];

export default function WatermarkDialog({
  fileName,
  initialText = "",
  onConfirm,
  onCancel,
}: {
  fileName: string;
  initialText?: string;
  onConfirm: (watermark: string) => void;
  onCancel: () => void;
}) {
  const isPreset = WATERMARK_PRESETS.includes(initialText);
  const [selected, setSelected] = useState(isPreset ? initialText : initialText ? "__custom__" : "");
  const [custom, setCustom] = useState(isPreset ? "" : initialText);

  const activeText = selected === "__custom__" ? custom : selected;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
            <Stamp size={16} className="text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Watermark</p>
            <p className="text-xs text-gray-400 truncate">{fileName}</p>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {WATERMARK_PRESETS.map(preset => (
              <button
                key={preset}
                onClick={() => setSelected(selected === preset ? "" : preset)}
                className={`py-2 px-3 rounded-xl border text-xs font-bold tracking-wide transition-all ${
                  selected === preset
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-white text-gray-500 border-gray-200 hover:border-violet-300"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Custom text</label>
            <input
              type="text"
              value={custom}
              maxLength={30}
              placeholder="e.g. INTERNAL USE ONLY"
              onChange={e => { setCustom(e.target.value); setSelected("__custom__"); }}
              onFocus={() => setSelected("__custom__")}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400"
            />
          </div>

          {/* Preview */}
          {activeText && (
            <div className="relative h-16 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-center overflow-hidden">
              <p
                className="text-gray-400 font-bold text-lg select-none"
                style={{ opacity: 0.35, transform: "rotate(25deg)", letterSpacing: "0.1em" }}
              >
                {activeText}
              </p>
              <p className="absolute bottom-1.5 right-2.5 text-[10px] text-gray-300">preview</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={() => onConfirm("")}
            className="flex-1 py-2 text-sm font-medium text-gray-500 border border-gray-200 rounded-xl hover:bg-white transition-colors"
          >
            Skip
          </button>
          <button
            onClick={() => onConfirm(activeText)}
            className="flex-1 py-2 text-sm font-semibold bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors"
          >
            {activeText ? "Apply" : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}
