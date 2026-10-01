// MeharFlow website - Copyright (c) 2026 Mehar Bilal. All rights reserved.
// 3D hero: a floating browser window showing MeharFlow next to Flow.
// Prompt cards leave the shot-list document and land in Flow's result grid.
// Falls back to the static CSS mockup when WebGL is missing.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const stage = document.getElementById("hero3d");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Window canvas layout (pixels) and its size in the 3D scene (units).
const CW = 1600, CH = 960, BAR = 64;
const WIN_W = 6.4, WIN_H = WIN_W * CH / CW;
// Result cells of the Flow grid inside img/hero-app.jpg (1500x800), in image pixels.
const IMG_W = 1500, IMG_H = 800;
const CELLS = [[24, 103, 544, 397], [553, 103, 1073, 397], [24, 404, 544, 697], [553, 404, 1073, 697]];
const PROMPTS = [
  ["@Hero_Full waves hello", "in the @Kitchen"],
  ["@Friend looks confused,", "@Kitchen, morning light"],
  ["@Hero_Full strikes a", "superhero pose"],
  ["@Hero_Full and @Friend", "wave goodbye"],
];

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch (e) {
    return false;
  }
}

if (stage && webglAvailable()) {
  const img = new Image();
  img.onload = () => start(img);
  img.src = "img/hero-app.jpg";
}

function start(appImage) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.appendChild(renderer.domElement);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 2, 0.1, 100);

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-3, 4, 6);
  scene.add(key);
  const glow = new THREE.PointLight(0xff7a1a, 30, 12, 2);
  glow.position.set(-2.5, 0, 2.5);
  scene.add(glow);

  const root = new THREE.Group();
  scene.add(root);

  // ---- Browser window ----
  const win = new THREE.Group();
  root.add(win);

  const body = new THREE.Mesh(
    new THREE.ExtrudeGeometry(roundedShape(WIN_W + 0.08, WIN_H + 0.08, 0.2), {
      depth: 0.14, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2,
    }),
    new THREE.MeshStandardMaterial({ color: 0x1b1f27, metalness: 0.5, roughness: 0.4 })
  );
  body.position.z = -0.17;
  win.add(body);

  const screenTex = texture(windowCanvas(appImage), maxAniso);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(WIN_W, WIN_H),
    new THREE.MeshBasicMaterial({ map: screenTex, transparent: true })
  );
  screen.position.z = 0.002;
  win.add(screen);

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTexture("rgba(255,122,26,0.45)"), transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  halo.scale.set(11, 7, 1);
  halo.position.z = -1.2;
  win.add(halo);

  // Cell positions in window space, and an orange flash for each cell.
  const cellInfo = CELLS.map(([x0, y0, x1, y1]) => {
    const p0 = imgToWin(x0, y0), p1 = imgToWin(x1, y1);
    const w = p1.x - p0.x, h = p0.y - p1.y;
    const flash = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        map: texture(flashCanvas(), maxAniso), transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending,
      })
    );
    flash.position.set((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, 0.01);
    win.add(flash);
    return { center: flash.position.clone(), w, h, flash };
  });

  // ---- Shot-list document ----
  const doc = new THREE.Group();
  root.add(doc);
  const docMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 2.5),
    new THREE.MeshBasicMaterial({ map: texture(docCanvas(), maxAniso), color: 0xe9ebef })
  );
  doc.add(docMesh);
  const docBack = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 2.5),
    new THREE.MeshBasicMaterial({ color: 0x9aa1ad, side: THREE.BackSide })
  );
  doc.add(docBack);

  // ---- Flying prompt cards ----
  const CARD_W = 1.15, CARD_H = 0.72;
  const cards = PROMPTS.map((lines, i) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_W, CARD_H),
      new THREE.MeshBasicMaterial({
        map: texture(promptCanvas(i + 1, lines), maxAniso), transparent: true, depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    m.renderOrder = 2;
    root.add(m);
    return m;
  });

  // ---- Layout per screen shape ----
  let wide = true;
  function layout(aspect) {
    wide = aspect >= 1.35;
    if (wide) {
      doc.position.set(-4.35, -0.35, 1.5);
      doc.rotation.set(0.05, 0.42, -0.04);
      doc.scale.setScalar(1);
      root.position.set(0.75, 0, 0);
    } else {
      doc.position.set(-2.55, -1.15, 1.9);
      doc.rotation.set(0.05, 0.3, -0.06);
      doc.scale.setScalar(0.62);
      root.position.set(0.25, 0.1, 0);
    }
    const needHalfW = wide ? 5.6 : 3.75;
    const needHalfH = 2.2;
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const d = Math.max(needHalfW / (t * aspect), needHalfH / t);
    camera.position.set(0, 0.15, d);
    camera.lookAt(0, 0, 0);
  }

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    layout(w / h);
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  // Pointer tilt
  const target = { x: 0, y: 0 }, current = { x: 0, y: 0 };
  window.addEventListener("pointermove", (e) => {
    target.x = (e.clientX / window.innerWidth - 0.5) * 2;
    target.y = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  let visible = true;
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(stage);

  // Card animation along a curve from the document to its cell.
  const PERIOD = 7.2;
  const from = new THREE.Vector3(), ctrl = new THREE.Vector3(), to = new THREE.Vector3();
  const curve = new THREE.QuadraticBezierCurve3(from, ctrl, to);
  const ease = (x) => x * x * (3 - 2 * x);
  const flat = new THREE.Quaternion();

  function animateCards(t) {
    // The document is a child of root, so its own rotation is already in root space.
    const docLocal = doc.quaternion;

    cards.forEach((card, i) => {
      const cell = cellInfo[i];
      const u = (((t - i * PERIOD / 4) % PERIOD) + PERIOD) % PERIOD / PERIOD;
      from.copy(doc.position).add(new THREE.Vector3(0, 0.35 * doc.scale.x - i * 0.22 * doc.scale.x, 0.05));
      to.set(cell.center.x, cell.center.y, 0.03);
      ctrl.set((from.x + to.x) / 2, Math.max(from.y, to.y) + 1.4, 2.6);

      const mat = card.material;
      let scaleX = 1, scaleY = 1;
      if (u < 0.1) {                       // rise out of the document
        const k = ease(u / 0.1);
        card.position.copy(from);
        card.position.z += k * 0.25;
        card.quaternion.copy(docLocal);
        scaleX = scaleY = (wide ? 1 : 0.7) * k;
        mat.opacity = k;
      } else if (u < 0.55) {               // fly to the window
        const k = ease((u - 0.1) / 0.45);
        curve.getPoint(k, card.position);
        card.quaternion.copy(docLocal).slerp(flat, k);
        const s0 = wide ? 1 : 0.7;
        scaleX = THREE.MathUtils.lerp(s0, cell.w / CARD_W, k);
        scaleY = THREE.MathUtils.lerp(s0, cell.h / CARD_H, k);
        card.rotateZ(Math.sin(k * Math.PI) * 0.25);
        mat.opacity = 1;
      } else if (u < 0.66) {               // land and dissolve into the result
        const k = (u - 0.55) / 0.11;
        card.position.copy(to);
        card.quaternion.identity();
        scaleX = cell.w / CARD_W;
        scaleY = cell.h / CARD_H;
        mat.opacity = 1 - k;
      } else {
        mat.opacity = 0;
        scaleX = scaleY = 0.001;
      }
      card.scale.set(Math.max(scaleX, 0.001), Math.max(scaleY, 0.001), 1);

      // Flash the cell as the card lands.
      const f = u >= 0.55 && u < 0.85 ? Math.sin(((u - 0.55) / 0.3) * Math.PI) : 0;
      cell.flash.material.opacity = f * 0.9;
    });
  }

  const clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;
    const t = clock.getElapsedTime();
    current.x += (target.x - current.x) * 0.05;
    current.y += (target.y - current.y) * 0.05;

    const baseY = wide ? -0.2 : -0.12;
    root.rotation.y = baseY + current.x * 0.16;
    root.rotation.x = 0.06 + current.y * 0.08;
    if (!reduceMotion) {
      win.position.y = Math.sin(t * 0.9) * 0.05;
      doc.position.y += (Math.sin(t * 1.1 + 1) * 0.0009);
      animateCards(t);
    } else {
      cards.forEach((c) => { c.material.opacity = 0; });
    }
    renderer.render(scene, camera);
  }
  frame();
  stage.classList.add("is-live");
}

// ---------- helpers ----------

function imgToWin(x, y) {
  // The image is drawn full width under the title bar, centred vertically.
  const scale = CW / IMG_W;
  const top = BAR + (CH - BAR - IMG_H * scale) / 2;
  const cx = x * scale, cy = top + y * scale;
  return { x: (cx / CW - 0.5) * WIN_W, y: (0.5 - cy / CH) * WIN_H };
}

function texture(canvas, aniso) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}

function roundedShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function radialTexture(color) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, color);
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function windowCanvas(appImage) {
  const c = document.createElement("canvas");
  c.width = CW;
  c.height = CH;
  const g = c.getContext("2d");
  roundRect(g, 0, 0, CW, CH, 30);
  g.save();
  g.clip();
  g.fillStyle = "#0b0d11";
  g.fillRect(0, 0, CW, CH);

  // Title bar: three dots, a tab, an address pill.
  g.fillStyle = "#171b22";
  g.fillRect(0, 0, CW, BAR);
  ["#ff5f57", "#febc2e", "#28c840"].forEach((col, i) => {
    g.fillStyle = col;
    g.beginPath();
    g.arc(34 + i * 26, BAR / 2, 8, 0, Math.PI * 2);
    g.fill();
  });
  g.fillStyle = "#0b0d11";
  roundRect(g, 128, 12, 260, BAR - 12, 10);
  g.fill();
  g.fillStyle = "#ff7a1a";
  roundRect(g, 144, 24, 18, 18, 5);
  g.fill();
  g.font = "600 20px Inter, Segoe UI, sans-serif";
  g.fillStyle = "#c9ced6";
  g.fillText("Flow - Episode 106", 172, 40);
  g.fillStyle = "#0f1217";
  roundRect(g, 420, 14, 760, 36, 18);
  g.fill();
  g.fillStyle = "#6b7280";
  g.font = "500 18px Inter, Segoe UI, sans-serif";
  g.fillText("Your Flow project", 446, 38);

  const scale = CW / IMG_W;
  const h = IMG_H * scale;
  g.drawImage(appImage, 0, BAR + (CH - BAR - h) / 2, CW, h);
  g.restore();

  g.strokeStyle = "rgba(255,255,255,0.08)";
  g.lineWidth = 3;
  roundRect(g, 1.5, 1.5, CW - 3, CH - 3, 29);
  g.stroke();
  return c;
}

function flashCanvas() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 288;
  const g = c.getContext("2d");
  g.strokeStyle = "rgba(255,140,40,1)";
  g.lineWidth = 10;
  g.shadowColor = "rgba(255,122,26,1)";
  g.shadowBlur = 24;
  roundRect(g, 10, 10, 492, 268, 18);
  g.stroke();
  return c;
}

function docCanvas() {
  const c = document.createElement("canvas");
  c.width = 608;
  c.height = 800;
  const g = c.getContext("2d");
  g.fillStyle = "#f4f5f7";
  g.fillRect(0, 0, 608, 800);
  g.fillStyle = "#ff7a1a";
  g.fillRect(0, 0, 608, 10);

  g.fillStyle = "#1b1f27";
  g.font = "800 34px Inter, Segoe UI, sans-serif";
  g.fillText("Episode 106", 44, 78);
  g.fillStyle = "#6b7280";
  g.font = "600 20px Inter, Segoe UI, sans-serif";
  g.fillText("Shot list  ·  .docx", 44, 110);

  let y = 170;
  for (let i = 0; i < 6; i++) {
    g.fillStyle = "#ff7a1a";
    g.font = "800 20px Inter, Segoe UI, sans-serif";
    g.fillText(`SHOT ${String(i + 1).padStart(2, "0")}`, 44, y);
    g.fillStyle = "#d4d7dd";
    roundRect(g, 160, y - 16, 380 - (i % 3) * 50, 14, 7);
    g.fill();
    roundRect(g, 160, y + 10, 300 + (i % 2) * 60, 14, 7);
    g.fill();
    g.fillStyle = "rgba(255,122,26,0.22)";
    roundRect(g, 160 + (i * 47) % 140, y - 18, 86, 18, 9);
    g.fill();
    y += 100;
  }
  return c;
}

function promptCanvas(n, lines) {
  const W = 460, H = 288;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(22,26,33,0.97)";
  roundRect(g, 4, 4, W - 8, H - 8, 22);
  g.fill();
  g.strokeStyle = "rgba(255,122,26,0.8)";
  g.lineWidth = 4;
  g.stroke();

  g.font = "800 30px Inter, Segoe UI, sans-serif";
  g.fillStyle = "#ffffff";
  g.fillText(`SHOT ${String(n).padStart(2, "0")}`, 30, 60);
  g.font = "800 20px Inter, Segoe UI, sans-serif";
  g.fillStyle = "rgba(255,122,26,0.2)";
  roundRect(g, W - 100, 34, 70, 34, 10);
  g.fill();
  g.fillStyle = "#ffb070";
  g.fillText("IMG", W - 85, 58);

  // Prompt lines with @tags as orange chips
  g.font = "600 25px Inter, Segoe UI, sans-serif";
  lines.forEach((line, li) => {
    let x = 30;
    const y = 128 + li * 46;
    line.split(/(@\w+)/).forEach((part) => {
      if (!part) return;
      const w = g.measureText(part).width;
      if (part.startsWith("@")) {
        g.fillStyle = "rgba(255,122,26,0.22)";
        roundRect(g, x - 6, y - 26, w + 12, 36, 9);
        g.fill();
        g.fillStyle = "#ffb070";
      } else {
        g.fillStyle = "#c9ced6";
      }
      g.fillText(part, x, y);
      x += w + (part.startsWith("@") ? 8 : 0);
    });
  });

  g.fillStyle = "#9aa1ad";
  g.font = "600 19px Inter, Segoe UI, sans-serif";
  g.fillText("→ sending to Flow", 30, H - 32);
  return c;
}
