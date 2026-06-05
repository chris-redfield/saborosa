# Intro / Title Screen — Animations

This document explains every animation on the Saborosa intro screen and the
parameters that tune them. All parameters live in **`src/screens/intro.config.js`**
(the global `INTRO_JUICE`); the doc cites them by their group and name, e.g.
`title.enterDur`. It describes *behaviour and feel* — not implementation.

The intro runs at the game's standard resolution, **1280 × 720**.

---

## Boot sequence (what happens on load)

When the title screen first appears, several things play out on a shared clock
that starts at load (call it `t`, in seconds):

1. **Fade-in from black.** The whole window starts black and fades to clear over
   `bootFadeDur` (0.9s). This is a full-window overlay, so it covers the canvas,
   its border, and the surrounding letterbox — not just the play area.

2. **Title drop-in.** "SABOROSA" falls into place from above and fades in
   simultaneously (see *Title* below).

3. **Menu slide-in.** START and OPTIONS slide in from the sides shortly after
   (see *Menu entrance*).

4. **Hand pop-in.** Once the words land, the pointing hand pops onto the
   selected item.

### Entrance timeline

| Element  | Starts (t)            | Duration              | Settles | Motion              |
|----------|-----------------------|-----------------------|---------|---------------------|
| SABOROSA | 0 (no delay)          | `title.enterDur` 0.7s | ~0.7s   | drop from above     |
| START    | `menu.enterDelay` 0.2 | `menu.enterDur` 0.6s  | ~0.8s   | slide from right    |
| OPTIONS  | `menu.enterDelay` 0.2 | `menu.enterDur` 0.6s  | ~0.8s   | slide from left     |
| Hand     | ~0.8 (after words)    | `menu.handEnterDur` 0.3s | ~1.1s | pop-in (overshoot)  |

**Sync note:** START and OPTIONS are perfectly synced *with each other* — same
delay, same duration, only the direction differs. The **title is intentionally
offset** from the menu: it begins immediately at `t = 0` while the menu waits
`menu.enterDelay` (0.2s) and runs slightly faster (`menu.enterDur` 0.6 vs
`title.enterDur` 0.7). The result is a cascade — title drops → words slide in
together → hand pops on — rather than everything moving in lockstep. To lock the
menu to the title's clock, set `menu.enterDelay` to 0 and match the durations.

---

## Background

A seamless horizontal image pans continuously left-to-right at `scrollSpeed`
(40 px/sec). The image tiles forever, so the scroll never ends or jumps. This
speed is a dialed-in feel — change it deliberately.

---

## Title (SABOROSA)

Drawn from hand-lettered art at `title.imgHeight` (150px tall, width auto from
aspect ratio).

- **Entrance.** Drops in from `title.enterDrop` (70px) above its resting spot
  over `title.enterDur` (0.7s), using an "ease-out-back" curve so it slightly
  overshoots and settles. Its opacity ramps in over `title.fadeInDur` (0.5s).
- **Idle motion (perpetual).** After the entrance, the title gently bobs and
  "breathes" forever:
  - **Bob** — a vertical sway of `title.bobAmp` (6px) at `title.bobFreq`
    (1.6 rad/sec).
  - **Breathe** — a subtle scale wobble of `title.breatheAmp` (±1.2%) at
    `title.breatheFreq` (1.2 rad/sec).
  - Both ramp in smoothly: idle motion stays off until `title.settleDelay`
    (0.5s) after load, then fades to full strength over `title.settleDur`
    (0.5s), so the title doesn't start wobbling mid-drop.
- **Confirm punch.** When START is chosen, the title kicks larger by
  `title.punchKick` (+35% scale) and fades out as the screen hands off (see
  *Confirm punch*).

---

## Main menu (START / OPTIONS)

Each option is hand-lettered art at `menu.itemHeight` (52px tall).

### Entrance
START slides in from the right and OPTIONS from the left, each travelling
`menu.enterOffset` (130px) with the same ease-out-back overshoot the title uses,
fading in as they arrive. See the timeline above for timing.

### Selection feel
Selection is animated, not instant. A per-item "selected-ness" value eases
toward the highlighted item at `menu.selectEaseRate` (16 — higher = snappier),
so the highlight glides between items. For the selected item:

- **Scale up** to `menu.selScale` (1.18×).
- **Slide right** by `menu.selSlide` (6px).
- **Brighten** — unselected items sit at `menu.idleAlpha` (0.82 opacity); the
  selected one goes full opacity. (The art is pre-coloured yellow, so selection
  reads through size + brightness, not a colour change.)
- **Pop on change** — each time you move the selection, the new item gets a
  brief extra scale bump of `menu.pulseScale` (+10%) that fades over
  `menu.pulseDecay` (0.22s).

### Pointing-hand cursor
A hand-drawn hand points at the selected item from its left.

- **Size** `menu.handHeight` (37px tall).
- **Position** sits `menu.handGap` (28px) from the word's left edge.
- **Breathing** — it drifts toward and away from the word by `menu.handBreatheAmp`
  (9px) at `menu.handBreatheFreq` (4 rad/sec), so it feels alive.
- **Pop-in** — on load it appears only after the words have landed, popping in
  with an overshoot over `menu.handEnterDur` (0.3s).

### Fade during START
When START is confirmed, the whole menu fades out over
`punch.dur × menu.fadeOnStartFactor` (0.55 × 0.6 ≈ 0.33s) as the punch plays.

---

## OPTIONS sub-screen (VOLUME · OFF / ON)

Choosing OPTIONS reveals a volume setting laid out like the source artwork:
**VOLUME** as a label on top, with **OFF** (left) and **ON** (right) side-by-side
below, and a **thumbs-up hand** marking the current choice.

### Layout
- VOLUME label centered at `options.volumeY` (58% of screen height), height
  `options.volumeHeight` (52px).
- OFF and ON centered at `options.valueY` (72% of screen height), height
  `options.valueHeight` (52px), separated by `options.valueSpread` (150px to
  either side of center).

### Selection
- **OFF/ON crossfade.** A value eases between OFF and ON at
  `options.selectEaseRate` (16). The selected value scales up by
  `options.valueSelScale` (1.12×) and is full opacity; the other dims to
  `options.idleAlpha` (0.7). The crossfade is tied to the thumb's glide, so the
  feedback feels connected.
- **Thumbs-up cursor.** Sits under the selected value at `options.thumbHeight`
  (57px tall), `options.thumbGap` (14px) below it. It **glides** horizontally
  between OFF and ON as you switch (same easing as the crossfade), and gently
  bobs up/down by `options.thumbBreatheAmp` (8px) at `options.thumbBreatheFreq`
  (4 rad/sec).
- **Controls.** ← selects OFF, → selects ON. Esc / Space / Enter returns to the
  main menu. OFF mutes the game music and ON unmutes it; the choice is applied
  live and carries into gameplay (the intro and game share one audio manager).

---

## Confirm punch (pressing START)

When START is confirmed, a short "punch" plays before the game loads, lasting
`punch.dur` (0.55s):

- **White flash** — the screen flashes white to `punch.flashStrength` (0.7
  opacity) and fades over `punch.flashDecay` (0.35s).
- **Screen shake** — the title and menu (as one group) jitter, peaking at
  `punch.shakeAmp` (14px) and decaying to zero. Horizontal jitter runs at
  `punch.shakeFreqX` (62) and vertical at `punch.shakeFreqY` (53 rad/sec);
  vertical shake is gentler by `punch.shakeYScale` (0.6×). Only the foreground
  shakes, so the screen edges never reveal gaps.
- **Title kick + menu fade** — as described above.

Once the punch finishes, the screen blacks out fully (and waits for that black
to actually paint, so the stage load doesn't freeze on the last frame), then the
game **fades in** as the black cover fades out over `reveal.fadeDur` (0.4s).

---

## Atmosphere layers

Ambience drawn over the background but under the text.

### Vignette
Darkened edges that draw the eye to the center. `atmosphere.vignette.strength`
(0.6) is the peak corner darkness; `atmosphere.vignette.innerRadius` (0.35) is
how far from the center (as a fraction of the half-diagonal) the darkening
begins. Set `strength` to 0 to disable.

### Drifting pollen / dust
`atmosphere.particles.count` (45) soft glowing motes float through the air. Each
mote is randomized within ranges so the field never looks uniform:

- **Size** between `minR` (1px) and `maxR` (3px).
- **Drift** — horizontal between `minDriftX`/`maxDriftX` (−14…−4 px/sec, a gentle
  leftward drift) and vertical between `minVy`/`maxVy` (−22…−6 px/sec, floating
  up). Motes wrap around the screen edges endlessly.
- **Sway** — a sideways waver of `swayAmp` (12px) at a per-mote speed between
  `minSwayFreq`/`maxSwayFreq` (0.4…1.1 rad/sec).
- **Twinkle** — opacity wobbles by `twinkleAmp` (±25%) at a per-mote speed
  between `minTwinkleFreq`/`maxTwinkleFreq` (0.6…1.8 rad/sec), around a base
  opacity between `minAlpha`/`maxAlpha` (0.12…0.5).
- **Colour** — a warm tint, `color` (RGB 255, 246, 214).

Set `count` to 0 to disable.

---

## Dev toggles (testing aid)

While the intro is on screen, small buttons appear at the top-left (outside the
canvas) for quick A/B testing. They remove themselves when START is pressed.

- **Vignette: ON/OFF** — toggles the vignette.
- **Pollen: ON/OFF** — toggles the drifting motes.
- **Title / Start-Options / Hand: YELLOW or B&W** — each switches that element
  between the yellow art and the black-and-white line-art variant, independently.
