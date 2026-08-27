import { apiFetch } from "@/lib/api-client";
import { HealthStatus } from "@/components/health-status";

interface HealthResponse {
  status: "ok";
  timestamp: string;
}

// Server component: the initial fetch happens here, not in the browser.
export default async function HealthPage() {
  const initial = await apiFetch<HealthResponse>("/health").catch(() => null);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">API health</h1>
      <HealthStatus initial={initial} />
    </main>
  );
}
