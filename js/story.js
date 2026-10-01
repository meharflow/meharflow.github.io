// MeharFlow website - Copyright (c) 2026 Mehar Bilal. All rights reserved.
// "How it works" scroll story. Scroll position drives a 0..4 timeline:
// 0-1 install, 1-2 references, 2-3 shot list, 3-4 Start -> results saved.
(function () {
  const story = document.getElementById("story");
  if (!story) return;
  const wrap = document.getElementById("storyWrap");
  const stage = document.getElementById("storyStage");
  const steps = [...story.querySelectorAll(".story-steps li")];
  const ext = document.getElementById("stExt");
  const panel = document.getElementById("stPanel");
  const file = document.getElementById("stFile");
  const startBtn = document.getElementById("stStart");
  const prog = document.getElementById("stProg");
  const progLabel = document.getElementById("stProgLabel");
  const doc = document.getElementById("stDoc");
  const slots = [...panel.querySelectorAll(".pn-slots span")];
  const chips = [...stage.querySelectorAll(".st-chip")];
  const cells = [...stage.querySelectorAll(".cell")];
  const cards = [...stage.querySelectorAll(".st-card")];
  const tags = [...doc.querySelectorAll(".tag")];

  const STAGE_W = 960, STAGE_H = 600;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = (x) => x * x * (3 - 2 * x);
  const seg = (s, a, b) => ease(clamp((s - a) / (b - a)));
  const lerp = (a, b, k) => a + (b - a) * k;

  // Fit the fixed-size stage into its column.
  function fit() {
    const maxH = story.classList.contains("static") ? Infinity : wrap.parentElement.clientHeight * (window.innerWidth <= 860 ? 0.62 : 0.92);
    const k = Math.min(wrap.clientWidth / STAGE_W, maxH / STAGE_H);
    stage.style.transform = `scale(${k})`;
    wrap.style.height = `${STAGE_H * k}px`;
    // Centre horizontally when height is the limit.
    stage.style.left = `${(wrap.clientWidth - STAGE_W * k) / 2}px`;
  }

  // Positions in stage pixels (offsets ignore transforms, so read them once panel is at rest).
  function slotPos(i) {
    return { x: panel.offsetLeft + slots[i].offsetLeft, y: panel.offsetTop + slots[i].offsetTop };
  }
  function startPos() {
    return {
      x: panel.offsetLeft + startBtn.offsetLeft + startBtn.offsetWidth / 2,
      y: panel.offsetTop + startBtn.offsetTop + startBtn.offsetHeight / 2,
    };
  }

  function render(s) {
    // Steps list
    const active = Math.min(3, Math.floor(s));
    steps.forEach((li, i) => {
      li.classList.toggle("active", i === active);
      li.classList.toggle("done", i < active);
    });

    // 1. Install: extension icon pops in, side panel slides open.
    const kExt = seg(s, 0.1, 0.4);
    ext.style.transform = `scale(${kExt})`;
    ext.style.opacity = kExt;
    const kPanel = seg(s, 0.45, 0.9);
    panel.style.transform = `translateX(${(1 - kPanel) * 310}px)`;

    // 2. References fly in from the left into their slots.
    chips.forEach((chip, i) => {
      const k = seg(s, 1.1 + i * 0.2, 1.5 + i * 0.2);
      const to = slotPos(i);
      const from = { x: -140, y: 140 + i * 120 };
      const x = lerp(from.x, to.x, k);
      const y = lerp(from.y, to.y, k) - Math.sin(k * Math.PI) * 90;
      chip.style.transform = `translate(${x}px, ${y}px) rotate(${(1 - k) * -14}deg) scale(${lerp(1.5, 1, k)})`;
      chip.style.opacity = clamp(k * 3);
    });

    // 3. Shot list: document slides in, file appears in the panel, @tags match their references.
    const kDocIn = seg(s, 2.0, 2.35);
    const kDocOut = seg(s, 3.0, 3.25);
    doc.style.transform = `translateX(${(1 - kDocIn) * -480 + kDocOut * -40}px) rotate(${lerp(-10, -3, kDocIn)}deg)`;
    doc.style.opacity = s < 2 ? 0 : 1 - kDocOut;
    file.style.opacity = seg(s, 2.35, 2.5);
    file.style.transform = `translateY(${(1 - seg(s, 2.35, 2.5)) * 8}px)`;
    const lit = new Set();
    tags.forEach((tag, i) => {
      const on = s >= 2.45 + i * 0.07 && s < 3.0;
      tag.classList.toggle("on", on);
      if (on && s < 2.45 + (i + 1) * 0.07 + 0.08) lit.add(tag.dataset.ref);
    });
    chips.forEach((chip, i) => chip.classList.toggle("pulse", lit.has(String(i))));

    // 4. Start: button pressed, cards fly to Flow, results appear and get saved.
    const press = s >= 3.0 && s < 3.12;
    startBtn.style.transform = press ? "scale(0.95)" : "";
    startBtn.style.filter = press ? "brightness(1.2)" : "";
    const sp = startPos();
    let done = 0;
    cards.forEach((card, i) => {
      const a = 3.1 + i * 0.18, b = a + 0.3;
      const k = seg(s, a, b);
      const cell = cells[i];
      const tx = cell.offsetLeft + cell.offsetWidth / 2, ty = cell.offsetTop + cell.offsetHeight / 2;
      const x = lerp(sp.x, tx, k) - 100;
      const y = lerp(sp.y, ty, k) - 56 - Math.sin(k * Math.PI) * 70;
      const sc = lerp(0.35, 1.2, k);
      card.style.transform = `translate(${x}px, ${y}px) scale(${sc}) rotate(${Math.sin(k * Math.PI) * -6}deg)`;
      card.style.opacity = s < a ? 0 : k < 0.85 ? 1 : (1 - k) / 0.15;
      const filled = s >= b;
      cell.classList.toggle("filled", filled);
      cell.classList.toggle("saved", s >= b + 0.12);
      if (filled) done++;
    });
    prog.style.width = `${done * 25}%`;
    progLabel.textContent = s < 3.0 ? "Ready" : done < 4 ? `Sending shot ${done + 1} of 4` : "4 of 4 done · saved to your folder";
  }

  function progress() {
    const r = story.getBoundingClientRect();
    const total = story.offsetHeight - story.firstElementChild.offsetHeight;
    // A short hold at the end so the finished state stays on screen.
    return clamp(-r.top / total) * 4.25;
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      render(Math.min(4, progress()));
    });
  }

  if (reduceMotion) {
    story.classList.add("static");
    fit();
    render(4);
    window.addEventListener("resize", () => { fit(); render(4); });
    return;
  }
  fit();
  render(Math.min(4, progress()));
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => { fit(); onScroll(); });
})();
