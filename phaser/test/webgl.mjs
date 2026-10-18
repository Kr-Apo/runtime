import { parseRig, PhaserRig } from "@ankhimate/phaser-runtime";

const query = new URL(location.href).searchParams;
const name = query.get("rig") ?? "walker";
const sampleIndex = Number(query.get("sample") ?? 0);
const referenceStem = query.get("clip") === "leg_ik" ? "cpu-leg_ik" : "cpu";
const result = { name, sampleIndex, checks: [], failures: [] };
const check = (condition, message, details) => {
  result.checks.push({ message, pass: !!condition, ...(details === undefined ? {} : { details }) });
  if (!condition) result.failures.push(message);
};
const close = (a, b, tolerance = 0.01) => Math.abs(a - b) <= tolerance;

try {
  const base = `./fixtures/${name}/`;
  const [raw, reference] = await Promise.all([fetch(`${base}skeleton.json`).then(r => r.json()), fetch(`${base}${referenceStem}-reference.json`).then(r => r.json())]);
  const rigData = parseRig(raw);
  const sample = reference.samples[sampleIndex];
  result.time = sample.time;
  result.animation = reference.animation;
  result.formatVersion = raw.format_version ?? 1;
  result.phaser = Phaser.VERSION;
  let scene;
  const game = new Phaser.Game({
    type: Phaser.WEBGL, parent: "game", width: reference.width, height: reference.height,
    backgroundColor: "#28323d", banner: false, audio: { noAudio: true },
    render: { preserveDrawingBuffer: true, antialias: true, roundPixels: false },
    scene: {
      preload() { raw.atlas.pages.forEach((page, index) => this.load.image(`page-${index}`, `${base}${page.file}`)); },
      create() {
        try {
          scene = this;
          this.rig = new PhaserRig(this, rigData, { pageTextureKeys: raw.atlas.pages.map((_, i) => `page-${i}`) });
          this.rig.root.setPosition(...reference.origin).setScale(reference.scale);
          this.rig.play(reference.animation);
          this.rig.player.seek(sample.time);
          this.pose = this.rig.update(0);
          this.ready = true;
        } catch (error) { result.failures.push(String(error)); this.ready = true; }
      },
    },
  });
  await new Promise((done) => {
    const poll = () => { if (scene?.ready) done(); else requestAnimationFrame(poll); }; poll();
  });
  await new Promise(done => game.events.once("postrender", done));
  if (!scene.rig) throw new Error("Rig creation failed");
  const { rig, pose } = scene;
  const gl = game.renderer.gl;
  const extension = gl.getExtension("WEBGL_debug_renderer_info");
  result.gpu = extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  check(game.renderer.type === Phaser.WEBGL, "real WebGL renderer");
  let maxAffineError = 0;
  for (const expected of sample.bones) {
    const actual = pose.bones.find(b => b.name === expected.name);
    for (const key of ["a", "b", "c", "d", "tx", "ty"]) maxAffineError = Math.max(maxAffineError, Math.abs(actual.world[key] - expected.world[key]));
  }
  check(maxAffineError <= 0.01, "bone affines match Rust within 0.01 world units", maxAffineError);
  let maxVertexError = 0, maxUvError = 0;
  for (const expected of sample.slots) {
    // Test-only inspection of the actual Phaser mesh; no private API is used by the game example.
    const mesh = rig.views.get(expected.name)?.object;
    check(!!mesh?.visible, `${expected.name}: visible mesh`);
    if (!mesh) continue;
    check(mesh.getFaceCount() === expected.indices.length / 3, `${expected.name}: triangle count`);
    check(mesh.vertices.length === expected.indices.length, `${expected.name}: indexed triangle vertices`);
    const region = raw.atlas.regions.find(r => r.name === expected.texture);
    const page = raw.atlas.pages[region.page];
    const localUvs = [[0,0],[0,1],[1,1],[1,0]];
    mesh.vertices.forEach((vertex, index) => {
      const source = expected.indices[index];
      maxVertexError = Math.max(maxVertexError,
        Math.abs(vertex.vx - expected.positions[source * 2]),
        Math.abs(vertex.vy + expected.positions[source * 2 + 1]));
      const [u, v] = localUvs[source];
      const expectedU = (region.x + (region.rotated ? (1-v)*region.width : u*region.width)) / page.width;
      const expectedV = (region.y + (region.rotated ? u*region.height : v*region.height)) / page.height;
      maxUvError = Math.max(maxUvError, Math.abs(vertex.u-expectedU), Math.abs(vertex.v-expectedV));
      check(close(vertex.alpha, expected.color[3], 1/255), `${expected.name}: vertex alpha`);
    });
    check(mesh.depth === expected.order, `${expected.name}: authored depth`);
    if(expected.dark_color)check(expected.dark_color.every((v,i)=>pose.slots.find(s=>s.name===expected.name).dark_color?.[i]===v),`${expected.name}: exact static dark RGBA in pose`);
    for (const face of mesh.faces) check(Math.abs((face.vertex2.x-face.vertex1.x)*(face.vertex3.y-face.vertex1.y)-(face.vertex2.y-face.vertex1.y)*(face.vertex3.x-face.vertex1.x)) > 0.00001, `${expected.name}: non-degenerate triangle`);
  }
  check(maxVertexError <= 0.01, "projected mesh vertices match Rust (Y-up to screen Y-down once)", maxVertexError);
  check(maxUvError <= 0.000001, "atlas UVs preserve region orientation", maxUvError);

  const cpu = new Image(); cpu.src = `${base}${referenceStem}-${sampleIndex}.png`; await cpu.decode();
  const read = source => { const canvas=document.createElement("canvas");canvas.width=reference.width;canvas.height=reference.height;const ctx=canvas.getContext("2d");ctx.drawImage(source,0,0);return ctx.getImageData(0,0,canvas.width,canvas.height).data; };
  const expectedPixels = read(cpu), actualPixels = read(game.canvas);
  let interior = 0, interiorBad = 0, allBad = 0;
  const width = reference.width, height = reference.height;
  for (let y=1;y<height-1;y++) for (let x=1;x<width-1;x++) {
    const i=(y*width+x)*4;
    const error=Math.max(...[0,1,2].map(c=>Math.abs(expectedPixels[i+c]-actualPixels[i+c])));
    if (error>8) allBad++;
    const foreground=[0,1,2].some(c=>Math.abs(expectedPixels[i+c]-reference.background[c])>10);
    if (!foreground) continue;
    const flat=[-width-1,-width,-width+1,-1,1,width-1,width,width+1].every(d=>[0,1,2].every(c=>Math.abs(expectedPixels[i+c]-expectedPixels[i+d*4+c])<=1));
    if (flat) {interior++;if(error>8)interiorBad++;}
  }
  result.pixels = { interior, interiorBad, allBad, total:width*height, interiorMatch:1-interiorBad/Math.max(1,interior), mismatchFraction:allBad/(width*height) };
  check(interior>1000 && result.pixels.interiorMatch>=0.995, "CPU/WebGL interior pixels agree (8/255, at least 99.5%)", result.pixels);
  check(result.pixels.mismatchFraction<=0.02, "CPU/WebGL differing pixels stay below 2% including edges", result.pixels.mismatchFraction);
  window.__game = game;
} catch (error) {
  result.failures.push(error.stack ?? String(error));
}
result.pass = result.failures.length === 0;
window.__result = result;
document.querySelector("#result").textContent = JSON.stringify(result, null, 2);
