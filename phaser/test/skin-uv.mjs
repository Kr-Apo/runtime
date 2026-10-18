import { parseRig, PhaserRig } from "@ankhimate/phaser-runtime";

const q = new URL(location.href).searchParams;
const name = q.get("case"), mode = q.get("mode"), index = Number(q.get("sample") ?? 1);
const result = { name, mode, index, failures: [], checks: [] };
const check = (condition, message, details) => {
  result.checks.push({ message, pass: !!condition, details });
  if (!condition) result.failures.push(message);
};
try {
  const base = `./fixtures/skin-uv/${name}/`;
  const [raw, reference] = await Promise.all([
    fetch(`${base}native/skeleton.json`).then(r => r.json()),
    fetch(`${base}reference.json`).then(r => r.json()),
  ]);
  const skin = mode === "default" ? "default" : "alternate";
  const sample = reference.samples.find(s => s.skin === skin && s.index === index);
  const data = parseRig(raw);
  let scene, ready = false, initialMesh, initialIndices;
  const resources = { buffer: { made: 0, removed: 0 }, texture: { made: 0, removed: 0 } };
  const game = new Phaser.Game({
    type: Phaser.WEBGL, parent: "game", width: 256, height: 256, transparent: true,
    banner: false, audio: { noAudio: true },
    render: { preserveDrawingBuffer: true, antialias: false, roundPixels: false },
    scene: {
      preload() { raw.atlas.pages.forEach((p, i) => this.load.image(`page-${i}`, `${base}native/${p.file}`)); },
      create() {
        scene = this;
        try {
          // Test instrumentation only: count actual GL resource creation/deletion.
          for (const [label, suffix] of [["buffer", "Buffer"], ["texture", "Texture"]]) {
            const gl = this.game.renderer.gl;
            for (const [prefix, counter] of [["create", "made"], ["delete", "removed"]]) {
              const original = gl[`${prefix}${suffix}`].bind(gl);
              gl[`${prefix}${suffix}`] = (...args) => { resources[label][counter]++; return original(...args); };
            }
          }
          this.rig = new PhaserRig(this, data, {
            pageTextureKeys: raw.atlas.pages.map((_, i) => `page-${i}`),
            skin: ["direct", "roundtrip"].includes(mode) ? "alternate" : "default",
          });
          this.rig.root.setPosition(128, 128).setScale(2);
          this.rig.play("clip");
          // Advance a running clip through the public API, including attachment keys.
          this.rig.update(sample.time * 1000);
          initialMesh = this.rig.views.get("art").object;
          initialIndices = [...this.rig.views.get("art").indices];
          this.beforeSkinPose = this.rig.player.pose();
          this.pose = this.rig.update(0);
        } catch (e) { result.failures.push(e.stack ?? String(e)); }
        ready = true;
      },
    },
  });
  await new Promise(done => { const poll = () => ready ? done() : requestAnimationFrame(poll); poll(); });
  const rendered = () => new Promise(done => game.events.once("postrender", done));
  await rendered();
  if (!scene.rig) throw Error("Rig creation failed");
  const { rig } = scene;
  // Each leg is actually rendered. Looking only at the last alternate frame
  // would miss the stale default UVs in an alternate -> default -> alternate trip.
  result.transitions = [];
  for (const selected of mode === "roundtrip" ? ["default", "alternate"] : ["switch", "stress"].includes(mode) ? ["alternate"] : []) {
    const timeBefore = rig.player.time;
    rig.setSkin(selected); scene.pose = rig.update(0); await rendered();
    const intermediate = reference.samples.find(s => s.skin === selected && s.index === index);
    const image = new Image(); image.src = `${base}${intermediate.file}`; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d", { willReadFrequently: true }); ctx.drawImage(image, 0, 0);
    const b = scene.pose.bones.find(b => b.name === "host");
    const x = Math.round(128 + b.world.tx * 2), y = Math.round(128 - b.world.ty * 2);
    const cpu = ctx.getImageData(x, y, 1, 1).data, gpu = new Uint8Array(4), gl = game.renderer.gl;
    gl.readPixels(x, 255 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, gpu);
    const expected = [0, 1, 2, 3].map(c => c === 3 ? cpu[c] : cpu[c] * cpu[3] / 255);
    const vertices = rig.views.get("art").object.vertices.map(v => ({ u: v.u, v: v.v, tu: v.tu, tv: v.tv }));
    const maxUvDrift = Math.max(...vertices.flatMap(v => [Math.abs(v.u - v.tu), Math.abs(v.v - v.tv)]));
    const maxPixelError = Math.max(...expected.map((v, i) => Math.abs(v - gpu[i])));
    result.transitions.push({ skin: selected, vertices, expectedPma: expected, gpuPma: Array.from(gpu), maxUvDrift, maxPixelError });
    check(rig.player.time === timeBefore && rig.player.animation === "clip", `${selected}: running clip time preserved`);
    check(maxUvDrift <= 1e-7 && maxPixelError <= 2, `${selected}: intermediate GPU UVs and pixels match Rust`, { maxUvDrift, maxPixelError });
  }
  const pose = scene.pose;
  const view = rig.views.get("art"), mesh = view.object, gl = game.renderer.gl;
  const extension = gl.getExtension("WEBGL_debug_renderer_info");
  result.gpu = extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  result.phaser = Phaser.VERSION;
  result.time = sample.time;
  result.pageCount = raw.atlas.pages.length;
  check(Phaser.VERSION === "3.90.0" && game.renderer.type === Phaser.WEBGL, "pinned Phaser, real WebGL");
  check(mesh === initialMesh, "skin changes reuse the existing mesh");
  check(JSON.stringify(view.indices) === JSON.stringify(initialIndices), "skin changes preserve triangle indices");
  check(mesh.vertices.length === sample.indices.length && mesh.getFaceCount() === sample.indices.length / 3, "dimensions / triangle count");
  check(JSON.stringify(pose.drawOrder) === JSON.stringify(scene.beforeSkinPose.drawOrder), "draw order preserved");
  check(pose.slots.find(s => s.name === "art").attachment === sample.attachment, "clip attachment key preserved");
  let maxAffineError = 0, maxVertexError = 0, maxUvError = 0, maxSubmittedUvError = 0;
  for (const expected of sample.bones) {
    const actual = pose.bones.find(b => b.name === expected.name);
    for (const key of ["a", "b", "c", "d", "tx", "ty"]) maxAffineError = Math.max(maxAffineError, Math.abs(actual.world[key] - expected.world[key]));
  }
  const region = raw.atlas.regions.find(r => r.name === sample.texture);
  const page = raw.atlas.pages[region.page];
  check(mesh.texture.key === `page-${region.page}` && mesh.frame.name === sample.texture, "correct atlas page / frame selected");
  result.vertices = mesh.vertices.map((v, i) => {
    const source = sample.indices[i], u = sample.uvs[source * 2], w = sample.uvs[source * 2 + 1];
    const expectedU = (region.x + (region.rotated ? (1 - w) * region.height : u * region.width)) / page.width;
    const expectedV = (region.y + (region.rotated ? u * region.width : w * region.height)) / page.height;
    maxVertexError = Math.max(maxVertexError, Math.abs(v.x - sample.positions[source * 2]), Math.abs(v.y - sample.positions[source * 2 + 1]));
    maxUvError = Math.max(maxUvError, Math.abs(v.u - expectedU), Math.abs(v.v - expectedV));
    maxSubmittedUvError = Math.max(maxSubmittedUvError, Math.abs(v.tu - expectedU), Math.abs(v.tv - expectedV));
    return { x: v.x, y: v.y, u: v.u, v: v.v, tu: v.tu, tv: v.tv, expectedU, expectedV };
  });
  check(maxAffineError <= 0.01 && maxVertexError <= 0.01, "Rust bone / geometry parity <= 0.01", { maxAffineError, maxVertexError });
  check(maxUvError <= 1e-7, "logical u/v match the native atlas", maxUvError);
  check(maxSubmittedUvError <= 1e-7, "GPU tu/tv match the native atlas", maxSubmittedUvError);
  // Observe the actual interleaved vertices supplied to Phaser's WebGL pipeline.
  const submitted = [];
  const originalLoad = Phaser.Geom.Mesh.Vertex.prototype.load;
  Phaser.Geom.Mesh.Vertex.prototype.load = function (f32, u32, offset, ...rest) {
    const next = originalLoad.call(this, f32, u32, offset, ...rest);
    if (mesh.vertices.includes(this)) submitted.push({ u: f32[offset + 3], v: f32[offset + 4], tu: this.tu, tv: this.tv });
    return next;
  };
  try { await rendered(); } finally { Phaser.Geom.Mesh.Vertex.prototype.load = originalLoad; }
  check(submitted.length >= mesh.vertices.length, "captured actual GPU vertex submissions", submitted.length);
  check(submitted.every(s => Math.abs(s.u - s.tu) <= 1e-7 && Math.abs(s.v - s.tv) <= 1e-7), "submitted buffer uses tu/tv");
  result.submitted = submitted;
  const pixels = new Uint8Array(256 * 256 * 4);
  gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const image = new Image(); image.src = `${base}${sample.file}`; await image.decode();
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d", { willReadFrequently: true }); ctx.drawImage(image, 0, 0);
  const cpu = ctx.getImageData(0, 0, 256, 256).data;
  let flatBad = 0, edgeBad = 0, maxPmaFlat = 0, maxAlphaFlat = 0;
  for (let y = 2; y < 254; y++) for (let x = 2; x < 254; x++) {
    const i = (y * 256 + x) * 4, g = ((255 - y) * 256 + x) * 4;
    const errors = [0, 1, 2, 3].map(c => Math.abs((c === 3 ? cpu[i + c] : cpu[i + c] * cpu[i + 3] / 255) - pixels[g + c]));
    const flat = [-257, -256, -255, -1, 1, 255, 256, 257].every(d => [0, 1, 2, 3].every(c => Math.abs(cpu[i + c] - cpu[i + d * 4 + c]) <= 1));
    if (flat) { if (Math.max(...errors) > 4) flatBad++; maxPmaFlat = Math.max(maxPmaFlat, ...errors.slice(0, 3)); maxAlphaFlat = Math.max(maxAlphaFlat, errors[3]); }
    else if (Math.max(...errors) > 4) edgeBad++;
  }
  check(flatBad === 0 && maxPmaFlat <= 2 && maxAlphaFlat <= 1, "readPixels matches Rust CPU in flat interiors", { flatBad, maxPmaFlat, maxAlphaFlat });
  check(edgeBad / (256 * 256) <= 0.02, "rasterization edge mismatch <= 2% of canvas", edgeBad);
  const bone = pose.bones.find(b => b.name === "host"), x = Math.round(128 + bone.world.tx * 2), y = Math.round(128 - bone.world.ty * 2);
  const offset = ((255 - y) * 256 + x) * 4, ci = (y * 256 + x) * 4;
  result.center = { x, y, actual: Array.from(pixels.slice(offset, offset + 4)), rustStraight: Array.from(cpu.slice(ci, ci + 4)) };
  result.measures = { maxAffineError, maxVertexError, maxUvError, maxSubmittedUvError, flatBad, edgeBad, maxPmaFlat, maxAlphaFlat };
  if (mode === "stress") {
    // Warm both materials/pages before measuring allocations. Keep the attachment
    // fixed here; intentional attachment-driven mesh replacement is tested above.
    rig.setSkin("default"); await rendered(); rig.setSkin("alternate"); await rendered();
    const snapshot = () => ({ resources: structuredClone(resources), textures: Object.keys(scene.textures.list).length, children: rig.root.list.length, views: rig.views.size, clips: rig.clips.size });
    const before = snapshot(), identities = mesh.vertices.slice();
    for (let i = 0; i < 256; i++) {
      rig.setSkin(i % 2 === 0 ? "default" : "alternate");
      rig.update(0);
      await rendered();
    }
    const after = snapshot();
    check(JSON.stringify(before) === JSON.stringify(after), "256 rendered skin changes allocate no new meshes, textures or GL buffers", { before, after });
    check(rig.views.get("art").object === mesh && mesh.vertices.every((v, i) => v === identities[i]), "mesh / vertex identities retained after stress");
    check(mesh.vertices.every(v => v.u === v.tu && v.v === v.tv), "UVs remain synchronized after stress");
    result.stress = { changes: 256, before, after };
  }
  window.__game = game;
} catch (e) { result.failures.push(e.stack ?? String(e)); }
result.pass = result.failures.length === 0;
window.__result = result;
document.querySelector("#result").textContent = JSON.stringify(result, null, 2);
