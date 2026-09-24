"use client";
import { Check, ChevronLeft, ExternalLink, KeyRound, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { IS_STATIC, loadConfig } from "@/lib/client/api";
import { clearDeviceKeys, getDeviceKeys, saveDeviceKeys, type DeviceKeys } from "@/lib/client/device-keys";
import { useConfig } from "@/lib/client/useConfig";

const VOICE_LABEL = { elevenlabs: "ElevenLabs", openai: "OpenAI", browser: "iPhone's built-in voice" };
const RESTAURANT_LABEL = { google: "Google Places ratings", web: "Claude web search", demo: "Sample picks (demo)" };

export default function Settings() {
  const config = useConfig();
  return (
    <main className="pt-safe mx-auto min-h-dvh max-w-xl pb-16">
      <header className="flex items-center gap-1 px-2 py-2">
        <Link href="/" className="flex items-center font-medium text-accent">
          <ChevronLeft className="size-7" /> Tours
        </Link>
      </header>
      <h1 className="px-5 font-display text-[34px] font-bold">Settings</h1>

      {config && (
        <section className="mx-4 mt-4 space-y-1.5 rounded-2xl bg-card p-4 text-[15px]">
          <Status ok={config.claude} label="Tour planning" value={config.claude ? `Claude (${config.model})` : "Demo mode — sample Lisbon tour"} />
          <Status ok={config.tts !== "browser"} label="Voice" value={VOICE_LABEL[config.tts]} />
          <Status ok={config.restaurants !== "demo"} label="Restaurants" value={RESTAURANT_LABEL[config.restaurants]} />
        </section>
      )}

      {IS_STATIC ? (
        <KeyForm />
      ) : (
        <p className="mx-5 mt-4 text-sm text-muted">
          This copy of the app runs on a server, which holds the API keys. Change them in the server&apos;s environment variables (see the README).
        </p>
      )}
    </main>
  );
}

function Status({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`size-2.5 shrink-0 rounded-full ${ok ? "bg-good" : "bg-car"}`} />
      <span className="w-28 shrink-0 text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function KeyForm() {
  const [keys, setKeys] = useState<DeviceKeys | null>(null);
  const [state, setState] = useState<{ kind: "idle" | "saving" | "saved" | "error"; message?: string }>({ kind: "idle" });

  useEffect(() => setKeys(getDeviceKeys()), []);
  if (!keys) return null;

  const set = (field: keyof DeviceKeys) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setKeys({ ...keys, [field]: e.target.value });
    setState({ kind: "idle" });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ kind: "saving" });
    if (keys.anthropic.trim()) {
      const { checkAnthropicKey } = await import("@/lib/client/device-env");
      const problem = await checkAnthropicKey(keys.anthropic.trim());
      if (problem) return setState({ kind: "error", message: problem });
    }
    saveDeviceKeys(keys);
    await loadConfig(true);
    setState({ kind: "saved", message: keys.anthropic.trim() ? "Saved — Claude is connected." : "Saved." });
  };

  const clear = async () => {
    if (!confirm("Remove all API keys from this device?")) return;
    clearDeviceKeys();
    setKeys(getDeviceKeys());
    await loadConfig(true);
    setState({ kind: "saved", message: "Keys removed from this device." });
  };

  return (
    <form onSubmit={save} className="mx-4 mt-6 space-y-5">
      <div className="flex gap-3 rounded-2xl bg-accent-soft p-4 text-sm">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent" />
        <p>
          This app is hosted as static files, so your keys stay <b>on this device</b> and go straight to each provider over HTTPS. Anyone who can
          use this phone&apos;s browser can use them. Set a monthly spending limit in each provider&apos;s console.
        </p>
      </div>

      <Field
        label="Anthropic API key"
        hint="Required. Plans tours, writes the guide and narration, finds restaurants."
        link="https://console.anthropic.com/settings/keys"
        placeholder="sk-ant-…"
        value={keys.anthropic}
        onChange={set("anthropic")}
      />
      <Field
        label="ElevenLabs API key"
        hint="Optional. The most natural podcast-style voice."
        link="https://elevenlabs.io/app/settings/api-keys"
        placeholder="sk_…"
        value={keys.elevenlabs}
        onChange={set("elevenlabs")}
      />
      {keys.elevenlabs && (
        <Field label="ElevenLabs voice ID" hint="Optional. Leave empty for the default narrator." value={keys.elevenlabsVoice} onChange={set("elevenlabsVoice")} plain />
      )}
      <Field
        label="OpenAI API key"
        hint="Optional alternative voice. Without either voice key, the iPhone's own voice reads the guide."
        link="https://platform.openai.com/api-keys"
        placeholder="sk-…"
        value={keys.openai}
        onChange={set("openai")}
      />
      <Field
        label="Google Places API key"
        hint="Optional. Real Google ratings and photos for restaurants. Restrict the key to this site's address in Google Cloud."
        link="https://console.cloud.google.com/apis/library/places.googleapis.com"
        placeholder="AIza…"
        value={keys.googlePlaces}
        onChange={set("googlePlaces")}
      />

      {state.message && (
        <p className={`flex items-center gap-2 text-sm font-medium ${state.kind === "error" ? "text-red-500" : "text-good"}`}>
          {state.kind === "saved" && <Check className="size-4" />}
          {state.message}
        </p>
      )}
      <button
        disabled={state.kind === "saving"}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 text-[17px] font-semibold text-white active:opacity-85 disabled:opacity-60"
      >
        {state.kind === "saving" ? <Loader2 className="size-5 animate-spin" /> : <KeyRound className="size-5" />}
        {state.kind === "saving" ? "Checking key…" : "Save keys"}
      </button>
      <button type="button" onClick={clear} className="flex w-full items-center justify-center gap-2 py-2 text-sm font-medium text-red-500">
        <Trash2 className="size-4" /> Remove all keys from this device
      </button>
    </form>
  );
}

function Field({
  label,
  hint,
  link,
  placeholder,
  value,
  onChange,
  plain,
}: {
  label: string;
  hint: string;
  link?: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  plain?: boolean;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between px-1">
        <span className="font-semibold">{label}</span>
        {link && (
          <a href={link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-medium text-accent">
            Get a key <ExternalLink className="size-3" />
          </a>
        )}
      </span>
      <input
        type={plain ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="mt-1.5 w-full rounded-xl border border-line bg-card px-4 py-3 font-mono text-[16px] outline-none focus:border-accent"
      />
      <span className="mt-1 block px-1 text-xs text-muted">{hint}</span>
    </label>
  );
}
