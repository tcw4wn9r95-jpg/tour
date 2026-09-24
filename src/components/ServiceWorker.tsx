"use client";
import { useEffect } from "react";
import { BASE } from "@/lib/client/api";

export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(`${BASE}/sw.js`, { scope: `${BASE}/` }).catch((err) => console.warn("Service worker failed", err));
  }, []);
  return null;
}
