import { Shader } from 'pixi.js';
import type { Mesh, MeshGeometry, Texture } from 'pixi.js';
import type { AtlasRegion } from '@ankhimate/runtime';

// Same PMA equation as Phaser and the Rust CPU renderer. Dark alpha is shadow
// intensity, never opacity. Full-page UVs retain the CPU texel-centre mapping.
const vertex = `
precision highp float;
attribute vec2 aPosition;
attribute vec2 aUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform vec4 uWorldColorAlpha;
uniform vec4 uColor;
varying vec2 vUV;
varying vec4 vColor;
void main() {
  vUV = aUV;
  vColor = uColor * uWorldColorAlpha;
  gl_Position = vec4((uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
}`;
const fragment = `
precision highp float;
uniform sampler2D uTexture;
uniform vec3 uLight;
uniform float uOpacity;
uniform vec4 uDark;
uniform vec4 uTrim;
uniform vec2 uPageSize;
uniform float uTrimEnabled;
varying vec2 vUV;
varying vec4 vColor;
void main() {
  vec2 sampleUV = vUV;
  float coverage = 1.0;
  if (uTrimEnabled > 0.5) {
    // Atlas extrusion is not source content. Sample retained centres only,
    // then reconstruct the removed zero-PMA texels' bilinear contribution.
    vec2 low = clamp((vUV - uTrim.xy) * uPageSize + 1.0, 0.0, 1.0);
    vec2 high = clamp((uTrim.zw - vUV) * uPageSize + 1.0, 0.0, 1.0);
    coverage = low.x * low.y * high.x * high.y;
    sampleUV = clamp(vUV, uTrim.xy, uTrim.zw);
  }
  vec4 texel = texture2D(uTexture, sampleUV) * coverage;
  vec3 rgb = texel.rgb * uLight + (vec3(texel.a) - texel.rgb) * uDark.rgb * uDark.a;
  gl_FragColor = vec4(rgb * vColor.rgb, texel.a * vColor.a) * uOpacity;
}`;

/** One small effect per tinted slot, private uniforms, shared Pixi program cache. */
export class DarkTint {
  private shader: (Shader & { texture: Texture }) | undefined;
  private texture!: Texture;
  private readonly light = new Float32Array(4);
  private readonly dark = new Float32Array(4);
  private readonly trim = new Float32Array(4);
  private readonly pageSize = new Float32Array(2);
  private trimEnabled = 0;
  constructor(private readonly mesh: Mesh<MeshGeometry>) {
    // Avoid compiling GL programs in headless Node pose tests. Pixi invokes this
    // before building its render instructions; the mesh is then unbatched.
    mesh.onRender = () => { this.prepare(); mesh.shader = this.shader!; };
  }
  update(texture: Texture, light: readonly number[], dark: readonly number[], region?: AtlasRegion): void {
    this.trimEnabled = region && (region.width !== region.original_width || region.height !== region.original_height) ? 1 : 0;
    if (this.trimEnabled && region) {
      this.trim[0] = (region.x + .5) / texture.width;
      this.trim[1] = (region.y + .5) / texture.height;
      this.trim[2] = (region.x + region.width - .5) / texture.width;
      this.trim[3] = (region.y + region.height - .5) / texture.height;
      this.pageSize[0] = texture.width; this.pageSize[1] = texture.height;
    }
    this.texture = texture; this.light.set(light); this.dark.set(dark);
    if (this.shader) this.prepare();
  }
  private prepare(): void {
    this.shader ??= Object.assign(Shader.from({ gl: { vertex, fragment, name: 'ankhimate-two-color', preferredFragmentPrecision: 'highp' }, resources: {
      uTexture: this.texture.source,
      tintUniforms: { uLight: { value: new Float32Array(3), type: 'vec3<f32>' }, uOpacity: { value: 1, type: 'f32' }, uDark: { value: new Float32Array(4), type: 'vec4<f32>' },
        uTrim: { value: new Float32Array(4), type: 'vec4<f32>' }, uPageSize: { value: new Float32Array(2), type: 'vec2<f32>' }, uTrimEnabled: { value: 0, type: 'f32' } },
    } }), { texture: this.texture });
    this.shader.resources.uTexture = this.texture.source;
    const group = this.shader.resources.tintUniforms;
    group.uniforms.uLight.set(this.light.subarray(0,3)); group.uniforms.uOpacity = this.light[3]; group.uniforms.uDark.set(this.dark);
    group.uniforms.uTrim.set(this.trim); group.uniforms.uPageSize.set(this.pageSize); group.uniforms.uTrimEnabled = this.trimEnabled; group.update();
  }
  destroy(): void {
    // Do not destroy the shared program, renderer groups or borrowed textures.
    this.mesh.onRender = null;
    this.shader?.destroy(); this.shader = undefined;
  }
}
