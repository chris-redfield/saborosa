/**
 * Stats — the tally the CLEAR board is built from.
 *
 * A RUN'S WORTH OF COUNTERS AND NOTHING ELSE. It knows nothing about drawing,
 * and nothing about the fight either: `combat.js` tells it what happened, and
 * that is the ONE place hits are resolved in this game, so every number here
 * comes from the same resolver the player actually fought against. Counting
 * swings in player.js and hits in combat.js would be two sources for one ratio,
 * and accuracy would drift the first time either changed.
 *
 * ⚠️ A SWING IS COUNTED WHEN ITS HITBOX GOES LIVE, NOT WHEN THE BUTTON IS
 * PRESSED. A punch interrupted during its own start-up never became a punch —
 * the player was hit out of it — and charging them for it would make accuracy a
 * measure of how often they were interrupted. `hitbox()` is null until the
 * active window opens, so "the frame a live box first exists" is exactly the
 * right moment, and it is already being computed.
 *
 * ⚠️ IT IS COUNTED ONCE PER ATTACK, BY IDENTITY. The active window is several
 * frames long, so counting every frame a box exists would score one punch as
 * five. The attack OBJECT is the identity — Fighter builds a fresh one per
 * swing — so holding the last one seen is enough and no id has to be invented.
 *
 * DEV MODE INFLATES `damageOut` and nothing else. Every punch does 50 with it
 * on, so the damage total is real but meaningless; the hit counts, accuracy and
 * time are unaffected. The board says so on screen rather than hiding it.
 */
class Stats {
  constructor() { this.reset(); }

  reset() {
    this.swings = 0;        // punches whose hitbox went live
    this.hits = 0;          // ...of which connected
    this.damageOut = 0;
    this.taken = 0;         // blows the player ate
    this.damageIn = 0;
    this.kills = {};        // kind -> how many went down
    this.time = 0;          // seconds of PLAY, not of end screens
    this._swing = null;     // the attack object last counted as a swing
    this._connected = null; // ...and the last one counted as having connected
  }

  /** Called every frame with the player's live hitbox (or null). */
  countSwing(atk) {
    if (atk && atk !== this._swing) {
      this._swing = atk;
      this.swings++;
    }
  }

  /**
   * A blow the player landed. `swing` is the ATTACK OBJECT it came from, and
   * passing it is what keeps accuracy honest.
   *
   * ⚠️ `hits` IS SWINGS THAT CONNECTED, NOT BODIES STRUCK, and the two stopped
   * being the same thing on 2026-08-24 when the finisher started hitting
   * everything in its box. `accuracy()` is hits/swings, so counting each body
   * would let one punch that caught three enemies score 300%. Damage always
   * accumulates; the hit is counted once per attack object, the same dedupe
   * `countSwing` does one line above and for the same reason.
   *
   * ⚠️ OMITTING `swing` COUNTS EVERY CALL, which is what a thrown barrel wants:
   * it is not a swing, nothing called `countSwing` for it, and it has no attack
   * object to be deduped by.
   */
  hit(dmg, swing) {
    this.damageOut += dmg;
    if (swing !== undefined) {
      if (swing === this._connected) return;
      this._connected = swing;
    }
    this.hits++;
  }
  tookHit(dmg) { this.taken++; this.damageIn += dmg; }
  killed(kind) { this.kills[kind] = (this.kills[kind] || 0) + 1; }
  tick(dt) { this.time += dt; }

  accuracy() {
    return this.swings ? Math.round((this.hits / this.swings) * 100) : 0;
  }

  downed() {
    let n = 0;
    for (const k in this.kills) n += this.kills[k];
    return n;
  }

  /** "DUDU x7 · DIDI x5 · CLAUDINHO x4", in the order the cast is declared.

      ⚠️ IT WALKS `CONFIG.CHARACTERS`, so it can only ever name a character that
      has a pack entry there. The Mosca does not -- it is a FlyBoss with two raw
      sheets -- so NARUTÃO can never appear on this line, and neither boss is
      counted here. That is why `CONFIG.MOSCA_NAME` exists and why nothing reads
      it yet. */
  downedBy() {
    const out = [];
    for (const kind of Object.keys(CONFIG.CHARACTERS)) {
      const n = this.kills[kind];
      if (n) out.push(`${CONFIG.CHARACTERS[kind].name} x${n}`);
    }
    return out.join('   ');
  }

  /**
   * The letter, and it is the only line on the board that JUDGES the run rather
   * than reporting it.
   *
   * THREE THINGS, WEIGHTED, because any one of them alone is farmable: rank on
   * accuracy and standing still poking at one enemy wins it; rank on damage
   * taken and so does running away; rank on time and the reward is skipping the
   * fights. Together they describe a player who hit what they aimed at, did not
   * get hit back, and kept moving.
   *
   * The two budgets are deliberately generous — `rankDamageBudget` is two full
   * health bars, `rankParS` a comfortable clear — because a rank that is hard to
   * read is just a participation letter. S is meant to be rare, C is meant to
   * still feel like finishing.
   */
  rank() {
    const R = CONFIG.RESULTS;
    const clamp = (v) => Math.max(0, Math.min(1, v));
    const acc = clamp(this.accuracy() / 100);
    const kept = clamp(1 - this.damageIn / R.rankDamageBudget);
    const pace = clamp(R.rankParS / Math.max(1, this.time));
    const score = acc * R.rankWeights[0] + kept * R.rankWeights[1]
                + pace * R.rankWeights[2];
    for (const [letter, min] of R.rankTiers) {
      if (score >= min) return letter;
    }
    return R.rankTiers[R.rankTiers.length - 1][0];
  }

  /**
   * The board's rows, in order.
   *
   * `value` is the NUMBER the tally rolls up to and `text` formats it, so the
   * count-up needs to know nothing about percent signs, slashes or clocks — it
   * animates one number and asks for the label of the moment. A row with no
   * `value` is not rolled at all.
   */
  rows() {
    const mm = (s) => {
      const t = Math.max(0, Math.round(s));
      return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    };
    /* ⚠️ THE LABELS LIVE IN CONFIG AND ARE PORTUGUESE, by request -- nothing on
       this board is in English. They are slang rather than translations; see
       the note on RESULTS.LABELS for which ones were chosen rather than given. */
    const L = (CONFIG.RESULTS && CONFIG.RESULTS.LABELS) || {};
    return [
      { label: L.hits,     value: this.hits,       text: (n) => `${n} / ${this.swings}` },
      { label: L.accuracy, value: this.accuracy(), text: (n) => `${n}%` },
      { label: L.taken,    value: this.taken,      text: (n) => `${n}` },
      { label: L.dealt,    value: this.damageOut,  text: (n) => `${n}` },
      { label: L.suffered, value: this.damageIn,   text: (n) => `${n}` },
      { label: L.time,     value: this.time,       text: mm },
      { label: L.downed,   value: this.downed(),   text: (n) => `${n}`,
        note: this.downedBy() },
    ];
  }
}
