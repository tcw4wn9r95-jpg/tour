"use client";
// Tour packages live on the phone (IndexedDB) so they survive reloads and
// work with a patchy connection mid-tour.
import { createStore, del, entries, get, set, type UseStore } from "idb-keyval";
import { useEffect, useState } from "react";
import type { Tour } from "../types";

let tourStore: UseStore | null = null;
let voiceStore: UseStore | null = null;
const tours = () => (tourStore ??= createStore("city-tour", "tours"));
const voices = () => (voiceStore ??= createStore("city-tour-voice", "voice"));

const cache = new Map<string, Tour>();
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function loadAll(): Promise<void> {
  loaded ??= entries<string, Tour>(tours())
    .then((all) => {
      for (const [id, tour] of all) cache.set(id, tour);
    })
    .catch((err) => {
      console.error("Could not read saved tours", err);
    });
  return loaded;
}

export async function listTours(): Promise<Tour[]> {
  await loadAll();
  return [...cache.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getTour(id: string): Promise<Tour | undefined> {
  await loadAll();
  return cache.get(id);
}

export async function saveTour(tour: Tour): Promise<void> {
  await loadAll();
  cache.set(tour.id, tour);
  notify();
  await set(tour.id, tour, tours());
}

export async function deleteTour(id: string): Promise<void> {
  await loadAll();
  cache.delete(id);
  notify();
  await del(id, tours());
}

// Updates are chained per tour so background tasks never overwrite each other.
const chains = new Map<string, Promise<unknown>>();

export function updateTour(id: string, change: (tour: Tour) => Tour): Promise<Tour | undefined> {
  const run = async () => {
    const current = await getTour(id);
    if (!current) return undefined;
    const next = change(current);
    await saveTour(next);
    return next;
  };
  const p = (chains.get(id) ?? Promise.resolve()).then(run, run);
  chains.set(id, p);
  return p;
}

export function useTours(): Tour[] | null {
  const [value, setValue] = useState<Tour[] | null>(null);
  useEffect(() => {
    let alive = true;
    const refresh = () => listTours().then((t) => alive && setValue(t));
    refresh();
    listeners.add(refresh);
    return () => {
      alive = false;
      listeners.delete(refresh);
    };
  }, []);
  return value;
}

/** undefined while loading, null when the tour doesn't exist. */
export function useTour(id: string | undefined): Tour | null | undefined {
  const [value, setValue] = useState<Tour | null | undefined>(() => (id ? cache.get(id) : null));
  useEffect(() => {
    if (!id) return;
    let alive = true;
    const refresh = () => getTour(id).then((t) => alive && setValue(t ?? null));
    refresh();
    listeners.add(refresh);
    return () => {
      alive = false;
      listeners.delete(refresh);
    };
  }, [id]);
  return value;
}

// ---------------------------------------------------------------------------
// Voice recordings (MP3 from the TTS service), keyed by text hash.

export function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${(h >>> 0).toString(16)}-${text.length}`;
}

export async function getVoice(key: string): Promise<Blob | undefined> {
  try {
    return await get<Blob>(key, voices());
  } catch {
    return undefined;
  }
}

export async function putVoice(key: string, blob: Blob): Promise<void> {
  try {
    await set(key, blob, voices());
  } catch (err) {
    console.warn("Could not cache narration audio", err);
  }
}
