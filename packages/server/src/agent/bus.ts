import type { SessionEvent } from "@quantum/shared";

type Listener = (event: SessionEvent) => void;

export class EventBus {
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: SessionEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

export const bus = new EventBus();
