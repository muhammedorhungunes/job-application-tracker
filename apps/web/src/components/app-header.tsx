import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { logout } from "@/app/(auth)/actions";

// Links use prefetch={false}: see the refresh-token caveat in src/middleware.ts.
export function AppHeader() {
  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-3">
      <Link href="/applications" prefetch={false} className="font-semibold">
        Job Application Tracker
      </Link>
      <nav className="flex items-center gap-2">
        <Link href="/applications/stats" prefetch={false} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Stats
        </Link>
        <Link href="/settings" prefetch={false} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Settings
        </Link>
        <form action={logout}>
          <Button type="submit" variant="ghost" size="sm">
            Log out
          </Button>
        </form>
      </nav>
    </header>
  );
}
