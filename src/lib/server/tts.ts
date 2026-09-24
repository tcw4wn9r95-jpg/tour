import "server-only";

export type TtsProvider = "elevenlabs" | "openai" | "browser";

export function ttsProvider(): TtsProvider {
  if (process.env.ELEVENLABS_API_KEY) return "elevenlabs";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "browser";
}

const GUIDE_STYLE =
  "You are a warm, engaging travel-podcast host and tour guide. Speak clear, well-paced English with friendly enthusiasm, " +
  "natural pauses between sentences, and a smile in your voice. Never rush.";

/** Returns an MP3 of `text` read by the configured voice. */
export async function synthesize(text: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  const provider = ttsProvider();
  if (provider === "elevenlabs") {
    const voice = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        signal,
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY!,
          "content-type": "application/json",
          accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2",
          voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true },
        }),
      },
    );
    if (!res.ok) throw new Error(`ElevenLabs TTS failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
    return res.arrayBuffer();
  }
  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      signal,
      headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
        voice: process.env.OPENAI_TTS_VOICE || "ash",
        input: text,
        instructions: GUIDE_STYLE,
        response_format: "mp3",
      }),
    });
    if (!res.ok) throw new Error(`OpenAI TTS failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
    return res.arrayBuffer();
  }
  throw new Error("No server voice configured");
}
