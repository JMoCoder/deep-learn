import { createPortal } from "react-dom";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useT } from "@/i18n";
import {
  clampDrawerDrag,
  drawerDragOverlayOpacity,
  lockDrawerSwipeAxis,
  shouldCancelDrawerNativeScroll,
  shouldDismissDrawer,
  type DrawerSide,
} from "@/lib/drawer-dismiss";
import { cn } from "@/lib/utils";

const SWIPE_IGNORE = "input, textarea, select, [contenteditable='true']";

function ignoreSwipeFrom(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(SWIPE_IGNORE));
}

export function Drawer({
  open,
  side,
  title,
  onClose,
  children,
  contained = false,
  swipeDismiss = true,
  fill = false,
}: {
  open: boolean;
  side: DrawerSide;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Sit in the app frame (full height). Do not clip to the page stage. */
  contained?: boolean;
  /** Overlay drawers only. Persistent wide rails must not pass this. */
  swipeDismiss?: boolean;
  /** Children fill the panel and own their own scroll (session pane). */
  fill?: boolean;
}) {
  const t = useT();
  const panelRef = useRef<HTMLElement | null>(null);
  const widthRef = useRef(0);
  const suppressClickRef = useRef(false);
  const detachSwipeRef = useRef<(() => void) | null>(null);
  const liveRef = useRef({ open, side, swipeDismiss, onClose });
  liveRef.current = { open, side, swipeDismiss, onClose };
  const dragRef = useRef<{
    pointerId: number;
    touchId: number | null;
    startX: number;
    startY: number;
    dx: number;
    axis: "h" | "v" | null;
  } | null>(null);
  const [dragX, setDragX] = useState<number | null>(null);

  const dragging = dragX !== null;

  function detachSwipeListeners() {
    detachSwipeRef.current?.();
    detachSwipeRef.current = null;
  }

  function resetDrag() {
    detachSwipeListeners();
    dragRef.current = null;
    setDragX((prev) => (prev === null ? prev : null));
  }

  function applySwipeMove(dx: number, dy: number, event: Event) {
    const drag = dragRef.current;
    const live = liveRef.current;
    if (!drag || !live.open || !live.swipeDismiss) return;
    if (!drag.axis) {
      const axis = lockDrawerSwipeAxis(dx, dy);
      if (!axis) return;
      drag.axis = axis;
    }
    if (shouldCancelDrawerNativeScroll(drag.axis) && event.cancelable) {
      event.preventDefault();
    }
    if (drag.axis !== "h") return;
    drag.dx = dx;
    setDragX(clampDrawerDrag(live.side, dx));
  }

  function finishDrag(pointerId: number) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== pointerId) return;
    const live = liveRef.current;
    const dismiss =
      drag.axis === "h" &&
      shouldDismissDrawer({
        side: live.side,
        dx: drag.dx,
        dy: 0,
        width: widthRef.current,
        enabled: live.swipeDismiss && live.open,
      });
    if (drag.axis === "h") suppressClickRef.current = true;
    resetDrag();
    if (dismiss) live.onClose();
  }

  function attachSwipeListeners() {
    detachSwipeListeners();
    // Do not setPointerCapture after axis lock: iOS loses capture to the
    // overflow-y child and lostpointercapture used to abort the swipe.

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      applySwipeMove(event.clientX - drag.startX, event.clientY - drag.startY, event);
    };
    const onTouchMove = (event: TouchEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const touch =
        drag.touchId != null
          ? Array.from(event.touches).find((item) => item.identifier === drag.touchId)
          : event.touches[0];
      if (!touch) return;
      drag.touchId = touch.identifier;
      applySwipeMove(touch.clientX - drag.startX, touch.clientY - drag.startY, event);
    };
    const onPointerUp = (event: PointerEvent) => {
      finishDrag(event.pointerId);
    };
    const onPointerCancel = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      applySwipeMove(event.clientX - drag.startX, event.clientY - drag.startY, event);
      const live = liveRef.current;
      if (
        drag.axis === "h" &&
        shouldDismissDrawer({
          side: live.side,
          dx: drag.dx,
          dy: 0,
          width: widthRef.current,
          enabled: live.swipeDismiss && live.open,
        })
      ) {
        finishDrag(event.pointerId);
        return;
      }
      if (drag.axis === "v") resetDrag();
    };
    const onTouchEnd = (event: TouchEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (event.touches.length > 0) return;
      finishDrag(drag.pointerId);
    };
    const onTouchCancel = () => {
      resetDrag();
    };
    const onPageHide = () => {
      resetDrag();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;
      resetDrag();
    };

    // pointercancel: dismiss if reverse travel already qualifies; otherwise
    // keep listeners so touchmove/touchend can finish. Do not abort an
    // in-progress horizontal swipe (that was the phone no-op).
    document.addEventListener("pointermove", onPointerMove, { capture: true, passive: false });
    document.addEventListener("pointerup", onPointerUp, { capture: true });
    document.addEventListener("pointercancel", onPointerCancel, { capture: true });
    document.addEventListener("touchmove", onTouchMove, { capture: true, passive: false });
    document.addEventListener("touchend", onTouchEnd, { capture: true });
    document.addEventListener("touchcancel", onTouchCancel, { capture: true });
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);

    detachSwipeRef.current = () => {
      document.removeEventListener("pointermove", onPointerMove, { capture: true });
      document.removeEventListener("pointerup", onPointerUp, { capture: true });
      document.removeEventListener("pointercancel", onPointerCancel, { capture: true });
      document.removeEventListener("touchmove", onTouchMove, { capture: true });
      document.removeEventListener("touchend", onTouchEnd, { capture: true });
      document.removeEventListener("touchcancel", onTouchCancel, { capture: true });
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }

  useEffect(() => {
    if (open) return;
    resetDrag();
  }, [open]);

  useEffect(() => () => detachSwipeListeners(), []);

  function onPanelPointerDown(event: ReactPointerEvent<HTMLElement>) {
    event.stopPropagation();
    if (!open || !swipeDismiss) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (ignoreSwipeFrom(event.target)) return;
    widthRef.current = panelRef.current?.getBoundingClientRect().width ?? 0;
    dragRef.current = {
      pointerId: event.pointerId,
      touchId: null,
      startX: event.clientX,
      startY: event.clientY,
      dx: 0,
      axis: null,
    };
    attachSwipeListeners();
  }

  function onPanelPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!open || !swipeDismiss || !drag || event.pointerId !== drag.pointerId) return;
    applySwipeMove(event.clientX - drag.startX, event.clientY - drag.startY, event.nativeEvent);
  }

  function onPanelPointerUp(event: ReactPointerEvent<HTMLElement>) {
    finishDrag(event.pointerId);
  }

  function onPanelClickCapture(event: ReactMouseEvent<HTMLElement>) {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  }

  const node = (
    <div
      data-testid="drawer-root"
      data-drawer-side={side}
      data-state={open ? "open" : "closed"}
      data-swipe-dismiss={swipeDismiss ? "true" : "false"}
      data-dragging={dragging ? "true" : "false"}
      inert={!open}
      aria-hidden={!open}
      className={cn(
        contained ? "absolute inset-0 z-40" : "fixed inset-0 z-50",
        "transition-opacity duration-200 ease-out",
        open ? "opacity-100" : "pointer-events-none opacity-0",
        dragging && "duration-0",
      )}
    >
      {/* Overlay sits behind the panel so 新建主题 and other hits stay on the aside. */}
      <div
        role="button"
        tabIndex={open ? 0 : -1}
        data-testid="drawer-dismiss"
        aria-label={t("drawer.closeAria")}
        className={cn(
          "absolute inset-0 bg-black/25 transition-opacity duration-200 ease-out",
          open ? "opacity-100" : "opacity-0",
          dragging && "duration-0",
        )}
        style={
          dragX !== null
            ? { opacity: drawerDragOverlayOpacity(side, dragX, widthRef.current) }
            : undefined
        }
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-label={title}
        aria-hidden={!open}
        data-testid="drawer-panel"
        data-swipe-pan-y={swipeDismiss ? "true" : undefined}
        className={cn(
          "absolute inset-y-0 z-10 flex w-[var(--sidebar-width)] flex-col border-paper-line bg-paper shadow-2xl",
          "transition-transform duration-200 ease-out",
          swipeDismiss && "touch-pan-y",
          side === "left" ? "left-0 border-r" : "right-0 border-l",
          open ? "translate-x-0" : side === "left" ? "-translate-x-full" : "translate-x-full",
          dragging && "duration-0",
        )}
        style={{
          ...(swipeDismiss ? { touchAction: "pan-y" as const } : {}),
          ...(dragX !== null ? { transform: `translateX(${dragX}px)` } : {}),
        }}
        onPointerDown={onPanelPointerDown}
        onPointerMove={onPanelPointerMove}
        onPointerUp={onPanelPointerUp}
        onClickCapture={onPanelClickCapture}
        onClick={(event) => event.stopPropagation()}
      >
        <header
          data-testid="drawer-header"
          className="flex h-[var(--top-region-height)] items-center justify-between border-b border-paper-line px-4"
        >
          <h2 className="font-serif text-base">{title}</h2>
          <button type="button" className="text-sm text-paper-muted" onClick={onClose}>
            {t("drawer.close")}
          </button>
        </header>
        <div
          data-testid="drawer-scroll"
          data-fill={fill ? "true" : "false"}
          data-swipe-pan-y={swipeDismiss ? "true" : undefined}
          className={cn(
            "min-h-0 flex-1 touch-pan-y",
            fill ? "flex flex-col overflow-hidden" : "quantum-scroll overflow-y-auto",
          )}
          style={swipeDismiss ? { touchAction: "pan-y" } : undefined}
        >
          {children}
        </div>
      </aside>
    </div>
  );

  if (contained || typeof document === "undefined") return node;
  return createPortal(node, document.body);
}

export type { DrawerSide };
