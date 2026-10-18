"use client";

import { Button } from "@/components/ui/button";

/** Client-side only for the confirm() prompt; the delete itself is a server action. */
export function DeleteApplicationButton({ action }: { action: () => Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("Delete this application?")) event.preventDefault();
      }}
    >
      <Button type="submit" variant="outline">
        Delete
      </Button>
    </form>
  );
}
