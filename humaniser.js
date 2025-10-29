// Paperly Humaniser (MV3-safe)
let userActivated = false;

// Utils
function post(msg) { try { parent.postMessage(msg, "*"); } catch(e) {} }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Basic styles so the gate isn't a blank box
(function injectStyles(){
  const css = `
    :root { color-scheme: light dark; }
    body { margin:0; font: 14px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
    .gate { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.45); }
    .card { width:320px; padding:16px; border-radius:12px; background:#111827; color:#e8eefc; border:1px solid rgba(255,255,255,.14); }
    .card h3 { margin:0 0 8px 0; font-size:16px; }
    .card p { margin:0 0 12px 0; font-size:13px; opacity:.9; }
    .btn { appearance:none; border:1px solid rgba(255,255,255,.18); border-radius:10px;
           background:#121a2a; color:#e8eefc; padding:8px 12px; cursor:pointer; }
    .btn:hover { filter:brightness(1.06); }
    .hint { margin-top:8px; font-size:12px; opacity:.7; }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
})();

// Activation UI
function showActivateUI() {
  if (document.querySelector(".gate")) return;
  const gate = document.createElement("div");
  gate.className = "gate";
  gate.innerHTML = `
    <div class="card" role="dialog" aria-modal="true" aria-label="Enable Humaniser">
      <h3>Enable Humaniser</h3>
      <p>Click once to allow on-device rewriting for this page.</p>
      <button class="btn" id="activate">Activate</button>
      <div class="hint">You only need to do this once per page.</div>
    </div>`;
  document.body.appendChild(gate);
  gate.querySelector("#activate").addEventListener("click", () => {
    console.log("[Humaniser] Activated by user.");
    userActivated = true;
    gate.remove();
    post({ type: "PAPERLY_ACTIVATED" });
  }, { once: true });
}

// Light-touch humanise
function toHumanisedMarkdown(bullets) {
  if (!Array.isArray(bullets) || !bullets.length) return "- (no content)";
  const cleaned = bullets.map(b => {
    let s = String(b || "").trim();
    s = s.replace(/\s+/g, " ").replace(/^[-*]\s*/, "");
    s = s
      .replace(/\b(utilize|leverage)\b/gi, "use")
      .replace(/\bapproximately\b/gi, "about")
      .replace(/\badditionally\b/gi, "also")
      .replace(/\btherefore\b/gi, "so");
    if (!/[.?!)]$/.test(s)) s += ".";
    s = s.charAt(0).toUpperCase() + s.slice(1);
    return s;
  });
  return cleaned.map(x => `- ${x}`).join("\n");
}

// Router
window.addEventListener("message", async (evt) => {
  const d = evt.data || {};
  if (typeof d !== "object" || !d) return;

  if (d.type === "PING") {
    post({ type: "PONG" });
    return;
  }

  if (d.type === "SHOW_ACTIVATE") {
    showActivateUI();
    return;
  }

  if (d.type === "PAPERLY_REWRITE") {
    const { requestId, bullets } = d;

    if (!userActivated && !(navigator.userActivation && navigator.userActivation.isActive)) {
      post({ type: "PAPERLY_REWRITE_RESULT", requestId, error: "NEEDS_USER_ACTIVATION" });
      return;
    }

    post({ type: "PAPERLY_REWRITE_PROGRESS", requestId, progress: 5 });
    await sleep(120);

    const md = toHumanisedMarkdown(bullets || []);
    post({ type: "PAPERLY_REWRITE_PROGRESS", requestId, progress: 65 });
    await sleep(120);

    post({ type: "PAPERLY_REWRITE_PROGRESS", requestId, progress: 100 });
    post({ type: "PAPERLY_REWRITE_RESULT", requestId, bulletsMarkdown: md });
  }
});
