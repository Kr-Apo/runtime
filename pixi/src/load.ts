import { ImageSource, Texture } from 'pixi.js';
import type { AtlasPage } from '@ankhimate/runtime';
import { requireThat } from './validate.js';

export async function pageTexture(url: URL, page: AtlasPage, signal?: AbortSignal): Promise<Texture> {
  const response = await fetch(url, { ...(signal ? { signal } : {}) });
  requireThat(response.ok, `Atlas page ${page.index} failed: HTTP ${response.status} (${url})`);
  const blob = await response.blob();
  // Native atlas pages are PNG; do not silently accept HTML or another codec.
  const magic = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
  requireThat([137,80,78,71,13,10,26,10].every((v,i) => magic[i] === v), `Atlas page ${page.index} is not PNG (${url})`);
  signal?.throwIfAborted();
  const objectUrl = URL.createObjectURL(blob);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: unknown) => {
        image.onload = image.onerror = null;
        signal?.removeEventListener('abort', abort);
        if (error) reject(error); else resolve();
      };
      const abort = () => { image.src = ''; finish(signal?.reason ?? new Error('Atlas loading aborted')); };
      image.onload = () => finish();
      image.onerror = () => finish(new Error(`Cannot decode atlas PNG ${url}`));
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort(); else image.src = objectUrl;
    });
    signal?.throwIfAborted();
    requireThat(image.naturalWidth === page.width && image.naturalHeight === page.height,
      `Atlas page ${page.index}: decoded dimensions do not match JSON`);
    // HTMLImageElement honours WebGL's UNPACK_PREMULTIPLY_ALPHA_WEBGL.
    // ImageBitmap has different upload semantics and is deliberately not used.
    return new Texture({ source: new ImageSource({ resource: image, alphaMode: 'premultiply-alpha-on-upload',
      resolution: 1, scaleMode: 'linear', autoGenerateMipmaps: false }) });
  } finally { URL.revokeObjectURL(objectUrl); }
}
