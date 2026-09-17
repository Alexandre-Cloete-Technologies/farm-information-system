"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Keeps the Supabase session alive from the browser.
 *
 * Next middleware used to refresh the token on every request, but that route is
 * closed (see the README's "No middleware" note). A server component can read
 * cookies but not write them, so a token refreshed during SSR would be thrown
 * away and the refresh token would rotate on every page load.
 *
 * The browser client refreshes on its own timer and persists the result to
 * cookies properly, so mounting it once on the dashboard is enough. Access
 * tokens last an hour — longer than any demo — but this keeps a dashboard left
 * open all afternoon from quietly expiring.
 */
export function SessionKeeper() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/login");
      if (event === "TOKEN_REFRESHED") router.refresh();
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}
