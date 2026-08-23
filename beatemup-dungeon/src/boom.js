/**
 * boom.js — a string of explosions, for a boss that goes up rather than down.
 *
 * ONE COPY, TWO BOSSES. It was written inside horse-boss.js on 2026-08-22 and
 * lifted out the same day when the Mosca was asked for the same death. The two
 * are genuinely the same effect -- the only things that differ are how many,
 * how far apart, and how big, which is why all of those are config and none of
 * them are in here.
 *
 * ⚠️ THE PATTERN IS ROLLED ONCE, AT THE MOMENT OF DEATH, AND STORED. Rolling it
 * inside draw() gives a different scatter sixty times a second, which is not an
 * explosion, it is static. That is the same lesson hit-fx.js records for the
 * impact bursts, where the variant is frozen onto the event -- and it is the
 * single most repeated mistake in this codebase's effects.
 *
 * ⚠️ AND THE TIMES ARE SHUFFLED AGAINST THE POSITIONS. Laid out along the body
 * and then fired in that order, the blasts unzip it nose to tail; dealt out at
 * random they read as the thing coming apart from the inside. It is one line
 * either way and it is the whole difference between the two readings.
 *
 * NOTHING IS TICKED HERE. Each blast knows when it starts and the caller says
 * what time it is, so the whole string is a pure function of the death clock --
 * the same arrangement the game over panel uses, and it means there is no
 * second clock to keep in step with the one the boss already has.
 *
 * The art is STILL LIFE's explosion sheet, read in place out of that game's
 * folder: CONFIG.BOOM_SHEET, CONFIG.BOOM_RECTS, CONFIG.boomMs.
 */
class Booms {
  constructor() { this.list = []; }

  /** True once armed, whatever is or is not still on screen. */
  get armed() { return this.list.length > 0; }

  /**
   * Roll the pattern. `cfg` is a DEATH_BOOM block; `refPx` is the body size the
   * spread is measured against, so a bigger boss scatters wider for free.
   */
  arm(cfg, refPx) {
    this.list = [];
    if (!cfg || !cfg.on) return;
    const n = Math.max(1, cfg.count || 7);

    // The order they go off in: 0..n-1, shuffled. See the header.
    const order = [];
    for (let i = 0; i < n; i++) order.push(i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
    }

    const jit = cfg.sizeJitter || 0;
    for (let i = 0; i < n; i++) {
      /* Spread ALONG the body first and jittered second, so the blasts cover
         all of it instead of clustering wherever the rolls happened to fall. */
      const spanX = (n === 1) ? 0 : ((i + 0.5) / n * 2 - 1);
      this.list.push({
        ox: (spanX * (cfg.spreadXRel || 0.55) + (Math.random() - 0.5) * 0.16) * refPx,
        // Up from the ground point: never at floor level, never overhead.
        oy: -(0.18 + Math.random() * (cfg.spreadYRel || 0.75)) * refPx,
        at: (cfg.startMs || 0) + order[i] * (cfg.everyMs || 180),
        size: (cfg.sizePx || 210) * (1 + (Math.random() * 2 - 1) * jit),
      });
    }
  }

  /** ms from the death to the last blast finishing. For sizing `dieMs`. */
  static spanMs(cfg) {
    if (!cfg || !cfg.on) return 0;
    const rects = (CONFIG.BOOM_RECTS || []).length;
    return (cfg.startMs || 0) + Math.max(0, (cfg.count || 7) - 1) * (cfg.everyMs || 180)
         + rects * (CONFIG.boomMs || 71);
  }

  /**
   * Draw whatever is alight at death-time `t` SECONDS, around the ground point
   * (gx, gy). `img` is the explosion sheet; a missing one draws nothing rather
   * than throwing -- a death must never be able to take the frame down with it.
   */
  draw(ctx, img, gx, gy, t) {
    if (!this.list.length) return;
    const rects = CONFIG.BOOM_RECTS || [];
    if (!img || !rects.length) return;
    const ms = CONFIG.boomMs || 71;
    const now = t * 1000;

    /* Measured off the WIDEST frame, not the first. With the full twelve-frame
       set the first frame is the smallest -- the blast growing -- so anchoring
       the scale on it would make every explosion enormous. */
    let peak = 1;
    for (const r of rects) if (r[2] > peak) peak = r[2];

    ctx.save();
    for (const b of this.list) {
      const local = now - b.at;
      if (local < 0) continue;
      const i = Math.floor(local / ms);
      if (i >= rects.length) continue;              // this one has finished
      const r = rects[i];
      const s = b.size / peak;
      const w = r[2] * s, h = r[3] * s;
      /* Centred on its own point so the frames grow and shrink about it. Every
         frame shares one scale, which is what keeps their relative sizes: the
         animation is the sheet's, not something re-timed here. */
      ctx.drawImage(img, r[0], r[1], r[2], r[3],
                    gx + b.ox - w / 2, gy + b.oy - h / 2, w, h);
    }
    ctx.restore();
  }
}
