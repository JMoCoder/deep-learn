import { useEffect, useState } from "react";
import { matchesOutlineRail, OUTLINE_RAIL_QUERY } from "@/lib/outline-rail";

/** Wide layout ≥768px. Same query as persistent Learn rails. */
export function useOutlineRail(): boolean {
  const [wide, setWide] = useState(() => matchesOutlineRail());

  useEffect(() => {
    const mq = window.matchMedia(OUTLINE_RAIL_QUERY);
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return wide;
}

export const useWideLayout = useOutlineRail;
