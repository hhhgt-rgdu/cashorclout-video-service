const Anthropic = require("@anthropic-ai/sdk");
const { createClient } = require("@supabase/supabase-js");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const getSupabase = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const SYSTEM_PROMPT = `You are CashOrClout — a sharp, calm, precise BS detector for AI income claims from social media.

Your job: stress-test the claim. No fluff. No hedging. No business theory essays.

You may receive either:
- A manually entered idea and income claim
- A transcript and description from a TikTok/Instagram/YouTube video

In both cases, extract what's being claimed and run the full analysis.

Respond ONLY with a valid JSON object. No markdown. No code fences. Raw JSON only.

JSON structure:
{
  "plainEnglish": "1-2 sentences. What this actually is.",
  "truths": ["bullet 1", "bullet 2", "bullet 3", "bullet 4"],
  "effortScore": 7,
  "isEasy": "No",
  "whyFeelsEasy": "Short punchy explanation.",
  "whyNot": "Short punchy explanation.",
  "realisticTime": "3–9 months",
  "verdict": "One strong closing sentence.",
  "whatWorks": "2-3 sentences. Concrete alternative. Specific. Actionable."
}

Rules:
- effortScore: 1–10 integer
- isEasy: exactly one of "Yes", "No", "Only if experienced"
- Output raw JSON only. No markdown. No backticks. No code fences.`;

async function getVideoTranscript(url) {
  const serviceUrl = process.env.VIDEO_SERVICE_URL;
  const serviceSecret = process.env.VIDEO_SERVICE_SECRET;

  if (!serviceUrl) throw new Error("VIDEO_SERVICE_URL not configured");

  const res = await fetch(`${serviceUrl}/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, secret: serviceSecret }),
  });

  if (!res.ok) throw new Error(`Video service error: ${res.status}`);
  return await res.json();
}

function isUrl(str) {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const { idea, claim, timeframe, videoUrl } = JSON.parse(event.body);

    let userMessage;
    let inputSummary = { idea, claim, timeframe };

    if (videoUrl && isUrl(videoUrl)) {
      // Video URL mode
      try {
        const video = await getVideoTranscript(videoUrl);
        userMessage = `
The user submitted a social media video for analysis.
Video URL: ${videoUrl}

Video transcript:
${video.transcript || "(no speech detected)"}

Video description:
${video.description || "(no description)"}

Identify what AI business idea and income claim is being promoted in this video, then run the full CashOrClout analysis.`.trim();
        inputSummary = { videoUrl, transcript: video.transcript?.slice(0, 200) };
      } catch (videoErr) {
        console.error("Video fetch failed:", videoErr);
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Could not process that video. Try a different link or enter the idea manually." }),
        };
      }
    } else {
      // Manual text mode
      userMessage = `
AI Business Idea: ${idea}
Income Claim: ${claim}
Timeframe: ${timeframe || "not specified"}

Run the full analysis.`.trim();
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const raw = message.content[0].text;
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    parsed.id = id;
    parsed.input = inputSummary;

    try {
      const supabase = getSupabase();
      await supabase.from("analyses").insert({ id, data: parsed });
    } catch (dbErr) {
      console.error("Supabase save failed:", dbErr);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Analysis failed. Try again." }),
    };
  }
};
