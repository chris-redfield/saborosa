/**
 * Backdrop — the LAYER STACK and the sources that fill it.
 *
 * The renderer never knows what a layer is made of. It walks `CONFIG.LAYERS`
 * in order, asks each one to draw itself at its own parallax offset, and draws
 * the fighters in whichever slot is marked `entities`. That is the whole
 * contract, and it is why a plane in front of everything is one config entry
 * rather than a change to the draw code.
 *
 * ⚠️ THE POINT OF THIS INDIRECTION IS THE FILM. The backdrop for this game is
 * going to be SHOT, not painted, and footage does not behave like a picture: it
 * has its own time. A source therefore answers one method —
 * `draw(ctx, scrollX, w, h, dt)` — and what it does inside is its own business.
 * Three kinds exist:
 *
 *     tile    an image repeated forever along x. What is in the game now: the
 *             infinite dungeon floor tile, standing in until footage exists.
 *     image   one long painted strip, drawn at an offset.
 *     film    A FRAME SEQUENCE. The one this is all for.
 *
 * ⚠️ A FILM SOURCE RUNS IN ONE OF TWO MODES AND THE SEGMENT CHOOSES, not the
 * config — because the same footage means different things in a scrolling
 * stretch and in a locked fight:
 *
 *     scrub   the frame is indexed by CAMERA POSITION. Walking right winds the
 *             footage forward; stopping stops it; walking back rewinds it. The
 *             camera is travelling, so the film travels. This is a dolly shot,
 *             and it is what a scrolling section wants.
 *     play    the frame is indexed by TIME, looping. The camera is locked and
 *             the world carries on living around a fight — smoke drifting,
 *             a crowd moving — while the player is pinned in an arena.
 *
 * `stage.js` sets the mode from the segment kind on every frame, so a level
 * that alternates between walking and fighting alternates between a dolly and a
 * living still without either the level or the footage knowing about the other.
 *
 * DOWNSCALING. Footage will be reduced before it ships (the plan from the
 * start), so `loadBig`'s cap is the knob that decides how much VRAM a film
 * costs. A frame sequence is the single most expensive thing this game will
 * ever load — see PERFORMANCE.md for what happened last time textures got away
 * from us.
 */
class Backdrop {
  constructor(assets) {
    this.assets = assets;
    this.sources = {};
    this.time = 0;
  }

  /** Build every source declared in CONFIG.SOURCES that has something to draw. */
  build() {
    for (const [name, cfg] of Object.entries(CONFIG.SOURCES || {})) {
      if (!cfg || (!cfg.src && !cfg.frames)) continue;
      this.sources[name] = { cfg, mode: 'scrub', frame: 0, t: 0 };
    }
  }

  /** Asset keys a source needs, so game.js can queue the loads. */
  static assetsFor(name, cfg) {
    if (!cfg) return [];
    if (cfg.kind === 'film') {
      return (cfg.frames || []).map((src, i) => ({ key: `${name}#${i}`, src, big: true }));
    }
    return cfg.src ? [{ key: name, src: cfg.src, big: true }] : [];
  }

  /** Put a film source into 'scrub' or 'play'. No-op for the other kinds. */
  setMode(name, mode) {
    const s = this.sources[name];
    if (s && s.cfg.kind === 'film') s.mode = mode;
  }

  update(dt) { this.time += dt; }

  /**
   * Draw one layer. `camX` is the world camera; the parallax factor is applied
   * here rather than by the caller so a layer's "how far away am I" lives with
   * the layer.
   */
  drawLayer(ctx, layer, camX, w, h, dt) {
    const s = this.sources[layer.source];
    if (!s) return;
    const scrollX = camX * (layer.parallax != null ? layer.parallax : 1);
    const cfg = s.cfg;
    if (cfg.kind === 'tile') this._drawTile(ctx, layer.source, cfg, scrollX, w, h);
    else if (cfg.kind === 'film') this._drawFilm(ctx, layer.source, s, scrollX, w, h, dt);
    else this._drawImage(ctx, layer.source, cfg, scrollX, w, h);
  }

  /**
   * The screen rect a layer actually PAINTS, for the debug view.
   *
   * Worth having as a real answer rather than "the whole canvas": a tile source
   * with `repeatY: false` covers only a band, and if that band does not reach
   * the bottom of the frame the clear colour shows through under the belt —
   * which is very hard to spot by eye against dark art and obvious the moment
   * the bounds are drawn.
   */
  layerBounds(layer, camX, w, h) {
    const s = this.sources[layer.source];
    if (!s) return null;
    const cfg = s.cfg;
    if (cfg.kind === 'film') return { x: 0, y: 0, w, h, note: 'film fills the frame' };
    const img = this.assets.getDrawable(
      cfg.kind === 'tile' ? layer.source : layer.source);
    if (!img) return null;
    const scale = cfg.scale || 1;
    const th = img.height * scale;
    const oy = cfg.offsetY || 0;
    if (cfg.kind === 'tile') {
      // Tiles span the view horizontally by construction; vertically they cover
      // one tile height (or the frame, if repeatY).
      return cfg.repeatY
        ? { x: 0, y: 0, w, h, note: 'tiled x+y' }
        : { x: 0, y: oy, w, h: th, note: 'tiled x only' };
    }
    return { x: -camX * (layer.parallax || 1), y: oy, w: img.width * scale, h: th };
  }

  _drawTile(ctx, key, cfg, scrollX, w, h) {
    const img = this.assets.getDrawable(key);
    if (!img) return;
    const scale = cfg.scale || 1;
    const tw = img.width * scale, th = img.height * scale;
    if (tw < 1) return;
    const oy = cfg.offsetY || 0;

    /* Start one tile LEFT of the view. The modulo gives the offset of the seam
       inside the view, and without the extra tile the leftmost column would pop
       in and out as that offset crosses zero. */
    let x0 = -(((scrollX % tw) + tw) % tw) - tw;
    const rows = cfg.repeatY ? Math.ceil(h / th) + 1 : 1;
    for (let x = x0; x < w + tw; x += tw) {
      for (let r = 0; r < rows; r++) {
        ctx.drawImage(img, Math.round(x), Math.round(oy + r * th), Math.ceil(tw), Math.ceil(th));
      }
    }
    /* The tint. A flat fill over the WHOLE view rather than over the tiles: the
       tiles have just covered it edge to edge, and filling the view cannot
       leave a sliver un-tinted at a seam the way a per-tile fill can. */
    if (cfg.tint) {
      ctx.save();
      ctx.fillStyle = cfg.tint;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  _drawImage(ctx, key, cfg, scrollX, w, h) {
    const img = this.assets.getDrawable(key);
    if (!img) return;
    const scale = cfg.scale || 1;
    ctx.drawImage(img, Math.round(-scrollX), Math.round(cfg.offsetY || 0),
                  Math.ceil(img.width * scale), Math.ceil(img.height * scale));
  }

  _drawFilm(ctx, name, s, scrollX, w, h, dt) {
    const cfg = s.cfg;
    const n = (cfg.frames || []).length;
    if (!n) return;

    if (s.mode === 'play') {
      // Time-indexed, looping. The world lives while the camera is locked.
      s.t += dt;
      const hold = (cfg.holdMs || 66) / 1000;
      s.frame = Math.floor(s.t / hold) % n;
    } else {
      /* Camera-indexed: the dolly. `pxPerFrame` is how far the camera travels
         before the footage advances one frame, and it is the single number that
         syncs a walk to the shot — too small and the film races the player, too
         large and they outrun the set. It wraps rather than clamping so a level
         longer than its footage simply loops the shot. */
      const ppf = cfg.pxPerFrame || 24;
      s.frame = ((Math.floor(scrollX / ppf) % n) + n) % n;
    }

    const img = this.assets.getDrawable(`${name}#${s.frame}`);
    if (!img) return;
    /* Footage fills the frame. It is a shot, not a texture: it has no seam to
       tile and no meaningful position, so it is stretched to the view and the
       PARALLAX IS EXPRESSED AS THE FRAME CHOICE rather than as an offset. That
       is the real difference between a filmed backdrop and a painted one. */
    ctx.drawImage(img, 0, 0, w, h);
    if (cfg.tint) {
      ctx.save();
      ctx.fillStyle = cfg.tint;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }
}
