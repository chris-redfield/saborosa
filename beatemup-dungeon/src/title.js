/**
 * title.js — the first thing the game shows.
 *
 * A photograph of a wall, held on its own for a beat, and then the name fades
 * up over it. Any button starts the fight.
 *
 * ⚠️ IT USED TO BE THE FLYING DUNGEON'S CRAWLING VERMIN PANEL with the SABOROSA
 * logo over it, three frames on a ~105ms cycle read in place out of that game's
 * folder. All of that is gone -- one still photograph and hand-set type
 * replaced it on 2026-08-21. The frame clock went with it, which is most of why
 * this file got shorter.
 *
 * THE PICTURE IS ALLOWED TO BE A PICTURE FIRST, and that is the only real idea
 * on this screen. It opens bare and stays bare for two full seconds before the
 * name arrives. Cut the type in at zero and the photograph instantly reads as a
 * background for some text; hold it first and it reads as a place, which is the
 * same place the level is filmed in. The wait is the design, not dead air --
 * `titleNameAtMs` is the knob and shortening it costs exactly that.
 *
 * ⚠️ THE PHOTO IS 4:3 AND THE CANVAS IS 16:9, so it is drawn COVER: scaled to
 * fill and centre-cropped. `contain` would pillarbox and put two black bars
 * either side of the one image the screen has.
 *
 * NO DROP SHADOW, NOTHING DARKENED UNDER THE TYPE. That is the house rule for
 * every title screen in this project -- the art shows at full brightness and
 * the letters sit on it crisp. The type is dark because the wall is sunlit; if
 * it ever stops reading, move it to a cleaner part of the wall rather than
 * shading the photograph.
 */
class Title {
  constructor(assets) {
    this.assets = assets;
    this.t = 0;          // ms on screen; the name is timed off this
    this.out = -1;       /* -1 until dismissed, then the fade-out clock.
                            IT DOUBLES AS THE "already going" FLAG: a second
                            press during the fade must not restart it, and a
                            separate boolean would be a second thing to keep in
                            step with this one. */
    this.done = false;
  }

  /** Every frame it is up. Returns true on the frame the game should begin. */
  update(dt, input) {
    this.t += dt * 1000;
    if (this.out >= 0) {
      this.out += dt * 1000;
      if (this.out >= (CONFIG.titleFadeOutMs || 600)) { this.done = true; return true; }
    } else if (input && input.takeAnyPress()) {
      /* ACCEPTED FROM THE FIRST FRAME, before the name has even arrived. The
         hold is there to be looked at, not to be sat through -- anyone who has
         seen it once must be able to leave immediately, and a title screen that
         ignores input for two seconds reads as one that has hung. */
      this.out = 0;
    }
    return false;
  }

  /** 0..1 through the name's fade-in. 1 once it is fully up. */
  _nameAlpha() {
    const at = CONFIG.titleNameAtMs != null ? CONFIG.titleNameAtMs : 2000;
    const fade = CONFIG.titleNameFadeMs != null ? CONFIG.titleNameFadeMs : 320;
    if (this.t < at) return 0;
    if (fade <= 0) return 1;
    return Math.min(1, (this.t - at) / fade);
  }

  /**
   * Draw the plate COVER: fill the canvas, centre-crop the overflow.
   *
   * Kept apart because the arithmetic is the one thing here that is easy to get
   * subtly wrong -- scaling by the wrong axis squashes a 4:3 photo into 16:9,
   * which does not look like a bug, it looks like a badly shot photo.
   */
  _plate(ctx, W, H) {
    const img = this.assets.getDrawable('titleBg');
    if (!img) return;
    const iw = img.width || img.naturalWidth;
    const ih = img.height || img.naturalHeight;
    if (!iw || !ih) return;
    const s = Math.max(W / iw, H / ih);     // max = cover; min would be contain
    const dw = iw * s, dh = ih * s;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.restore();
  }

  /**
   * One line of the title, set the way the flying dungeon sets its end panels.
   *
   * ⚠️ THE FAUX-BOLD STROKE IS NOT DECORATION. Futura is not bundled in either
   * game, so most machines fall through the stack to Century Gothic, URW Gothic
   * or Jost -- all lighter than the cut the design assumes. Stroking the glyphs
   * in their OWN colour puts that weight back, and on a machine that does have
   * Futura it is a fraction of a pixel and invisible. It is `heavy` only,
   * because the gloss is meant to be light.
   *
   * `letterSpacing` is guarded because it is a recent canvas property; without
   * it the words simply set tighter, which is a look, not a break.
   */
  _word(ctx, text, x, y, size, weight, family, heavy) {
    ctx.font = `${weight} ${size.toFixed(1)}px ${family}`;
    const ls = CONFIG.titleNameLsPct || 0;
    if ('letterSpacing' in ctx) {
      ctx.letterSpacing = (size * ls / 100).toFixed(2) + 'px';
    }
    ctx.fillText(text, x, y);
    const fb = CONFIG.titleFauxBoldPct || 0;
    if (heavy && fb > 0) {
      ctx.lineWidth = size * fb / 100;
      ctx.strokeText(text, x, y);
    }
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  draw(ctx, W, H) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    this._plate(ctx, W, H);

    const a = this._nameAlpha();
    if (a > 0) {
      const name = CONFIG.TITLE_NAME || '';
      const sub = CONFIG.TITLE_SUBNAME || '';
      const ns = CONFIG.titleNameSize || 74;
      const ss = CONFIG.titleSubSize || 30;
      const gap = CONFIG.titleNameGap != null ? CONFIG.titleNameGap : 20;
      const cy = H * (CONFIG.titleNameY != null ? CONFIG.titleNameY : 0.30);

      const col = CONFIG.titleNameColor || '#2A1B10';
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = col;
      ctx.strokeStyle = col;
      ctx.lineJoin = 'round';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      /* THE PORTUGUESE NAME IS THE TITLE AND THE ENGLISH IS A GLOSS, which is
         the whole reason the weights differ. Heavy and large, then light and
         small under it -- the jam audience mostly cannot read the first line
         and should not have to hunt for the second. */
      const total = sub ? ns + gap + ss : ns;
      const top = cy - total / 2;
      const fam = CONFIG.TITLE_FONT || CONFIG.hudFont;

      this._word(ctx, name, W / 2, top + ns / 2, ns,
                 CONFIG.titleNameWeight || 900, fam, true);
      if (sub) {
        this._word(ctx, sub, W / 2, top + ns + gap + ss / 2, ss,
                   CONFIG.titleSubWeight || 400, fam, false);
      }
      ctx.restore();
    }

    if (this.out >= 0) {
      const ms = CONFIG.titleFadeOutMs || 600;
      ctx.save();
      ctx.globalAlpha = ms > 0 ? Math.min(1, this.out / ms) : 1;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }
}
