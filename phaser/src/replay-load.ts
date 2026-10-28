import type Phaser from 'phaser';
import type { AtlasPage } from '@ankhimate/runtime';
import { requireThat } from './validate.js';

interface Qualification {
  readonly renderer: Phaser.Renderer.WebGL.WebGLRenderer;
  readonly gl: WebGLRenderingContext;
  readonly canvas: HTMLCanvasElement;
  qualified: boolean;
  destroyed: boolean;
}
// One identity-bound qualification per Game, never a resource or pose cache.
// Weak ownership lets a discarded Game and its listener cycle be collected.
const qualifications = new WeakMap<Phaser.Game, Qualification | { readonly destroyed: true }>();

export function replayWebGL2(game: Phaser.Game): void {
  const renderer = game?.renderer;
  requireThat(renderer && 'gl' in renderer && renderer.gl, 'Experimental Replay Phaser requires WebGL2 (supply a WebGL2 context to Phaser)');
  const gl = renderer.gl, cached = qualifications.get(game);
  requireThat(!('pendingDestroy' in game && game.pendingDestroy) && !cached?.destroyed, 'Replay Game is destroyed or pending destruction');
  if (cached) requireThat(cached.renderer === renderer && cached.gl === gl && cached.canvas === renderer.canvas, 'Replay WebGL2 renderer/context identity changed; create a new Game and asset');
  if (typeof WebGL2RenderingContext !== 'undefined') requireThat(renderer.gl instanceof WebGL2RenderingContext, 'Expected a real WebGL2 context');
  // This remains dynamic even for a cached pose and before the loss event runs.
  requireThat(typeof gl.isContextLost === 'function', 'Expected a live WebGL2 context');
  if (renderer.contextLost || gl.isContextLost()) {
    if (cached) cached.qualified = false;
    requireThat(false, 'Replay WebGL context is lost');
  }
  if (cached?.qualified) return;
  requireThat(/^WebGL 2\.0/.test(gl.getParameter(gl.VERSION)), 'Experimental Replay Phaser requires WebGL2 (supply a WebGL2 context to Phaser)');
  requireThat(game.renderer === renderer && renderer.gl === gl && !renderer.contextLost && !gl.isContextLost(), 'Replay renderer/context changed or lost during qualification');
  if (cached) { cached.qualified = true; return; }
  const state: Qualification = { renderer, gl, canvas: renderer.canvas, qualified: true, destroyed: false };
  const invalidate = () => { state.qualified = false; };
  // Native canvas events also invalidate a loss/restoration with no intervening
  // presentation. Phaser owns actual GPU resource restoration, not this cache.
  state.canvas?.addEventListener('webglcontextlost', invalidate);
  state.canvas?.addEventListener('webglcontextrestored', invalidate);
  game.events.once('destroy', () => {
    state.destroyed = true; state.qualified = false;
    state.canvas?.removeEventListener('webglcontextlost', invalidate);
    state.canvas?.removeEventListener('webglcontextrestored', invalidate);
    // A retained destroyed Game needs only a tombstone, not its former GL objects.
    qualifications.set(game, { destroyed: true });
  });
  qualifications.set(game, state);
}

/** Stage decoded native PNG, without installing any Phaser TextureManager entry. */
export async function replayPage(url: URL, page: AtlasPage, signal: AbortSignal): Promise<HTMLImageElement> {
  requireThat(['http:', 'https:'].includes(url.protocol), 'Atlas pages require HTTP(S)');
  signal.throwIfAborted(); const response = await fetch(url, { signal });
  requireThat(response.ok, `Atlas page ${page.index}: HTTP ${response.status}`);
  const blob = await response.blob(), magic = new Uint8Array(await blob.slice(0,8).arrayBuffer());
  requireThat([137,80,78,71,13,10,26,10].every((v,i) => magic[i] === v), `Atlas page ${page.index}: expected PNG`);
  signal.throwIfAborted(); const objectUrl = URL.createObjectURL(blob), image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: unknown) => { image.onload = image.onerror = null; signal.removeEventListener('abort', abort); if (error) reject(error); else resolve(); };
      const abort = () => { image.src = ''; finish(signal.reason ?? new Error('Atlas aborted')); };
      image.onload = () => finish(); image.onerror = () => finish(new Error(`Cannot decode atlas page ${page.index}`));
      signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort(); else image.src = objectUrl;
    });
    signal.throwIfAborted(); requireThat(image.naturalWidth === page.width && image.naturalHeight === page.height, `Atlas page ${page.index}: dimensions disagree with JSON`);
    return image;
  } catch (error) { image.src = ''; throw error; }
  finally { URL.revokeObjectURL(objectUrl); }
}
