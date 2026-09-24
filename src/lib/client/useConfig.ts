"use client";
import { useEffect, useState } from "react";
import { loadConfig, type AppConfigResponse } from "./api";

export function useConfig(): AppConfigResponse | null {
  const [config, setConfig] = useState<AppConfigResponse | null>(null);
  useEffect(() => {
    let alive = true;
    loadConfig()
      .then((c) => alive && setConfig(c))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return config;
}
