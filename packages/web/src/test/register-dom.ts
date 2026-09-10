import { Window } from "happy-dom";

if (!(globalThis as { __quantumDom?: boolean }).__quantumDom) {
  const win = new Window({ url: "http://127.0.0.1/", width: 1024, height: 768 });
  const assign = [
    "window",
    "document",
    "navigator",
    "HTMLElement",
    "HTMLButtonElement",
    "Element",
    "Node",
    "Document",
    "DocumentFragment",
    "MouseEvent",
    "PointerEvent",
    "Event",
    "CustomEvent",
    "KeyboardEvent",
    "DOMParser",
    "NodeFilter",
    "getComputedStyle",
    "requestAnimationFrame",
    "cancelAnimationFrame",
  ] as const;

  Object.defineProperty(globalThis, "window", { value: win, configurable: true });
  Object.defineProperty(globalThis, "document", { value: win.document, configurable: true });
  for (const key of assign) {
    if (key === "window" || key === "document") continue;
    const value = (win as unknown as Record<string, unknown>)[key];
    if (value !== undefined) {
      Object.defineProperty(globalThis, key, { value, configurable: true });
    }
  }
  Object.defineProperty(globalThis, "localStorage", {
    value: win.localStorage,
    configurable: true,
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    value: win.sessionStorage,
    configurable: true,
  });
  if (typeof win.matchMedia !== "function") {
    Object.defineProperty(win, "matchMedia", {
      configurable: true,
      value: (query: string) => {
        const widthMatch = /min-width:\s*([\d.]+)(px|rem)/.exec(query);
        let matches = false;
        if (widthMatch) {
          const n = Number(widthMatch[1]);
          const px = widthMatch[2] === "rem" ? n * 16 : n;
          matches = (win.innerWidth ?? 1024) >= px;
        }
        return {
          matches,
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
          onchange: null,
        };
      },
    });
  }
  Object.defineProperty(globalThis, "matchMedia", {
    configurable: true,
    value: win.matchMedia.bind(win),
  });
  (globalThis as { __quantumDom?: boolean }).__quantumDom = true;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
}

class FakeEventSource {
  url: string;
  constructor(url: string) {
    this.url = url;
  }
  addEventListener(): void {}
  removeEventListener(): void {}
  close(): void {}
}

globalThis.EventSource = FakeEventSource as typeof EventSource;
