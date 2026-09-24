"use client";
import { useEffect, useState } from "react";
import { loadConfig, onConfigChange, type AppConfigResponse } from "./api";

/** App configuration; updates when keys are changed in Settings. */
export function useConfig(): AppConfigResponse | null {
  const [config, setConfig] = useState<AppConfigResponse | null>(null);
  useEffect(() => {
    let alive = true;
    loadConfig()
      .then((c) => alive && setConfig(c))
      .catch(() => {});
    const off = onConfigChange((c) => alive && setConfig(c));
    return () => {
      alive = false;
      off();
    };
  }, []);
  return config;
}
