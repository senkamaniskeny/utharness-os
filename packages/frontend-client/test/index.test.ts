import { afterEach, describe, expect, it, vi } from "vitest";
import { UtharnessApiError, UtharnessClient, UtharnessEventStream, getRuntimeConfig } from "../src/index.js";

describe("frontend client", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("uses local-first runtime defaults and supports overrides", () => {
    expect(getRuntimeConfig()).toEqual({ apiBaseUrl: "http://127.0.0.1:4317", websocketUrl: "ws://127.0.0.1:4317/ws" });
    expect(getRuntimeConfig({ apiBaseUrl: "http://localhost:9000/", websocketUrl: "ws://localhost:9000/ws" })).toEqual({ apiBaseUrl: "http://localhost:9000", websocketUrl: "ws://localhost:9000/ws" });
  });

  it("raises a typed error for failed REST requests", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Denied" }), { status: 403, headers: { "content-type": "application/json" } })));
    await expect(new UtharnessClient().health()).rejects.toBeInstanceOf(UtharnessApiError);
  });

  it("publishes WebSocket events and connection state", () => {
    class FakeWebSocket {
      static instances: FakeWebSocket[] = [];
      readonly listeners = new Map<string, Array<(event: { data?: string }) => void>>();
      constructor(_url: string) { FakeWebSocket.instances.push(this); }
      addEventListener(type: string, listener: (event: { data?: string }) => void): void { this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]); }
      close(): void { this.emit("close", {}); }
      emit(type: string, event: { data?: string }): void { this.listeners.get(type)?.forEach((listener) => listener(event)); }
    }
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const stream = new UtharnessEventStream("ws://localhost/ws");
    const states: string[] = [];
    const events: string[] = [];
    stream.onState((state) => states.push(state));
    stream.onEvent((event) => events.push(event.type));
    stream.connect();
    const socket = FakeWebSocket.instances[0];
    socket.emit("open", {});
    socket.emit("message", { data: JSON.stringify({ type: "task.completed", payload: {}, at: new Date().toISOString() }) });
    expect(states).toContain("open");
    expect(events).toEqual(["task.completed"]);
    stream.close();
  });
});
