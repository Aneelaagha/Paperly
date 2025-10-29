// --- Paperly content script (Summarizer + Rewriter Humaniser + Cite + Translator) ---
console.log("[Paperly] content script loaded");


function installRewriterOriginTrial(token) {
  try {
    // Avoid duplicate meta if reloaded
    if (document.querySelector('meta[http-equiv="origin-trial"][data-paperly="rewriter"]')) return;

    const meta = document.createElement('meta');
    meta.httpEquiv = 'origin-trial';
    meta.content = token; // <— your token goes here
    meta.setAttribute('data-paperly', 'rewriter');
    (document.head || document.documentElement).appendChild(meta);
  } catch (e) {
    console.warn('[Paperly] Failed to inject origin-trial meta:', e);
  }
}

// Inject token at startup (Chrome 137–148 joint trial for Writer/Rewriter)
installRewriterOriginTrial("A3ZRgDDZ7qwtc+nYmqHLUAFJYcAi7KcvEYm//ouzrFOAoH5dz6XUpt2a9EwqdgoHX9CfapqKAlty+QPORHx1AAoAAACCeyJvcmlnaW4iOiJjaHJvbWUtZXh0ZW5zaW9uOi8vcG5iZWhibmhhcGRnaWZiampvYm1mYnBoZ2dia2hqa28iLCJmZWF0dXJlIjoiQUlSZXdyaXRlckFQSSIsImV4cGlyeSI6MTc2OTQ3MjAwMCwiaXNUaGlyZFBhcnR5Ijp0cnVlfQ==");

/* ===================== Utilities ===================== */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function cap(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1) : s; }
function oneLine(s){ return String(s||"").replace(/\s+/g," ").trim(); }

/* ===================== Parsing / Rendering ===================== */
function getMainTextOrSelection() {
  const sel = (window.getSelection && window.getSelection().toString()) || "";
  if (sel.trim().split(/\s+/).length > 20) return sel.trim();

  const roots = [document.querySelector("article"), document.querySelector("main"), document.body];
  const seen = new Set();
  let text = "";

  for (const root of roots) {
    if (!root) continue;
    const clone = root.cloneNode(true);
    clone.querySelectorAll("script, style, nav, footer, header, aside, form, svg, noscript").forEach(n => n.remove());
    const nodes = clone.querySelectorAll("p, li, h1, h2, h3");
    for (const n of nodes) {
      const t = (n.innerText || "").replace(/\s+/g, " ").trim();
      if (t && !seen.has(t) && t.length > 40) { text += t + "\n"; seen.add(t); }
      if (text.length > 20000) break;
    }
    if (text.split(/\s+/).length > 150) break;
  }
  return text.trim();
}

function parseMarkdownKeypoints(md) {
  if (!md) return [];
  const lines = md.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const out = [];
  for (const line of lines) {
    const m = line.match(/^[-*•–—]\s+(.*)$/) || line.match(/^\d+[.)]\s+(.*)$/);
    if (m && m[1]) out.push(m[1].trim());
  }
  if (out.length) return out;

  // fallback split if author uses bare lines
  const para = md.replace(/\s+/g," ").trim();
  const split = para.split(/\s*[•–—-]\s+|\s*\d+[.)]\s+/).map(s=>s.trim()).filter(Boolean);
  return split.length > 1 ? split : [para];
}

function highlightNumbers(s) {
  return s.replace(/\b(\$?\d[\d,]*(?:\.\d+)?(?:%|[kKmMbB])?|\d{4}|\d+(?:x|–\d+))\b/g, `<span class="num">$1</span>`);
}
function pickKeyTerms(text, max = 6) {
  if (!text) return [];
  const caps = text.match(/\b[A-Z][a-zA-Z0-9-]{2,}\b/g) || [];
  const lowers = (text.toLowerCase().match(/\b[a-z][a-z0-9-]{3,}\b/g) || []);
  const stop = new Set(["with","from","this","that","have","which","their","about","into","after","before","over","under","between","because","therefore","where","while","within","using","than","then","also","such","other","these","those","paperly"]);
  const counts = new Map(); for (const w of lowers) { if (!stop.has(w)) counts.set(w,(counts.get(w)||0)+1); }
  const frequent = [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0, max).map(([w])=>w);
  const uniq = [];
  for (const w of caps.concat(frequent)) {
    const key = w.toLowerCase();
    if (!uniq.some(u => u.toLowerCase() === key)) uniq.push(w);
    if (uniq.length >= max) break;
  }
  return uniq;
}
function highlightTerms(s, terms) {
  if (!terms || !terms.length) return s;
  const sorted = [...terms].sort((a,b)=>b.length-a.length);
  for (const term of sorted) {
    const esc = term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const re = new RegExp(`\\b(${esc})\\b`,'gi');
    s = s.replace(re, `<mark>$1</mark>`);
  }
  return s;
}
function createTLDR(fullText) {
  const sents = (fullText || "")
    .split(/(?<=[.!?])\s+/)
    .map(s => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const firstGood = sents.find(x => x.split(/\s+/).length >= 8 && x.length <= 220);
  return firstGood || "";
}
function renderSummaryHTML(fullText, bullets) {
  const tldr = createTLDR(fullText);
  const keyTerms = pickKeyTerms(fullText, 6);
  const items = (bullets || []).map((b) => {
    const withNums = highlightNumbers(b);
    const withTerms = highlightTerms(withNums, keyTerms);
    return `<li>${withTerms}</li>`;
  }).join("");
  const tldrHTML = tldr ? `<div class="tldr"> ${highlightTerms(highlightNumbers(tldr), keyTerms)}</div>` : "";
  return `${tldrHTML}<ul>${items}</ul>`;
}

/* ===================== Deterministic Humaniser (fallback) ===================== */
function humaniseLocally(bullets) {
  const REPLACE = [
    [/\butilize\b/gi,"use"],[/\bleverage\b/gi,"use"],[/\bapproximately\b/gi,"about"],
    [/\badditionally\b/gi,"also"],[/\bmoreover\b/gi,"also"],[/\bfurthermore\b/gi,"also"],
    [/\btherefore\b/gi,"so"],[/\bhowever\b/gi,"but"],[/\bin order to\b/gi,"to"],
    [/\bdue to\b/gi,"because of"],[/\bprior to\b/gi,"before"],[/\bsubsequent to\b/gi,"after"],
  ];
  const simpNums = (s)=>s
    .replace(/\b([0-9]+)\s*percent\b/gi,"$1%")
    .replace(/\b([0-9]+)\s*million\b/gi,"$1M")
    .replace(/\b([0-9]+)\s*billion\b/gi,"$1B")
    .replace(/\b([0-9]+)\s*thousand\b/gi,"$1k");

  let changed = 0;
  const out = (bullets||[]).map((b)=>{
    let s = oneLine(b).replace(/^[-*•–—\d]+[.)]?\s*/,"");
    const original = s;
    s = simpNums(s);
    for (const [re, rep] of REPLACE) s = s.replace(re, rep);
    s = s.replace(
      /\b([\w\s,.-]+?)\s+(?:is|was|were|are)\s+([a-z]+ed)\s+by\s+([\w\s,.-]+?)\b/gi,
      (m, subj, v, agent) => `${oneLine(agent)} ${v} ${oneLine(subj)}`
    );
    if (s.length > 120) s = s.split(/, (?:and|but|so)\b/i)[0] + ".";
    s = cap(s);
    if (!/[.?!)]$/.test(s)) s += ".";
    if (s !== original) changed++;
    return s;
  });
  humaniseLocally._lastChangeCount = changed || out.length; // guarantee visible change
  return out;
}

/* ===================== Humaniser with Rewriter (preferred) or Summarizer ===================== */
async function humaniseWithModel(bullets, statusEl) {
  // Try Rewriter first (preferred)
  if ('Rewriter' in self) {
    try {
      const avail = await Rewriter.availability();
      if (avail !== 'unavailable') {
        const rw = await Rewriter.create({
          tone: 'more-casual',           
          format: 'markdown',
          length: 'shorter',             
          expectedInputLanguages: ['en'],
          expectedContextLanguages: ['en'],
          outputLanguage: 'en',
          sharedContext:
            'Rewrite study bullets into a friendly, student-facing style. ' +
            'Vary openings, prefer active voice, keep facts and figures intact.',
          monitor(m){
            m.addEventListener('downloadprogress', (e) => {
              const pct = Math.round((e.loaded || 0) * 100);
              if (statusEl) statusEl.textContent = `Downloading on-device writer… ${pct}%`;
            });
          }
        });

        const input = (bullets || []).map(b => `- ${oneLine(b)}`).join('\n');
        const md = await rw.rewrite(input, {
          context: 'Keep each bullet in ~12–22 words. Conversational, not fluffy.',
        });

        const out = parseMarkdownKeypoints(md);
        let changed = 0;
        for (let i=0;i<Math.min(out.length, bullets.length);i++){
          if (oneLine(out[i]) !== oneLine(bullets[i])) changed++;
        }
        humaniseWithModel._lastChangeCount = changed;
        if (out.length) return out;
      }
    } catch (e) {
      console.warn('[Paperly] Rewriter path failed, will try Summarizer fallback:', e);
    }
  }

  // Summarizer fallback rewrite (paraphrase style)
  if ('Summarizer' in self) {
    const availability = await Summarizer.availability().catch(()=> "unavailable");
    if (availability !== "unavailable") {
      const model = await Summarizer.create({
        type: "key-points",
        format: "markdown",
        length: "medium",
        expectedInputLanguages: ["en"],
        outputLanguage: "en",
        expectedContextLanguages: ["en"],
        sharedContext:
          "Paraphrase existing bullet points for a student. " +
          "Make them friendly and clear. Return only bullets.",
      });
      const input = (bullets || []).map(b => "- " + oneLine(b)).join("\n");
      const md = await model.summarize(input, {
        context:
          "Rewrite the bullets in a conversational, human tone. " +
          "Do not remove key facts or numbers. Avoid repeating the same sentence starts.",
      });
      const out = parseMarkdownKeypoints(md);
      let changed = 0;
      for (let i=0;i<Math.min(out.length, bullets.length);i++){
        if (oneLine(out[i]) !== oneLine(bullets[i])) changed++;
      }
      humaniseWithModel._lastChangeCount = changed;
      if (out.length) return out;
    }
  }

  // No model path—signal caller to use local fallback
  return null;
}

/* ===================== Citation helpers (unchanged) ===================== */
function toTitleCase(s) {
  if (!s) return s;
  const lowerWords = new Set(["a","an","the","and","but","or","nor","for","so","of","at","by","from","to","in","on","with","as","vs","via"]);
  return s.split(/\s+/).map((w, i, arr) => {
    const lead = w.replace(/^[“"(\[]/,'');
    const trail = lead.replace(/[.,”")\]]$/,'');
    const core = trail.toLowerCase();
    if (i !== 0 && i !== arr.length - 1 && lowerWords.has(core)) return w.toLowerCase();
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(" ");
}
function sentenceCase(s){ if (!s) return s; const lower = s.toLowerCase(); return lower.charAt(0).toUpperCase() + lower.slice(1); }
function extractPageMetadata() {
  const by = firstNonEmpty(meta('citation_author'), meta('author'), meta('article:author'), document.querySelector('[itemprop="author"]')?.textContent);
  const authors = parseAuthors(by);
  const title = firstNonEmpty(meta('citation_title'), meta('og:title'), meta('twitter:title'), document.querySelector('h1')?.innerText, document.title);
  const site = firstNonEmpty(meta('og:site_name'), meta('twitter:site'), location.hostname.replace(/^www\./,''));
  const publisher = firstNonEmpty(meta('publisher'), document.querySelector('[itemprop="publisher"]')?.textContent, site);
  const dateRaw = firstNonEmpty(
    meta('citation_publication_date'), meta('article:published_time'), meta('date'),
    document.querySelector('#footer-info-lastmod time[datetime]')?.getAttribute('datetime'),
    document.querySelector('time[datetime]')?.getAttribute('datetime'),
    document.querySelector('time')?.textContent
  );
  const url = location.href.split('#')[0];
  return { authors, title: clean(title), site: clean(site), publisher: clean(publisher), date: parseDateFlexible(dateRaw), accessed: new Date(), url };

  function meta(name){ const m1=document.querySelector(`meta[name="${name}"]`); const m2=document.querySelector(`meta[property="${name}"]`); return m1?.content||m2?.content||""; }
  function firstNonEmpty(...vals){ return vals.find(v=>v && String(v).trim()) || ""; }
  function clean(s){ return (s||"").replace(/\s+/g,' ').trim(); }
}
function parseAuthors(raw) {
  if (!raw) return [];
  const parts = raw.split(/;|, and | and | & |(?:^|,)\s*(?=[A-Z][a-z]+ [A-Z])/).map(s=>s.trim()).filter(Boolean);
  return parts.map(nameToParts);
}
function nameToParts(full) {
  full = full.replace(/\s+/g,' ').trim();
  if (/,/.test(full)) { const [family, given] = full.split(',').map(s=>s.trim()); return { given, family }; }
  const bits = full.split(' '); const family = bits.pop(); const given = bits.join(' '); return { given, family };
}
function parseDateFlexible(s) {
  if (!s) return null;
  s = s.trim(); const d = new Date(s); if (!isNaN(d)) return d;
  const m = s.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/); if (m) return new Date(`${m[2]} ${m[1]}, ${m[3]}`);
  const m2 = s.match(/([A-Za-z]+)\s+(\d{4})/); if (m2) return new Date(`${m2[1]} 1, ${m2[2]}`);
  const y = s.match(/(\d{4})/); if (y) return new Date(`${y[1]}-01-01`); return null;
}
function monthName(d, short=false) {
  const arr = short ? ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
                    : ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return arr[d.getMonth()];
}
function formatAPA(m) {
  const authorStr = m.authors.length ? m.authors.map(a => apaName(a)).join(", ") : undefined;
  let dateStr = "(n.d.)."; if (m.date) { const y=m.date.getFullYear(); const mon=monthName(m.date,true); const day=m.date.getDate(); dateStr=`(${y}${isNaN(day)?"":`, ${mon} ${day}`}).`; }
  const title = sentenceCase(m.title || m.site);
  const siteName = m.site && (!m.publisher || m.publisher === m.site) ? m.site : (m.publisher || m.site);
  const parts = []; parts.push(authorStr ? `${authorStr}.` : `${title}.`); parts.push(dateStr); if (authorStr) parts.push(`${title}.`); parts.push(`_${siteName}_.`); parts.push(m.url);
  return parts.filter(Boolean).join(" ").replace(/\s+/g,' ').trim();
  function apaName(a){ const initials=(a.given||"").split(/\s+/).filter(Boolean).map(x=>x[0].toUpperCase()+".").join(" "); return `${a.family}, ${initials}`.trim(); }
}
function formatMLA(m) {
  const authorStr = m.authors.length ? `${m.authors[0].family}, ${m.authors[0].given}` + (m.authors.length>1?", et al.":"") : "";
  const pubDate = m.date ? `${m.date.getDate()} ${monthName(m.date,true)} ${m.date.getFullYear()}` : "";
  const acc = m.accessed ? `${m.accessed.getDate()} ${monthName(m.accessed,true)} ${m.accessed.getFullYear()}` : "";
  const titleQuoted = m.title ? `"${toTitleCase(m.title)}."` : "";
  const site = m.site || ""; const publisher = m.publisher && m.publisher !== m.site ? `${m.publisher},` : "";
  return [authorStr && (authorStr + "."), titleQuoted, site ? `${site},` : "", publisher, pubDate && (`${pubDate},`), m.url + ".", acc && (`Accessed ${acc}.`)]
    .filter(Boolean).join(" ").replace(/\s+/g,' ').trim();
}
function formatChicago(m) {
  const authorStr = m.authors.length ? `${m.authors[0].given} ${m.authors[0].family}` + (m.authors.length>1?", et al.":"") : "";
  const pubDate = m.date ? `${monthName(m.date,false)} ${m.date.getDate()}, ${m.date.getFullYear()}` : "";
  const acc = m.accessed ? `${monthName(m.accessed,false)} ${m.accessed.getDate()}, ${m.accessed.getFullYear()}` : "";
  const chicagoTitle = m.title ? `"${toTitleCase(m.title)}."` : "";
  return [authorStr && (authorStr + "."), chicagoTitle, m.site ? `${m.site}.` : "", pubDate && (`${pubDate}.`), m.url + ".", acc && (`Accessed ${acc}.`)]
    .filter(Boolean).join(" ").replace(/\s+/g,' ').trim();
}
function toTitleCase(s){ if(!s) return s; const low=new Set(["a","an","the","and","but","or","nor","for","so","of","at","by","from","to","in","on","with","as","vs","via"]);
  return s.split(/\s+/).map((w,i,a)=> (i!==0 && i!==a.length-1 && low.has(w.toLowerCase())) ? w.toLowerCase() : w.charAt(0).toUpperCase()+w.slice(1)).join(" ");
}
function firstNonEmpty(...vals){ return vals.find(v=>v && String(v).trim()) || ""; }

/* ===================== Overlay / UI ===================== */
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "PAPERLY_SUMMARIZE") {
    try { showPaperlyOverlay(); } catch (e) { console.error("[Paperly] overlay error:", e); }
  }
});

let paperlyRoot = null;

function showPaperlyOverlay() {
  if (paperlyRoot) return;

  paperlyRoot = document.createElement("div");
  paperlyRoot.id = "paperly-overlay-root";
  const shadow = paperlyRoot.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; }
    .backdrop { position:fixed; inset:0; z-index:2147483647; background:rgba(0,0,0,.20);
                display:flex; justify-content:flex-end; align-items:stretch; pointer-events:auto; }
    @keyframes paperly-slide-in { from { transform: translateX(24px); opacity:0; } to { transform: translateX(0); opacity:1; } }
    .panel { width:min(540px,92vw); background:rgba(17,24,38,.80); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
             color:#E8EEFC; border-left:1px solid rgba(255,255,255,.08);
             display:flex; flex-direction:column; gap:10px; padding:14px; box-sizing:border-box; animation:paperly-slide-in 180ms ease-out; }
    .header { display:flex; justify-content:space-between; align-items:center; gap:8px; }
    .title { margin:0; font-size:16px; }
    .btn { appearance:none; border:1px solid rgba(255,255,255,.15); border-radius:10px; background:rgba(15,21,34,.75);
           color:#E8EEFC; padding:8px 10px; cursor:pointer; }
    .btn:hover { border-color:rgba(255,255,255,.28); }
    select.btn { padding:8px 10px; background:rgba(15,21,34,.75); color:#E8EEFC; }
    .row { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
    .hint { color:#9FB0D3; font-size:12px; }
    .status { color:#C7D2FE; font-size:12px; }
    .error { color:#FCA5A5; font-size:12px; }
    .result { background:rgba(15,21,34,.60); border:1px solid rgba(255,255,255,.10); border-radius:10px; padding:10px; min-height:120px; font-size:13px; }
    .result ul { margin:0 0 0 1.1em; padding:0; }
    .result li { margin:6px 0; line-height:1.35; }
    .result .tldr { font-weight:600; margin-bottom:6px; }
    .btn.loading { position: relative; color: #cfd7ee; pointer-events: none; }
    .btn.loading::before { content: ""; position: absolute; left: 8px; top: 50%; width: 14px; height: 14px; margin-top: -7px;
      border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent; animation: spin 700ms linear infinite; }
    .spinner-overlay { position: fixed; inset: 0; display: none; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.28); z-index: 2147483647; }
    .spinner-overlay.show { display: flex; }
    .spinner { width: 44px; height: 44px; border-radius: 50%; border: 3px solid #e8eefc; border-right-color: transparent; animation: spin 800ms linear infinite; }
    .result.refreshing { animation: pulse 320ms ease-out; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pulse { 0% { opacity: .6; transform: scale(.997); } 100% { opacity: 1; transform: scale(1); } }
  `;

  const wrapper = document.createElement("div");
  wrapper.className = "backdrop"; wrapper.id = "paperly-backdrop";

  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `
    <div class="header">
      <h3 class="title">Paperly — Summary</h3>
      <div class="row">
        <select class="btn" id="density" title="Summary length">
          <option value="short">Concise</option>
          <option value="medium" selected>Standard</option>
          <option value="long">Detailed</option>
        </select>
        <button class="btn" id="humanize" disabled>Humanise</button>

        <!-- ===== Translator controls (NEW) ===== -->
        <select class="btn" id="lang" title="Translate to">
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="hi">Hindi</option>
          <option value="ur">Urdu</option>
          <option value="ar">Arabic</option>
          <option value="zh">Chinese</option>
          <option value="en" selected>English</option>
        </select>
        <button class="btn" id="translate" disabled>Translate</button>
        <!-- ===================================== -->

        <button class="btn" id="copy">Copy</button>
        <button class="btn" id="close">Close</button>
      </div>
    </div>

    <div class="row">
      <button class="btn" id="generate">Generate</button>
      <span class="status" id="status">Tip: click <b>Generate</b> to summarize with Gemini Nano.</span>
    </div>

    <div class="hint">Pro tip: select a paragraph first for a focused summary.</div>
    <div class="result" id="result">Waiting to summarize…</div>

    <div class="row" id="cite-row" style="margin-top:4px">
      <select class="btn" id="cite-style" title="Citation style">
        <option value="apa">APA 7</option>
        <option value="mla">MLA 9</option>
        <option value="chicago">Chicago (Notes/Bib)</option>
      </select>
      <button class="btn" id="make-cite">Cite this page</button>
      <button class="btn" id="copy-cite" disabled>Copy citation</button>
      <span class="status" id="cite-status"></span>
    </div>
    <div class="result mono" id="cite-output" style="display:none;"></div>
  `;

  wrapper.appendChild(panel);
  shadow.append(style, wrapper);
  document.documentElement.appendChild(paperlyRoot);

  // Center spinner overlay
  const spinnerOverlay = document.createElement("div");
  spinnerOverlay.className = "spinner-overlay";
  spinnerOverlay.innerHTML = `<div class="spinner" aria-label="Loading"></div>`;
  panel.appendChild(spinnerOverlay);
  const setCenterSpinner = (on) => spinnerOverlay.classList.toggle("show", !!on);
  const setButtonLoading = (btn, on) => btn?.classList.toggle("loading", !!on);
  const refreshResultFlash = (el) => { if (!el) return; el.classList.remove("refreshing"); el.offsetHeight; el.classList.add("refreshing"); };

  // Close helpers
  const close = () => { window.removeEventListener("keydown", onEsc, true); paperlyRoot?.remove(); paperlyRoot = null; };
  const onEsc = (e) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); close(); } };
  window.addEventListener("keydown", onEsc, true);
  shadow.getElementById("close").onclick = close;
  const backdrop = shadow.getElementById("paperly-backdrop");
  backdrop.addEventListener("mousedown", (e) => { if (e.target === backdrop) close(); });

  // Controls
  const resultEl = shadow.getElementById("result");
  const statusEl = shadow.getElementById("status");
  const densitySel = shadow.getElementById("density");
  const generateBtn = shadow.getElementById("generate");
  const humanizeBtn = shadow.getElementById("humanize");
  const translateBtn = shadow.getElementById("translate");          // NEW
  const langSel = shadow.getElementById("lang");                    // NEW
  shadow.getElementById("copy").onclick = () => navigator.clipboard.writeText(resultEl.innerText || "");

  // Cite controls
  const citeBtn = shadow.getElementById("make-cite");
  const citeCopyBtn = shadow.getElementById("copy-cite");
  const citeStyleSel = shadow.getElementById("cite-style");
  const citeOut = shadow.getElementById("cite-output");
  const citeStatus = shadow.getElementById("cite-status");

  // Data
  const sourceText = getMainTextOrSelection();
  let currentBullets = [];
  let humanisedBullets = null;
  let humanisedOn = false;

  // Translator state (NEW)
  let translatedOn = false;
  let originalHTMLForTranslate = "";
  let translatorInstance = null;

  /* -------- Summarize -------- */
  generateBtn.addEventListener("click", async () => {
    try {
      setCenterSpinner(true); setButtonLoading(generateBtn, true);
      resultEl.textContent = "Summarizing…";

      if (!('Summarizer' in self)) {
        statusEl.innerHTML = `<span class="error">Summarizer API not supported in this browser.</span>`;
        setCenterSpinner(false); setButtonLoading(generateBtn, false); return;
      }
      const availability = await Summarizer.availability();
      if (availability === 'unavailable') {
        statusEl.innerHTML = `<span class="error">Summarizer API unavailable on this device/Chrome.</span>`;
        setCenterSpinner(false); setButtonLoading(generateBtn, false); return;
      }
      if (!navigator.userActivation.isActive) {
        statusEl.innerHTML = `<span class="error">Click "Generate" again to activate.</span>`;
        setCenterSpinner(false); setButtonLoading(generateBtn, false); return;
      }

      const opts = {
        type: 'key-points',
        format: 'markdown',
        length: densitySel.value,
        expectedInputLanguages: ['en'],
        outputLanguage: 'en',
        expectedContextLanguages: ['en'],
        sharedContext: 'Summarize for students; clear, factual bullets.',
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            const pct = Math.round((e.loaded || 0) * 100);
            statusEl.textContent = `${pct}%`;
          });
        }
      };
      const model = await Summarizer.create(opts);
      statusEl.textContent = 'Generating summary…';

      const text = sourceText || "";
      if (!text || text.split(/\s+/).length < 30) {
        statusEl.innerHTML = `<span class="error">Not enough content detected. Select a larger passage.</span>`;
        setCenterSpinner(false); setButtonLoading(generateBtn, false); return;
      }

      const md = await model.summarize(text, { context: 'Make helpful key points for a student reader.' });
      currentBullets = parseMarkdownKeypoints(md);

      humanisedBullets = null;
      humanisedOn = false;
      translatedOn = false;
      translatorInstance = null;
      originalHTMLForTranslate = "";
      humanizeBtn.textContent = "Humanise";
      humanizeBtn.disabled = false;

      // Enable Translate only when we have something to translate
      translateBtn.disabled = false;

      resultEl.innerHTML = renderSummaryHTML(text, currentBullets);
      statusEl.textContent = 'Completed!';
      setCenterSpinner(false); setButtonLoading(generateBtn, false);
      refreshResultFlash(resultEl);
    } catch (err) {
      console.error("[Paperly] Summarizer error:", err);
      statusEl.innerHTML = `<span class="error">Summarizer failed. Please try again.</span>`;
      setCenterSpinner(false); setButtonLoading(generateBtn, false);
    }
  });

  /* -------- Humanise (Rewriter preferred, then Summarizer, then local) -------- */
  humanizeBtn.addEventListener("click", async () => {
    if (!currentBullets.length) return;

    // If currently showing translation, restore original before humanising toggles
    if (translatedOn) {
      resultEl.innerHTML = originalHTMLForTranslate || resultEl.innerHTML;
      translatedOn = false;
      translateBtn.textContent = "Translate";
    }

    if (humanisedOn) {
      resultEl.innerHTML = renderSummaryHTML(sourceText, currentBullets);
      humanisedOn = false;
      humanizeBtn.textContent = "Humanise";
      statusEl.textContent = 'Original summary restored.';
      return;
    }

    if (humanisedBullets && humanisedBullets.length) {
      resultEl.innerHTML = renderSummaryHTML(sourceText, humanisedBullets);
      humanisedOn = true;
      humanizeBtn.textContent = "Original";
      const n = (humaniseWithModel._lastChangeCount || humaniseLocally._lastChangeCount || 0);
      statusEl.textContent = `Humanised tone applied (${n} bullet${n===1?"":"s"} updated).`;
      refreshResultFlash(resultEl);
      return;
    }

    try {
      statusEl.textContent = "Rewriting on-device…";
      setCenterSpinner(true); setButtonLoading(humanizeBtn, true);

      // Prefer Rewriter; fallback to Summarizer paraphrase; then to local deterministic
      let rewritten = await humaniseWithModel(currentBullets, statusEl).catch(()=>null);
      if (!rewritten || !rewritten.length) {
        rewritten = humaniseLocally(currentBullets);
      }

      humanisedBullets = rewritten;
      resultEl.innerHTML = renderSummaryHTML(sourceText, humanisedBullets);
      humanisedOn = true;
      humanizeBtn.textContent = "Original";

      const n = (humaniseWithModel._lastChangeCount || humaniseLocally._lastChangeCount || 0);
      statusEl.textContent = `Humanised tone applied (${n} bullet${n===1?"":"s"} updated).`;
      refreshResultFlash(resultEl);
    } catch (e) {
      console.error("[Paperly] Humaniser error:", e);
      statusEl.innerHTML = `<span class="error">Humaniser failed. Please try again.</span>`;
    } finally {
      setCenterSpinner(false); setButtonLoading(humanizeBtn, false);
    }
  });

  /* -------- Translate (NEW) -------- */
  translateBtn.addEventListener("click", async () => {
    try {
      if (!currentBullets.length && !resultEl.innerText.trim()) return;

      // Toggle back to original if already translated
      if (translatedOn) {
        resultEl.innerHTML = originalHTMLForTranslate || resultEl.innerHTML;
        translatedOn = false;
        translateBtn.textContent = "Translate";
        statusEl.textContent = "Original language restored.";
        return;
      }

      if (!('Translator' in self)) {
        statusEl.innerHTML = `<span class="error">Translator API not supported in this browser.</span>`;
        return;
      }

      const target = (langSel.value || 'en').trim();
      // Best-effort guess for source language from the page/UA
      const guessSource = (navigator.language || 'en').split('-')[0] || 'en';

      statusEl.textContent = "Checking translation availability…";

      const avail = await Translator.availability({
        sourceLanguage: guessSource,
        targetLanguage: target
      }).catch(() => 'unavailable');

      if (avail === 'unavailable') {
        statusEl.innerHTML = `<span class="error">Translator unavailable for ${guessSource} → ${target} on this device.</span>`;
        return;
      }

      setCenterSpinner(true); setButtonLoading(translateBtn, true);

      if (!translatorInstance) {
        translatorInstance = await Translator.create({
          sourceLanguage: guessSource,
          targetLanguage: target,
          monitor(m) {
            m.addEventListener('downloadprogress', (e) => {
              const pct = Math.round((e.loaded || 0) * 100);
              statusEl.textContent = `Translating … ${pct}%`;
            });
          }
        });
      }

      // Grab plain text of the rendered bullets so we preserve items when re-rendering
      const rawText = (resultEl.innerText || "").trim();
      if (!rawText) {
        statusEl.innerHTML = `<span class="error">Nothing to translate yet. Generate a summary first.</span>`;
        setCenterSpinner(false); setButtonLoading(translateBtn, false);
        return;
      }

      statusEl.textContent = "Translating on-device…";
      const translated = await translatorInstance.translate(rawText);

      // Keep original HTML for toggle-back
      if (!originalHTMLForTranslate) originalHTMLForTranslate = resultEl.innerHTML;

      // Render translated text as simple paragraphs preserving line breaks
      const safe = translated
        .split(/\n+/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => `<p>${line.replace(/[&<>]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[s]))}</p>`)
        .join("");

      resultEl.innerHTML = safe || `<p>${translated}</p>`;
      translatedOn = true;
      translateBtn.textContent = "Original";
      statusEl.textContent = `Translated to ${target.toUpperCase()}.`;
      refreshResultFlash(resultEl);
    } catch (e) {
      console.error("[Paperly] Translator error:", e);
      statusEl.innerHTML = `<span class="error">Translation failed. Try another language or reload.</span>`;
    } finally {
      setCenterSpinner(false); setButtonLoading(translateBtn, false);
    }
  });

  /* -------- Cite current page -------- */
  citeBtn.addEventListener("click", () => {
    try {
      citeStatus.textContent = "Building citation…";
      const m = extractPageMetadata();
      const styleVal = citeStyleSel.value;
      let citation = "";

      if (styleVal === "apa") citation = formatAPA(m);
      else if (styleVal === "mla") citation = formatMLA(m);
      else citation = formatChicago(m);

      citeOut.style.display = "block";
      citeOut.textContent = citation;
      citeCopyBtn.disabled = false;
      navigator.clipboard.writeText(citation).catch(()=>{});
      citeStatus.textContent = "Citation copied to clipboard.";
    } catch (e) {
      console.error("[Paperly] cite error:", e);
      citeStatus.innerHTML = `<span class="error">Couldn’t format. Try again.</span>`;
    }
  });

  citeCopyBtn.addEventListener("click", () => {
    const txt = citeOut.textContent || "";
    if (!txt.trim()) return;
    navigator.clipboard.writeText(txt).then(() => {
      citeStatus.textContent = "Copied.";
      setTimeout(()=> citeStatus.textContent = "", 1000);
    });
  });

  if (!sourceText) {
    shadow.getElementById("result").innerHTML = "<ul><li>Not enough content detected. Try selecting a paragraph first.</li></ul>";
  }
  statusEl.textContent = 'Tip: Click "Generate".';
}
