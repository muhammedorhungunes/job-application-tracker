import { ApplicationStatsSchema } from "@job-tracker/types";
import { StatTile } from "@/components/stats/stat-tile";
import { StatusBarChart } from "@/components/stats/status-bar-chart";
import { WeeklyChart } from "@/components/stats/weekly-chart";
import { serverApiFetch } from "@/lib/session";
import { formatPercent } from "@/lib/stats";

export default async function StatsPage() {
  const stats = await serverApiFetch("/applications/stats", ApplicationStatsSchema);

  return (
    <>
      <h1 className="text-2xl font-semibold">Stats</h1>

      {stats.total === 0 ? (
        <p className="text-muted-foreground">No applications yet. Stats appear once you add one.</p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <StatTile label="Applications" value={String(stats.total)} />
            <StatTile
              label="Waiting too long"
              value={String(stats.stale.count)}
              hint={`No update in ${stats.stale.thresholdDays}+ days`}
            />
            <StatTile label="Reached interview" value={formatPercent(stats.conversion.interviewRate)} />
            <StatTile label="Got an offer" value={formatPercent(stats.conversion.offerRate)} />
            <StatTile label="Offer after interview" value={formatPercent(stats.conversion.offerFromInterviewRate)} />
          </section>
          <p className="-mt-2 text-xs text-muted-foreground">
            Rates count every status an application has reached, so one that was interviewed and then rejected
            still counts as interviewed. Status changes made before history tracking (Nov 2026) aren&apos;t known.
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="flex flex-col gap-4 rounded-lg border border-border p-4">
              <h2 className="font-medium">By status</h2>
              <StatusBarChart byStatus={stats.byStatus} />
            </section>
            <section className="flex flex-col gap-4 rounded-lg border border-border p-4">
              <h2 className="font-medium">Applications per week</h2>
              <WeeklyChart weekly={stats.weekly} />
            </section>
          </div>
        </>
      )}
    </>
  );
}
