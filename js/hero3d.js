// MeharFlow website - Copyright (c) 2026 Mehar Bilal. All rights reserved.
// 3D hero: the MeharFlow bolt in the middle, a ring of shot cards orbiting it.
// Falls back to the static CSS logo when WebGL is missing or motion is reduced.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const stage = document.getElementById("hero3d");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch (e) {
    return false;
  }
}

if (stage && webglAvailable()) {
  start();
}

function start() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0.6, 9);

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 4, 6);
  scene.add(key);
  const glow = new THREE.PointLight(0xff7a1a, 40, 12, 2);
  glow.position.set(0, 0, 1.5);
  scene.add(glow);
  const rim = new THREE.PointLight(0xffa149, 25, 14, 2);
  rim.position.set(-4, -2, -3);
  scene.add(rim);

  const root = new THREE.Group();
  scene.add(root);

  // The bolt logo, extruded from the same path as the header icon.
  const pts = [[13.2, 2], [4.5, 13.6], [10.6, 13.6], [9.8, 22], [18.5, 10.4], [12.4, 10.4]];
  const shape = new THREE.Shape();
  pts.forEach(([x, y], i) => {
    const px = (x - 11.5) / 6.5;
    const py = -(y - 12) / 6.5;
    if (i === 0) shape.moveTo(px, py);
    else shape.lineTo(px, py);
  });
  shape.closePath();
  const boltGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.38, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 4,
  });
  boltGeo.center();
  const bolt = new THREE.Mesh(
    boltGeo,
    new THREE.MeshStandardMaterial({
      color: 0xff8a2a, emissive: 0xff5a00, emissiveIntensity: 0.55, metalness: 0.35, roughness: 0.28,
    })
  );
  root.add(bolt);

  // Soft halo sprite behind the bolt
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: radialTexture("rgba(255,122,26,0.55)"), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  halo.scale.set(5.2, 5.2, 1);
  halo.position.z = -0.6;
  root.add(halo);

  // Ring of shot cards
  const ring = new THREE.Group();
  ring.rotation.x = 0.32;
  root.add(ring);
  const SHOTS = 10;
  const radius = 3.25;
  const cardGeo = new THREE.BoxGeometry(1.25, 0.8, 0.03);
  for (let i = 0; i < SHOTS; i++) {
    const tex = cardTexture(i + 1, i % 3 === 2 ? "VID" : "IMG", i);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.1 });
    const edge = new THREE.MeshStandardMaterial({ color: 0x262b35, roughness: 0.6 });
    const card = new THREE.Mesh(cardGeo, [edge, edge, edge, edge, face, face]);
    const a = (i / SHOTS) * Math.PI * 2;
    card.position.set(Math.cos(a) * radius, Math.sin(i * 1.7) * 0.18, Math.sin(a) * radius);
    card.lookAt(0, card.position.y, 0);
    card.rotateY(Math.PI);
    ring.add(card);
  }

  // Dust particles
  const N = 260;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 14;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 8;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 8 - 2;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      size: 0.05, map: radialTexture("rgba(255,180,110,1)"), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0.8,
    })
  );
  scene.add(dust);

  // Pointer tilt
  const target = { x: 0, y: 0 };
  const current = { x: 0, y: 0 };
  window.addEventListener("pointermove", (e) => {
    target.x = (e.clientX / window.innerWidth - 0.5) * 2;
    target.y = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  function resize() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Pull back on narrow screens so the ring stays inside the frame.
    camera.position.z = w / h < 1.25 ? 12 : 9;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  // Only render while the hero is on screen.
  let visible = true;
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(stage);

  const clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;
    const t = clock.getElapsedTime();
    current.x += (target.x - current.x) * 0.05;
    current.y += (target.y - current.y) * 0.05;

    if (!reduceMotion) {
      ring.rotation.y = t * 0.22;
      bolt.rotation.y = Math.sin(t * 0.8) * 0.45;
      bolt.position.y = Math.sin(t * 1.3) * 0.08;
      dust.rotation.y = t * 0.02;
      glow.intensity = 36 + Math.sin(t * 2.2) * 8;
    }
    root.rotation.y = current.x * 0.35;
    root.rotation.x = current.y * 0.18;
    renderer.render(scene, camera);
  }
  frame();
  stage.classList.add("is-live");
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

// A small "shot card": a frame thumbnail plus the shot number, like the saved files.
function cardTexture(n, kind, seed) {
  const W = 320;
  const H = 205;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#161a21";
  g.fillRect(0, 0, W, H);

  // Thumbnail: a simple gradient "scene" with hills and a sun, different per card.
  const hues = [24, 200, 280, 140, 340, 45, 190, 260, 10, 160];
  const h = hues[seed % hues.length];
  const sky = g.createLinearGradient(0, 14, 0, 150);
  sky.addColorStop(0, `hsl(${h},55%,32%)`);
  sky.addColorStop(1, `hsl(${(h + 30) % 360},60%,16%)`);
  g.fillStyle = sky;
  roundRect(g, 14, 14, W - 28, 136, 10);
  g.fill();
  g.save();
  roundRect(g, 14, 14, W - 28, 136, 10);
  g.clip();
  g.fillStyle = "rgba(255,190,120,0.85)";
  g.beginPath();
  g.arc(60 + (seed * 37) % 200, 60, 16, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = `hsl(${h},35%,12%)`;
  g.beginPath();
  g.moveTo(14, 150);
  for (let x = 14; x <= W - 14; x += 20) {
    g.lineTo(x, 112 + Math.sin(x * 0.03 + seed) * 16);
  }
  g.lineTo(W - 14, 150);
  g.fill();
  if (kind === "VID") {
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.beginPath();
    g.moveTo(W / 2 - 12, 66);
    g.lineTo(W / 2 + 16, 82);
    g.lineTo(W / 2 - 12, 98);
    g.fill();
  }
  g.restore();

  // Label row
  g.font = "700 24px Inter, Segoe UI, sans-serif";
  g.fillStyle = "#e8eaee";
  g.fillText(`SHOT ${String(n).padStart(2, "0")}`, 18, 186);
  g.font = "800 16px Inter, Segoe UI, sans-serif";
  const label = kind;
  const lw = g.measureText(label).width + 18;
  g.fillStyle = kind === "VID" ? "rgba(120,170,255,0.18)" : "rgba(255,122,26,0.18)";
  roundRect(g, W - 18 - lw, 166, lw, 28, 8);
  g.fill();
  g.fillStyle = kind === "VID" ? "#9cc0ff" : "#ffb070";
  g.fillText(label, W - 18 - lw + 9, 186);

  // Orange top edge
  g.fillStyle = "#ff7a1a";
  g.fillRect(0, 0, W, 4);
  return new THREE.CanvasTexture(c);
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
