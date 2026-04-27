"use client";

import { useEffect, useRef, useState } from "react";

import type { Preferences, RankedHackathon } from "@scout/core/schemas";

import { streamScout, type ParsedScoutEvent, type ScoutStage } from "./scout-client";

export type ScoutStatus = "idle" | "streaming" | "done" | "error";

export type ScoutStreamState = {
  status: ScoutStatus;
  stage: ScoutStage | null;
  hackathons: RankedHackathon[];
  discoveredCount: number | null;
  durationMs: number | null;
  error: { code: string; message: string } | null;
};

const initialState: ScoutStreamState = {
  status: "idle",
  stage: null,
  hackathons: [],
  discoveredCount: null,
  durationMs: null,
  error: null,
};

export function useScoutStream(prefs: Preferences | null): ScoutStreamState & { restart: () => void } {
  const [state, setState] = useState<ScoutStreamState>(initialState);
  const [nonce, setNonce] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!prefs) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ ...initialState, status: "streaming" });

    (async () => {
      try {
        for await (const event of streamScout(prefs, controller.signal)) {
          if (controller.signal.aborted) break;
          setState((prev) => reduce(prev, event));
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : String(err);
        setState((prev) => ({
          ...prev,
          status: "error",
          error: { code: "NETWORK", message },
        }));
      }
    })();

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs ? JSON.stringify(prefs) : null, nonce]);

  return { ...state, restart: () => setNonce((n) => n + 1) };
}

function reduce(state: ScoutStreamState, event: ParsedScoutEvent): ScoutStreamState {
  switch (event.type) {
    case "stage":
      return { ...state, stage: event.stage };
    case "discovered":
      return { ...state, discoveredCount: event.count };
    case "ranked":
      return {
        ...state,
        hackathons: dedupePush(state.hackathons, event.hackathon),
      };
    case "done":
      return {
        ...state,
        status: "done",
        durationMs: event.summary.durationMs,
      };
    case "error":
      return {
        ...state,
        status: "error",
        error: { code: event.code, message: event.message },
      };
    default:
      return state;
  }
}

function dedupePush(list: ScoutStreamState["hackathons"], next: ScoutStreamState["hackathons"][number]) {
  if (list.some((h) => h.url === next.url)) return list;
  return [...list, next];
}
