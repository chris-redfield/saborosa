# Flying Dungeon — state of play

Handoff notes for the jam game. Covers what was built, why it's shaped the way
it is, and what's still open. Values here were read off `src/config.js` at the
time of writing — trust the file over this document if they ever disagree.

Run it: serve the repo root and open `flying-dungeon/index.html`.
Package it: `./package.sh` → `dist/` + `flying-dungeon-itch.zip`.

---

## Flow

```
boot (black)
  └─ intro panels load first (~1MB) and start playing immediately,
     while the 32 heavy tray frames stream in behind them
        └─ storyboard roll  →  FRUIT SELECT (waits on the player)
             →  countdown + plane takeoff  →  fade  →  game
```

The intro doubles as the loading screen. If it finishes before the tray frames
land, it holds on black with the progress bar rather than starting half-loaded.

---

## Files added this session

| file | role |
|---|---|
| `src/intro.js` | storyboard roll, board ordering, select + liftoff scheduling |
| `src/fruit-select.js` | the SELECT FRUIT board, ported from the main game |
| `src/liftoff.js` | the plane's takeoff over the countdown |
| `src/hud.js` | canvas HUD (flies counter + run timer) |
| `src/game-clock.js` | the run's own time base — see "Planned: rewind" |
| `tools/build-intro-frames.py` | intro masters → webp (64MB → 1MB) |
| `tools/build-select-frames.py` | main game's select art → webp, into the dungeon asset set |
| `tools/intro-align.py` | measures how far the camera should roll between boards |

`package.sh` also gained the `enemy-sheets/` and `select/` copies — the former
was a pre-existing bug, every packaged build shipped without fly sprites.

---

## The intro

12 storyboard boards, `assets-v2/flying-dungeon/saborosa-intro-NN.webp`.

**Boards are cut or rolled, not uniformly scrolled.** Most transitions are a
CUT — the picture is identical and only the printed text changes, so the next
board appears in front of the current one with the camera still. Only boards
3→4 and 6→7 move the camera (`introRollBefore: [3, 6]`).

**The two rolling boards overlap.** They're crops of one taller scene — board
4's top 414px *is* board 3's bottom. Rolling a full screen height replays that
band and you see the join. `introRollPx` holds the measured offsets:

```js
introRollPx: { 3: 306, 6: 672 }
```

Re-derive with `python3 tools/intro-align.py --all` if the art changes. It
slides one board under the other and only accepts a **sharp, isolated**
minimum — boards that are the same photo under different text score low at
every offset, and that test is what rejects them.

**Board 6 is omitted** (`introOmit: [5]`, 0-based). It was a mock-up of the
fruit select with cards drawn onto the picture; the real interactive one now
opens over board 5. Omitted boards are skipped, not renumbered — every index in
config still means the board with that number on disk, and the file is never
fetched.

Current beats: `introHoldMs: 520` default, with overrides
`{7: 1040 (STOP DECAY), 8/9/10: 850 (3·2·1), 11: 765 (GO!)}`.

---

## Fruit select

Same art and same trick as the main game's `src/screens/select.js`: a 3-frame
idle loop that exists twice over, pixel-aligned — a GRAY line-art base and a
COLOURED twin. Both loops always run (every fruit keeps moving); the chosen one
lights up because the coloured twin of the *same frame* is drawn clipped to its
panel.

Differences from the main game's version:

- No background of its own — it opens over the intro board already on screen.
- No fade-to-black on confirm; the intro just carries on.
- Its own "SELECT FRUIT" title band is cropped off (`selectCropTop: 146`),
  because the board underneath already says it. Rows 141–146 are an empty
  gutter in all six frames, so the cut takes no art.

Sizing has **two boxes** and that matters: scale is measured against the FULL
content box (title included) so `selectFill` keeps meaning what it did before
the crop, while positioning centres on the panels alone. Shrinking the fit box
to match the crop would silently enlarge the board.

Panels map `JUIXY→lemon, ERKPA→eggplant, TOM→tomato`. The pick reaches the
plane via `intro.pickedCharacter` → `plane.setCharacter()`.

**The select has no clock.** It ends when the player decides. `_msUntilBoard()`
returns `Infinity` across it so nothing can be scheduled past it — without that
guard the takeoff starts while the player is still choosing and the plane flies
across the select board.

---

## Liftoff

The gridded cloth at the bottom of boards 8–12 is the runway. The plane enters
off the left edge already rolling, accelerates, rotates and climbs out.

**Its clock is derived, not configured.** `Intro._liftoffMs()` sums the beats
from `introLiftoffFrom` to the end, so retiming the countdown retimes the
takeoff automatically instead of leaving the plane airborne early or still
rolling at GO!.

Currently timed to board 9 ("3") with a 250ms head start
(`introLiftoffFrom: 8`, `introLiftoffLeadMs: 250`), and played at
`liftSpeed: 1.0` — so the takeoff fills the derived window exactly: 250 lead +
850·3 + 765 = **3565ms**.

It ran at `1.2` (2971ms) while carrying over from the era when the window was
the 4879ms one tied to STOP DECAY. Retargeting to "3" had already cut the window
to 61%; the extra 20% on top of that was the compression that read as hurried.
**Needs eyes** — the arithmetic is restored, whether it now feels right is a
look-at-it call.

`FOOT` in `liftoff.js` holds where each pitch pose's belly and centre actually
sit inside the 660×507 sprite frame — the art floats inside it, so anchoring on
the frame corner would hover the plane above the ground. Measured off the
sheets and identical across all three characters (the packs are registered).

---

## The plane, in game

- **Entrance** — flies in from off-screen left, settles at `startX: 0.35`,
  holds 500ms, then hands over control (~1787ms total). Implemented as a
  DRAW-only offset: routing it through `plane.x` would drag the camera with it
  (camera pans off `displayX()`) and swing past the left inset into the blank
  studio margin. Input is swallowed via a frozen no-input object, and
  `game.js` separately gates firing and character-cycle — those read
  `input.firing`/`takeCycle()` directly and would otherwise bypass the plane.
  The key that confirmed the fruit select is usually still held.

- **`startY` drives TWO things** — the sprite position *and* the vertical
  camera pan. Currently `0.90 - 100/720`. Moving it re-frames the opening shot
  by the same amount; that's inherent, not a bug.

- **`planeOffsetY` is 0 and should probably stay there.** It's a draw-only lift
  that moves the plane in frame without touching the camera — but it shifts the
  plane's *entire travel range*, not just the spawn. At −450/720 the plane could
  fly clean off the top and couldn't reach below mid-screen, which put the
  corpse floor plane out of reach. The comment in config records this.

---

## Flies

- `flyCount: 30`, `flyHealth: 3`, `rayDamage: 1`. Coins: `coinCount: 22`.
- **The shot is a hitscan beam re-tested every frame**, so damage must be rate
  limited or 3 HP drains in 3 frames (~50ms) and it dies instantly anyway.
  `flyHurtMs: 180` is that limit and doubles as the blink + knockback window,
  so the i-frames are always exactly as long as the feedback showing them.
  ~360ms of held fire to kill.
- Non-lethal hits play the **full death burst** — same frames, size and rate —
  but pinned to the impact point rather than following the fly. A death-burst
  sprite tracking a still-flying fly reads as "it died and kept going".
  It's 280ms vs the 180ms hurt window, so held fire restarts it at the new
  impact point (only ever one per fly).
- Knockback (`flyKnockback: 260`) only *slows* the leftward drift rather than
  reversing it — flies move at 90–290 px/s. Raise past ~400 for a visible shove.

### The corpse pile

Dead flies settle on a fake floor plane across the **bottom of the dungeon map**
(`corpsePlaneTop: 0.899` → `corpsePlaneBottom: 1.0`, i.e. world y 2158–2400).
World space, so the pile scrolls with the tray.

Those bounds weren't guessed — the annotated screenshot was template-matched
back against the 16 tray frames, which put its camera at camY 1680 (the bottom
of the pan range, correlation 0.892 on frame 14), so the marked band's canvas
y 478–720 is world y 2158–2400.

Each corpse samples a landing depth **uniformly across the band** (so they
scatter rather than lining up on one row) and a resting angle uniform in
**±25°** (`corpseTiltDeg`). Both drawn **once at death** — sampling in render
would jitter, sampling in update would burn work re-rolling a fixed value.
Size is constant wherever it lands; no perspective shrink.

Landed ≠ dead: `isDead()` stays false so `game.js` never splices them out.

---

## HUD

Canvas-drawn, not DOM — the old readout was a div over the page that kept its
CSS pixel size while the canvas scaled, so it drifted out of the frame's corner
at every window size but one.

Rendered **after** the film pass on purpose: the vignette darkens exactly the
corners it sits in and the gate weave shakes the scene. Fixed to the camera
means neither.

- Colour `#FAFA24` — from the spec CMYK 2/2/86/0. Note sampling the intro art
  directly gives `#FFEC4E`; the spec won.
- `FLIES nn` top-right; run timer HH:MM:SS bottom-centre. `hudMargin: 22`
  governs both the top gap and the timer's bottom gap, so the block stays
  symmetric if retuned.

⚠️ **Open: the font.** Futura is **not bundled** and isn't present on most
Linux/Windows machines — it'll only render as Futura for players who happen to
have it (in practice, macOS). The stack falls through
`Futura → Futura PT → Futura Std → Century Gothic → URW Gothic → Avant Garde →
Trebuchet MS → sans-serif`. Century Gothic catches most Windows, URW Gothic most
Linux, both geometric sans. **Decision needed:** ship a webfont (licensed Futura
you own, or a free geometric lookalike like Jost) and wire an `@font-face` +
`package.sh` copy, or accept the fallback.

---

## The time coin

In the game as `src/coin.js`. `tools/coin-anim.html` is where it gets timed;
`tools/build-coin-frames.py` builds what that tool (and the game) reads.

**Two masters, and they are alternatives rather than a sequence** — the game
picks one, and **it picks 01, the upright spin**. 02 is still built and still
previewable in the tool; it is simply not listed in `COIN_SHEETS`. Both are
4387×381 strips holding **22 frames of a full rotation**, and in both, 1–11 is
the clock face turning away, 12–22 the fruit face coming back, and 11/22 are
the edge-on frames.

| | | |
|---|---|---|
| `saborosa-coin-time-01.png` | **upright** spin, vertical axis | height fixed at 151px, width 32→156px |
| `saborosa-coin-time-02.png` | **tilted** / isometric spin | 120×120→154×155; even edge-on it is a diagonal bar |

**Neither is a grid, and neither can be cut like one.** The frames are
hand-drawn at irregular pitch (84–217px apart) and every one is a different
size, since the coin foreshortens as it turns. There is no stride that cuts
them, and in 02 the tightest gap is 11px — a fixed 160px window centred on
frame 11 pulls 8px of frame 12 in with it. So the build script finds frames by
alpha and re-lays them onto a real grid.

Output is `coin/saborosa-coin-time-NN.webp`: **22 cells of a fixed 160×160**,
one row, lossless (flat line art — lossy rings the black outlines). Frame k is
`(k*160, 0, 160, 160)` and the game needs no per-frame table at all.

**Both variants share one cell**, sized off the largest frame found across all
of them (156px → 160). That is deliberate: swapping coins is then a filename
change and nothing else, with no rescaling in the draw code. Change the cell
and you change it for both.

**The recut deliberately changes one thing, in 02.** Its frame centres drift
over a 13px band vertically; on a coin spinning in place that is hand jitter,
and at 12fps it shudders. Every frame is re-centred in its cell. The offsets
are kept in the `.json` as `wobble`, and the tool's *master + original wobble*
toggle puts them back, so the call can be overruled by eye. 01 was drawn clean
— every centre is at y=101.0 exactly — so its wobble is all zeros and that
toggle does nothing.

Watch for the masters' **1px alpha-14/15 white column** down the right edge,
the same sheet-border artefact the fire sheet had. It reads as a 23rd frame if
the alpha threshold is set too low.

In the tool, `V` swaps coins with timing, range and framing all held, which is
the comparison it exists for.

### In the game

`Coin` borrows the fly's X — steady leftward drift in world space, wrapping at
the world width, three wrap copies so one on the seam draws both sides — but
**not** the fly's vertical darting. Instead it holds its world Y and rides the
plane's sine bob (`coinBobFreq/Rel/Min`, the plane's own numbers), as a DRAW
offset only, so `y` never moves and nothing downstream has to know. At the
configured 76px the `bobMin` floor wins, so it bobs 6px — a float, not a
flight.

Frame phase, bob phase and speed are randomised per coin. Without that the
whole field flashes its face on the same frame and pulses in unison.

Coins are their own list, **not** `enemies` — the hitscan beam iterates
`enemies`, and a coin is not something you shoot. They draw under the flies and
the plane so nothing you are aiming at can hide behind one, and they spawn in a
band of 0.10–0.80 of world height, the lower bound chosen to clear the corpse
floor plane at 0.899 so they aren't buried in the tablecloth.

### Shooting a coin

Coins take the same hitscan beam the flies do — it **pierces**, so one shot can
hit a fly and a coin on the same line. `coinHealth: 12`, and each connected hit
throws the coin into reverse for `coinHurtMs`: it travels **backwards at the
speed it was drifting** (its own `vx` negated, not a separate knockback value,
so a push always exactly undoes its drift), its **spin runs backwards** with
it, and it **jolts**. Holding fire walks a coin back up the screen against
itself — ~1.9s of held fire and ~230 world px before it's spent.

⚠️ **The rate limit is not optional.** The beam is re-tested every frame while
fire is held, so without `coinHurtMs` all six points drain in six frames
(~100ms) and read exactly like a one-shot. It doubles as the reverse window and
the jolt window, so the i-frames are always exactly as long as the feedback
showing them — the same bargain `flyHurtMs` makes.

A non-lethal hit also plays **the fly's impact puff** — literally the same
effect, reaching into the `fly` sheet for `FLY_RECTS[1..4]` at the same 70ms
rate, rather than owning a near-copy that could drift from it. Pinned to where
the shot connected, not to the coin: the coin is about to be shoved backwards,
and a puff dragged along with it would read as part of the coin instead of the
moment of impact. `coinHitFxSize: 1.3` on a 76px coin works out to the same
0.362 px-per-source-px the fly draws its own puff at, so it reads identically
but follows if the coin is resized. At 280ms it outlives the 160ms hurt window,
so held fire restarts it at each new impact point — one per coin, same as the
fly.

**The jolt is a damped oscillation, not random jitter** — noise reads as a
rendering fault, a decaying shake reads as a flinch. `coinSpasmFreq` is radians
across the whole jolt, and **it has to respect the frame rate**: 140ms is only
~8 frames at 60fps, so 13 (≈2 cycles, ~4 frames per cycle) is near the ceiling.
Higher values alias into exactly the noise the damped shake exists to avoid.

The **hitbox is fixed** at `coinHitScale` of the drawn size, not the frame's own
silhouette: face-on the coin is 76px but edge-on only ~15px, and a box that
collapsed with it would flicker in and out of being shootable twice per
rotation. The jolt is left out of the box too — a hitbox that shook with the art
would be dodging the shot hitting it. Hold **C** to see them, in coin yellow.

### Rewinding time — what a coin is FOR

Every connected hit winds the run clock **back one second** (`coinRewindMs`),
and jolts the HUD timer to show it.

This is not just a number moving. The colour drain and the 2:00 deadline are
both read from that same clock, so shooting a coin makes the world visibly
**recover its colour** and pushes time over further away. `GameClock.rewind()`
clamps at 0, so the clock can never go negative however many coins are cashed.

⚠️ **The rewind is rate-limited by the coin's i-frames, and has to be.** It only
fires when `hit()` returns true, which is false inside `coinHurtMs` — otherwise
the every-frame beam would wind the clock back a second *per frame* and the run
would never end.

**The economy, worth a look before shipping:**

| | |
|---|---|
| one hit | **5s**, every 160ms of held fire |
| held fire on one coin | ~31s of clock per real second |
| a full coin | 60s, for ~1.9s of firing |
| all 22 coins | **1320s (22 min)** — against a 120s run |

Deliberately enormous: two fully drained coins take you from 0:00 to the boss
at -2:00. **`coinRewindMs` is live-editable** from the controls under the canvas
(in seconds), so it can be dialled while playing rather than rebuilt — it is the
one number that sets how fast the whole rewind economy runs.

**Shooting is deliberately NOT gated on `ending`.** The player keeps firing
through the 900ms dip to black and can still hit coins and rewind there — it
just doesn't save them, because `ending` has already latched, so those last
seconds are bought and immediately lost. This was flagged as an edge case to
close and was **kept on purpose**: the futile final volley is the better
moment, and a gun that goes dead the instant the fade begins reads as the game
having stopped listening. Don't "fix" it.

### Below zero

**Time is allowed to go negative.** `GameClock.rewind()`/`seek()` used to clamp
at 0 on the reasoning that a run cannot start before it started — but winding
past zero is the point of the coins, not an error to guard against. The clamp
is gone.

Below zero:

- the HUD reads **-HH:MM:SS**
- both colour drains sit at 0, so the world is at **full colour**. That falls
  out of the existing `Math.max(0, …)` on their progress rather than needing a
  case — and it is the right answer anyway: you have out-run the decay.

The tray's direction is **not** tied to the clock's sign — see below.
`GameClock.isReversed()` survives as a predicate but nothing drives the picture
from it.

### The flies run backwards too, and the dead come back

While the rewind window is open the flies **fly their own paths in reverse**,
and dead ones **come back to life** if the clock has moved back past the moment
they died.

**The path is retraced exactly, not approximated.** A fly's path is a chain of
straight LEGS — a heading held for 0.25–0.9s. Reversing along the *current*
heading is right only while the rewind fits inside one leg; measured, that is
~60% of the time at this game's window, and the other 40% sends the fly off down
a path it never flew. So each fly banks the legs it has flown (`flyLegMemory`,
12 of them ≈ 3–11s, three numbers each) and a rewind unwinds back *through*
them. Retrace error at the 240ms window: **98% exact, mean 0.05px**.

Three things had to be right for that, and each was worth a real bug:

1. **A wall bounce closes a leg.** It flips `vy` mid-leg, so without a boundary
   there the rewind unwinds the whole leg at the post-bounce heading and the fly
   flies back out through the ceiling it just came off.
2. **`legT` counts up AFTER the heading switch, not before.** This frame's
   movement uses whatever heading the switch produces, so counting first banks
   one frame too many onto the old leg and starts the new one a frame short.
   Worth a fraction of a pixel per leg — and it was the whole difference between
   61% and 98% exact.
3. **The banked length is the time actually flown**, not the leg's nominal
   duration: `retarget` overshoots zero by part of a frame, and banking the
   nominal figure leaks that sliver into every leg.

The residual 2% is the bounce's position SNAP (`y = m`), which is not
reversible. Beyond `flyLegMemory` the retrace degrades gracefully — the fly
keeps unwinding along its oldest remembered heading rather than stalling.

**Resurrection is a snapshot, not a replay.** A fly about to die photographs
itself one instant before the fatal shot — position, heading, bank, buzz phase,
retarget, hp — stamped with the GAME time. Winding the clock back past that
stamp restores it exactly, so it resumes the same trajectory it was flying. The
snapshot is taken in `hit()` *before* hp is spent, because the point of it is
the state the shot destroyed. Kept for the whole run, so depth is limited only
by how many coins the player can cash.

Flies are never spliced from the list (a landed corpse reports `isDead()`
false), which is what makes resurrecting one possible at all — see the note
under The corpse pile.

### The tray runs backwards while you rewind

The world orbits the other way while the player is **actively pulling time
back** — `rewindSpinT` is re-armed by every coin hit — rather than whenever the
clock happens to be negative. So it reacts as you shoot, at any point on the
clock.

⚠️ **`rewindSpinMs` (240) MUST be longer than `coinHurtMs` (160)**, and that is
why it isn't simply set to it. Hits land every ~166ms once frame quantisation is
in, so a 160ms window lapses for a single frame between them: simulated over 3s
of held fire, matching the two gives **35 direction flips** — the tray snapping
back and forth once per hit — where 240 gives **1**, flipping into reverse and
staying there. The surplus also buys a short flourish after the last hit rather
than the world snapping round the instant you stop firing.

Two formatting details that are easy to get wrong:

1. Negative time **rounds away from zero** (ceil of the magnitude) where
   positive time truncates toward it. Both mean "the second you are currently
   in". Flooring the magnitude instead would print `-00:00:00` for a whole
   second — a minus sign on a zero, which reads as a glitch.
2. The timer centres its **digits**, not its string. A leading `-` on centred
   text shoves every digit half a minus-width sideways, so the clock would
   visibly jump the moment it crossed zero — the one moment it wants reading,
   not watching twitch.

The time-over test needs no guard: it is a `>=` that negative time is nowhere
near.

**The timer's jolt is the coin's spasm**, deliberately: same damped
oscillation, same `140ms`, same `freq 13`, so the coin's flinch and the clock's
flinch read as one event at both ends of the screen. Only the amplitude
differs — 3px against the coin's 5, which is 6% of the glyph height: a visible
nudge that still leaves the digits readable. It moves **only the timer**;
shaking the fly counter too would read as the whole HUD glitching.

### Death

At 0 HP the coin **vanishes on the spot** and the main game's explosion plays
where it was, for ~850ms (`78 / 1.1` per frame — the main game's rate run 10%
faster), after which the coin is spliced out for good (no respawn, same as the
flies).

The sheet is the main game's `saborosa-boom.png`, converted to webp for this
build (41KB → 9KB; flat art, so lossless) and kept at its native 1228×845 so
the frame coords carry over unchanged. It sits at the root of the
flying-dungeon assets, which `package.sh` already globs — no new copy line.

**It plays ALL TWELVE frames**, grow → peak → fade. The main game's hole-fall
uses a 7-frame *tail-only* subset (`saborosa-boom.json`) that starts at the peak
and only fades — half the explosion. This uses the full set
(`saborosa-boom-full.json`).

⚠️ **Don't re-cut this sheet by island detection.** Its alpha yields 14
islands, not 12: two frames have **detached debris flecks** sitting beside the
main blob (at x 808 and x 920), and the rects deliberately span both. 12 is
confirmed to be everything on the sheet.

Position and bob are **frozen at the moment of death**, so the blast stays put
instead of drifting and bobbing along the path a coin that no longer exists
would have taken. One scale is derived for all frames from the **widest** one,
so `coinBoomSize` means "how big the peak is" (1.7 → a 129px peak on a 76px
coin) and the frames keep their relative sizes. With the full set the first
frame is the *smallest*, so anchoring the scale on it would blow the blast up.

Explosions draw in their **own pass, after the flies and the plane** — a blast
something could fly in front of would read as a glitch.

**Still not built:** coins have no pickup; killing one is currently all that can
happen to it.

`package.sh` copies `coin/*.webp` as a glob, so it currently ships 02's 241KB
unused. That's deliberate: swapping variants stays a pure config change with no
packaging edit.

`package.sh` copies `coin/` (added when the folder was created, rather than
after shipping a build without it — which is how `enemy-sheets/` went missing).

---

## Colour drain — time passing

The background loses its colour as the run goes on, on **game** time (rate
1.15), so the drain and the HUD timer always agree about how long you've been
there. Nothing for the first 20s, then eased in (`drainCurve` 1.6) to fully
grey exactly as the clock runs out. Lightness goes with it, 12% of black at
full drain.

`drainFullMs: 0` means "end with the run" — `drainAt()` falls back to
`timeOverMs`, so the picture hits full black & white on the very frame time
expires. One number, rather than two that have to be kept in step by hand.

### And the same thing run backwards: the bleach

Below zero the world drains **just the same, but LIFTS instead of dims** —
washed out and ultra-luminous by the time the clock reaches the boss at -2:00,
where `bleachFullMs: 0` puts it (the same one-number trick, tracking
`bossAtMs`). Linear rather than the forward drain's ease-in: the player is
actively pulling the clock back, so the picture should answer in proportion to
what they are doing instead of holding flat and then rushing.

| clock | desaturation | lightness |
|---|---|---|
| +2:00 | 100% | **dim** 12% |
| +1:00 | 23% | dim 3% |
| 0:00 | — | — |
| −1:00 | 50% | **lift** 50% |
| −2:00 | 100% | **lift 100% — pure white** |

The two are **one signed wash**, not two effects: `washAt()` returns
`{desat, lift}` with lift negative for black and positive for white. They can
never overlap anyway — the drain needs the clock past `drainStartMs` (+20s) and
the bleach needs it below zero — so making it one value removes any question of
them fighting.

The lift is plain source-over white, which is arithmetically identical to
SCREENING with a grey of the same value. So there is no second blend mode to
feature-detect, and the lightness half keeps working even on a browser that
cannot desaturate at all.

Background only, like the drain. `bleachLift` is **1.0**: the world does not
fade at -2:00, it is **erased into light**. The ramp is what carries it —
desaturation and lift climb together across the whole two minutes, so the
picture washes out progressively and only reaches solid white at the very
bottom.

Lowering it leaves a ghost of the tray behind at the end instead; measured on a
real frame, the luminance range surviving out of 255 is `0.45 → 141` (clearly
still a photograph), `0.80 → 51` (a bright fog).

There is no separate "extra white layer" and there cannot be one: another
source-over pass of white at alpha *a* is arithmetically just a bigger *a*, and
1.0 is already the whole way. Anything beyond it would need a different blend
mode (`color-dodge` blows highlights while keeping darks), not more white.

The **plane and its muzzle flash** drain too, but on their own curve and only
half way — `Plane.drainAt()`, linear from **1:00 to 2:00, capping at 50%**. So
the world dies around a player still holding some of its colour, and the plane
stays what the eye tracks at the end instead of dissolving into the greyscale
with everything else. Starting a full minute in, when the background is already
23% gone, keeps the two readable as separate events rather than one global fade.

| game | wall | background | plane |
|---|---|---|---|
| 0:20 | 0:17 | — | — |
| 1:00 | 0:52 | 23% | — |
| 1:30 | 1:18 | 57% | 25% |
| 2:00 | 1:44 | **100%** | **50%** |

The plane uses `ctx.filter = saturate()`, **not** the background's blend-mode
fill — a fill would have to be clipped to the plane, and clipping to its BOX
would grey a rectangle of the background behind it. The plane is ~7% of the
canvas so a filter pass over it is cheap, and it is set inside the plane's own
`save()` so it covers the flash and the plane together and is undone by the
matching `restore()`. Where `ctx.filter` is unsupported the assignment is
simply ignored and the plane stays in colour — a safe failure, unlike the blend
mode's.

**Coins, flies and the HUD keep their colour** entirely.

Three ways NOT to do it, all rejected for a reason:

- **A CSS filter on the canvas** — what `CONFIG.film` uses for its own B&W. It
  hits the whole canvas, HUD included.
- **A pre-greyed copy of each frame** — there are 32 at `FRAME_CAP`, and
  doubling that is exactly the VRAM thrash that cost us the frame rate once
  already. See PERFORMANCE.md.
- **`ctx.filter` per draw** — a full-texture filter pass every frame.

What it actually does is one `fillRect` over the drawn frame in the
**`saturation` blend mode**: that keeps the backdrop's hue and luminosity and
takes the *source's* saturation, and a grey source has none — so the picture
goes greyscale with its brightness intact, and `globalAlpha` is the drain. No
new textures, no per-pixel JS.

⚠️ **The blend mode is feature-detected, and that detection is not optional.**
An unsupported `globalCompositeOperation` silently falls back to `source-over`,
which would paint a flat grey slab over the picture rather than desaturating
it. `_canDesaturate()` sets it and reads it back once; if it fails, the drain
falls back to the dimming alone and the world stays in colour, which is a much
better failure. The fill is laid over the FRAME's rect rather than the canvas,
so it can't miss a sliver while the film pass has the scene weaving.

---

## No time mode

At **-2:00** the run stops being about time. Latched, and it is the same moment
the boss arrives:

- the **HUD goes entirely** — timer *and* fly counter. With the flies gone the
  count is as meaningless as the clock, and one number left floating over an
  empty white world would read as a leftover.
- the **flies vanish**, corpse pile and all
- the **coins vanish**
- the background **stays pure white** rather than fading back
- what is left is the player, the boss, and the void

**The clock is PAUSED, not reset**, and that single decision buys the rest:

- frozen at ≤ `bossAtMs`, so `bleachAt()` keeps returning 1 and the white holds
  with no special case anywhere;
- time-over can never fire, because that test requires `clock.running`;
- and the value is still sitting there for when time comes back.

**Nothing is deleted, only stopped.** Beating the boss should be
`clock.resume()` plus `noTime = false`; every system — drain, bleach, HUD,
time-over — is untouched and waiting to pick up from the frozen reading.

⚠️ This is what forced `GameClock.started`. The loop used to start the clock
whenever it wasn't running, which would have undone the pause on the very next
frame — no-time mode would have climbed straight back out of the white. It was
already quietly wrong for the time-over fade, where the timer ticked past 2:00
while the screen dipped to black. `started` means "has this run begun" and is
never cleared by a pause, only by `reset()`.

---

## The Time Boss

A furious alarm clock (`src/boss.js`,
`enemy-sheets/saborosa-boss-time.png`). It appears **only** once the player has
driven the run clock down to **-2:00** by shooting coins — it is what abusing
the rewind earns you, not something the game hands out on a timer. Summoned
once and it stays for the rest of the run even if the clock climbs back above
the threshold; a restart makes it be earned again.

**The sheet is a TURN, not a walk cycle.** Its 7 frames sweep profile-left →
full-front → profile-right, and the widths prove it: 120px in profile, 269px
face-on, symmetric about the middle. So `facing` is a continuous 0..1 (0.5 =
front) and the frame is just that value quantised — the boss is never "playing
an animation", it is pointed somewhere.

**Behaviour comes almost entirely from one coupling:** velocity is
`bossSpeed × (facing×2 − 1)`, so it moves at full speed in profile and is
STATIONARY face-on. Which means:

- **Idle** — faces the camera, and is therefore motionless. It stands there
  front-on, watching.
- **Alerted** — the player has come within `bossSeeRange`. It turns to face
  whichever side they are on, and because facing *is* velocity, turning to look
  at you **is** setting off after you.

So it decelerates through front-on, hangs there square to the camera for an
instant, and accelerates away the other way — with no acceleration code at all.
Retiming `bossTurnMs` retimes the speed ramp with it.

**Being alerted latches.** Once it has seen the player it never goes back to
minding its own business however far they get — that is what makes it stalking
rather than a proximity trigger.

Two things it needs to not look broken: `bossStopRange`, a stand-off, without
which it walks *through* the player, `dx` flips sign underneath it and it
shudders on the spot instead of looming; and a **wrap-aware** `_dx`, without
which a player just over the world seam reads as most of a world away and it
stalks off in the wrong direction.

Vertical pursuit shares the same `bossSpeed` — one knob for both axes, so a
second can't drift away from it. It is **not** scaled by the facing coupling
though: the turn is a horizontal affair, so the boss keeps closing on the
player's altitude even while it is swinging through front-on and going nowhere
sideways.

Frames are hand-placed at irregular pitch (170–275px apart) and differing
sizes, so they are drawn from measured rects. They are centred on X and **hung
from a common top**: every frame shares y=79 on the sheet, so top-alignment is
exact, and the 4px the front-facing frames gain is the stance widening at the
feet, which belongs downward rather than centred away.

It spawns at the **middle of the world's X range** — a fixed landmark rather
than somewhere relative to the camera, so it is always in the same place and
the player can go looking for it. Y is put near the middle of the current view,
so it starts at a height they can reach. It draws over the flies (it dwarfs
them) but under the plane.

**It arrives in an explosion** — the same 12-frame blast a coin dies in, same
`boomMs` rate, ~850ms, scaled up to `bossBoomSize` × `bossSizePx` (a 390px
fireball around a 260px boss). Frozen at the spawn point rather than following
him, so he walks out of his own entrance instead of dragging it about. Drawn in
the same over-everything pass the coin explosions use, so nothing can be in
front of it.

`boomMs` is named for the boom rather than the coin on purpose: the frame rate
belongs to the explosion, not to whatever exploded, so the two can never drift
apart. Only the SIZE is per-user (`coinBoomSize` / `bossBoomSize`).

⚠️ **The boss does nothing yet.** It cannot be shot, does no harm, and has no
health — the brief that asked for it was cut off mid-sentence ("the boss should
have ."). Everything above is the entity and its presence; the fight is
undesigned.

---

## Time over

The run ends at **2:00 on the HUD** — game time, so ~1m44s of wall clock. The
clock the player is watching is the one that ends them.

```
2:00  clock.pause()  →  900ms dip to black  →  350ms black  →  900ms fade in
                                                    TIME at +1.5s, OVER at +2.5s
```

- **The clock is paused, not left running.** That stops the drain at exactly
  full grey and freezes the HUD's last reading on 2:00.
- **The handover runs on REAL time**, not the 1.15 clock — a fade has no
  business being rate-scaled.
- **The hold on black is deliberate.** Cross-fading the dungeon straight into
  the worms reads as a glitch; a moment of black reads as a cut.
- The dip is drawn **after the HUD**, so the timer goes down with the scene
  instead of floating over a fading world.
- Once the dip completes the scene stops being drawn at all — it is behind an
  opaque rect, so rendering it is a whole frame nobody sees.
- The film grain/vignette **stays on** over the panel: the whole game carries
  it and dropping it at the last screen would read as a bug. No weave, though —
  the panel fills the frame, so shaking it would show black at the edges.

`src/game-over.js` is **stateless**: `render()` is handed the ms since the
panel appeared and derives the frame and the word reveals from it. No
start/update pair to keep in step with the fade, no clock to drift, and
replaying it is passing 0 again.

The 1.5MB of panel frames load **lazily**, kicked off at `startGame()` and not
awaited — they aren't needed for two minutes, so they have no business delaying
the game appearing.

⚠️ `package.sh` did not copy `game-over/` until now, so every packaged build
would have 404'd the panel. Same class of bug as the missing `enemy-sheets/`.
Fixed.

### Starting over

Once the panel has settled, **any key or click** goes back to the title
sequence for a fresh run. Armed 3000ms into the panel — `gameOver.settledMs()`,
derived from the reveal timings rather than being its own constant, so
retiming the words moves the arming with it.

**Two held-key traps here, both already paid for elsewhere in this codebase:**

1. Arming on the panel's first frame would let a key pressed during the fade —
   or still held from the dying seconds of the run — blow straight past the
   screen the player is meant to read. Hence the wait for OVER plus
   `overRestartArmMs`.
2. The restarting key is then very probably still down, and the OS repeats
   `keydown` while it is — which lands on the intro's skip handler and blows
   past the title sequence too. `restartSkipGuardMs` (400ms) ignores skips for
   a beat afterwards.

**The restart rebuilds rather than resets.** `plane`, `fruitSelect`, `liftoff`
and `intro` are `let`, and restarting constructs new ones. All of their per-run
state is set in their constructors and none of them own their images — those
live in the shared `assets` store — so construction *is* the reset, with no
`reset()` method to fall out of step with a constructor.

**And no reload.** `location.reload()` would re-decode ~30MB of tray frames,
which is the one thing this game cannot afford (see PERFORMANCE.md). Restarting
in place is instant.

`spawnWorld()` clears both lists before refilling them, so a restart doesn't
stack a second swarm on the leftovers of the last run.

---

## Game clock

`src/game-clock.js`. Deliberately not the wall clock, for two reasons:

1. It ticks at `gameClockRate: 1.15` — a minute of real play reads **01:09**.
2. It's meant to be **scrubbable**. `rewind()` / `seek()` exist and are tested
   (both clamp at 0) but nothing calls them yet.

### Planned: rewind

The stated next feature is going back in time. `advance()` already returns the
game delta so callers can drive systems off it.

⚠️ **The rate currently scales the CLOCK ONLY** — the simulation still steps on
the real delta, so game feel is unchanged. That means the world and the clock
disagree about *when* things happened: 60s of fly movement is stamped 69s of
game time. For a rewind that reconstructs state by game time those must agree,
so the sim systems need to switch to consuming `advance()`'s return value.
Worth deciding at that point whether the world should also run 15% faster, or
whether the rate should drop to 1.0 and the urgency come from elsewhere.

---

## How this work was verified

⚠️ **Don't write headless test harnesses.** Early work here was checked with
fixed-dt node harnesses (eval the classes, stub `assets`/`ctx`, assert on draw
calls). That is no longer wanted — the tests are the author's to run, by eye,
in the browser. Write the change, say what is unverified, hand it over.

Offline measurement of ASSETS is still the right tool and still wanted:
compositing the real webp/png with PIL, alpha bboxes, contact sheets, stacked
frames to check registration. That is inspecting art, not testing code.

---

## Open items

1. **Liftoff speed** — set to `liftSpeed: 1.0` (3565ms). Unwatched; confirm it
   reads better than the old 2971ms.
2. **HUD font** — bundle a webfont or accept the fallback stack.
3. **Rewind** — migrate sim systems onto the game clock's delta.
4. **Empty sky at GO!** — ~600ms of it at `liftSpeed: 1.2`, because the takeoff
   finished a whole 594ms before the board did. At 1.0 the plane reaches
   `liftExitX` exactly as GO! ends and only the last ~2% of the path is
   off-frame, so the dead air should now be ~150ms. Re-check by eye before
   touching `introBeats[11]`.
5. **Plane clips the frame edges** — at full stick up/down the sprite is half
   off-screen (pre-existing). A clamp on the drawn position would fix it at the
   cost of a slightly smaller reachable band.
