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
  /** Sit in the app frame (full height). Do not clip to the page stage. */
  contained?: boolean;
}) {
  const t = useT();
  if (!open) return null;

  const node = (
    <div
      data-testid="drawer-root"
      className={contained ? "absolute inset-0 z-40" : "fixed inset-0 z-50"}
    >
      {/* Dim only the page, never the panel — a full-screen overlay steals the 新建主题 hit. */}
      <div
        role="button"
        tabIndex={0}
        data-testid="drawer-dismiss"
        aria-label={t("drawer.closeAria")}
        className={cn(
          "absolute inset-y-0 bg-black/25",
          side === "right" ? "left-0" : "right-0",
        )}
        style={side === "right" ? { right: "var(--sidebar-width)" } : { left: "var(--sidebar-width)" }}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-label={title}
        className={cn(
          "absolute inset-y-0 z-10 flex w-[var(--sidebar-width)] flex-col border-paper-line bg-paper shadow-2xl",
          side === "left" ? "left-0 border-r" : "right-0 border-l",
        )}
        onPointerDown={(event) => event.stopPropagation()}
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
