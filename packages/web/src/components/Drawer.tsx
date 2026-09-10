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

  const node = (
    <div
      data-testid="drawer-root"
      data-drawer-side={side}
      data-state={open ? "open" : "closed"}
      inert={!open}
      aria-hidden={!open}
      className={cn(
        contained ? "absolute inset-0 z-40" : "fixed inset-0 z-50",
        "transition-opacity duration-200 ease-out",
        open ? "opacity-100" : "pointer-events-none opacity-0",
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
        )}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-label={title}
        aria-hidden={!open}
        className={cn(
          "absolute inset-y-0 z-10 flex w-[var(--sidebar-width)] flex-col border-paper-line bg-paper shadow-2xl",
          "transition-transform duration-200 ease-out",
          side === "left" ? "left-0 border-r" : "right-0 border-l",
          open ? "translate-x-0" : side === "left" ? "-translate-x-full" : "translate-x-full",
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
