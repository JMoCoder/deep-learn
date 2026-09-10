import { useCallback, useState } from "react";
import { independentRailOpens } from "@/lib/outline-rail";
import { useOutlineRail } from "@/lib/use-outline-rail";

/**
 * Wide persistent rails keep independent open prefs.
 * matchMedia only switches persistent vs drawer layout — it must not
 * set outlineOpen and sessionOpen to the same boolean.
 */
export function useLearnRails() {
  const persistent = useOutlineRail();
  const [outlineWidePref, setOutlineWidePref] = useState(true);
  const [sessionWidePref, setSessionWidePref] = useState(true);
  const [outlineDrawerOpen, setOutlineDrawerOpen] = useState(false);
  const [sessionDrawerOpen, setSessionDrawerOpen] = useState(false);

  const { outlineOpen, sessionOpen } = independentRailOpens({
    persistent,
    outlineWidePref,
    sessionWidePref,
    outlineDrawerOpen,
    sessionDrawerOpen,
  });

  const setOutlineOpen = useCallback(
    (open: boolean) => {
      if (persistent) setOutlineWidePref(open);
      else setOutlineDrawerOpen(open);
    },
    [persistent],
  );

  const setSessionOpen = useCallback(
    (open: boolean) => {
      if (persistent) setSessionWidePref(open);
      else setSessionDrawerOpen(open);
    },
    [persistent],
  );

  return { persistent, outlineOpen, sessionOpen, setOutlineOpen, setSessionOpen };
}
