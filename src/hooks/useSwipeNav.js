import { useCallback, useEffect, useRef, useState } from "react";

// Horizontal swipe for galleries. Deliberately forgiving: the gesture only wins
// once the pointer has travelled past the threshold *and* moved mostly
// sideways, so vertical scrolling (and taps) keep working.
const SWIPE_THRESHOLD = 48;
const SWIPE_SLOP = 1.2;
const DRAG_START = 6;

const INTERACTIVE = "button, a, input, select, textarea, label, [role='button']";

export const useSwipeNav = ({ onNext, onPrev, enabled = true, count = 2 }) => {
  const [dragOffset, setDragOffset] = useState(0);
  const gesture = useRef(null);

  const reset = useCallback(() => {
    gesture.current = null;
    setDragOffset(0);
  }, []);

  const onPointerDown = useCallback(
    (e) => {
      if (!enabled || count < 2) return;
      if (e.target?.closest?.(INTERACTIVE)) return;
      if (typeof e.clientX !== "number" || typeof e.clientY !== "number") return;
      gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
      e.currentTarget?.setPointerCapture?.(e.pointerId);
    },
    [enabled, count]
  );

  const onPointerMove = useCallback((e) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    if (typeof e.clientX !== "number" || typeof e.clientY !== "number") return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.moved) {
      if (Math.abs(dx) < DRAG_START || Math.abs(dx) <= Math.abs(dy)) return;
      g.moved = true;
    }
    setDragOffset(dx * 0.6);
  }, []);

  const onPointerUp = useCallback(
    (e) => {
      const g = gesture.current;
      if (!g || g.id !== e.pointerId) return;
      const dx = e.clientX - g.x;
      const dy = e.clientY - g.y;
      reset();
      // Guard against non-finite coordinates: comparing NaN falls through every
      // check below and would otherwise navigate on a gesture that never moved.
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
      if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) <= Math.abs(dy) * SWIPE_SLOP) return;
      if (dx < 0) onNext?.();
      else onPrev?.();
    },
    [onNext, onPrev, reset]
  );

  // A cancelled gesture must never navigate.
  const onPointerCancel = useCallback(() => reset(), [reset]);

  useEffect(() => {
    if (enabled && count >= 2) return;
    reset();
  }, [enabled, count, reset]);

  return {
    dragOffset,
    dragging: dragOffset !== 0,
    swipeHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
  };
};
