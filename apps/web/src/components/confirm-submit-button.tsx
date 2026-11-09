"use client";

import { Button } from "@/components/ui/button";

/** Client-side only for the confirm() prompt; the action itself is a server action. */
export function ConfirmSubmitButton({
  action,
  confirmMessage,
  label,
  size,
}: {
  action: () => Promise<void>;
  confirmMessage: string;
  label: string;
  size?: "default" | "sm";
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      <Button type="submit" variant="outline" size={size}>
        {label}
      </Button>
    </form>
  );
}
