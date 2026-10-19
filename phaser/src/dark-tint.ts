import type Phaser from "phaser";
import type { AtlasRegion, AtlasPage } from "@ankhimate/runtime";
type Rgba = readonly [
    number,
    number,
    number,
    number
];
interface TintUniforms {
    light: Rgba;
    dark: Rgba;
    region?: AtlasRegion;
    page?: AtlasPage;
}
interface TintData {
    ankhimateDarkTint?: TintUniforms;
}
type Renderer = Phaser.Renderer.WebGL.WebGLRenderer;
type Pipeline = Phaser.Renderer.WebGL.Pipelines.SinglePipeline;
// One lazily created pipeline per renderer, owned/destroyed by Phaser's manager.
// Recreating rigs does not allocate additional pipelines or shader programs.
const pipelines = new WeakMap<Renderer, Pipeline>();
const name = "AnkhimateStaticDarkTint";
const fragment = `
precision highp float;
uniform sampler2D uMainSampler;
uniform vec3 uLight;
uniform vec4 uDark;
uniform float uOpacity;
uniform vec4 uTrim;
uniform vec2 uPageSize;
uniform float uTrimEnabled;
varying vec2 outTexCoord;
varying vec4 outTint;
void main () {
    vec2 sampleUV = outTexCoord;
    float coverage = 1.0;
    if (uTrimEnabled > 0.5) {
      vec2 low = clamp((outTexCoord - uTrim.xy) * uPageSize + 1.0, 0.0, 1.0);
      vec2 high = clamp((uTrim.zw - outTexCoord) * uPageSize + 1.0, 0.0, 1.0);
      coverage = low.x * low.y * high.x * high.y;
      sampleUV = clamp(outTexCoord, uTrim.xy, uTrim.zw);
    }
    vec4 texel = texture2D(uMainSampler, sampleUV) * coverage;
    // PNG textures are uploaded premultiplied by Phaser. Algebraically equal to
    // (T.rgb*L.rgb + (1-T.rgb)*D.rgb*D.a) * T.a * L.a without dividing by T.a.
    vec3 rgb = texel.rgb * uLight + (vec3(texel.a) - texel.rgb) * uDark.rgb * uDark.a;
    gl_FragColor = vec4(rgb * outTint.a, texel.a * outTint.a) * uOpacity;
}`;
function pipelineFor(scene: Phaser.Scene): Pipeline {
    const renderer = scene.sys.game.renderer as Renderer;
    const cached = pipelines.get(renderer);
    if (cached)
        return cached;
    const manager = renderer.pipelines;
    const single = manager.get("SinglePipeline");
    if (!single || manager.has(name))
        throw new Error("Ankhimate dark tint requires an available Phaser SinglePipeline");
    // Obtain the public pipeline class from the active Phaser instance. Keep the
    // adapter's type-only Phaser import: no global or second Phaser copy required.
    const Single = single.constructor as typeof Phaser.Renderer.WebGL.Pipelines.SinglePipeline;
    class DarkTintPipeline extends Single {
        override onBind(gameObject?: Phaser.GameObjects.GameObject): void {
            const data = (gameObject as Phaser.GameObjects.Mesh | undefined)?.pipelineData as TintData | undefined;
            const tint = data?.ankhimateDarkTint;
            if (!tint)
                return;
            // Uniforms belong to a draw batch, not a mesh. Flush the preceding mesh
            // before replacing its values, even when this pipeline is already active.
            this.flush();
            this.set3f("uLight", tint.light[0], tint.light[1], tint.light[2]);
            this.set4f("uDark", tint.dark[0], tint.dark[1], tint.dark[2], tint.dark[3]);
            this.set1f("uOpacity", tint.light[3]);
            const r = tint.region, p = tint.page, trim = r && p && !r.rotated && (r.width !== r.original_width || r.height !== r.original_height);
            this.set1f("uTrimEnabled", trim ? 1 : 0);
            if (trim) {
                this.set4f("uTrim", (r.x + .5) / p.width, (r.y + .5) / p.height, (r.x + r.width - .5) / p.width, (r.y + r.height - .5) / p.height);
                this.set2f("uPageSize", p.width, p.height);
            }
        }
    }
    const pipeline = new DarkTintPipeline({ game: scene.sys.game, fragShader: fragment });
    manager.add(name, pipeline);
    pipelines.set(renderer, pipeline);
    return pipeline;
}
export function applyDarkTint(scene: Phaser.Scene, mesh: Phaser.GameObjects.Mesh, light: Rgba, dark: Rgba | undefined, region?: AtlasRegion, page?: AtlasPage): void {
    if (!mesh.frame.source.glTexture?.pma)
        throw new Error("Ankhimate tint requires premultiplied atlas textures (Phaser PNG loading)");
    mesh.setPipelineData("ankhimateDarkTint", { light, dark: dark ?? [0, 0, 0, 0], ...(region ? { region } : {}), ...(page ? { page } : {}) } satisfies TintUniforms);
    mesh.setPipeline(pipelineFor(scene));
}
