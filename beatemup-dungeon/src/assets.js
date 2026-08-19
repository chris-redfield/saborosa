/**
 * Assets — a tiny image + JSON store.
 *
 * Ported from flying-dungeon/src/assets.js, with JSON loading added because
 * this game's characters are sheet + defs pairs rather than bare images.
 *
 * Exposes `getDrawable(key)` and `getJSON(key)` on purpose: those are the SAME
 * accessor names the main Saborosa engine uses, so the sheet reader in
 * sheets.js reads identically here and there. When this lifts into the main
 * game you delete this file and let its asset system answer instead.
 *
 * PATH PREFIXES. Two asset roots are in play — the main game's `assets/` for
 * the character packs and `assets-v2/` for the floor tile master — so a src
 * string may carry a `v2:` prefix to pick the second. Resolving it here, in
 * one place, is what keeps the rest of the code from knowing there are two
 * roots at all, and what lets package.sh flatten both into one folder by
 * rewriting two lines of config.
 */
class Assets {
  constructor() {
    this.store = {};
    this.json = {};
    /* Undecoded audio, kept apart from `store` because it is not a drawable and
       nothing may hand it to drawImage by mistake. See loadAudio. */
    this.bytes = {};
    this.loaded = 0;
    this.total = 0;
  }

  getDrawable(key) { return this.store[key] || null; }
  getJSON(key) { return this.json[key] || null; }
  getBytes(key) { return this.bytes[key] || null; }

  /** Turn a config `src` into a URL. `v2:foo.png` → ASSET_V2_BASE + foo.png. */
  resolve(src) {
    if (!src) return '';
    if (/^https?:|^\.|^\//.test(src)) return src;
    if (src.slice(0, 3) === 'v2:') return CONFIG.ASSET_V2_BASE + src.slice(3);
    return CONFIG.ASSET_BASE + src;
  }

  _tick() { this.loaded++; }

  /** Fraction of the declared work that has finished, 0..1. */
  progress() { return this.total ? Math.min(1, this.loaded / this.total) : 1; }

  /**
   * Load a VIDEO as a drawable. The element itself is stored, because a
   * `<video>` is a valid source for `drawImage` and the backdrop wants to blit
   * whatever frame it is currently showing.
   *
   * IT RESOLVES ON `canplay`, NOT ON THE WHOLE FILE. Waiting for the entire
   * clip would sit the loading bar on a several-MB download while every sprite
   * was already decoded; `canplay` means there is enough buffered to start, and
   * the plate only ever needs the frame it is on. It also resolves on `error`
   * rather than rejecting, for the reason loadImage does: one missing asset
   * should cost its own layer, not the whole game.
   *
   * MUTED AND playsInline ARE LOAD-BEARING, not hygiene. An unmuted video
   * cannot be played without a user gesture on any current browser, and on iOS
   * a video without `playsinline` takes over the screen with the native player
   * the moment it plays.
   */
  loadVideo(key, src) {
    this.total++;
    return new Promise(res => {
      const v = document.createElement('video');
      v.muted = true;
      v.defaultMuted = true;
      v.playsInline = true;
      v.loop = false;
      v.preload = 'auto';
      v.crossOrigin = 'anonymous';
      let done = false;
      const finish = ok => {
        if (done) return;
        done = true;
        if (ok) this.store[key] = v;
        this._tick();
        res(ok ? v : null);
      };
      v.addEventListener('canplay', () => finish(true), { once: true });
      v.addEventListener('error', () => finish(false), { once: true });
      v.src = this.resolve(src);
      v.load();
    });
  }

  loadImage(key, src) {
    this.total++;
    return new Promise(res => {
      const i = new Image();
      i.onload = () => { this.store[key] = i; this._tick(); res(i); };
      // Resolves rather than rejects: one missing image must never take the
      // whole load down with it. The consumer null-checks getDrawable anyway,
      // so a gap shows up as a thing not drawn instead of a dead screen.
      i.onerror = () => { this._tick(); res(null); };
      i.src = this.resolve(src);
    });
  }

  /**
   * An AUDIO file, fetched as bytes and NOT decoded.
   *
   * Decoding needs an AudioContext, and browsers keep one suspended until the
   * page has been interacted with -- so decoding here would either fail or
   * force the loading bar to wait on a user gesture that may never come. The
   * bytes are what the loading bar can honestly account for; sound.js decodes
   * them the moment it has a context.
   *
   * Resolves rather than rejects, like every other loader here: a missing
   * track must cost the music, not the game.
   */
  loadAudio(key, src) {
    this.total++;
    return fetch(this.resolve(src), { cache: 'force-cache' })
      .then(r => (r.ok ? r.arrayBuffer() : null))
      .then(b => { if (b) this.bytes[key] = b; this._tick(); return b; })
      .catch(() => { this._tick(); return null; });
  }

  loadJSON(key, src) {
    this.total++;
    return fetch(this.resolve(src), { cache: 'force-cache' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) this.json[key] = d; this._tick(); return d; })
      .catch(() => { this._tick(); return null; });
  }

  /** A character pack: the cropped game PNG and its frame defs, under one key. */
  loadPack(key, base) {
    return Promise.all([
      this.loadImage(key, base + '-game.png'),
      this.loadJSON(key, base + '-sprites.json'),
    ]);
  }

  /**
   * A BIG image: decode + downscale ONCE, off the main thread, to an
   * ImageBitmap. The floor tile master is 1.4MB and several thousand px square;
   * handing that to the GPU at full size for something drawn at 0.85 scale is
   * the VRAM thrash that cost the main game its frame rate once already (see
   * PERFORMANCE.md). Falls back to a plain <img> where unsupported.
   */
  async loadBig(key, src, cap) {
    this.total++;
    try {
      if (typeof createImageBitmap !== 'function') throw 0;
      const blob = await (await fetch(this.resolve(src), { cache: 'force-cache' })).blob();
      const bmp0 = await createImageBitmap(blob);
      const s = Math.min(1, cap / Math.max(bmp0.width, bmp0.height));
      if (s >= 1) { this.store[key] = bmp0; this._tick(); return bmp0; }
      const bmp = await createImageBitmap(blob, {
        resizeWidth: Math.round(bmp0.width * s),
        resizeHeight: Math.round(bmp0.height * s),
        resizeQuality: 'high',
      });
      bmp0.close && bmp0.close();
      this.store[key] = bmp;
      this._tick();
      return bmp;
    } catch (e) {
      this.total--;               // loadImage counts its own
      return this.loadImage(key, src);
    }
  }
}
