import { NewApplicationPanel } from "@/components/new-application-panel";
import { createApplication } from "../actions";

export default function NewApplicationPage() {
  return (
    // The layout is wide for the Kanban board; forms read better narrower.
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">New application</h1>
      <NewApplicationPanel action={createApplication} />
    </div>
  );
}
