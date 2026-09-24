"use client";
import { Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { loadConfig, setPasscode } from "@/lib/client/api";

/** Only shown when the server sets APP_PASSCODE and this phone hasn't entered it yet. */
export function PasscodeGate({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadConfig()
      .then((c) => setLocked(c.passcodeRequired && !c.passcodeOk))
      .catch(() => {});
  }, []);

  if (!locked) return <>{children}</>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasscode(value.trim());
    const c = await loadConfig(true);
    if (c.passcodeOk) setLocked(false);
    else setError("That passcode didn't work.");
  };

  return (
    <main className="pt-safe flex min-h-dvh flex-col items-center justify-center px-8 text-center">
      <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-accent text-white">
        <Lock className="size-8" />
      </div>
      <h1 className="font-display text-2xl font-bold">City Tour</h1>
      <p className="mt-2 text-muted">Enter the passcode set on your server to start planning tours.</p>
      <form onSubmit={submit} className="mt-6 w-full max-w-xs space-y-3">
        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-xl border border-line bg-card px-4 py-3 text-center outline-none focus:border-accent"
          placeholder="Passcode"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button className="w-full rounded-xl bg-accent py-3 font-semibold text-white active:opacity-80">Unlock</button>
      </form>
    </main>
  );
}
