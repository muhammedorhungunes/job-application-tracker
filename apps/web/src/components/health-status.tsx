"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";

interface HealthResponse {
  status: "ok";
  timestamp: string;
}

/**
 * The one client component in the Day 1-2 scaffold — pushed as low in the
 * tree as the health page allows, per CLAUDE.md's server-by-default rule.
 * Everything above it (HealthPage) stays a server component.
 */
export function HealthStatus({ initial }: { initial: HealthResponse | null }) {
  const [health, setHealth] = useState(initial);
  const [loading, setLoading] = useState(false);

  async function recheck(): Promise<void> {
    setLoading(true);
    try {
      setHealth(await apiFetch<HealthResponse>("/health"));
    } catch {
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <p>{health ? `API is ${health.status} as of ${health.timestamp}` : "API is unreachable"}</p>
      <Button onClick={() => void recheck()} disabled={loading}>
        {loading ? "Checking..." : "Re-check"}
      </Button>
    </div>
  );
}
