import { EventEmitter } from 'node:events';

class SessionEventsManager extends EventEmitter {
  emitSessionUpdate(sessionId: string, data: Record<string, unknown>): void {
    this.emit(`session:${sessionId}`, data);
  }

  subscribe(sessionId: string, listener: (data: Record<string, unknown>) => void): () => void {
    const eventName = `session:${sessionId}`;
    this.on(eventName, listener);
    return () => {
      this.off(eventName, listener);
    };
  }
}

export const sessionEvents = new SessionEventsManager();
