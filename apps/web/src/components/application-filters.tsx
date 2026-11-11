import Link from "next/link";
import { ApplicationStatusValues, type ApplicationListQuery } from "@job-tracker/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatStatus } from "@/lib/format";

const selectClassName = "h-9 rounded-md border border-border bg-transparent px-3 text-sm";

/**
 * Server component: a plain GET form, so submitting it just navigates to
 * /applications?q=...&status=... and the page re-renders with those filters.
 */
export function ApplicationFilters({ filters, techOptions }: { filters: ApplicationListQuery; techOptions: string[] }) {
  // Keep a selected value that no longer exists (e.g. from an old link) visible in the select.
  const techValues = filters.tech && !techOptions.includes(filters.tech) ? [filters.tech, ...techOptions] : techOptions;

  return (
    <form
      method="get"
      action="/applications"
      role="search"
      aria-label="Filter applications"
      className="flex flex-col gap-3 rounded-lg border border-border p-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
          <span className="font-medium">Search</span>
          <Input
            name="q"
            type="search"
            placeholder="Position or company"
            maxLength={100}
            defaultValue={filters.q ?? ""}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Tech</span>
          <select name="tech" defaultValue={filters.tech ?? ""} className={selectClassName}>
            <option value="">Any</option>
            {techValues.map((tech) => (
              <option key={tech} value={tech}>
                {tech}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Applied from</span>
          <Input name="from" type="date" defaultValue={filters.from ?? ""} className="w-auto" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Applied to</span>
          <Input name="to" type="date" defaultValue={filters.to ?? ""} className="w-auto" />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <legend className="sr-only">Status</legend>
          {ApplicationStatusValues.map((status) => (
            <label key={status} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                name="status"
                value={status}
                defaultChecked={filters.status?.includes(status) ?? false}
              />
              {formatStatus(status)}
            </label>
          ))}
        </fieldset>
        <div className="flex gap-2">
          <Link href="/applications" prefetch={false} className={buttonVariants({ variant: "outline" })}>
            Clear
          </Link>
          <Button type="submit">Apply</Button>
        </div>
      </div>
    </form>
  );
}
