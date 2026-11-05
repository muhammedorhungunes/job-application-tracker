import Link from "next/link";
import type { ReactNode } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { logout } from "../(auth)/actions";

export default function ApplicationsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <Link href="/applications" prefetch={false} className="font-semibold">
          Job Application Tracker
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/applications/stats" prefetch={false} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Stats
          </Link>
          <form action={logout}>
            <Button type="submit" variant="ghost" size="sm">
              Log out
            </Button>
          </form>
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">{children}</main>
    </div>
  );
}
