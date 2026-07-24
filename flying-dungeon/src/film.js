/**
 * Film — a 1930s black-and-white projector post-effect (PORTABLE, cheap).
 *
 * The headline is the FRAME LINE: the dark band of the gap between two film
 * frames, rolling down the picture like a misframed projector. Around it are
 * the trimmings of aged film — grain, brightness flicker, a vignette, gate
 * weave, the odd scratch. Black & white itself is done with a CSS filter on the
 * canvas (GPU-cheap); everything here is drawn ON the canvas after the scene.
 *
 * Deliberately light: pre-baked noise tiles blitted once, cached gradients, a
 * handful of fills per frame. No per-pixel work, no allocation in the hot path.
 */
class Film {
  constructor(cfg) {
    this.cfg = cfg;
    this.barY = 0;
    this.flick = 0;
    this.weaveY = 0;
    this.scratchX = -1;
    this.grainTiles = [];
    this.grainIdx = 0;
    this.grainT = 0;
    this._vig = null; this._vigKey = '';
    this._buildGrain();
  }

  // A few pre-baked greyscale-noise tiles; we blit one (offset randomly) each
  // frame so the grain crawls without generating pixels live.
  _buildGrain() {
    const N = 4, S = 256;
    for (let i = 0; i < N; i++) {
      const c = document.createElement('canvas'); c.width = c.height = S;
      const g = c.getContext('2d');
      const img = g.createImageData(S, S), d = img.data;
      for (let p = 0; p < d.length; p += 4) {
        const v = (Math.random() * 255) | 0;
        d[p] = d[p + 1] = d[p + 2] = v; d[p + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      this.grainTiles.push(c);
    }
  }

  weaveOffset() { return this.weaveY; }   // the scene is drawn shifted by this

  update(dt) {
    const c = this.cfg, s = dt / 1000;
    this.barY += c.filmBarSpeed * s;
    this.grainT += dt;
    if (this.grainT >= 45) { this.grainT = 0; this.grainIdx = (this.grainIdx + 1) % this.grainTiles.length; }
    this.flick = Math.random() * c.filmFlicker;                       // brightness dip
    this.weaveY = (Math.random() * 2 - 1) * c.filmWeave;              // gate jitter
    this.scratchX = Math.random() < c.filmScratchChance ? Math.random() : -1;
  }

  render(ctx, W, H) {
    const c = this.cfg;

    // Grain — one tile, tiled with a random offset so it never sits still.
    if (c.filmGrain > 0 && this.grainTiles.length) {
      const t = this.grainTiles[this.grainIdx];
      const ox = -((Math.random() * t.width) | 0), oy = -((Math.random() * t.height) | 0);
      ctx.save();
      ctx.globalAlpha = c.filmGrain;
      ctx.globalCompositeOperation = 'overlay';
      for (let x = ox; x < W; x += t.width)
        for (let y = oy; y < H; y += t.height) ctx.drawImage(t, x, y);
      ctx.restore();
    }

    // Vignette — cached (canvas size is fixed).
    if (c.filmVignette > 0) {
      const key = W + 'x' + H + ':' + c.filmVignette;
      if (this._vigKey !== key) {
        const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, H * 0.75);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, `rgba(0,0,0,${c.filmVignette})`);
        this._vig = g; this._vigKey = key;
      }
      ctx.fillStyle = this._vig; ctx.fillRect(0, 0, W, H);
    }

    // The FRAME LINE: soft dark gap with faint bright edges, rolling down. It
    // exits the bottom and re-enters the top (span = H + barHeight).
    const h = c.filmBarHeight;
    if (h > 0) {
      const span = H + h;
      const y = ((this.barY % span) + span) % span - h;
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0.00, 'rgba(0,0,0,0)');
      g.addColorStop(0.14, 'rgba(255,255,255,0.06)');           // bright edge above the gap
      g.addColorStop(0.50, `rgba(0,0,0,${c.filmBarDark})`);     // the dark gap
      g.addColorStop(0.86, 'rgba(255,255,255,0.06)');           // bright edge below
      g.addColorStop(1.00, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, y, W, h);
    }

    // Occasional vertical scratch.
    if (this.scratchX >= 0) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#fff';
      ctx.fillRect(Math.floor(this.scratchX * W), 0, 1, H);
      ctx.restore();
    }

    // Brightness flicker.
    if (this.flick > 0) { ctx.fillStyle = `rgba(0,0,0,${this.flick})`; ctx.fillRect(0, 0, W, H); }
  }
}
