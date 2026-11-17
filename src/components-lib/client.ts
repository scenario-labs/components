// components-lib behaviour, as photoshop.scenario.com behaves: the contents
// rail (open beside the page, a closed card on narrow screens, the section in
// view marked), search ("/" focuses it), drag to compare, the film, and
// pictures that enlarge. A browser script: the builder strips its types and
// inlines it (components.ts, CLIENT). The page reads fine without it.

interface Mark {
  a: HTMLAnchorElement;
  el: HTMLElement;
  up: Element | null;
}

interface Entry {
  id: string;
  t: string;
  c: string;
  x: string;
  lt: string;
  lx: string;
}

interface Hit {
  d: Entry;
  s: number;
}

const byId = <T extends HTMLElement = HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;
const closest = (target: EventTarget | null, selector: string): Element | null => (target instanceof Element ? target.closest(selector) : null);

// Contents rail
function contentsRail(toc: HTMLElement): void {
  const det = toc.querySelector("details");
  if (!det) return;
  const mq = window.matchMedia("(max-width: 960px)");
  const fit = (): void => {
    det.open = !mq.matches;
  };
  fit();
  mq.addEventListener("change", fit);
  det.querySelector("summary")?.addEventListener("click", (e) => {
    if (!mq.matches) e.preventDefault();
  });
  toc.addEventListener("click", (e) => {
    if (mq.matches && closest(e.target, "a")) det.open = false;
  });
  const marks: Mark[] = [];
  for (const a of toc.querySelectorAll<HTMLAnchorElement>("a[href^='#']")) {
    const el = byId((a.getAttribute("href") ?? "").slice(1));
    const up = a.parentElement?.parentElement?.closest("li");
    if (el) marks.push({ a, el, up: up ? up.firstElementChild : null });
  }
  let ticking = false;
  const spy = (): void => {
    ticking = false;
    let cur = marks[0];
    if (!cur) return;
    for (const m of marks) if (m.el.getBoundingClientRect().top <= 140) cur = m;
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = marks[marks.length - 1] ?? cur;
    for (const m of marks) {
      m.a.removeAttribute("aria-current");
      m.a.classList.remove("in");
    }
    cur.a.setAttribute("aria-current", "location");
    cur.up?.classList.add("in");
    if (!mq.matches) {
      const t = cur.a.offsetTop;
      const h = toc.clientHeight;
      if (t < toc.scrollTop + 40 || t > toc.scrollTop + h - 60) toc.scrollTop = t - h / 3;
    }
  };
  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(spy);
      }
    },
    { passive: true },
  );
  spy();
}

// Drag to compare
function wipes(): void {
  for (const w of document.querySelectorAll<HTMLElement>(".wipe")) {
    const r = w.querySelector("input");
    r?.addEventListener("input", () => w.style.setProperty("--cut", `${r.value}%`));
  }
}

// The film: its poster until it plays; no broken player
function film(): void {
  const box = byId("film");
  const video = byId<HTMLVideoElement>("film-v");
  const play = byId("film-play");
  if (!box || !video || !play) return;
  const missing = (): void => {
    box.setAttribute("data-state", "missing");
    video.controls = false;
  };
  video.addEventListener("error", missing);
  play.addEventListener("click", () => {
    if (box.getAttribute("data-state") === "missing") return;
    video.controls = true;
    box.setAttribute("data-state", "playing");
    video.play().catch((err: unknown) => {
      // The browser wants its own play button: keep the controls.
      if (err instanceof Error && err.name === "NotAllowedError") return;
      missing();
    });
  });
}

// Pictures that enlarge
function lightbox(): void {
  const lb = byId<HTMLDialogElement>("lightbox");
  const lbImg = lb?.querySelector("img");
  const lbCap = lb?.querySelector(".lb-cap");
  if (!lb || !lbImg || !lbCap || typeof lb.showModal !== "function") return;
  document.addEventListener("click", (e) => {
    const img = closest(e.target, "[data-zoom]")?.querySelector("img");
    if (!img) return;
    lbImg.src = img.currentSrc || img.src;
    lbImg.alt = img.alt;
    lbCap.textContent = img.alt;
    lb.showModal();
  });
  lb.addEventListener("click", (e) => {
    if (e.target === lb || e.target === lbImg) lb.close();
  });
}

// Search: entries from the page's search index
function search(): void {
  const input = byId<HTMLInputElement>("q");
  const panel = byId("q-panel");
  const list = byId("q-results");
  const status = byId("q-status");
  if (!input || !panel || !list || !status) return;
  let data: Entry[] = [];
  try {
    data = JSON.parse(byId("search-index")?.textContent ?? "[]") as Entry[];
  } catch {
    data = [];
  }
  for (const d of data) {
    d.lt = d.t.toLowerCase();
    d.lx = d.x.toLowerCase();
  }
  let sel = -1;
  let hits: Hit[] = [];
  const escH = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
  // Marks the query words on the raw text, then escapes each piece, so a word
  // such as "amp" or "mark" never matches inside an entity or a tag.
  const hl = (s: string, words: string[]): string => {
    const ws = words.filter((w) => w.length >= 2).map((w) => w.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&"));
    if (!ws.length) return escH(s);
    return s
      .split(new RegExp(`(${ws.join("|")})`, "ig"))
      .map((part, i) => (i % 2 ? `<mark>${escH(part)}</mark>` : escH(part)))
      .join("");
  };
  const snippet = (d: Entry, words: string[]): string => {
    let i = -1;
    for (let k = 0; k < words.length && i < 0; k++) i = d.lx.indexOf(words[k] ?? "");
    if (i < 0) return d.x.slice(0, 140);
    const s = Math.max(0, i - 50);
    return `${s ? "…" : ""}${d.x.slice(s, s + 150)}…`;
  };
  const close = (): void => {
    panel.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  };
  const run = (): void => {
    const q = input.value.trim().toLowerCase();
    if (!q) {
      close();
      return;
    }
    const words = q.split(/\s+/);
    hits = [];
    for (const d of data) {
      let score = 0;
      let all = true;
      for (const w of words) {
        const t = d.lt.includes(w);
        const x = d.lx.includes(w);
        if (!t && !x) {
          all = false;
          break;
        }
        score += (t ? 10 : 0) + (x ? 1 : 0) + (d.lt.indexOf(w) === 0 ? 5 : 0);
      }
      if (all) hits.push({ d, s: score });
    }
    hits.sort((a, b) => b.s - a.s);
    hits = hits.slice(0, 12);
    sel = hits.length ? 0 : -1;
    list.innerHTML = hits
      .map(
        (h, i) =>
          `<li role="option" id="q-o${i}" aria-selected="${i === sel}"><a href="#${h.d.id}">${h.d.c ? `<span class="s-trail">${escH(h.d.c)}</span>` : ""}<span class="s-title">${hl(h.d.t, words)}</span><span class="s-snip">${hl(snippet(h.d, words), words)}</span></a></li>`,
      )
      .join("");
    status.textContent = hits.length ? `${hits.length}${hits.length === 1 ? " section" : " sections"}. Enter opens, arrows move, Esc closes.` : "No section matches.";
    panel.hidden = false;
    input.setAttribute("aria-expanded", "true");
    if (sel >= 0) input.setAttribute("aria-activedescendant", "q-o0");
  };
  const move = (n: number): void => {
    if (!hits.length) return;
    const items = list.children;
    items[sel]?.setAttribute("aria-selected", "false");
    sel = (sel + n + hits.length) % hits.length;
    items[sel]?.setAttribute("aria-selected", "true");
    items[sel]?.scrollIntoView({ block: "nearest" });
    input.setAttribute("aria-activedescendant", `q-o${sel}`);
  };
  const go = (id: string): void => {
    close();
    input.blur();
    const el = byId(id);
    if (el) {
      location.hash = id;
      el.setAttribute("tabindex", "-1");
      el.focus({ preventScroll: true });
    }
  };
  input.addEventListener("input", run);
  input.addEventListener("focus", () => {
    if (input.value.trim()) run();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Enter") {
      const hit = hits[sel];
      if (hit) {
        e.preventDefault();
        go(hit.d.id);
      }
    } else if (e.key === "Escape") {
      if (!panel.hidden) close();
      else {
        input.value = "";
        input.blur();
      }
    }
  });
  list.addEventListener("click", (e) => {
    const a = closest(e.target, "a");
    if (a) {
      e.preventDefault();
      go((a.getAttribute("href") ?? "").slice(1));
    }
  });
  document.addEventListener("click", (e) => {
    if (!closest(e.target, ".search")) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    e.preventDefault();
    input.focus();
    input.select();
  });
}

const toc = byId("toc");
if (toc) contentsRail(toc);
wipes();
film();
lightbox();
search();

export {};
