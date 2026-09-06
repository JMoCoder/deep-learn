import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-20 w-full resize-none rounded-md border border-paper-line bg-paper px-3 py-2 text-sm outline-none focus:border-cinnabar",
        className,
      )}
      {...props}
    />
  );
}
