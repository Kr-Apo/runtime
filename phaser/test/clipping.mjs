import { parseRig, PhaserRig } from "@ankhimate/phaser-runtime";

const q = new URL(location.href).searchParams, name = q.get("case"), mode = q.get("mode");
const result = { name, mode, samples: [], failures: [] };
const check = (condition, message) => { if (!condition) result.failures.push(message); };
try {
  const base = `./fixtures/clipping/${name}/`;
  const [raw, reference] = await Promise.all([fetch(`${base}native/skeleton.json`).then(r => r.json()), fetch(`${base}reference.json`).then(r => r.json())]);
  const data = parseRig(raw), width = reference.width, height = reference.height;
  let scene, ready = false;
  const game = new Phaser.Game({
    type: Phaser.WEBGL, parent: "game", width, height, transparent: true, banner: false, audio: { noAudio: true },
    render: { preserveDrawingBuffer: true, antialias: false, roundPixels: false },
    scene: {
      preload() { raw.atlas.pages.forEach((p, i) => this.load.image(`page-${i}`, `${base}native/${p.file}`)); },
      create() { scene = this; try { this.rig = new PhaserRig(this, data, { pageTextureKeys: raw.atlas.pages.map((_, i) => `page-${i}`) }); this.rig.play("clip"); } catch (e) { result.failures.push(e.stack ?? String(e)); } ready = true; },
    },
  });
  await new Promise(done => { const poll = () => ready ? done() : requestAnimationFrame(poll); poll(); });
  const rendered = () => new Promise(done => game.events.once("postrender", done));
  await rendered();
  const rig = scene.rig, gl = game.renderer.gl, ext = gl.getExtension("WEBGL_debug_renderer_info");
  result.gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  result.phaser = Phaser.VERSION; result.pageCount = raw.atlas.pages.length;
  check(game.renderer.type === Phaser.WEBGL && Phaser.VERSION === "3.90.0", "pinned Phaser / real WebGL required");
  const configure = (object, c) => object.setPosition(c.x, c.y).setScale(c.sx, c.sy).setRotation(c.rotation).setScrollFactor(c.scrollFactorX, c.scrollFactorY);
  let previous = 0;
  for (const sample of reference.samples.filter(s => s.mode === mode)) {
    // Apply the document animation first, then mutate Containers/camera. A fix
    // that syncs a mask only in rig.update would fail this order of operations.
    rig.update((sample.time - previous) * 1000); previous = sample.time;
    const c = sample.config;
    if (c.parent) { scene.parent ??= scene.add.container(); scene.parent.add(rig.root); configure(scene.parent, c.parent); }
    configure(rig.root, c.root);
    scene.cameras.main.setScroll(c.camera.scrollX, c.camera.scrollY).setZoom(c.camera.zoom).setRotation(c.camera.rotation);
    await rendered();
    const image = new Image(); image.src = `${base}${sample.file}`; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true }); ctx.drawImage(image, 0, 0);
    const cpu = ctx.getImageData(0, 0, width, height).data, gpu = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, gpu);
    const cpuAt = (x, y) => { const i = (y * width + x) * 4; return [0, 1, 2, 3].map(k => k === 3 ? cpu[i + k] : cpu[i + k] * cpu[i + 3] / 255); };
    const gpuAt = (x, y) => { const i = ((height - 1 - y) * width + x) * 4; return Array.from(gpu.slice(i, i + 4)); };
    let flatBad = 0, edgeBad = 0, maxPmaFlat = 0, maxAlphaFlat = 0, visibleFlat = 0, transparentFlat = 0;
    for (let y = 2; y < height - 2; y++) for (let x = 2; x < width - 2; x++) {
      const i = (y * width + x) * 4;
      const flat = [-width - 1, -width, -width + 1, -1, 1, width - 1, width, width + 1].every(d => [0, 1, 2, 3].every(k => Math.abs(cpu[i + k] - cpu[i + d * 4 + k]) <= 1));
      const a = cpuAt(x, y), b = gpuAt(x, y), errors = a.map((v, k) => Math.abs(v - b[k]));
      if (flat) { if (cpu[i + 3] > 0) visibleFlat++; else transparentFlat++; if (Math.max(...errors) > 4) flatBad++; maxPmaFlat = Math.max(maxPmaFlat, ...errors.slice(0, 3)); maxAlphaFlat = Math.max(maxAlphaFlat, errors[3]); }
      else if (Math.max(...errors) > 4) edgeBad++;
    }
    const probes = sample.probes.map(p => {
      const x = Math.floor(p.x), y = Math.floor(p.y);
      if (x < 1 || x >= width - 1 || y < 1 || y >= height - 1) return { ...p, skipped: "outside viewport" };
      const expected = cpuAt(x, y), actual = gpuAt(x, y), error = Math.max(...actual.map((v, i) => Math.abs(v - expected[i])));
      return { label: p.label, x, y, expected, actual, error };
    });
    const pass = flatBad === 0 && maxPmaFlat <= 2 && maxAlphaFlat <= 1 && edgeBad / (width * height) <= 0.02 && visibleFlat > 0 && probes.every(p => p.skipped || p.error <= 2);
    const masks = [...rig.views].map(([slot, view]) => ({ slot, visible: view.object.visible, clipped: !!view.object.mask, depth: view.object.depth }));
    result.samples.push({ index: sample.index, time: sample.time, pass, flatBad, edgeBad, maxPmaFlat, maxAlphaFlat, visibleFlat, transparentFlat, probes, masks });
    check(pass, `t=${sample.time}: Rust CPU / WebGL pixels differ`);
    // Allow the runner to capture this actual pose before advancing the clip.
    window.__sample = sample.index;
    await new Promise(done => { window.__advance = done; });
  }
  if (q.has("stress")) {
    const resources = { buffer: { made: 0, removed: 0 }, texture: { made: 0, removed: 0 } };
    for (const [label, suffix] of [["buffer", "Buffer"], ["texture", "Texture"]]) for (const [prefix, field] of [["create", "made"], ["delete", "removed"]]) {
      const original = gl[`${prefix}${suffix}`].bind(gl); gl[`${prefix}${suffix}`] = (...args) => { resources[label][field]++; return original(...args); };
    }
    const snapshot = () => ({ listeners: scene.events.listenerCount("prerender"), children: scene.children.length, textures: Object.keys(scene.textures.list).length, resources: structuredClone(resources) });
    rig.destroy(); scene.parent?.destroy(); await rendered();
    const before = snapshot(), cycles = [];
    for (let i = 0; i < 32; i++) {
      const instance = new PhaserRig(scene, data, { pageTextureKeys: raw.atlas.pages.map((_, j) => `page-${j}`) }); instance.root.setPosition(width / 2, height / 2); instance.play("clip");
      for (const t of [0, 0.5, 0.75, 0]) { instance.player.seek(t); instance.update(0); instance.root.setRotation(i * 0.01); await rendered(); }
      const views = [...instance.clips.values()];
      check(views.length <= 2, "mask count bounded by clipping slots");
      if (i % 2 === 0) instance.destroy(); else instance.root.destroy();
      await rendered();
      check(views.every(v => !v.graphics.scene && v.mask.geometryMask === null), "Graphics and GeometryMasks released on destroy");
      cycles.push(snapshot());
    }
    const after = snapshot(); result.stress = { cycles: cycles.length, clippingChanges: cycles.length * 4, before, after, samples: cycles };
    check(JSON.stringify(before) === JSON.stringify(after) && cycles.every(s => JSON.stringify(s) === JSON.stringify(before)), "no accumulation of scene children, listeners, textures or GL buffers after rig recreation");
  }
  window.__game = game;
} catch (e) { result.failures.push(e.stack ?? String(e)); }
result.pass = result.failures.length === 0;
window.__result = result;
document.querySelector("#result").textContent = JSON.stringify(result, null, 2);
