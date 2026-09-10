import { useEffect, useState } from "react";
import { matchesOutlineRail, OUTLINE_RAIL_QUERY } from "@/lib/outline-rail";

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
