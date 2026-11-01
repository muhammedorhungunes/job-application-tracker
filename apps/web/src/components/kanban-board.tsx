"use client";

import { startTransition, useId, useOptimistic, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ApplicationStatusSchema, ApplicationStatusValues, type Application, type ApplicationStatus } from "@job-tracker/types";
import { updateApplicationStatus } from "@/app/applications/actions";
import { KanbanCardPreview } from "@/components/kanban-card";
import { KanbanColumn } from "@/components/kanban-column";
import { groupByStatus, moveApplication } from "@/lib/kanban";

type Move = { id: string; status: ApplicationStatus };

export function KanbanBoard({ applications }: { applications: Application[] }) {
  // A stable id keeps dnd-kit's generated aria ids identical on server and client (no hydration warning).
  const dndId = useId();
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Reverts on its own when the transition ends: on success the revalidated
  // props already contain the move, on failure they still have the old status.
  const [optimistic, applyMove] = useOptimistic(applications, (state, move: Move) =>
    moveApplication(state, move.id, move.status),
  );

  const sensors = useSensors(
    // A small distance keeps a plain click working as navigation to the detail page.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    // Cards are links, so Enter must keep opening them; Space starts a keyboard drag.
    useSensor(KeyboardSensor, { keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] } }),
  );

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    const status = ApplicationStatusSchema.safeParse(over?.id);
    const id = String(active.id);
    if (!status.success) return;
    if (optimistic.find((application) => application.id === id)?.status === status.data) return;

    setError(null);
    startTransition(async () => {
      applyMove({ id, status: status.data });
      const result = await updateApplicationStatus(id, status.data);
      if (result.error) setError(result.error);
    });
  }

  const columns = groupByStatus(optimistic);
  const activeApplication = optimistic.find((application) => application.id === activeId);

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <DndContext
        id={dndId}
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="flex items-stretch gap-3 overflow-x-auto pb-2">
          {ApplicationStatusValues.map((status) => (
            <KanbanColumn key={status} status={status} applications={columns[status]} />
          ))}
        </div>
        <DragOverlay>{activeApplication && <KanbanCardPreview application={activeApplication} />}</DragOverlay>
      </DndContext>
    </div>
  );
}
