import { test } from "node:test";
import assert from "node:assert/strict";
import { hasAudioGuide } from "./labels.ts";

test("audio only for major landmarks, never for food", () => {
  assert.equal(hasAudioGuide({ category: "architecture", landmark: true }), true);
  assert.equal(hasAudioGuide({ category: "food", landmark: true }), false);
  assert.equal(hasAudioGuide({ category: "market", landmark: true }), false);
  assert.equal(hasAudioGuide({ category: "neighborhood", landmark: false }), false);
  // tours planned before the landmark flag existed: everything but food keeps its audio
  assert.equal(hasAudioGuide({ category: "history" }), true);
  assert.equal(hasAudioGuide({ category: "food" }), false);
});
