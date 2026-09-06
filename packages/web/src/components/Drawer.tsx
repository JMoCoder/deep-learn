import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Drawer({
  open,
  side,
  title,
  onClose,
  children,
}: {
  open: boolean;
  side: "left" | "right";
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <button
        type="button"
        aria-label="关闭抽屉"
        className={cn(
          "fixed inset-0 z-40 bg-black/25 transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed inset-y-0 z-50 flex w-[min(22rem,92vw)] flex-col border-paper-line bg-paper shadow-2xl transition-transform duration-200",
          side === "left" ? "left-0 border-r" : "right-0 border-l",
          open
            ? "translate-x-0"
            : side === "left"
              ? "-translate-x-full"
              : "translate-x-full",
        )}
      >
        <header className="flex items-center justify-between border-b border-paper-line px-4 py-3">
          <h2 className="font-serif text-base">{title}</h2>
          <button type="button" className="text-sm text-paper-muted" onClick={onClose}>
            关闭
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </aside>
    </>
  );
}
