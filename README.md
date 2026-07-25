# termite

A coding-assistant chatbot that runs **entirely in the browser** — no backend, no API key, no server code. Just static files, deployable straight to GitHub Pages.

It works by loading a small language model (`onnx-community/Qwen2.5-0.5B-Instruct`, ~350MB) directly into the browser using [Transformers.js](https://huggingface.co/docs/transformers.js). The model runs on WebGPU if available (fast), or falls back to WebAssembly/CPU (slower but still works). After the first load, the browser caches the model, so it's fast on repeat visits — and it keeps working offline.

## Deploying to GitHub Pages

1. Create a new GitHub repo (or use an existing one).
2. Add `index.html`, `style.css`, and `app.js` to the repo root (or a `/docs` folder — your choice).
3. Push to GitHub.
4. In the repo: **Settings → Pages → Source**, pick the branch (and folder) you pushed to.
5. Wait a minute, then visit `https://<your-username>.github.io/<repo-name>/`.

That's it — no build step, no `npm install`, nothing else needed.

## Notes & things to know

- **First load is slow.** The model download (~350MB) only happens once per browser/device; after that it's cached.
- **Quality is limited.** This is a 0.5B-parameter model — good for quick snippets, explanations, and simple bugs, but nowhere near a hosted model like Claude or GPT-4. It's meant to be a genuinely-free, private, offline-capable helper, not a full replacement.
- **Better code quality, bigger download:** swap `MODEL_ID` in `app.js` for `onnx-community/Qwen2.5-Coder-3B-Instruct` for noticeably better coding ability, at the cost of a much larger download (~2GB+) and needing a decent GPU for WebGPU to feel fast.
- **Browser support:** WebGPU currently works best in Chrome/Edge. Safari and Firefox will fall back to WASM (CPU), which is slower but functional.
- **Privacy:** nothing you type ever leaves the browser. There's no server to send it to.

## Files

- `index.html` — page structure
- `style.css` — terminal-style visual design
- `app.js` — loads the model via Transformers.js and runs the chat loop
