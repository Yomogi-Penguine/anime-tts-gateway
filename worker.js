const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const MODEL = "gemini-3.8-flash-tts";

const MAX_TEXT_CHARS = 2000;
const MAX_STYLE_CHARS = 600;
const MAX_VOICE_CHARS = 128;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return new Response(APP_HTML, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
        },
      });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "anime-tts-gateway" });
    }

    if (request.method === "POST" && url.pathname === "/api/tts") {
      return handleTts(request, env);
    }

    return new Response("Not Found", { status: 404 });
  },
};

async function handleTts(request, env) {
  if (!env.ACCESS_TOKEN || !env.GEMINI_API_KEY) {
    return json({ error: "Server secrets are not configured." }, 503);
  }

  const auth = request.headers.get("Authorization") || "";
  if (!constantTimeEqual(auth, `Bearer ${env.ACCESS_TOKEN}`)) {
    return json({ error: "Unauthorized." }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }

  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const style = typeof body?.style === "string" ? body.style.trim() : "";
  const voice = typeof body?.voice === "string" ? body.voice.trim() : "Kore";

  if (!text) {
    return json({ error: "Text is required." }, 400);
  }
  if (text.length > MAX_TEXT_CHARS) {
    return json(
      { error: `Text is too long. Maximum is ${MAX_TEXT_CHARS} characters.` },
      400
    );
  }
  if (style.length > MAX_STYLE_CHARS) {
    return json(
      { error: `Style is too long. Maximum is ${MAX_STYLE_CHARS} characters.` },
      400
    );
  }
  if (!voice || voice.length > MAX_VOICE_CHARS) {
    return json({ error: "Invalid voice." }, 400);
  }

  const annotation = { type: "speech_metadata" };
  if (style) annotation.style = style;

  const payload = {
    model: MODEL,
    input: [
      {
        type: "user_input",
        content: [
          {
            type: "text",
            text,
            annotations: [annotation],
          },
        ],
      },
    ],
    response_format: {
      type: "audio",
    },
    generation_config: {
      speech_config: [
        {
          voice,
        },
      ],
    },
  };

  let upstream;
  try {
    upstream = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return json({ error: "Could not reach the TTS provider." }, 502);
  }

  if (!upstream.ok) {
    if (upstream.status === 429) {
      return json(
        { error: "The TTS provider is temporarily rate-limited." },
        429
      );
    }
    return json({ error: "The TTS provider rejected the request." }, 502);
  }

  let data;
  try {
    data = await upstream.json();
  } catch {
    return json({ error: "Invalid response from TTS provider." }, 502);
  }

  const audioBase64 = findLastAudioBlock(data);
  if (!audioBase64) {
    return json({ error: "No audio was returned." }, 502);
  }

  let bytes;
  try {
    bytes = decodeBase64(audioBase64);
  } catch {
    return json({ error: "Returned audio could not be decoded." }, 502);
  }

  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "audio/wav",
      "Content-Disposition": 'inline; filename="speech.wav"',
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function findLastAudioBlock(data) {
  let found = null;
  const steps = Array.isArray(data?.steps) ? data.steps : [];

  for (const step of steps) {
    if (step?.type !== "model_output" || !Array.isArray(step?.content)) {
      continue;
    }

    for (const item of step.content) {
      if (item?.type === "audio" && typeof item?.data === "string") {
        found = item.data;
      }
    }
  }

  return found;
}

function decodeBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return diff === 0;
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

const APP_HTML = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Anime TTS Gateway</title>
<style>
  :root { color-scheme: light dark; font-family: system-ui, -apple-system, sans-serif; }
  body { margin: 0; background: Canvas; color: CanvasText; }
  main { max-width: 720px; margin: 0 auto; padding: 22px 16px 48px; }
  h1 { font-size: 1.6rem; margin-bottom: 8px; }
  label { display: block; margin: 18px 0 6px; font-weight: 700; }
  textarea, input {
    width: 100%; box-sizing: border-box; padding: 12px;
    font: inherit; border-radius: 10px; border: 1px solid #8888;
    background: Canvas; color: CanvasText;
  }
  textarea { min-height: 130px; resize: vertical; }
  button {
    width: 100%; margin-top: 20px; padding: 13px;
    border: 0; border-radius: 10px; font: inherit; font-weight: 700;
  }
  button:disabled { opacity: .55; }
  .card { margin-top: 20px; padding: 16px; border: 1px solid #8886; border-radius: 12px; }
  .hint { font-size: .9rem; opacity: .7; }
  audio { width: 100%; margin-top: 12px; }
</style>
</head>
<body>
<main>
  <h1>Anime TTS Gateway</h1>
  <p>æç« ãGemini 3.8 Flash TTSã§WAVé³å£°ã«ãã¾ãã</p>

  <label for="text">èª­ã¿ä¸ãæç« </label>
  <textarea id="text" maxlength="${MAX_TEXT_CHARS}">ãã¯ãããããã¾ãâ¦â¦ä»æ¥ã¯ãå°ãéãã§ãã­ã</textarea>

  <label for="style">å£°ã»æ¼æ</label>
  <textarea id="style" maxlength="${MAX_STYLE_CHARS}">Soft, slightly low-pitched, breathy Japanese anime-style female voice. Calm, mysterious, restrained emotion, gentle pauses.</textarea>

  <label for="voice">Voice</label>
  <input id="voice" value="Kore" maxlength="${MAX_VOICE_CHARS}">

  <label for="token">Gateway Access Token</label>
  <input id="token" type="password" autocomplete="off">
  <div class="hint">Gemini APIã­ã¼ã§ã¯ããã¾ãããGatewayå°ç¨Tokenã§ãã</div>

  <button id="generate">é³å£°ãçæ</button>

  <div class="card">
    <div id="status">æºåå®äº</div>
    <audio id="player" controls></audio>
    <div><a id="download" download="speech.wav" hidden>WAVãä¿å­</a></div>
  </div>
</main>

<script>
const $ = id => document.getElementById(id);
const text = $("text");
const style = $("style");
const voice = $("voice");
const token = $("token");
const button = $("generate");
const status = $("status");
const player = $("player");
const download = $("download");

token.value = sessionStorage.getItem("gateway-token") || "";
let lastUrl = null;

button.addEventListener("click", async () => {
  const accessToken = token.value.trim();
  if (!accessToken) {
    status.textContent = "Access Tokenãå¥åãã¦ãã ããã";
    return;
  }

  sessionStorage.setItem("gateway-token", accessToken);
  button.disabled = true;
  status.textContent = "çæä¸­â¦";
  download.hidden = true;

  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + accessToken,
      },
      body: JSON.stringify({
        text: text.value,
        style: style.value,
        voice: voice.value,
      }),
    });

    if (!res.ok) {
      let message = "é³å£°çæã«å¤±æãã¾ããã";
      try {
        const data = await res.json();
        if (data?.error) message = data.error;
      } catch {}
      throw new Error(message);
    }

    const blob = await res.blob();

    if (lastUrl) URL.revokeObjectURL(lastUrl);
    lastUrl = URL.createObjectURL(blob);

    player.src = lastUrl;
    download.href = lastUrl;
    download.hidden = false;
    status.textContent = "çæå®äºã";
  } catch (err) {
    status.textContent = err?.message || "ã¨ã©ã¼ãçºçãã¾ããã";
  } finally {
    button.disabled = false;
  }
});
</script>
</body>
</html>`;
