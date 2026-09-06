import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-md border border-paper-line bg-paper px-3 text-sm outline-none focus:border-cinnabar",
        className,
      )}
      {...props}
    />
  );
}
