import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Loader2, X, ZoomIn, ZoomOut } from "lucide-react";
import { imgSrc } from "@/lib/api";
import { useSwipeNav } from "@/hooks/useSwipeNav";

// Discrete magnification levels so the +/- buttons always land on a predictable
// scale; pinch and wheel move continuously between MIN_SCALE and MAX_SCALE.
const ZOOM_STEPS = [1, 1.5, 2, 3];
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const WHEEL_THROTTLE = 140;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const nextScaleUp = (scale) => clamp(ZOOM_STEPS.find((v) => v > scale + 0.01) ?? MAX_SCALE, MIN_SCALE, MAX_SCALE);

const nextScaleDown = (scale) => {
  const lower = [...ZOOM_STEPS].reverse().find((v) => v < scale - 0.01);
  return clamp(lower ?? MIN_SCALE, MIN_SCALE, MAX_SCALE);
};

/**
 * Fullscreen product-image viewer.
 *
 * Rendered as a *nested* Radix dialog on purpose: the parent product modal sets
 * `pointer-events: none` on `document.body` and only re-enables it on the top
 * dismissable layer, so a portal outside this subtree would be inert (no clicks,
 * no swipes). Nesting also makes this the top layer for Escape handling and
 * focus trapping, so closing the viewer never closes the product modal.
 */
export const ImageZoomViewer = ({ open, onOpenChange, images, active, onActiveChange, title }) => {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);

  const stageRef = useRef(null);
  const pinch = useRef(null);
  const pan = useRef(null);
  const gestureRef = useRef(null);
  const pointers = useRef(new Map());
  const lastTap = useRef(0);
  const lastWheel = useRef(0);

  const count = images.length;
  const current = images[active] ?? images[0];
  const zoomed = scale > MIN_SCALE;

  const resetView = useCallback(() => {
    setScale(MIN_SCALE);
    setOffset({ x: 0, y: 0 });
  }, []);

  // Never carry a zoom level or a pan offset across pictures.
  useEffect(() => {
    resetView();
    setLoaded(false);
  }, [resetView]);

  useEffect(() => {
    if (!open) return;
    resetView();
    setLoaded(false);
  }, [active, current, open, resetView]);

  const clampOffset = useCallback((next, atScale) => {
    const node = stageRef.current;
    const width = node?.clientWidth ?? 0;
    const height = node?.clientHeight ?? 0;
    const maxX = (width * (atScale - MIN_SCALE)) / 2;
    const maxY = (height * (atScale - MIN_SCALE)) / 2;
    return { x: clamp(next.x, -maxX, maxX), y: clamp(next.y, -maxY, maxY) };
  }, []);

  const zoomTo = useCallback(
    (target) => {
      const value = clamp(target, MIN_SCALE, MAX_SCALE);
      setScale(value);
      setOffset((prev) => (value <= MIN_SCALE ? { x: 0, y: 0 } : clampOffset(prev, value)));
    },
    [clampOffset]
  );

  const goNext = useCallback(() => {
    if (count < 2) return;
    onActiveChange((active + 1) % count);
  }, [active, count, onActiveChange]);

  const goPrev = useCallback(() => {
    if (count < 2) return;
    onActiveChange((active - 1 + count) % count);
  }, [active, count, onActiveChange]);

  const { dragOffset, swipeHandlers } = useSwipeNav({
    onNext: goNext,
    onPrev: goPrev,
    enabled: open && !zoomed,
    count,
  });
  const dragOffsetRef = useRef(0);
  dragOffsetRef.current = dragOffset;

  // Moving on to the next picture drops any in-flight drag with it.
  useEffect(() => {
    pinch.current = null;
    pan.current = null;
    gestureRef.current = null;
    pointers.current.clear();
  }, [active]);

  const onPointerDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // Panning only makes sense while magnified; otherwise the swipe hook owns the
    // gesture (a second finger makes it stand down so pinch can take over).
    if (pointers.current.size === 1 && zoomed && !e.target?.closest?.("button")) {
      gestureRef.current = { pointerId: e.pointerId, target: e.target, pointerType: e.pointerType, moved: false };
      pan.current = { id: e.pointerId, x: e.clientX, y: e.clientY, origin: offset };
      return;
    }
    gestureRef.current = { pointerId: e.pointerId, target: e.target, pointerType: e.pointerType, moved: false };
    pan.current = null;
  };

  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const spread = distance(a, b);
      // A second finger turns the gesture into a pinch, never a tap or a swipe.
      if (gestureRef.current) gestureRef.current.moved = true;
      if (!pinch.current) {
        pinch.current = { spread, scale };
        pan.current = null;
        return;
      }
      if (pinch.current.spread > 0) zoomTo((scale * spread) / pinch.current.spread);
      return;
    }

    if (dragOffsetRef.current !== 0 && gestureRef.current) gestureRef.current.moved = true;

    if (!pan.current || pan.current.id !== e.pointerId) return;
    if (gestureRef.current) gestureRef.current.moved = true;
    const next = {
      x: pan.current.origin.x + (e.clientX - pan.current.x),
      y: pan.current.origin.y + (e.clientY - pan.current.y),
    };
    setOffset(clampOffset(next, scale));
  };

  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const gesture = gestureRef.current;
    pan.current = null;

    // Any gesture that moved — a swipe between pictures or a pan while magnified
    // — must not also count as a tap, or fast swiping would toggle the zoom.
    const moved = gesture?.pointerId === e.pointerId && (gesture.moved || dragOffsetRef.current !== 0);
    gestureRef.current = null;
    if (moved) {
      lastTap.current = 0;
      return;
    }

    if (gesture && !gesture.target?.closest?.("button, a, input, select, textarea, label")) {
      const now = Date.now();
      if (now - lastTap.current < 300) {
        lastTap.current = 0;
        zoomTo(zoomed ? MIN_SCALE : 2);
        return;
      }
      lastTap.current = now;
    }
  };

  const onPointerCancel = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    pan.current = null;
    gestureRef.current = null;
  };

  const onWheel = (e) => {
    const now = Date.now();
    if (now - lastWheel.current < WHEEL_THROTTLE) return;
    lastWheel.current = now;
    if (e.deltaY < 0) zoomTo(nextScaleUp(scale));
    else if (e.deltaY > 0) zoomTo(nextScaleDown(scale));
  };

  // Escape is handled by Radix, which only dismisses the top-most layer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "0") resetView();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, goNext, goPrev, resetView]);

  const imageStyle = { transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})` };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="zoom-gallery-overlay"
        data-lenis-prevent
        aria-describedby={undefined}
        className="max-w-none w-screen h-screen sm:h-[100dvh] p-0 gap-0 border-0 bg-void/95 backdrop-blur-sm flex flex-col focus:outline-none [&>button:last-child]:hidden"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>

        <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-line/60">
          <span className="text-[11px] font-mono uppercase tracking-widest text-slate-400" data-testid="zoom-counter">
            {active + 1} / {count}
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className={`mr-1 text-[11px] font-mono tabular-nums ${zoomed ? "text-neon" : "text-slate-500"}`}
              data-testid="zoom-scale-indicator"
            >
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => zoomTo(nextScaleDown(scale))}
              disabled={!zoomed}
              data-testid="zoom-zoom-out-button"
              aria-label="Perkecil gambar"
              className="grid place-items-center w-10 h-10 text-slate-300 hover:text-neon border border-line/60 hover:border-neon disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200"
            >
              <ZoomOut size={18} />
            </button>
            <button
              type="button"
              onClick={() => zoomTo(nextScaleUp(scale))}
              disabled={scale >= MAX_SCALE}
              data-testid="zoom-zoom-in-button"
              aria-label="Perbesar gambar"
              className="grid place-items-center w-10 h-10 text-slate-300 hover:text-neon border border-line/60 hover:border-neon disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200"
            >
              <ZoomIn size={18} />
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              data-testid="zoom-close-button"
              aria-label="Tutup"
              className="grid place-items-center w-10 h-10 text-slate-300 hover:text-coral transition-colors duration-200"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        <div
          ref={stageRef}
          onPointerDown={(e) => {
            swipeHandlers.onPointerDown(e);
            onPointerDown(e);
          }}
          onPointerMove={(e) => {
            swipeHandlers.onPointerMove(e);
            onPointerMove(e);
          }}
          onPointerUp={(e) => {
            swipeHandlers.onPointerUp(e);
            onPointerUp(e);
          }}
          onPointerCancel={(e) => {
            swipeHandlers.onPointerCancel(e);
            onPointerCancel(e);
          }}
          onWheel={onWheel}
          className="relative flex-1 overflow-hidden touch-pan-y select-none"
          style={{ cursor: zoomed ? "grab" : "zoom-in" }}
        >
          <div className="absolute inset-0 flex items-center justify-center px-2 sm:px-16">
            <div
              className="relative flex items-center justify-center w-full h-full"
              style={{ transform: dragOffset ? `translate3d(${dragOffset}px, 0, 0)` : undefined }}
              data-testid="zoom-swipe-surface"
            >
              {!loaded && (
                <Loader2 size={22} className="absolute text-neon/70 animate-spin" data-testid="zoom-loading" />
              )}
              <img
                src={imgSrc(current)}
                alt={title}
                onLoad={() => setLoaded(true)}
                onError={() => setLoaded(true)}
                data-testid="zoom-main-image"
                draggable="false"
                className="max-h-full max-w-full object-contain select-none transition-transform duration-200 ease-out"
                style={imageStyle}
              />
            </div>
          </div>

          {count > 1 && !zoomed && (
            <>
              <button
                type="button"
                onClick={goPrev}
                data-testid="zoom-prev-button"
                aria-label="Gambar sebelumnya"
                className="absolute left-2 sm:left-5 top-1/2 -translate-y-1/2 grid place-items-center w-11 h-11 bg-panel/80 border border-line hover:border-neon text-slate-200 hover:text-neon transition-colors duration-200"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                type="button"
                onClick={goNext}
                data-testid="zoom-next-button"
                aria-label="Gambar selanjutnya"
                className="absolute right-2 sm:right-5 top-1/2 -translate-y-1/2 grid place-items-center w-11 h-11 bg-panel/80 border border-line hover:border-neon text-slate-200 hover:text-neon transition-colors duration-200"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}
        </div>

        <div className="shrink-0 flex items-center justify-center gap-1.5 px-4 py-3 border-t border-line/60">
          {count > 1 && (
            <div className="flex gap-1.5 overflow-x-auto" data-testid="zoom-thumbs">
              {images.map((g, i) => (
                <button
                  type="button"
                  key={g}
                  onClick={() => onActiveChange(i)}
                  data-testid={`zoom-thumb-${i}`}
                  aria-label={`Lihat gambar ${i + 1}`}
                  className={`w-14 h-14 shrink-0 overflow-hidden border transition-colors duration-200 ${
                    active === i ? "border-neon" : "border-line/60 opacity-60 hover:opacity-100"
                  }`}
                >
                  <img src={imgSrc(g)} alt="" loading="lazy" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
          <span className="ml-2 hidden sm:block text-[10px] font-mono text-slate-500 whitespace-nowrap">
            {zoomed ? "Geser untuk menggeser gambar" : count > 1 ? "Swipe / ← → untuk ganti gambar" : "Klik 2x untuk zoom"}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
