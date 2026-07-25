import { pipeline, TextStreamer } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2";

const MODEL_ID = "onnx-community/Qwen2.5-0.5B-Instruct";
const SYSTEM_PROMPT =
  "You are a concise, helpful coding assistant. Give correct, working code. " +
  "Keep explanations short unless asked for more detail. Use markdown code fences for code.";

const els = {
  loadBtn: document.getElementById("loadBtn"),
  boot: document.getElementById("boot"),
  chat: document.getElementById("chat"),
  composer: document.getElementById("composer"),
  input: document.getElementById("input"),
  sendBtn: document.getElementById("sendBtn"),
  progressWrap: document.getElementById("progressWrap"),
  progressFill: document.getElementById("progressFill"),
  progressLabel: document.getElementById("progressLabel"),
  statusDot: document.getElementById("statusDot"),
  statusText: document.getElementById("statusText"),
};

let generator = null;
let history = [{ role: "system", content: SYSTEM_PROMPT }];
let busy = false;

function setStatus(mode, text) {
  els.statusDot.className = "dot" + (mode ? " " + mode : "");
  els.statusText.textContent = text;
}

async function detectDevice() {
  if (navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) return "webgpu";
    } catch (_) {}
  }
  return "wasm";
}

function trackedFiles() {
  return new Map(); // filename -> {loaded, total}
}

async function loadModel() {
  els.loadBtn.disabled = true;
  els.progressWrap.hidden = false;
  setStatus("busy", "downloading model…");

  const device = await detectDevice();
  const files = trackedFiles();

  const progressCallback = (data) => {
    if (data.status === "progress" && data.file) {
      files.set(data.file, { loaded: data.loaded || 0, total: data.total || 0 });
      let loaded = 0, total = 0;
      for (const f of files.values()) { loaded += f.loaded; total += f.total; }
      const pct = total ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
      els.progressFill.style.width = pct + "%";
      els.progressLabel.textContent = `downloading model… ${pct}%`;
    } else if (data.status === "ready") {
      els.progressLabel.textContent = "warming up…";
    }
  };

  try {
    generator = await pipeline("text-generation", MODEL_ID, {
      device,
      dtype: device === "webgpu" ? "q4f16" : "q8",
      progress_callback: progressCallback,
    });

    els.progressLabel.textContent = `ready — running on ${device === "webgpu" ? "your GPU" : "CPU (WASM)"}`;
    setStatus("ready", `ready · ${device}`);
    setTimeout(() => {
      els.boot.hidden = true;
      els.chat.hidden = false;
      els.composer.hidden = false;
      els.input.focus();
    }, 500);
  } catch (err) {
    console.error(err);
    els.progressLabel.textContent = "failed to load — see console. try a browser with WebGPU (Chrome/Edge) or reload.";
    setStatus(null, "load failed");
    els.loadBtn.disabled = false;
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Minimal renderer: turns ```fenced code``` and `inline code` into markup.
function renderMarkdownish(raw) {
  const escaped = escapeHtml(raw);
  const withBlocks = escaped.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });
  return withBlocks.replace(/`([^`\n]+)`/g, "<code>$1</code>");
}

function addMessage(role, text) {
  const wrap = document.createElement("div");
  wrap.className = "msg " + (role === "user" ? "user" : "ai");
  const who = document.createElement("div");
  who.className = "who";
  who.textContent = role === "user" ? "you" : "termite";
  const body = document.createElement("div");
  body.className = "body";
  wrap.appendChild(who);
  wrap.appendChild(body);
  els.chat.appendChild(wrap);
  els.chat.scrollTop = els.chat.scrollHeight;
  return body;
}

async function sendMessage(text) {
  if (!text.trim() || busy || !generator) return;
  busy = true;
  els.sendBtn.disabled = true;
  setStatus("busy", "thinking…");

  addMessage("user", text).textContent = text;
  history.push({ role: "user", content: text });

  const bodyEl = addMessage("ai", "");
  const cursor = document.createElement("span");
  cursor.className = "cursor-blink";
  bodyEl.appendChild(cursor);

  let rendered = "";
  const streamer = new TextStreamer(generator.tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (chunk) => {
      rendered += chunk;
      bodyEl.innerHTML = renderMarkdownish(rendered);
      bodyEl.appendChild(cursor);
      els.chat.scrollTop = els.chat.scrollHeight;
    },
  });

  try {
    const output = await generator(history, {
      max_new_tokens: 256,
      do_sample: false,
      repetition_penalty: 1.15,
      streamer,
    });
    const full = output[0].generated_text;
    const reply = full[full.length - 1].content;
    history.push({ role: "assistant", content: reply });
    bodyEl.innerHTML = renderMarkdownish(reply);
  } catch (err) {
    console.error(err);
    bodyEl.innerHTML = renderMarkdownish("[error generating a response — see console]");
  } finally {
    busy = false;
    els.sendBtn.disabled = false;
    setStatus("ready", "ready");
    els.input.value = "";
    els.input.style.height = "auto";
    els.input.focus();
  }
}

els.loadBtn.addEventListener("click", loadModel);

els.composer.addEventListener("submit", (e) => {
  e.preventDefault();
  sendMessage(els.input.value);
});

els.input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage(els.input.value);
  }
});

els.input.addEventListener("input", () => {
  els.input.style.height = "auto";
  els.input.style.height = Math.min(els.input.scrollHeight, 160) + "px";
});
