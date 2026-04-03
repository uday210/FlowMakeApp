"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { X, ChevronRight, ChevronLeft, HelpCircle } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TourStep {
  /** CSS selector of the element to highlight. If null, centers the tooltip. */
  target: string | null;
  title: string;
  content: string;
  /** Where to place the tooltip relative to the target */
  placement?: "top" | "bottom" | "left" | "right" | "center";
}

interface TourContextValue {
  startTour: (steps: TourStep[], tourKey: string) => void;
  endTour: () => void;
  isRunning: boolean;
}

// ── Context ────────────────────────────────────────────────────────────────────

const TourContext = createContext<TourContextValue>({
  startTour: () => {},
  endTour: () => {},
  isRunning: false,
});

export function useTour() {
  return useContext(TourContext);
}

// ── Spotlight overlay ──────────────────────────────────────────────────────────

interface Rect { top: number; left: number; width: number; height: number }

function getTargetRect(selector: string | null): Rect | null {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

const PAD = 8; // spotlight padding

function TooltipBox({
  step,
  rect,
  stepIndex,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
}: {
  step: TourStep;
  rect: Rect | null;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: "50%", left: "50%", transform: "translate(-50%,-50%)" });

  useEffect(() => {
    if (!ref.current) return;
    const box = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const MARGIN = 12;

    if (!rect) {
      setPos({ top: "50%", left: "50%", transform: "translate(-50%,-50%)" });
      return;
    }

    const placement = step.placement ?? autoPlacement(rect, box, vw, vh);

    let top = 0, left = 0;
    if (placement === "bottom") {
      top = rect.top + rect.height + PAD + MARGIN;
      left = rect.left + rect.width / 2 - box.width / 2;
    } else if (placement === "top") {
      top = rect.top - PAD - MARGIN - box.height;
      left = rect.left + rect.width / 2 - box.width / 2;
    } else if (placement === "right") {
      top = rect.top + rect.height / 2 - box.height / 2;
      left = rect.left + rect.width + PAD + MARGIN;
    } else if (placement === "left") {
      top = rect.top + rect.height / 2 - box.height / 2;
      left = rect.left - PAD - MARGIN - box.width;
    } else {
      setPos({ top: "50%", left: "50%", transform: "translate(-50%,-50%)" });
      return;
    }

    // Clamp to viewport
    left = Math.max(MARGIN, Math.min(left, vw - box.width - MARGIN));
    top  = Math.max(MARGIN, Math.min(top,  vh - box.height - MARGIN));

    setPos({ top: `${top}px`, left: `${left}px`, transform: "none" });
  }, [rect, step]);

  return (
    <div
      ref={ref}
      className="fixed z-[100000] w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 p-5"
      style={pos}
    >
      {/* Step counter */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-violet-500 uppercase tracking-wider">
          Step {stepIndex + 1} of {totalSteps}
        </span>
        <button onClick={onSkip} className="text-gray-300 hover:text-gray-500 transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1 bg-gray-100 rounded-full mb-4">
        <div
          className="h-1 bg-violet-500 rounded-full transition-all duration-300"
          style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
        />
      </div>

      <h3 className="text-sm font-bold text-gray-900 mb-1.5">{step.title}</h3>
      <p className="text-xs text-gray-500 leading-relaxed mb-4">{step.content}</p>

      <div className="flex items-center justify-between">
        <button
          onClick={onSkip}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Skip tour
        </button>
        <div className="flex items-center gap-2">
          {stepIndex > 0 && (
            <button
              onClick={onPrev}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft size={12} /> Back
            </button>
          )}
          <button
            onClick={onNext}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-violet-600 rounded-lg hover:bg-violet-700 transition-colors"
          >
            {stepIndex === totalSteps - 1 ? "Done" : "Next"} <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

function autoPlacement(rect: Rect, box: DOMRect, vw: number, vh: number): TourStep["placement"] {
  const spaceBelow = vh - rect.top - rect.height;
  const spaceAbove = rect.top;
  const spaceRight = vw - rect.left - rect.width;

  if (spaceBelow >= box.height + 20) return "bottom";
  if (spaceAbove >= box.height + 20) return "top";
  if (spaceRight >= box.width + 20) return "right";
  return "left";
}

// ── Provider ───────────────────────────────────────────────────────────────────

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [steps, setSteps]       = useState<TourStep[]>([]);
  const [stepIdx, setStepIdx]   = useState(0);
  const [tourKey, setTourKey]   = useState("");
  const [running, setRunning]   = useState(false);
  const [rect, setRect]         = useState<Rect | null>(null);

  const updateRect = useCallback((step: TourStep) => {
    const r = getTargetRect(step.target);
    setRect(r);
    if (r) {
      // Scroll element into view
      const el = document.querySelector(step.target!);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, []);

  const startTour = useCallback((newSteps: TourStep[], key: string) => {
    setSteps(newSteps);
    setStepIdx(0);
    setTourKey(key);
    setRunning(true);
    setTimeout(() => updateRect(newSteps[0]), 100);
  }, [updateRect]);

  const endTour = useCallback(() => {
    setRunning(false);
    setSteps([]);
    setRect(null);
    if (tourKey) {
      localStorage.setItem(`tour_done_${tourKey}`, "1");
    }
  }, [tourKey]);

  const goNext = useCallback(() => {
    const next = stepIdx + 1;
    if (next >= steps.length) { endTour(); return; }
    setStepIdx(next);
    setTimeout(() => updateRect(steps[next]), 80);
  }, [stepIdx, steps, endTour, updateRect]);

  const goPrev = useCallback(() => {
    const prev = Math.max(0, stepIdx - 1);
    setStepIdx(prev);
    setTimeout(() => updateRect(steps[prev]), 80);
  }, [stepIdx, steps, updateRect]);

  // Update rect on resize/scroll
  useEffect(() => {
    if (!running || !steps[stepIdx]) return;
    const update = () => updateRect(steps[stepIdx]);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [running, steps, stepIdx, updateRect]);

  const currentStep = steps[stepIdx];

  return (
    <TourContext.Provider value={{ startTour, endTour, isRunning: running }}>
      {children}

      {running && currentStep && (
        <>
          {/* Dark overlay with spotlight cutout */}
          <svg
            className="fixed inset-0 z-[99999] pointer-events-none"
            style={{ width: "100vw", height: "100vh" }}
          >
            <defs>
              <mask id="tour-mask">
                <rect width="100%" height="100%" fill="white" />
                {rect && (
                  <rect
                    x={rect.left - PAD}
                    y={rect.top - PAD}
                    width={rect.width + PAD * 2}
                    height={rect.height + PAD * 2}
                    rx={10}
                    fill="black"
                  />
                )}
              </mask>
            </defs>
            <rect
              width="100%"
              height="100%"
              fill="rgba(0,0,0,0.55)"
              mask="url(#tour-mask)"
            />
            {/* Highlight border around target */}
            {rect && (
              <rect
                x={rect.left - PAD}
                y={rect.top - PAD}
                width={rect.width + PAD * 2}
                height={rect.height + PAD * 2}
                rx={10}
                fill="none"
                stroke="#7c3aed"
                strokeWidth={2}
              />
            )}
          </svg>

          {/* Clickable overlay to advance (but not on the tooltip) */}
          <div className="fixed inset-0 z-[99999]" onClick={goNext} />

          <TooltipBox
            step={currentStep}
            rect={rect}
            stepIndex={stepIdx}
            totalSteps={steps.length}
            onNext={goNext}
            onPrev={goPrev}
            onSkip={endTour}
          />
        </>
      )}
    </TourContext.Provider>
  );
}

// ── Auto-start hook ────────────────────────────────────────────────────────────

export function useAutoTour(steps: TourStep[], tourKey: string) {
  const { startTour, isRunning } = useTour();
  useEffect(() => {
    if (isRunning) return;
    const done = localStorage.getItem(`tour_done_${tourKey}`);
    if (done) return;
    // Small delay so the page fully renders first
    const t = setTimeout(() => startTour(steps, tourKey), 800);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourKey]);
}

// ── HintIcon ───────────────────────────────────────────────────────────────────

export function HintIcon({ content, title }: { content: string; title?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<"top" | "bottom">("top");

  useEffect(() => {
    if (!open || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos(r.top > 120 ? "top" : "bottom");

    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex items-center">
      <button
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen(v => !v)}
        className="text-gray-300 hover:text-violet-400 transition-colors ml-1 flex-shrink-0"
        tabIndex={-1}
      >
        <HelpCircle size={13} />
      </button>

      {open && (
        <div
          className={`absolute z-50 w-56 bg-gray-900 text-white rounded-xl px-3 py-2.5 shadow-xl pointer-events-none ${
            pos === "top" ? "bottom-full mb-2 left-1/2 -translate-x-1/2" : "top-full mt-2 left-1/2 -translate-x-1/2"
          }`}
        >
          {title && <p className="text-xs font-semibold mb-1 text-violet-300">{title}</p>}
          <p className="text-xs leading-relaxed text-gray-200">{content}</p>
          {/* Arrow */}
          <div className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 ${pos === "top" ? "top-full -mt-1" : "bottom-full mb-[-4px]"}`} />
        </div>
      )}
    </div>
  );
}
