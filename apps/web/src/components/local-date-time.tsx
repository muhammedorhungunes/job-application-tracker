"use client";

import { useIsClient } from "@/lib/use-is-client";

/** Formats an ISO time in the viewer's own time zone, which the server can't know. */
export function LocalDateTime({ iso }: { iso: string }) {
  const isClient = useIsClient();
  return (
    <time dateTime={iso}>
      {isClient
        ? new Date(iso).toLocaleString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })
        : "…"}
    </time>
  );
}
