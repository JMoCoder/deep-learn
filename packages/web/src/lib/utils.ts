import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function phaseLabel(phase: string): string {
  switch (phase) {
    case "idle":
      return "未开始";
    case "boundary_interview":
      return "边界访谈";
    case "outline_draft":
      return "大纲起草";
    case "learning":
      return "学习中";
    default:
      return phase;
  }
}
