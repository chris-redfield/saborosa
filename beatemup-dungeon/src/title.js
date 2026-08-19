/**
 * title.js — the first thing the game shows.
 *
 * The flying dungeon's title screen, brought over: a bed of crawling vermin
 * with the SABOROSA logo laid over it, and any button starts the fight.
 *
 * THE ART IS BORROWED, NOT COPIED. Both images are read in place out of
 * `assets-v2/flying-dungeon/` -- the three frames its endings crawl on, and the
 * logo its finale lands on. Nothing is duplicated into this game's folder, for
 * the reason the character packs are not either: two copies of a picture drift
 * the moment one of them is recut, and the copy that is wrong is always the one
 * you are not looking at.
 *
 * ⚠️ IT IS A CLASS HERE AND WAS NOT THERE, and that is the one deliberate
 * difference. In the flying dungeon this lives in the shell as two draw calls,
 * because the screen it borrows from is part of the same game and already owns
 * the loading, the frame clock and the timing. This game owns none of that --
 * it has no game-over panel of its own -- so the animation clock has to live
 * somewhere, and a file that holds it is cheaper than a shell that grows four
 * more variables.
 *
 * THE FRAME CLOCK IS THE ART'S, NOT THE GAME'S. Three frames at ~105ms each,
 * cycling 1-2-3, which is the timing those frames were drawn to and tuned at in
 * the flying dungeon's tools/game-over-anim.html. It runs off its own
 * accumulated time rather than the frame counter, so it crawls at the same rate
 * on a 144Hz monitor as on a 60Hz one.
 */
class Title {
  constructor(assets) {
    this.assets = assets;
    this.t = 0;          // ms on screen, drives the crawl
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
      this.out = 0;
    }
    return false;
  }

  /** Which crawl frame `t` ms in. Per-frame holds, so an uneven cut still works. */
  _frameAt(t) {
    const holds = CONFIG.TITLE_HOLDS_MS || [105, 105, 105];
    const n = (CONFIG.TITLE_FRAMES || []).length || holds.length;
    let total = 0;
    for (let i = 0; i < n; i++) total += holds[i % holds.length];
    if (total <= 0) return 0;
    let r = t % total;
    for (let i = 0; i < n; i++) {
      r -= holds[i % holds.length];
      if (r < 0) return i;
    }
    return n - 1;
  }

  draw(ctx, W, H) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    const img = this.assets.getDrawable('title' + this._frameAt(this.t));
    if (img) {
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      // The band IS the picture and it is already 16:9 — fill the canvas.
      ctx.drawImage(img, 0, 0, W, H);
      ctx.restore();
    }

    const logo = this.assets.getDrawable('logo');
    if (logo) {
      const dw = W * (CONFIG.titleLogoWRel || 0.52);
      const dh = dw * ((logo.height || logo.naturalHeight) / (logo.width || logo.naturalWidth));
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      /* NO DROP SHADOW AND NOTHING DARKENED UNDER IT. The art shows at full
         brightness and the letters sit on it crisp -- that is the house look
         for every title screen in this project and it is not up for a tasteful
         gradient. */
      ctx.drawImage(logo, W / 2 - dw / 2, H / 2 - dh / 2, dw, dh);
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
