"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LocalRaidResult, LocalRaidSnapshot } from "@/lib/local-raid-types";

type ResponseBody = { state: LocalRaidSnapshot; result?: LocalRaidResult; error?: string };
async function request(path: string, init?: RequestInit): Promise<ResponseBody> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(path, { ...init, cache: "no-store", signal: controller.signal });
    const body = await response.json() as ResponseBody;
    if (!response.ok) throw new Error(body.error || "同期サーバーに接続できません。");
    return body;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("接続がタイムアウトしました。PCと同じWi-Fiか確認してください。");
    throw error;
  } finally { window.clearTimeout(timeout); }
}

export function useLocalRaid(enabled: boolean, personal = false) {
  const [state, setState] = useState<LocalRaidSnapshot | null>(null);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const applied = useRef(0);
  const mounted = useRef(true);
  const latest = useRef<{ roomId: string; revision: number } | null>(null);
  const pending = useRef<{ roomId: string; revision: number } | null>(null);
  const accept = useCallback((body: ResponseBody, id: number) => {
    if (!mounted.current) return;
    if (latest.current?.roomId === body.state.roomId && body.state.revision < latest.current.revision) return;
    if (latest.current?.roomId !== body.state.roomId && id < applied.current) return;
    applied.current = Math.max(id, applied.current);
    latest.current = { roomId: body.state.roomId, revision: body.state.revision };
    const turn = body.state.me?.lastResult?.turn;
    pending.current = turn && turn > body.state.counterTurn ? { roomId: body.state.roomId, revision: body.state.revision } : null;
    setState(body.state); setError("");
  }, []);
  const refresh = useCallback(async () => {
    const id = ++sequence.current;
    const wait = personal && pending.current;
    const body = await request(`/api/local-raid${personal ? `?personal=1${wait ? `&waitForRevision=${wait.revision}&roomId=${encodeURIComponent(wait.roomId)}` : ""}` : ""}`);
    accept(body, id);
  }, [personal, accept]);

  useEffect(() => {
    mounted.current = true;
    if (!enabled) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try { await refresh(); }
      catch (reason) { if (active) setError(reason instanceof Error ? reason.message : "同期に失敗しました。"); }
      if (active) timer = setTimeout(poll, 500);
    };
    void poll();
    return () => { active = false; mounted.current = false; clearTimeout(timer); };
  }, [enabled, refresh]);

  const send = useCallback(async (payload: object) => {
    const id = ++sequence.current;
    const body = await request("/api/local-raid", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    accept(body, id);
    return body;
  }, [accept]);
  return { state, error, send, refresh };
}

// randomUUID is unavailable over ordinary LAN HTTP on some phones.
export function localRequestId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = bytes[6] & 15 | 64;
  bytes[8] = bytes[8] & 63 | 128;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
