/**
 * Backdrop — the LAYER STACK and the sources that fill it.
 *
 * The renderer never knows what a layer is made of. It walks `CONFIG.LAYERS`
 * in order, asks each one to draw itself at its own parallax offset, and draws
 * the fighters in whichever slot is marked `entities`. That is the whole
 * contract, and it is why a plane in front of everything is one config entry
 * rather than a change to the draw code.
 *
 * THE POINT OF THIS INDIRECTION IS THE FILM. The backdrop for this game is
 * going to be SHOT, not painted, and footage does not behave like a picture: it
 * has its own time. A source therefore answers one method —
 * `draw(ctx, scrollX, w, h, dt)` — and what it does inside is its own business.
 * Three kinds exist:
 *
 *     tile    an image repeated forever along x. What is in the game now: the
 *             infinite dungeon floor tile, standing in until footage exists.
 *     image   one long painted strip, drawn at an offset. NOT what this game's
 *             plate uses -- a stitched panorama was tried there and rejected;
 *             see CONFIG.SOURCES.plate.
 *     video   THE SHOT ITSELF, projected behind the fighters and scrubbed by
 *             the camera: walking winds it forward, standing still freezes it.
 *             What the plate is now.
 *     film    A FRAME SEQUENCE. What `scrub` was designed around before a
 *             video element turned out to do it for a fraction of the VRAM.
 *
 * A FILM SOURCE RUNS IN ONE OF TWO MODES AND THE SEGMENT CHOOSES, not the
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
    /* WHICH SOURCE THE `plate` LAYER ACTUALLY DRAWS. The layer stack names a
       logical 'plate' and every room points that name at its own footage, so a
       room change is one call here rather than a rewrite of CONFIG.LAYERS. */
    this.plateAlias = 'plate';
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
    if (cfg.kind === 'video') {
      return cfg.src ? [{ key: name, src: cfg.src, video: true }] : [];
    }
    return cfg.src ? [{ key: name, src: cfg.src, big: true }] : [];
  }

  /** Point the 'plate' layer at a different source. See plateAlias. */
  setPlate(name) {
    if (name && this.sources[name]) this.plateAlias = name;
  }

  /** Resolve a layer's logical source name to the one it draws right now. */
  resolve(name) {
    return name === 'plate' ? this.plateAlias : name;
  }

  /** Put a film source into 'scrub' or 'play'. No-op for the other kinds. */
  setMode(name, mode) {
    const s = this.sources[this.resolve(name)];
    if (s && s.cfg.kind === 'film') s.mode = mode;
  }

  update(dt) { this.time += dt; }

  /**
   * Draw one layer. `camX` is the world camera; the parallax factor is applied
   * here rather than by the caller so a layer's "how far away am I" lives with
   * the layer.
   */
  drawLayer(ctx, layer, camX, w, h, dt) {
    const key = this.resolve(layer.source);
    const s = this.sources[key];
    if (!s) return;
    const scrollX = camX * (layer.parallax != null ? layer.parallax : 1);
    const cfg = s.cfg;
    if (cfg.kind === 'tile') this._drawTile(ctx, key, cfg, scrollX, w, h);
    else if (cfg.kind === 'film') this._drawFilm(ctx, key, s, scrollX, w, h, dt);
    else if (cfg.kind === 'video') this._drawVideo(ctx, key, s, scrollX, w, h, dt);
    else this._drawImage(ctx, key, cfg, scrollX, w, h);
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
    const s = this.sources[this.resolve(layer.source)];
    if (!s) return null;
    const cfg = s.cfg;
    if (cfg.kind === 'film') return { x: 0, y: 0, w, h, note: 'film fills the frame' };
    if (cfg.kind === 'video') return { x: 0, y: 0, w, h, note: 'video fills the frame' };
    const img = this.assets.getDrawable(
      cfg.kind === 'tile' ? layer.source : layer.source);
    if (!img) return null;
    const scale = this.imageScale(cfg, img, h);
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

  /**
   * The scale an image source is drawn at.
   *
   * `fitH` MAKES THE TEXTURE'S PIXEL SIZE A PURE QUALITY KNOB. A plate is the
   * whole picture by definition, so any row of canvas it fails to reach shows
   * the clear colour through -- and `loadBig` may hand back a SMALLER bitmap
   * than the file, because it downscales anything over its cap. A fixed
   * `scale` silently stops covering the moment that happens. Deriving the
   * scale from the canvas height instead means capping the texture costs
   * sharpness and nothing else.
   *
   * ONE FUNCTION, so the debug view's layer bounds cannot disagree with what
   * is actually painted.
   */
  imageScale(cfg, img, h) {
    if (cfg.fitH && img.height) return h / img.height;
    return cfg.scale || 1;
  }

  /**
   * A VIDEO SOURCE — the shot projected behind the fighters, and the closest
   * thing to what this backdrop actually is.
   *
   * THE FOOTAGE DOES NOT SCROLL; IT PLAYS. The pan is inside the frame, so the
   * video is drawn stationary filling the canvas and the shot's own camera move
   * supplies the parallax. Sliding it as well would move the picture twice.
   *
   * IT IS DRIVEN BY THE CAMERA, NOT BY A CLOCK. Walking winds the shot forward;
   * standing still freezes it on a frame; there is no idling backdrop. That is
   * `scrub`, the mode the film source was designed around, done with a video
   * element instead of a pile of decoded stills.
   *
   * `worldPxPerSecond` IS THE SYNC, and it is a measurement, not a preference:
   * how many px of CAMERA travel one second of the shot's own pan is worth. Set
   * it right and the background moves 1:1 with the world, which is what
   * parallax 1.0 means. Too low and the film races the player; too high and
   * they slide across a still.
   *
   * WHY RATE CONTROL RATHER THAN SEEKING. The honest implementation of "frame
   * indexed by camera position" is to set `currentTime` every frame, and it
   * stutters badly: a seek has to decode from the nearest keyframe, and there
   * are keyframes every couple of seconds, not every frame. So the video is
   * PLAYED at whatever rate keeps it level with the camera, and `currentTime`
   * is only ever written when the two are more than `resyncS` apart -- a fresh
   * level, or a camera that moved in one jump. Continuous decode, one seek.
   *
   * The camera in this game never runs backwards (`stage._followCamera` clamps
   * it), which is what makes this safe: a rate can only ever chase forward.
   */
  _drawVideo(ctx, key, s, scrollX, w, h, dt) {
    const v = this.assets.getDrawable(key);
    if (!v || !v.videoWidth) return;
    const cfg = s.cfg;
    const dur = v.duration;

    /* THE LAST GOOD FRAME. A video that is seeking has no frame to give, and
       `drawImage` on it is a SILENT NO-OP -- so the plate draws nothing, the
       canvas keeps the clear colour it was wiped with, and the backdrop goes
       black. That is what it looked like in Firefox; Chrome holds the previous
       frame instead, which looked like the shot freezing. Same cause.
       Keeping a copy means the worst a stall can ever do is hold a frame. */
    const keepFrame = () => {
      if (v.readyState < 2 || v.seeking) return;
      if (!s.frozen) {
        s.frozen = document.createElement('canvas');
        s.frozen.width = v.videoWidth;
        s.frozen.height = v.videoHeight;
        s.frozenCtx = s.frozen.getContext('2d');
      }
      s.frozenCtx.drawImage(v, 0, 0);
      s.hasFrozen = true;
    };
    // Cheap on purpose: captured once at the start and again only around the
    // moments a frame is about to become unavailable, never every frame.
    if (!s.hasFrozen) keepFrame();

    if (isFinite(dur) && dur > 0) {
      const pps = cfg.worldPxPerSecond || 116;
      // Where the shot should be for this camera position. Held a hair short of
      // the end: running past it pauses on a black frame in some browsers.
      const target = Math.max(0, Math.min(dur - 0.05, scrollX / pps));
      const err = target - v.currentTime;

      const last = (s.lastScroll == null) ? scrollX : s.lastScroll;
      s.lastScroll = scrollX;
      const camSpeed = dt > 0 ? (scrollX - last) / dt : 0;

      if (Math.abs(err) > (cfg.resyncS || 6)) {
        /* NEVER ISSUE A SEEK WHILE ONE IS IN FLIGHT, and this guard is the
           actual bug fix. Writing `currentTime` every frame during a camera
           catch-up cancels the seek before it can land, so no frame is ever
           decoded and the plate has nothing to draw for as long as the camera
           keeps moving -- black in Firefox, frozen in Chrome. One seek at a
           time, and it is allowed to finish. */
        if (!v.seeking) {
          keepFrame();                      // hold this one while we jump
          try { v.currentTime = target; } catch (e) { /* not seekable yet */ }
          if (!v.paused) v.pause();
        }
      } else if (camSpeed < -1 && cfg.allowReverse) {
        /* GOING BACKWARDS, WHICH A VIDEO CANNOT PLAY. No browser implements a
           negative playbackRate, so the only way back is to SEEK, and a seek
           costs a decode from the previous keyframe. That is why the room this
           is enabled for ships re-encoded with a keyframe every third frame
           (tools/build-boss-plate.py): a step back decodes at most three.

           Still one seek at a time -- issuing another while one is in flight
           cancels it, and nothing ever decodes. Same storm that blacked out the
           main level's plate. */
        if (!v.paused) v.pause();
        if (!v.seeking) {
          keepFrame();
          try { v.currentTime = target; } catch (e) { /* not seekable yet */ }
        }
      } else if (camSpeed > 1) {
        /* Rate = what the camera's own speed asks for, plus a term that closes
           whatever drift has accumulated. Without the correction the shot stays
           permanently offset by however much it lagged during the last start. */
        const rate = camSpeed / pps + err * (cfg.trackGain || 1.2);
        v.playbackRate = Math.max(0.1, Math.min(cfg.maxRate || 10, rate));
        if (v.paused && !v.seeking) {
          const pr = v.play();
          if (pr && pr.catch) pr.catch(() => {});
        }
      } else if (!v.paused) {
        v.pause();          // the player stopped: freeze the frame
        keepFrame();
      }
    }

    /* Draw the shot if it has a frame, and the kept copy if it does not.
       `seeking` is checked as well as `readyState` because a browser may report
       data while the frame it holds belongs to the position we just left. */
    if (!v.seeking && v.readyState >= 2) ctx.drawImage(v, 0, 0, w, h);
    else if (s.hasFrozen) ctx.drawImage(s.frozen, 0, 0, w, h);
  }

  _drawImage(ctx, key, cfg, scrollX, w, h) {
    const img = this.assets.getDrawable(key);
    if (!img) return;
    const scale = this.imageScale(cfg, img, h);
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
