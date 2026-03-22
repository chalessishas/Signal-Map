"use client";

import { useState, useEffect } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createSupabaseBrowser();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  if (loading) return null;

  if (user) {
    return (
      <div className="auth-button">
        <span className="auth-user-name">
          {user.user_metadata?.name ?? user.email?.split("@")[0]}
        </span>
        <button type="button" className="auth-sign-out" onClick={handleSignOut}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button type="button" className="auth-sign-in" onClick={handleSignIn}>
      Sign in
    </button>
  );
}
