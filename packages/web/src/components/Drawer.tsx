import { createPortal } from "react-dom";
import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useT } from "@/i18n";
import {
  clampDrawerDrag,
  drawerDragOverlayOpacity,
  lockDrawerSwipeAxis,
  shouldDismissDrawer,
  type DrawerSide,
} from "@/lib/drawer-dismiss";
import { cn } from "@/lib/utils";

export function Drawer({
  open,
  side,
  title,
  onClose,
  children,
  contained = false,
  swipeDismiss = true,
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
}) {
  const t = useT();
  const panelRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    dx: number;
    axis: "h" | "v" | null;
  } | null>(null);
  const [dragX, setDragX] = useState<number | null>(null);

  const dragging = dragX !== null;
  const panelWidth = () => panelRef.current?.getBoundingClientRect().width ?? 0;

  function resetDrag() {
    dragRef.current = null;
    setDragX(null);
  }

  function onPanelPointerDown(event: ReactPointerEvent<HTMLElement>) {
    event.stopPropagation();
    if (!open || !swipeDismiss) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dx: 0,
      axis: null,
    };
  }

  function onPanelPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!open || !swipeDismiss || !drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.axis) {
      const axis = lockDrawerSwipeAxis(dx, dy);
      if (!axis) return;
      drag.axis = axis;
      if (axis === "h") {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }
    }
    if (drag.axis !== "h") return;
    event.preventDefault();
    drag.dx = dx;
    setDragX(clampDrawerDrag(side, dx));
  }

  function finishDrag(event: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = drag.dx;
    const dy = event.clientY - drag.startY;
    const dismiss =
      drag.axis === "h" &&
      shouldDismissDrawer({
        side,
        dx,
        dy,
        width: panelWidth(),
        enabled: swipeDismiss && open,
      });
    resetDrag();
    if (dismiss) onClose();
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
            ? { opacity: drawerDragOverlayOpacity(side, dragX, panelWidth()) }
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
        className={cn(
          "absolute inset-y-0 z-10 flex w-[var(--sidebar-width)] flex-col border-paper-line bg-paper shadow-2xl",
          "transition-transform duration-200 ease-out",
          swipeDismiss ? (dragging ? "touch-none" : "touch-pan-y") : null,
          side === "left" ? "left-0 border-r" : "right-0 border-l",
          open ? "translate-x-0" : side === "left" ? "-translate-x-full" : "translate-x-full",
          dragging && "duration-0",
        )}
        style={dragX !== null ? { transform: `translateX(${dragX}px)` } : undefined}
        onPointerDown={onPanelPointerDown}
        onPointerMove={onPanelPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={resetDrag}
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
        <div className="quantum-scroll min-h-0 flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>
  );

  if (contained || typeof document === "undefined") return node;
  return createPortal(node, document.body);
}

export type { DrawerSide };
