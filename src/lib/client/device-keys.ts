"use client";
// GitHub Pages build only: API keys typed into Settings, kept in this
// browser's storage and sent only to the provider they belong to.

export interface DeviceKeys {
  anthropic: string;
  elevenlabs: string;
  elevenlabsVoice: string;
  openai: string;
  googlePlaces: string;
}

const STORAGE_KEY = "citytour.keys";
const EMPTY: DeviceKeys = { anthropic: "", elevenlabs: "", elevenlabsVoice: "", openai: "", googlePlaces: "" };

export function getDeviceKeys(): DeviceKeys {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<DeviceKeys>) } : { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}

export function saveDeviceKeys(keys: DeviceKeys): void {
  const trimmed = Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, v.trim()])) as unknown as DeviceKeys;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function clearDeviceKeys(): void {
  localStorage.removeItem(STORAGE_KEY);
}
