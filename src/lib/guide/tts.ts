import { ttsProvider, type TtsKeys } from "./env";
import {
  clipCost,
  DEFAULT_ELEVENLABS_MODEL,
  isExhausted,
  markExhausted,
  readUsage,
  recordSpend,
  refuseClip,
  VoiceBudgetError,
  type VoicePriority,
} from "./voice-budget";

const GUIDE_STYLE =
  "You are a warm, engaging travel-podcast host and tour guide. Speak clear, well-paced English with friendly enthusiasm, " +
  "natural pauses between sentences, and a smile in your voice. Never rush.";

/** Returns an MP3 of `text` read by the configured voice. */
export async function synthesize(keys: TtsKeys, text: string, priority: VoicePriority, signal?: AbortSignal): Promise<ArrayBuffer> {
  const provider = ttsProvider(keys);
  if (provider === "elevenlabs") {
    const apiKey = keys.elevenlabsKey!;
    const stayFree = keys.elevenlabsStayFree !== false;
    // Flash costs half as much per character: twice the minutes on the free plan.
    const model = keys.elevenlabsModel || (stayFree ? DEFAULT_ELEVENLABS_MODEL : "eleven_multilingual_v2");
    const cost = clipCost(text, model);
    const usage = await readUsage(apiKey, stayFree);
    const refusal = usage ? refuseClip(usage, cost, priority) : isExhausted(apiKey) ? "This month's ElevenLabs credits are used up — using the iPhone voice." : null;
    if (refusal) throw new VoiceBudgetError(refusal);

    const voice = keys.elevenlabsVoice || "JBFqnCBsd6RMkjVDRZzb";
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        signal,
        headers: {
          "xi-api-key": apiKey,
          "content-type": "application/json",
          accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: model,
          voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true },
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      if (/quota_exceeded/.test(body)) {
        markExhausted(apiKey);
        throw new VoiceBudgetError("This month's ElevenLabs credits are used up — using the iPhone voice.");
      }
      throw new Error(`ElevenLabs TTS failed (${res.status}): ${body.slice(0, 200)}`);
    }
    recordSpend(apiKey, cost);
    return res.arrayBuffer();
  }
  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      signal,
      headers: { authorization: `Bearer ${keys.openaiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: keys.openaiModel || "gpt-4o-mini-tts",
        voice: keys.openaiVoice || "ash",
        input: text,
        instructions: GUIDE_STYLE,
        response_format: "mp3",
      }),
    });
    if (!res.ok) throw new Error(`OpenAI TTS failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
    return res.arrayBuffer();
  }
  throw new Error("No voice service configured");
}
