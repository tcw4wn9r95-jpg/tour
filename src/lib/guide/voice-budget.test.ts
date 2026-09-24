import { test } from "node:test";
import assert from "node:assert/strict";
import { budgetOf, clipCost, FREE_TIER_CREDITS, MAIN_STORY_RESERVE, refuseClip, type VoiceUsage } from "./voice-budget.ts";

const usage = (used: number, limit = FREE_TIER_CREDITS, stayFree = true): VoiceUsage => ({
  used,
  limit,
  budget: budgetOf(limit, stayFree),
  resetsAt: null,
  tier: "free",
});

test("Flash/Turbo cost half a credit per character", () => {
  assert.equal(clipCost("x".repeat(1000), "eleven_flash_v2_5"), 500);
  assert.equal(clipCost("x".repeat(1000), "eleven_multilingual_v2"), 1000);
});

test("paid plans are capped at the free allowance unless the cap is turned off", () => {
  assert.equal(budgetOf(100_000, true), FREE_TIER_CREDITS);
  assert.equal(budgetOf(100_000, false), 100_000);
  assert.equal(budgetOf(5_000, true), 5_000);
});

test("clips that fit are allowed", () => {
  assert.equal(refuseClip(usage(0), 500, "main"), null);
  assert.equal(refuseClip(usage(0), 500, "extra"), null);
});

test("highlight clips can't eat into the reserve for main stories", () => {
  const used = FREE_TIER_CREDITS - MAIN_STORY_RESERVE; // exactly the reserve left
  assert.match(refuseClip(usage(used), 300, "extra") ?? "", /main stories/);
  assert.equal(refuseClip(usage(used), 300, "main"), null);
});

test("nothing is sent once the budget is spent", () => {
  assert.match(refuseClip(usage(FREE_TIER_CREDITS - 100), 300, "main") ?? "", /used up/);
  assert.match(refuseClip(usage(12_000, 30_000), 300, "main") ?? "", /used up/); // paid account, free cap on
});
