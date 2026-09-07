import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

export function Drawer({
  open,
  side,
  title,
  onClose,
  children,
  contained = false,
}: {
  open: boolean;
  side: "left" | "right";
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Sit in the page stage so the panel edge meets the title divider. */
  contained?: boolean;
}) {
  const t = useT();
  const node = (
    <div
      className={cn(
        contained ? "absolute inset-0 z-40" : "fixed inset-0 z-50",
        !open && "pointer-events-none",
      )}
      aria-hidden={!open}
    >
      {/* Dim only the page, never the panel — a full-screen overlay steals the 新建主题 hit. */}
      <div
        role="button"
        tabIndex={open ? 0 : -1}
        data-testid="drawer-dismiss"
        aria-label={t("drawer.closeAria")}
        className={cn(
          "absolute inset-y-0 bg-black/25 transition-opacity",
          open ? "opacity-100" : "opacity-0",
          side === "right" ? "left-0" : "right-0",
        )}
        style={side === "right" ? { right: "var(--sidebar-width)" } : { left: "var(--sidebar-width)" }}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-label={title}
        aria-hidden={!open}
        className={cn(
          "absolute inset-y-0 z-10 flex w-[var(--sidebar-width)] flex-col border-paper-line bg-paper shadow-2xl transition-transform duration-200",
          side === "left" ? "left-0 border-r" : "right-0 border-l",
          open
            ? "translate-x-0"
            : side === "left"
              ? "-translate-x-full"
              : "translate-x-full",
        )}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-paper-line px-4 py-3">
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
