# Flying Dungeon — state of play

Handoff notes for the jam game. Covers what was built, why it's shaped the way
it is, and what's still open. Values here were read off `src/config.js` at the
time of writing — trust the file over this document if they ever disagree.

Run it: serve the repo root and open `flying-dungeon/index.html`.
Tune it: same URL with **`?dev-mode=true`** — see Dev mode.
Package it: `./package.sh` → `dist/` + `flying-dungeon-itch.zip`.

---

## Flow

```
boot (black)
  └─ intro panels load first (~1MB) and start playing immediately,
     while the 32 heavy tray frames stream in behind them
        └─ storyboard roll  →  FRUIT SELECT (waits on the player)
             →  countdown + plane takeoff  →  fade  →  GAME
```

The intro doubles as the loading screen. If it finishes before the tray frames
land, it holds on black with the progress bar rather than starting half-loaded.

Once in the game, everything hangs off ONE number — the game clock, which runs
15% fast and is the clock the HUD shows:

```
        shoot flies                        shoot COINS to wind the clock BACK
             │                                          │
     kill all 3 → the MOSCA BOSS                        │
     charges, loops round, and                          │
     settles at the map's centre                        │
   0:00 ─────┼──────────── 2:00              0:00 ──────┼───────── -2:00
        colour drains to                         colour bleaches to
        black & white, dims                      PURE WHITE, and the
             │                                   world runs backwards
        TIME OVER panel                                 │
        → any key → intro                        NO TIME MODE:
                                                 HUD, flies, coins gone.
                                                 The boss arrives.
                                                        │
                                                 he ages you — 3 hits
                                                 and it all goes WHITE:
                                                 THE END appears.
                                                 KILL HIM: time comes
                                                 back, and the flies,
                                                 but never the coins —
                                                 so from there the
                                                 clock only runs on.
```

The two directions are the same machinery with the sign flipped — one signed
`{desat, lift}` wash on the background, one clock, one set of thresholds. The
player decides which way the run goes by choosing what to shoot.

---

## The files

| file | role |
|---|---|
| `src/game.js` | the disposable SHELL — canvas, loop, phases, wiring. Thrown away when this lifts into the main engine |
| `src/config.js` | every tunable, plain data, no logic |
| `src/plane.js` | the player: pitch poses, bob, muzzle flash, entrance, colour drain |
| `src/tray-background.js` | the orbiting tray, and the colour drain / bleach wash |
| `src/fly.js` | the enemy, its leg history, and death snapshots for rewinding |
| `src/coin.js` | the spinning time-coin: shootable, reversible, explodes |
| `src/boss.js` | the Time Boss: facing sweep, stalking, arrival blast, health, the throw |
| `src/orb.js` | what he throws — the root game's FX sphere, flying straight |
| `src/strike.js` | one wave of his SPECIAL: lightning arms, and their hitbox |
| `src/fly-boss.js` | the Mosca Boss: three-beat entrance, then a fight |
| `src/boss-bar.js` | his health bar, top-centre. Stateless. **Not** part of the HUD |
| `src/game-clock.js` | the run's own time base — scrubbable, and now actually scrubbed |
| `src/hud.js` | canvas HUD (flies counter + run timer) with the rewind jolt |
| `src/game-over.js` | the end panels, and the lettering all the endings share. Stateless |
| `src/finale.js` | the ENDING: time comes back, the cards, the exit, the logo |
| `src/intro.js` | storyboard roll, board ordering, select + liftoff scheduling |
| `src/fruit-select.js` | the SELECT FRUIT board, ported from the main game |
| `src/liftoff.js` | the plane's takeoff over the countdown |
| `src/film.js` | grain / vignette / frame line / gate weave |
| `src/sound.js` | the background music: one baked loop, played on Web Audio |
| `src/assets.js` | tiny asset store; goes when this lifts into the engine |
| `src/input.js` | keyboard + gamepad; goes when this lifts into the engine |
| `tools/build-intro-frames.py` | intro masters → webp (64MB → 1MB) |
| `tools/build-select-frames.py` | main game's select art → webp |
| `tools/build-coin-frames.py` | coin masters → uniform 160px grid sheets |
| `tools/build-orb-frames.py` | the root game's FX sphere → a 5-cell grid |
| `tools/build-hustlebar.py` | the 22 hand-drawn health bars → 23 rotated frames |
| `tools/boss-lightning.html` | previews the Time Boss's special before it is wired |
| `tools/build-sound.py` | phone voice notes → trimmed, levelled, loop-ready ogg |
| `tools/music-lab.html` | layers/aligns the three music takes; bounces the mix |
| `tools/bake-trilha.py` | renders that mix to the single file the game plays |
| `tools/coin-anim.html` | times the coin spin, A/Bs the two variants |
| `tools/intro-align.py` | measures how far the camera should roll between boards |

⚠️ **`index.html` writes its own script tags** with a `?v=<timestamp>`, rather
than listing them statically. Twice a change landed in source *and* dist and
still threw "x is not a function" in the browser, because it was running a
cached copy of a file whose URL had not changed — which looks exactly like a
bug in the new code and burns a debugging session proving it isn't. All of
`src/` is 184KB against ~30MB of art, so never caching it costs nothing.
`async = false` is what preserves execution order; without it the globals load
out of order. **A new `src/*.js` file must be added to that list.**

`package.sh` has needed a copy line added for `enemy-sheets/`, `select/`,
`coin/` and `game-over/`. The first was a real shipped bug — every packaged
build went out without fly sprites. **Adding an asset folder means adding a
`cp` line**, or dev works and the build 404s.

---

## Shipping it — itch.io / GMTK

`./package.sh` → `flying-dungeon-itch.zip`, **25MB, 135 files, `index.html` at
the top level of the zip** (which is itch's one hard requirement). Upload that
zip and set the project's kind to **HTML**.

### Embed options

| option | set to | why |
|---|---|---|
| Viewport | **1280 × 720** | the canvas's exact internal resolution → 1:1, no resampling. Drop to 960×540 if the page theme overflows; it scales cleanly to 0.75. |
| Mobile friendly | **off** | keyboard + gamepad only. There is no touch input at all, and ticking this advertises support that does not exist. |
| Automatically start on page load | **off** | the "Run game" click both FOCUSES the iframe and counts as the user gesture. Without it a judge can watch the intro, reach the fruit select, and press keys that go nowhere because the iframe was never focused — and the AudioContext stays suspended. |
| Fullscreen button | **on** | see below. |
| Enable scrollbars | **off** | the body is `overflow:hidden` and the canvas letterboxes itself; scrollbars only add a scroll offset to fight. |
| SharedArrayBuffer | **off** | not used, experimental, can break the page. |

### Two fit() rules that had to change for the embed

`fit()` began as a copy of the main game's `scaleCanvas()` and both of its rules
were wrong here:

- **The 40px margin** existed to keep the canvas off the edges of a browser
  window. In an embed the iframe *is* the game, so it was 40px of the player's
  viewport spent on nothing. `fitMarginPx: 0`.
- ⚠️ **The "never upscale past 1:1" cap** was the worse one, because itch offers
  a fullscreen button. Capped, pressing it on a 1440p monitor left the game as a
  1280×720 stamp in the middle of a black field — exactly when someone judging a
  jam entry is looking hardest. `fitMaxScale: 0` (uncapped) fills the screen:
  1.5× at 1080p, 2× at 1440p.

  Safe to uncap **because this art is drawn illustration scaled with smoothing
  on**, not pixel art — upscaling softens it slightly and nothing more. A
  pixel-art game would want the cap back, or integer steps.

### Layout note

`#help` (the control list) sits bottom-**left**; itch's fullscreen button is
bottom-**right**, so they do not overlap. The dev panel that used to live
bottom-right is removed unless `?dev-mode=true`, which itch cannot pass anyway.

---

## Dev mode

The tuning panel in the bottom-right corner — rewind seconds, shot damage,
stop-motion framerate, the film look, ballistic corpses — is a **workbench, not
a game feature**. It only appears with:

```
flying-dungeon/index.html?dev-mode=true
```

Bare `?dev-mode` works too; typing the flag without a value is the obvious
mistake and there is nothing to gain by punishing it.

⚠️ Outside dev mode the panel is **removed from the DOM, not hidden**.
`display:none` would leave a stack of live inputs a stray Tab could still reach,
and SPACE landing on a focused checkbox instead of the gun is a bug this file
has already had once — it is what the `blur()` calls after every control are
there for.

⚠️ The removal happens at the TOP of `game.js`, above the wiring. Every
`getElementById` in that block was already null-guarded, so deleting the
container first makes the whole thing no-op and **no other code needs a
dev-mode test**. `chrome`'s `'controls'` entry is then legitimately `null`, and
the guard in `showChrome` is what covers it — not defensive padding.

`#help` (bottom-left) is untouched: it is the player's control list.

---

## Controller support

Playable end to end on a pad: skip the intro, pick a fruit, fly, shoot, cycle
character, restart. It uses **the main game's own mapping file**
(`assets/gamepad-mapping.json`, authored in its `tools/gamepad-mapper.html`) —
not a copy, so a pad set up once works in both and there is no second file to
drift. That is why `GAMEPAD_MAPPING` sits outside `ASSET_BASE` and gets its own
`package.sh` rewrite line.

Actions are the main game's, so the file needs no translation:

| action | here |
|---|---|
| `up`/`down`/`left`/`right` | d-pad, plus the left stick through a deadzone |
| `lift` | FIRE — the same action Space is bound to over there |
| `cycleCharacter` | swap fruit |

Anything else in the mapping is simply not read.

**It needed no changes anywhere but `input.js`.** The portable classes all read
the plain `{left,right,up,down,firing,engaged}` shape, so the fruit select, the
plane and the shell neither know nor care which device set those fields. That
shape was already the point of the file; this is the first thing to prove it.

⚠️ **Keyboard and pad are tracked separately and OR'd together.** They cannot
share the public fields: the keyboard writes them on key *events* while the pad
rewrites them every frame from a *poll*, so one set of flags would have the pad's
"nothing held" clear a key the player is still holding — the stick would cancel
the keyboard several times a second.

⚠️ **`poll()` must be called once per frame, and is, from the top of the loop.**
The Gamepad API fires no button events; reading a fresh snapshot is the only way
to see a press, so that call IS the controller.

⚠️ **A gamepad fires no DOM events, so the two "press anything" screens needed
their own path.** `takeAnyPress()` is that: any button, mapped or not — a player
hunting for the button to skip a screen should not have to find the right one.
The intro skip routes through `onSkip` so it inherits both existing guards (the
arm-time window after a restart, and "not while the fruit select is up, where
buttons are the player choosing"), and the restart is behind the same
`restartArmed` gate the listeners are, so the beat to read the screen applies to
a pad too. `skipBound` exists because the pad cannot ask whether a DOM listener
is attached.

⚠️ **`applyMapping` REPLACES the button map and does not check `cfg.id`** — so a
mapping authored for one controller is applied to whatever is plugged in. That
is deliberate: it is exactly what the main game does, and matching it was the
request. But it means a different pad wants its own mapping re-authored rather
than expecting the shipped one to fit. The shipped file is an 8BitDo Ultimate 2C,
which puts FIRE on button 2 rather than the standard 0.

Loading is **not awaited and not part of the progress total**: a few hundred
bytes, optional, and the game must never sit on a loading bar waiting for a
controller profile. Missing file, bad JSON or no network all leave the
standard-layout defaults in place, which is a working pad.

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

- `flyCount: 13`, `flyHealth: 3`, `rayDamage: 1`.
- **It is a PACING number now, not a scenery one.** Killing all of them is
  what summons the Mosca Boss, so `flyCount` sets how long the swarm lasts
  before the first fight starts. It was 30, then 3, and is now 13.
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

### When they arrive

The world starts with **no coins**. They land in waves, on the game clock:

| wave | at | coins |
|---|---|---|
| 1 | 0:30 | 5 |
| 2 | 1:30 | 10 |
| 3 | 2:00 | 15 |

`count` is how many **appear** in that wave, not a target for the field — coins
are destroyed for good when shot and nothing tops them back up.

The opening 30 seconds therefore have **no rewind available at all**: time can
only run forward until wave 1 lands, and the choice the whole game is about does
not open up until then.

⚠️ **The schedule is LATCHED, and it has to be.** The clock goes backwards in
this game — that is what the coins are *for* — so a wave testing
`clock.now() >= atMs` afresh each frame would undo itself the instant the player
used the thing it gave them: shoot a coin at 0:31, the clock drops under 0:30,
and the coins that made it possible vanish. `coinWave` is an index that only
counts up.

⚠️ **The check is a `while`, not an `if`.** Nothing guarantees one wave per
frame: the finale scrubs two minutes of game time through in about five seconds
of real time, and a first frame after a stall can carry a large dt. Either would
step over a mark, and an `if` would silently drop the wave.

⚠️ **WAVE 3 LANDS EXACTLY ON `timeOverMs` (120000)** — the same instant the run
ends — so as written it can never be played. Left at the requested value rather
than quietly moved, because moving it is a design decision: pull the wave back
(1:45 gives it fifteen seconds to matter), or push `timeOverMs` out.

Waves are also gated on `!noTime`: no-time mode has just emptied the coin list
on purpose, and a wave landing there would put coins in the Time Boss's arena.
That is also what keeps the post-finale promise that the flies come back but the
coins never do.

### Shooting a coin

Coins take the same hitscan beam the flies do — it **pierces**, so one shot can
hit a fly and a coin on the same line. `coinHealth: 7`, and each connected hit
throws the coin into reverse for `coinHurtMs`: it travels **backwards at the
speed it was drifting** (its own `vx` negated, not a separate knockback value,
so a push always exactly undoes its drift), its **spin runs backwards** with
it, and it **jolts**. Holding fire walks a coin back up the screen against
itself — ~1.3s of held fire and ~150 world px before it's spent.

⚠️ **The rate limit is not optional.** The beam is re-tested every frame while
fire is held, so without `coinHurtMs` all eight points drain in eight frames
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

**Two live controls under the canvas**, typed number fields rather than sliders:
`rewind per clock hit` (`coinRewindMs`, in seconds — the unit on the HUD it
moves) and `shot damage` (`rayDamage`). Both are read fresh every frame by
everything that uses them, so a change applies on the next frame and the fights
can be dialled while playing instead of rebuilt.

⚠️ **Raising `rayDamage` does not speed a fight up in proportion**, which
surprises people. Every health bar in this game is gated by an i-frame window,
so time to kill is `(health / damage) × hurtMs` — damage buys FEWER HITS, not
faster ones. Past `health/1` a boss dies in one shot however high it goes. It is
integer-only for the same reason: a fraction only moves where the rounding lands
in that division.

**The economy, worth a look before shipping:**

| | |
|---|---|
| one hit | **5s**, every 160ms of held fire |
| held fire on one coin | ~31s of clock per real second |
| a full coin | 35s, for ~1.1s of firing |
| wave 1 alone (5 coins) | 175s — already more than a 120s run |
| everything reachable (15 coins) | **525s (8.75 min)** |

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

**Nothing is deleted, only stopped** — and that is exactly how winning works.

### Beating him

**The run does not carry on — the ENDING starts.** See The finale. The player
stops flying and watches.

⚠️ **`noTime` deliberately STAYS TRUE**, and the clock stays paused with it.
That flag is already doing exactly what the ending needs — no HUD, no flies, no
coins — and clearing it would put a fly counter and a run timer over the credits.

⚠️ **`bossBeaten` is still load-bearing** even though the clock no longer
resumes: the finale scrubs it back up THROUGH `bossAtMs`, which is the threshold
that summons him, so without that latch the ending would spawn a second boss
partway through itself. Cleared only by `restart()`.

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

### The fight

⚠️ **Being shot ALERTS him, and leaving that out made the fight a joke.**
`bossSeeRange` is 420 world px; the hitscan beam runs from the nose to the edge
of the screen, over a thousand. So a player standing off could empty the whole
bar into a boss that had never noticed them — and because **facing is velocity**,
an unalerted boss stands front-on and therefore perfectly still. A stationary
target that never breaks your line and never throws anything is 100% beam uptime
and no fight at all. `hit()` now wakes him, arming the first throw with the same
grace beat proximity does so he doesn't answer the opening shot instantly.

He takes **88 hits** (`bossHealth`), each gated by `bossHurtMs` i-frames — not
optional, for the reason every other health bar here says: the beam is re-tested
every frame, so an ungated bar drains in as many frames as it has points. A
connected hit **jolts** him (the coin's damped oscillation, at a much smaller
relative amplitude — a thing this size should barely move) and puts **the fly's
impact puff** at the point of contact.

**The puff sits at the HEIGHT the beam crossed him at** — the shell hands that Y
to `hit()`, because only the shell knows where the shot was. He is 213px of
hitbox tall, and a puff pinned to his centre showed the impact in one fixed place
however high or low the player was aiming, which read as decoration rather than
as a hit.

⚠️ **Y only. X stays on his centre.** Anchoring X to where the beam enters his
box was tried and is not wanted: the puff belongs on him, not on his leading
edge. `hit()` takes a bare Y rather than a point so it cannot quietly come back.

It is pinned where it landed and does not track him afterwards, for the reason
the coin's does not: he is about to flinch, and a puff dragged along with him
would read as part of the boss instead of as the moment of impact.

`bossHitFxSize` is **0.4**, well under 1, where the coin's equivalent is 1.3.
That is deliberate: the puff is about the BULLET, not the target. 0.4 of a 260px
boss is ~104px, near enough the 99px the coin gets. Scaling it *with* the boss
would fire a 338px cloud out of a rifle.

The hitbox is **fixed**, like the coin's but for a different reason: the turn
takes him from 120px in profile to 269px face-on, so a box that breathed with
the animation would make him a *harder* target exactly as he set off after you.

At 0 HP he is **erased into the same explosion he arrived in** — `boomT` is
simply re-armed, so the entrance and the death are one piece of code and one
rate, re-anchored to where he is now.

### Two stages

`stage()` is **derived from health, not latched** — no flag to fall out of step
with the bar it is read from, and nothing here heals so it cannot flap.

Under `bossStage2At` he **turns and travels `bossStage2Speed` faster**. That is
now the whole of stage 2.

⚠️ **The throw used to change here too and it was REMOVED.** Orbs that missed
curved back like a boomerang; it did not play well. What the shape was, in case
it is ever wanted again: two constant accelerations applied from the moment it
left, one back along the throw and one across it — constant acceleration in a
fixed frame IS a parabola, so it needed no waypoints and no curve fitting, only
two numbers. `orb.js` records this too.

So the speed-up is now the *only* thing marking the stage, which makes it carry
more than it used to: a boss that visibly winds up says "that did something"
without a word of UI. `_rush()` is the single place it applies, so the turn and
the travel can never be wound up by different amounts — remember `bossTurnMs`
*sets* the speed ramp, so those two have to move together.

**`bossStage2At: 0.5` is also exactly where the health bar runs out of red.**
That is not a coincidence and shouldn't be broken: the stage change has a tell
the player can read.

### The orb

`src/orb.js`. The art is the **root game's ambient FX sphere** — the spiky ink
ball from the assets-003 pack, the `animation` block in
`saborosa-assets-003-fx-small.json`. `tools/build-orb-frames.py` cuts those five
frames onto a uniform grid, so frame k is `(k*ORB_CELL, 0, CELL, CELL)` and there
is no per-frame table. 33KB, and it lands at the flying-dungeon asset root, which
`package.sh` already globs — **no new `cp` line**.

**The animation is the throw.** The five frames GROW (132→216px) and are centred
in their cells, so an orb starting on frame 0 *inflates out of nothing* at the
point it was released — which is why it spawns close to the boss
(`orbSpawnRel`) rather than on top of the player. You see him produce it.

Once at full size it drops into a **two-frame breath** rather than ping-ponging
all the way back down as the root game does: shrinking to frame 0 mid-flight
reads as the orb vanishing, not pulsing. The hitbox is fixed through all of it —
the coin's lesson again, a box that pulsed with the art would be dodging the
player twice a second.

**Aimed once, at release, and never corrected.** No homing: it is dodgeable by
moving, which is the whole fight. The throw direction is wrap-aware for the same
reason the stalk is.

**The boss does not construct orbs.** `takeThrow()` hands the shell a
description and the shell builds it, the same way it builds the flies and the
coins — so `boss.js` never has to know `orb.js` exists.

### The health bar

`src/boss-bar.js` + `tools/build-hustlebar.py`, from
`assets-v2/saborosa-hustlebar-1-low.png`.

The master is a contact sheet of hand-drawn **vertical** bars, 11 squares each.
Read as a ladder they are one bar in every state it can be in, and the level of
a bar is `(11 − whites) + reds`:

```
  0   WWWWWWWWWWW   empty — he is dead
 1-10 yellow rises from the BOTTOM
 11   YYYYYYYYYYY   ← NOT ON THE MASTER. Generated.
12-21 red then descends from the TOP
 22   RRRRRRRRRRR   full health
```

**23 states, and the master has 22.** The missing one is the changeover — the
instant the bar is all yellow and no red is left — missing because it is the only
state that is neither "some white" nor "some red".

⚠️ **It is generated by MULTIPLYING, not filling.** The squares are ink
drawings; a flat fill would eat the black outline and the pencil texture inside
it. Multiplying the white square by the yellow sampled from the square below maps
white→yellow, black→black, and every antialiased grey between them to a darker
yellow — which is what the artist actually drew in the other ten. Checked against
its neighbours on a contact sheet; it is seamless.

The bars come out **horizontal** (rotated 90° anticlockwise) and laid out as a
**column**, not a row — the frames are 333px wide, so a row would be a 7659×50
texture. Each is centred in a uniform cell: the bars are hand-drawn and differ by
a pixel or two, and the common cell is what stops the bar twitching sideways
every time the frame changes.

**Keep `bossHealth` a multiple of 22** (= `BAR_FRAMES − 1`). Then the bar steps
down one square every `bossHealth/22` connected hits with nothing left over;
anything else and it skips squares unevenly. At 88 that is four hits a square.

Time to kill is `bossHealth × bossHurtMs` of *connected* fire — 13.2s — and
those are the only two knobs.

⚠️ **The two phases are mirrored so they drain the same way.** In the master
they fill from opposite ends (yellow rises from the bottom, red descends from the
top), so once rotated the red drained right-to-left but the white ate in from the
left — the same bar emptying in two contradictory directions. Every frame
containing white is flipped horizontally in the build, so remaining health is
always anchored at the LEFT end and the bar empties one way throughout. The ink
wobble flips with it, but each bar was drawn separately and already differs frame
to frame, so there is no seam.

⚠️ **The bar cannot live in `hud.js`.** The whole HUD is hidden in no-time mode,
which is precisely when the fight happens. That is the entire reason it is its
own file. It is stateless like `game-over.js` — handed a fraction, derives the
frame — and drawn after the film pass for the same reasons the HUD is.

Frame 0 only shows when he is actually dead (`frameFor` clamps to ≥1 while
alive): an empty bar means dead, and showing it a hit early would call the fight
before it was over. It IS drawn through the death blast, because an empty bar is
the news.

---

### His SPECIAL — fists up, then two waves of lightning

`src/strike.js`, and `tools/boss-lightning.html` is where it was dialled in.

**When.** It arrives with **stage 2** — the frame his health crosses
`bossStage2At` (0.5) — and the first cast starts *then*, not on a timer: the
special is how the fight announces it has changed, so making the player wait for
it would waste that. After that it is every `bossSpecialEveryMs` (15s) ±
`bossSpecialSaltMs` (5s), **rolled per cast**, so a player cannot learn a
metronome and simply be elsewhere on the beat.

**The sequence**, ~3.1s end to end:

```
fists up 2000ms  →  CROSS 420ms  →  260ms  →  X 420ms  →  wait 10-20s
```

⚠️ Note the salt is now a third of the gap, not a quarter — at 15s ± 5s the
quiet stretch runs 10-20s, so the *fastest* repeat is barely three times the
attack's own length. Cutting the base much further without cutting the salt
would start letting one cast follow another almost immediately.

⚠️ **The 2s telegraph is the only warning there is** — the bolts appear at full
length in one frame. Shorten it and the attack becomes unavoidable rather than
hard, which is a different thing. He is drawn from the golpe sheet for the
*whole* special, not just the warning, so the pose the player learns to fear is
on screen throughout.

⚠️ **The special's clock is REAL ms.** The game clock is paused for the whole of
no-time mode, which is the only time this fight happens, so anything driven off
it would never advance. Phase overshoot is carried forward so a long frame
cannot make the sequence drift later and later.

**The art**, and three things about it that are not guessable:

- `saborosa-boss-time-golpe.png` is the **same 7 poses** with his fists up, so
  it swaps in against `BOSS_RECTS` with no second rect table. Measured, its
  poses sit within a few px of the originals and share the same top and heights.
- The four fire sheets are a **LOOP, not a build-up** — all four are distinct
  drawings (verified by hash) and they cycle for as long as a wave is on screen.
  The growing branch count is the crackle, not a progression.
- ⚠️ **A bolt is an ARM ROOTED AT THE ORIGIN, and the root is the sprite's RIGHT
  edge**, so every arm is drawn mirrored. Laid across him instead — the obvious
  reading of a full-width bolt — half of it runs backwards and reads as
  lightning *converging* on him. And the root cannot be derived from the art:
  the ink-per-column profile is thickest in the MIDDLE and tapers both ways, so
  reading the thinner right end as the tip (which I did first) gives rays that
  meet tip-to-tip in the centre. It was settled by looking at it.

The two waves are the same four angles swung 45°, which is what makes them read
as one attack in two beats rather than two unrelated effects.

⚠️ **Collision is a CHAIN OF SMALL BOXES along each arm**, not one rotated
rectangle. Everything in this game collides with AABBs, and a diagonal arm has
no useful one — its bounding box is a huge square covering the gaps *between*
the arms as well as the arm itself, which would hit a player standing safely in
one. Boxes stepped along the arm at 0.8× their own width overlap, so there is no
gap to slip through at any angle.

⚠️ **The hitbox is far narrower than the art** (`bossSpecialHitPx` 56, against a
drawn band of ~196px). The bolt is jagged branches and forks; being killed by a
wisp at the edge of one would be indefensible. Hold **C** to see the difference —
that gap is what makes the attack fair.

**One hit, not two.** The wave costs a full point (`bossSpecialDamage` 1 — the
half-point belongs to the swarm, not to him), and `plane.hurt()` is rejected
inside the player's 1100ms i-frames, which outlast the whole cross-gap-X
sequence. So being caught by both waves is ONE hit: the second wave exists to
catch a player who moved badly, not to double the first's damage.

Drawn **under** the boss, for the same reason the tool draws it that way: over
him a bolt cuts across his face, reads as something happening *to* him, and at
this length simply erases the character.

---

## The Mosca Boss

`src/fly-boss.js`, `enemy-sheets/saborosa-boss-mosca-01/02/03.png`, sliced by
`tools/mosca-boss-anim.html`. It turns up when the **last fly is dead** — where
the Time Boss is what abusing the rewind earns you, this one is what clearing
the room earns you.

**The sheet is a TURN**, the same shape the Time Boss's is and read the same way:
7 poses sweeping profile-left (0) → head-on (3) → profile-right (6), the widths
giving it away (253px in profile, 176px face-on, symmetric about the middle). So
`facing` is a continuous 0..1 and the pose is that value quantised. Every pose
shares the y band 38–302, so they are drawn from a common centre with no
per-pose offset.

⚠️ **But facing is NOT velocity here.** That coupling is the Time Boss's whole
character — he can only move as fast as he is turned — and it would be wrong for
a fly, which goes where it likes at whatever angle it likes. Here facing is only
where it is looking, and the entrance drives it explicitly.

**The rects are baked into config**, computed offline with the tool's own
algorithm (union alpha of the sheets, gap 6, alpha 16, minW 12) rather than
detected at boot.

⚠️ **Three sheets on disk, two loaded.** 01 and 03 are byte-identical (verified
by hash), so the delivered 1·2·3 flap is really A-B-A. `MOSCA_CYCLE: [0,1,0]`
reproduces it exactly against two images and saves 279KB of duplicate PNG — and
note it is *not* A-B: looping [0,1,0] holds A for two frames at the seam, which
is what the artist's three-file cycle does. The flap runs ACROSS FILES: a pose
holds its column while the sheet underneath it cycles.

They are PNGs in `enemy-sheets/`, a folder `package.sh` already copies — **no new
`cp` line**.

### The hit puff goes on its FACE

Every other damageable thing in this game takes the beam's height and puts the
impact puff where the shot crossed. This one **doesn't**, and the reason is the
art: the centre of this fly is its solid black abdomen, and the burst is black
line art. A hit registered there is feedback the player cannot see. Its face —
two red compound eyes — is the only part of it with any contrast.

So `flyBoss.hit()` takes no `atY` at all, and the puff is drawn at
`_facePoint()`. Being visible beats being accurate about a body you can't see
anything against.

`MOSCA_FACE` holds the face position per pose, as a fraction of that pose's own
rect — **measured, not guessed**, the same way `gunAnchorX/Y` were: the centroid
of the red eye pixels.

```python
# re-derive if the art changes
from PIL import Image; import numpy as np
im = np.array(Image.open('assets-v2/flying-dungeon/enemy-sheets/'
                         'saborosa-boss-mosca-01.png').convert('RGBA')).astype(int)
for i, r in enumerate(MOSCA_RECTS):
    c = im[r[1]:r[1]+r[3], r[0]:r[0]+r[2]]
    R, G, B, A = c[...,0], c[...,1], c[...,2], c[...,3]
    m = (A > 128) & (R > 150) & (G < 125) & (B < 125) & (R - G > 60)
    ys, xs = np.nonzero(m)
    print(i, xs.mean()/r[2], ys.mean()/r[3])
```

Note how far it travels — **0.22 of the width in profile-left to 0.77 in
profile-right** — which is why one fixed offset would not do and this has to be
per pose. Vertically it barely moves (0.475–0.489, i.e. dead centre), so the
problem was only ever horizontal. Identical across all three flap sheets: the
flap moves the wings and nothing else, so one table serves them all.

⚠️ **`_facePoint()` mirrors `render()` line for line** — same scale, same spasm
`dx`/`dy`, same spasm scale `k`. The puff has to sit on the face *while the body
is jolting*, and a body being shaken by a hit is exactly when this gets called.
Change `render()`'s transform and this changes with it.

⚠️ **It is recomputed every frame, not frozen at impact.** The fly keeps turning
and moving while the puff plays, and the face slides across half the sprite's
width over the turn — a point pinned at impact would drift off the face, and off
the fly, within the four frames the burst lasts.

### The entrance

A cutscene in three beats, and it cannot be interrupted:

| | |
|---|---|
| **CHARGE** | in from off the RIGHT at the player's own height, straight across at `flyBossChargeSpeed`, and out the far side. Aimed at where they were when it appeared and never corrected — a fly-past, not an attack |
| **DESCEND** | reappears at the TOP of the map, above the world entirely, and comes down the middle, turning to face the camera as it falls |
| **STALK** | reaches the centre of the map and comes straight for the player, with **no pause**. Arriving IS the start of the fight |

`arrived()` is the whole switch for that last line, and **everything** hangs off
that one test — the health bar goes up, it becomes shootable, and it starts
hurting on contact, all at the same instant and none of them before. Shooting a
boss whose bar is not up is damage the player cannot see land, and being killed
by a cutscene is worse.

⚠️ **The charge is timed by DISTANCE TRAVELLED, not by testing its position
against the edge of the screen.** The world wraps on X, so a position test would
have to be wrap-aware — and would still be wrong the moment the player moved the
camera mid-charge. Distance is neither.

The jump from off-left to above-the-centre is a **cut, not a move**: it is
off-screen either way, so there is nothing to see and nothing to animate.

**"Centre of the map" is the world's centre, not the screen's** (`flyBossHomeXRel`
/ `YRel`, both 0.5) — the same call the Time Boss's spawn makes, a fixed landmark
the player can go to rather than something that follows the camera.

### The fight

Everything damageable in this game has the same shape and this is no exception:
`flyBossHealth` 66 (a multiple of 22, so the bar steps one square every three
connected hits), gated by `flyBossHurtMs` i-frames, a damped jolt, the fly's own
burst frames as an impact puff — doubly apt here — at the height the beam crossed
it, and the shared 12-frame explosion on death.

The hitbox is **fixed**, the same call the coin and the Time Boss make: the turn
takes it from 253px in profile to 176px head-on, and a box that breathed with the
animation would make it a harder target for no reason the player could see.

### The stalk IS the attack

It has no projectile and no special move: it simply closes on the player at
`flyBossStalkSpeed` on both axes, and **touching it costs a third of their life**.
The collision boxes are the weapon. No extra gate is needed for that — `boxes()`
is empty until it has arrived and again once it is dying, so a cutscene and a
corpse are both harmless for free.

⚠️ **`flyBossStalkSpeed` MUST stay well under the player's own speed, and that
ratio is the entire difficulty of the fight.** The plane travels 0.30 of the
camera-plus-screen span per second, which is ~851 world px/s across and ~1117
down. At 420 the boss manages about half that, so it can always be outrun —
which is the point, because contact has to be a mistake the player made rather
than something that happens to them. Past ~800 the fight stops being winnable in
the other direction: unavoidable.

`plane.hurt()` is rejected inside the plane's i-frames, which is what stops a
boss parked on the player draining all three points in three frames. At
`planeHurtMs` 1100 a player who just sits inside it lasts 3.3 seconds.

⚠️ **The stalk step is CLAMPED to the distance remaining, and that is what
replaces the Time Boss's stand-off.** Without it the boss overshoots by a
fraction of a frame, `dx` flips sign underneath it, and it shudders on the spot
instead of looming. A stand-off would fix that too — but a stand-off also holds
the boss just *clear* of the player, and touching the player is this boss's whole
attack. Clamping settles it ON them instead, and the i-frames rate-limit the
cost. `_dx` is wrap-aware for the same reason the Time Boss's is.

Facing is only where it is LOOKING, so it turns toward the side the player is on
while travelling whatever way it likes, and keeps closing through the turn.

**No-time mode clears it**, along with the flies and the coins. It belongs to the
part of the run that was about time, and leaving it in a white void fighting
alongside a boss it has nothing to do with would be a mess. That is also what
guarantees only one health bar is ever up, so one renderer serves both bosses.

`flyBossDone` latches for the same reason `bossBeaten` does: beating the Time
Boss refills the sky with flies, and killing that second swarm must not summon
the Mosca Boss all over again.

---

## The player's health — he AGES

`planeHealth: 3`, and **there is no bar and there is not going to be one**: the
character himself is the readout. Each point lost deteriorates him one stage
(3 = as he starts, 2 = worn, 1 = badly gone) and the third kills him. That is
why this lives in `plane.js` rather than the HUD — and it *had* to, for the same
reason the boss bar did.

`wear` is a **continuous** number, not an integer counter. A full hit adds
exactly 1.0, which always crosses a stage boundary — so every hit is guaranteed
to change what the player looks like, which is the only feedback there is —
while leaving room for anything that ages him *gradually* to add a fraction to
the same number, with no second resource to keep in step. **The boss's aging
attack goes here and needs nothing else built.**

That room is now used. **Touching a little fly costs `flyTouchDamage: 0.5`** —
two touches age him one stage, six kill him — where the bosses and the orbs
deal a full point. It needed no change to `plane.js` at all: `hp()` and
`stage()` already floor `wear`, so the first touch is invisible and the second
ages him, and `isDead()` is a `>=` that six halves reach exactly.

### The victory sting

`victory-sound-01.ogg`, on **both boss kills** — the Mosca Boss and the Time
Boss. Read at `isDead()` in each case, which is the moment the death blast has
burnt out rather than the moment health hit zero, so the sting lands on the
fight being over instead of under an explosion still playing. Both are timed the
same way on purpose.

**It plays OVER the bed, not instead of it.** Nothing stops the music; being a
`once()` on the SFX bus it simply layers. That is the difference between winning
a fight and ending a run — the music carries on because the game does. Compare
the death sting, which arrives only after `stopMusic()`.

⚠️ **Only the FIRST PART of the take.** It is two pieces: a 620ms break at
10.88s, then a second, louder section from 11.50s. `OVERRIDES` cuts at 11.00s
and the normal tail trim finds where part one actually stops — **18.27s →
10.72s**. Which gap is *the* gap is not a judgement call: the longest musical
rest anywhere else in the take is 220ms. Nothing plays part two.

⚠️ `restart()` calls `stopOnce('victory')` as well as `stopOnce('gameOver')`. At
10.7s this easily outlives a player who beats the Mosca Boss and then dies, or
who restarts off the finale's logo.

### Two things happen on a hit, and they mean different things

| | lasts | reports |
|---|---|---|
| the **blink** (`hurtT`, `planeHurtMs` 1100ms) | the i-frame window | a **state** — you are invulnerable, for exactly this much longer |
| the **flinch** (`shakeT`, `planeShakeMs` 260ms) | a quarter-second | an **event** — that hit just landed, and it hurt |

They are separate timers on purpose. Hanging the shake off `hurtT` would
stretch it over the full second of invulnerability, and a plane that vibrates
for that long reads as broken machinery rather than as having been struck — the
moment of contact, which is the thing the player needs to feel, gets lost inside
it. The decay is *squared*, so the shake is nearly over by its own half-way
point; a linear fade spends its second half as a gentle drift that reads as the
plane being unsteady.

It restarts on **every landed hit**, including the half-point fly touches. That
matters most there: a graze that does not cross a stage boundary changes nothing
about how the plane is drawn, so without the flinch the player would have no way
to tell it from nothing at all.

⚠️ **`_shake()` is DRAW-ONLY and deliberately not part of `_metrics()`.**
Everything in `_metrics()` is shared with `muzzle()`. The shake is added to the
render translate alone, so it moves neither the camera (which pans off
`displayX`/`displayY`), nor `hitBox()`, nor the muzzle. A hitbox that jittered
would make what hits you a matter of luck at exactly the moment the game is
punishing you. The cost is that the shot line leaves the nose's *true* position
while the sprite rattles around it — a few px for a quarter-second, and far
better than a beam whose origin shakes.

It goes on the translate rather than being drawn separately so it carries the
**muzzle flash** with it; the flash is drawn inside the same transform, and a
plane that rattled while its gun flash stayed put would come apart on every hit.

### What can hurt him

| source | damage | credited as |
|---|---|---|
| a little fly, on contact | 0.5 | `'fly'` |
| the Mosca Boss, on contact | 1 | `'fly'` |
| a Time Boss orb | 1 | `'time'` |

⚠️ **All of it is rate-limited by `planeHurtMs` (1100ms)**, and with 13 flies
that is now load-bearing rather than a nicety: without it, flying into the
swarm would be six frames from full health to dead.

⚠️ The swarm test only counts flies that are **`isAlive()`**. Flies are never
spliced from the list while a corpse is still being drawn on the floor, so
without that the pile at the bottom of the screen would be a minefield. It also
breaks out of both loops on the first landed touch, so a frame with three flies
overlapping the plane is one hit, not three.

⚠️ **The deteriorated sprite packs do not exist yet.** `planeWearSheets` is the
switch: off (today) one pack is loaded and the stage shows through a `ctx.filter`
from `planeWearFilter`, which is a **stopgap and only a stopgap**. On, each stage
loads `saborosa-plane-{name}-wearN-NN.png` and the filter list should be emptied.
Stage 0 keeps the ORIGINAL asset key exactly, so turning the packs on adds keys
rather than renaming any. `_metrics()` falls back to the pristine pack per frame,
so a half-delivered set of art degrades to "he doesn't look older" rather than to
an invisible player.

The wear filter rides in the **same filter string** as the colour drain rather
than a second pass — `ctx.filter` takes a list, so ageing and greying compose for
free and the plane is still only filtered once. When the art lands that term
becomes `''` and nothing else changes.

`planeHurtMs: 1100` of i-frames, long by this game's standards because a hit here
costs a THIRD of the run rather than 1/44th. The **blink goes to alpha 0.3, not
to zero**: the player must never lose track of their own plane, least of all in
the half-second after being hit. It runs off `hurtT`, so the blink lasts exactly
as long as the invulnerability it reports. The i-frames run on **real** time and
are never touched by the stop-motion sampler — how long you are invulnerable
should not depend on what framerate the art happens to be hopping at.

**Only a landed hit consumes an orb.** Inside the i-frames `hurt()` returns false
and the orb flies on through, rather than being silently eaten — otherwise a
second orb arriving during the blink would punish the player later for a hit they
never saw.

Dying gives the fight a fail state at all, which no-time mode otherwise cannot
provide — the clock is paused in there, so time-over can never fire on its own.

### The death fall

The last hit does not cut to a panel. The plane **drops out of the sky exactly
the way a dead fly does** — same `flyGravity`, reused rather than copied so the
two cannot drift apart — after a small upward LURCH (`planeFallVy0`) that reads
as losing lift rather than as a sprite starting to slide down the screen, plus a
tumble, because a plane that fell flat reads as a bug. Only once the wreck has
left the frame does the ending begin.

- **The i-frames and the blink keep running over it**, on purpose: the player
  should see the hit land and THEN see the plane go down, rather than the two
  being one indistinguishable event.
- The fall runs on **real time and outside the stop-motion sampler** — it is a
  physical event, not part of the hopping animation, and quantising it to ~12fps
  would stutter it down the screen.
- `controlLocked` now covers falling as well as the entrance, so firing, moving
  and character-cycling all stop in one place. Both are moments the player is
  not flying this thing.
- `fallDone()` tests the sprite's **top edge** clearing the bottom of the canvas,
  so it is the whole plane that has gone, not just its centre. `planeFallMaxMs`
  is a safety net against a mistuned gravity, not part of the timing.
- The clock is paused **at the moment of death**, not when the fall ends, so the
  drain freezes on the frame it happened.

⚠️ **`plane.fallDone(canvas.height)`, not `H`.** That test runs earlier in the
loop than the frame's `const W, H`, so naming those there is a temporal
dead-zone crash on the one frame the player dies. Same number either way — the
canvas is a fixed internal resolution.

### Which ending you get

The two bosses kill you differently and the screen says so. `killedBy` is set at
the moment a hit actually lands, so the last thing to connect gets the credit.

| ending | backdrop | words |
|---|---|---|
| the clock runs out | coloured worm panel | **TIME OVER** |
| **Mosca Boss** knocks you down | coloured worm panel | **YOU FAILED** |
| **Time Boss** ages you out | white-out | **THE END** |

The fall is the plane's death animation and happens on both deaths — it belongs
to dying, not to whichever boss did it.

The coloured panel therefore serves **two** endings, and the only difference
between them is what it says: running out of time and being killed are not the
same thing to tell the player. `ending.title` carries the config key of the
override, `null` meaning plain TIME OVER.

`_titleFor()` memoises `overTitle` with one override merged on top, so all three
endings share the font, the size, the spacing and the 1500/1000ms reveal delays
and cannot drift apart. Only `words` (and, for the white one, the colour and
weight) ever differ.

⚠️ "YOU FAILED" is one glyph longer than "TIME OVER" — roughly 1020px against
910px at `sizePct` 20.4, so it still clears the 1280 frame with ~130px a side.
That is the number to drop if a longer phrase is ever wanted.

### Dying to the boss: THE END

The **inverse of the other ending.** The run running out of time dips to BLACK
and says TIME OVER; being killed by the Time Boss goes **WHITE** and says
**THE END**. Which is the picture finishing what it was already doing rather than
cutting to something new — the bleach has the world at pure white by the time the
fight starts, so what actually dissolves in the white-out is the plane, the boss
and the orbs, leaving the void they were standing in.

`ending.white` is the whole switch; it picks the dip colour and which render the
panel branch calls, and it is set from `killedBy` — see Which ending you get.
Dying to the Mosca Boss is deliberately NOT this screen: it knocks you out of the
sky in a world that still has its colour, so it gets the black TIME OVER panel.

**The letters arrive identically, and structurally so.** `_title()` now takes the
title config as an argument and both endings go through it, and `noTimeTitle` is
an **override merged over `overTitle`** rather than a second block — font, size,
spacing, the 1500/1000ms delays, all shared, so retiming one ending retimes both.
Three things differ:

- **the words** — and `noTimeTitle` / `renderNoTime()` are named for the MODE the
  death happens in, not for what it says. The words are config and have already
  changed once (NO TIME → THE END).
- **the weight** — `fauxBold` 4.5 against the shared 1.5. Futura's real Extra
  Bold cut only exists on machines that happen to have Futura at all, so weight
  is bought by stroking the glyphs in their own colour. Much past this and the
  counters in E and D start closing. Scoped to this ending on purpose: TIME OVER
  was not asked to change, and moving the value up one block would share it.

- **the colour** — **black**. The yellow it inherits from `overTitle` is what
  TIME OVER wears on a dark photograph; on this screen's white field it barely
  showed.

There is no picture to fade up, so the panel's `alpha` only ever gates the
letters — and they are 1500ms behind it, by which point it is 1. They pop exactly
as they do on the black screen, which is the point. `settledMs()` reads the
shared timings, so the restart arms at the same moment either way.

---

## The finale

`src/finale.js`. The only ending in the game that is a reward rather than a
failure, and the only one that is earned rather than arrived at.

```
he blows up
  → TIME COMES BACK: the clock is scrubbed -2:00 → 0:00 over finaleClockMs,
    and the world un-bleaches from pure white to full colour as it goes,
    while the plane glides to the middle of the screen, low, and bobs
  → "THANK YOU FOR PLAYING"   fade up · hold · fade out
  → "OBRIGADO"                fade up · hold · fade out
  → the plane accelerates out to the right
  → the LOGO runs the Mosca Boss's entrance MIRRORED: a fast pass across the
    screen left-to-right, then in again from below and up to the middle,
    where it stays
  → press anything → a new run
```

⚠️ **The background transition is NOT a second thing to keep in step.** The
bleach is read from the clock, so scrubbing the clock IS the world washing back —
on exactly that curve, for free. Accelerating one accelerates the other by
construction; there is no second timeline that could drift.

⚠️ **The clock is SCRUBBED, not resumed.** `seek()`, every frame, while it stays
paused. 120 seconds of game time inside 5 seconds of real time is a *position*,
not a rate — no `gameClockRate` could express it — and a resumed clock would also
hand the ending back to a time-over test that no longer means anything.

**Every beat is a duration, never an absolute timestamp.** `_marks()` sums them
into cumulative marks, so retiming any one shifts everything after it instead of
leaving a hole — the same trick the intro's liftoff window uses. The words wait
on `max(finaleClockMs, finalePlaneMoveMs)`, whichever of the two is slower.

**The glide is written into `plane.x/y`; the EXIT is not.** The glide *should*
move the camera — the world drifts into its final framing along with him. The
exit must not: ⚠️ the camera pans off `displayX()`, so flying it through `x`
would drag the world past its inset and expose the blank studio margin. It is a
DRAW-only offset (`cineOffX`), the same device the entrance uses at the other end
of the run, folded into `disp.entryOff` so render, muzzle and hitbox all pick it
up from one place. Quadratic, so it reads as building speed rather than sliding
off at a crawl.

### The lettering

Literally the same code as the end panels: `GameOver.renderTitle()` draws the
words with no panel behind them, through the same `_title()` and the same
`_titleFor()` merge. Same font, same weight, same colour, and any retune of
`overTitle` reaches all five titles in the game.

The finale's two configs switch the per-word reveal OFF (`d1`/`d2`/`revealMs`
all 0) and the fades are driven by the alpha the finale passes instead — they are
cards, not countdowns — which is why `t` can simply be 0.

⚠️ **`sizePct` had to come down.** "THANK YOU FOR PLAYING" is 18 glyphs against
TIME OVER's 8; at the panel's 20.4 it would be some 2000px wide in a 1280 frame.
At 9.5 it measures ~960px and sits with ~160px either side. OBRIGADO gets 15.

Both are drawn **outside the gate weave but under the film pass**, so the grain
and vignette sit over them exactly as they do over the TIME OVER panel, without
the scene's shake.

### The logo

`saborosa-logo-V3-low.png`, converted to `saborosa-logo.webp` (52KB → 30KB) and
dropped at the flying-dungeon asset root — the folder `package.sh` already globs,
so **no new `cp` line**. Same call the boom sheet made.

Screen space, not world space: nothing about an end card should scroll with a
tray the player is no longer flying over.

**Nothing follows it but a restart**, armed after `finaleLogoHoldMs` — the same
"press anything" the TIME OVER panel uses, because the player must never be left
on a screen with no way off it.

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

## Music

One file, one loop, no mixer: `assets-v2/flying-dungeon/audio/trilha-mix.ogg`,
a seamless **14.452s** bed. It starts in `startGame()` — with the first game
screen, never under the intro — and `restart()` stops it, so it always begins a
run from its own first beat. `M` mutes, in every phase.

**The track is three separate takes.** They were delivered as phone voice notes,
and getting from those to one file is a three-stage pipeline, each stage a
tool. It is worth knowing why there are three rather than one:

```
sound/*.ogg          the masters, as recorded. Never edited.
   │  tools/build-sound.py    trim the dead air, level them against each other
audio/music/trilha-0N.ogg     three aligned STEMS — ingredients, never shipped
   │  tools/music-lab.html    layer them, find the alignment, crop the loop
   │  tools/bake-trilha.py    render that arrangement down to one file
audio/trilha-mix.ogg          what the game loads, and all it loads
```

⚠️ **Every take has ~1s of dead air at each end**, because the recording starts
when the thumb goes down. Looping that raw goes silent for two seconds every
time it comes round — the single most audible flaw a loop can have, and it is
in the file, not the music. That is what `build-sound.py` exists for.

⚠️ **`bake-trilha.py` reads the arrangement OUT OF `music-lab.html`** — the
`DEFAULT_MIX` / `DEFAULT_MASTER` literals are the single source of truth. Dial
a change in the tool, put the numbers back in those literals, re-run the bake.
A second copy of them in the Python would be wrong the first time anyone
nudged an offset.

⚠️ **NEVER run `trilha-mix.ogg` through `build-sound.py`.** It trims silence off
both ends, which is right for a raw take and destroys a loop that has been
cropped to a downbeat.

**Why the loop is 14452ms and not the 15302ms of the longest take:** at 15302
the wrap arrived with every layer part-way into a fresh phrase and then jumped
to the top. 14452 is where the layers come back round together. The comment on
`DEFAULT_MASTER` has the full derivation, including why the tool's `crop`
button now gives a different (wrong) answer than it did when that number was
chosen.

**Why Web Audio and not an `<audio>` element.** The whole exercise was making
the wrap seamless — the loop is cropped to a downbeat and its first 60ms are a
crossfade of its own tail. `HTMLAudioElement.loop` re-primes the decoder at the
wrap and can drop a few ms there: inaudible on a song, fatal on a bed that
comes round every 14 seconds, and it would throw away exactly what the pipeline
bought. `AudioBufferSourceNode.loop` is sample-accurate by specification. It
costs ~2.7MB of decoded audio held in memory, against ~30MB of art.

**Autoplay** keeps an AudioContext suspended until the player has interacted
with the page. By `startGame()` they have pressed several keys, but that is a
fact about the current intro rather than a guarantee — with `CONFIG.intro` off,
nothing has been pressed. So `sound.js` retries the resume on every gesture
until one takes, and remembers that the game asked for music in the meantime.

Loading is **not awaited and not part of the progress total**, same as the
gamepad mapping and for the same reason: ~240KB, optional, and the game must
never sit on a loading bar for it. If it lands after the game has begun it
starts itself. A missing file or a browser that cannot decode opus leaves the
game silent and otherwise untouched.

`package.sh` copies **the root of `audio/` only, never `audio/music/`** — the
stems are ingredients the game has no code to play.

**The music stops on all three bad endings**, and it is two calls rather than
three because they all funnel through one flag: `ending`. The clock running out
latches it in one place; the plane dying latches it in the other, covering both
the Time Boss (THE END) and the Mosca Boss (TIME OVER, `failedTitle`). A fourth
ending added later inherits the behaviour as long as it sets `ending` too.

It stops where `ending` is LATCHED, not where the panel finally appears — that
is the moment the picture starts dipping, and the bed going down with it is what
makes the dip read as the end of the run. `musicFadeOutMs` (420) is deliberately
shorter than `overFadeOutMs` (900) so silence lands before black does. **Winning
is not one of these** — the finale keeps its music.

⚠️ The stop RAMPS rather than cutting. Stopping a buffer source outright chops
the waveform wherever it happens to be, and a waveform ending anywhere but zero
is a step, which is a loud click. `_start()` resets the gain afterwards rather
than a timer restoring it, so a run started again mid-fade cannot bring the old
level back under the new track.

**The death sting belongs to the PANEL, not to the death.** `game-over.ogg`
(3.44s) starts on the first frame of the game-over screen — the top of the block
that fills black/white and `return`s — which is ~900ms after `ending` latches.

⚠️ It first fired at the latch, and that was wrong in a way that is obvious once
heard: the song began while the player was still watching their own wreck fall,
so it scored *the death* instead of the screen that follows it. The dip to black
is still the played scene going away; the sting waits for what replaces it.

⚠️ **Latched on `ending.sung`, not on once()'s own state.** `once()` frees its
slot when the clip finishes, so an unlatched call in that block would restart
the sting every 3.4s for as long as the panel is up. `ending` is rebuilt per
run, so the flag resets itself.

It rides on the SFX bus as a `once()` like the movement whooshes — same
semantics, plays entirely, cannot stack — but with `{ src, volume }` giving it
its own level, because it is a piece of music standing in for the bed that just
stopped, not a sound effect sitting under one.

**It is DOUBLED against itself**: `double: { delayMs: 300 }` starts a second
voice off the same decoded buffer 300ms behind the first. No second file, no
second decode, no second copy of the samples — an `AudioBuffer` can feed any
number of sources at once, and this costs one more source node.

⚠️ The copy is scheduled against `ctx.currentTime`, **not** with a `setTimeout`.
The audio clock is sample-accurate and runs on its own thread; a timer runs on
the main one, behind whatever the frame is doing, and would land the copy at
300ms give or take a stutter — turning a fixed interval into a variable one,
which is the one thing this effect cannot survive.

**The delay decides what the effect is**, and small changes are not subtle:

| `delayMs` | |
|---|---|
| under ~40 | the copies fuse — one sound, tone coloured by comb filtering |
| **50** ← where it is | the edge of fusion: nearly one thickened sound with a hard edge |
| 100 | a slapback — two attacks, still reading as one event |
| 300 | the round of a canon |

**The whole combination runs 10% slow** (`rate: 0.9`), and that means the pair,
not just the material: `delayMs` is measured in the *clip's own time* and
divided by `rate`, so the 50ms gap stretches to 56ms of real time along with
it — exactly as it would if the two voices had been bounced to one file and that
file played slower. A fixed gap under stretched material would change the
relationship between the copies, which is the whole effect.

⚠️ `rate` **resamples**; it does not time-stretch. The pitch drops with the
speed, about 1.8 semitones at 0.9. That is what `playbackRate` on a buffer
source does and there is no flag to avoid it — preserving pitch would need a
real time-stretch, which Web Audio does not provide. On a death sting the drop
is the point, but it is a tape-speed change, not a tempo change.

⚠️ **`restart()` calls `stopOnce('gameOver')`, the one exception to "nothing
stops a one-shot".** The panel arms its "press anything" before 3.44s are up, so
without it a new run's title sequence opens over the sound of the last one
dying. The movement whooshes are deliberately *not* stopped this way — they are
short and incidental and the whole point is that they finish.

⚠️ **This take needed a hand cut** — the first entry in `OVERRIDES` in
`build-sound.py`. A handling thump (the recording being stopped) sits at
5.0–5.25s, a full second after the sting ends at ~4.1s, and the silence trim
keeps it because it *is* sound: 250ms at -26dB, well above the noise floor and
far past any start-duration minimum. Left in, it lands as a thunk over the
game-over panel. `OVERRIDES` entries are **not** re-applied automatically — the
up-to-date check compares mtimes — so changing one needs
`--force --only <name>`.

---

## Held loops — the gun, and the coin taking damage

`CONFIG.LOOPS`. These are **loops, not one-shots**, because they report a STATE
the player is holding rather than an event: `loop(name, true)` starts one,
`loop(name, false)` stops it. Both hang off the same beam, which is re-tested
every frame while fire is down — there is no per-shot moment to hang a one-shot
on, and one retriggered per frame would be sixty overlapping copies a second.

| | plays while |
|---|---|
| `gun` (`efeito-metralha-01.ogg`) | the gun is actually shooting |
| `coinHit` (`coin-hit-01.ogg`) | that beam is crossing a coin |

**The gun is gated on `ray`, not on `input.firing`.** `ray` is non-null on
exactly the frames the gun is actually shooting: null during the fly-in
(`controlLocked`), null while falling, null through the finale (`cine`), null
with no muzzle. So the sound stays welded to the muzzle flash instead of
drifting from it — holding fire during the entrance would otherwise play a gun
that visibly is not firing.

**`coinHit` is set on the BEAM CROSSING, not on `hit()` succeeding.** `hit()` is
rejected inside the coin's 160ms i-frames, so gating the sound on it would chop
the loop on and off several times a second while the player held a steady beam
on a coin they can see taking damage. The state being reported is "this coin is
under fire", which is true on every frame the beam is on it. It can only be true
on a frame the gun is also playing, so it is mixed to sit *inside* the gun
rather than fight it.

⚠️ **Two places have to silence every loop explicitly**, because both leave the
game phase without passing the firing block:

- the game-over panel path, which `return`s before it — a player who died
  holding fire would otherwise hear the gun over the panel forever;
- `restart()`, since the key that restarted was probably held and the intro has
  no firing block to turn it off.

Both call **`stopLoops()`** rather than naming the loops, so a third looping
sound added later cannot be the one nobody remembered to silence.

Like the shooting itself they are deliberately **not** gated on `ending`: the
final volley through the dip to black should be audible.

⚠️ **The loop region skips the clip's own fades** (`loopTrimMs`, via `loopStart`
/ `loopEnd`). `build-sound.py` fades 12ms in and out of everything it builds,
which is right for a clip played once and wrong for one played end to end: the
two fades meet at the wrap and punch a 24ms hole in the sound, once per pass. On
the gun that reads as a stutter in the burst; on any loop it is an audible seam.
The fade-in still plays as the attack when the loop first starts — playback
simply never returns to it.

⚠️ **`coin-hit-01.ogg` needed an `OVERRIDES` cut**, and it matters more here than
it did on the game-over sting because this one loops. The take is two hits, the
second decaying into the floor by ~1.30s, then 300ms of nothing, then a 100ms
plateau at -30dB from 1.67s that cuts off abruptly — a flat top and a hard edge,
so handling noise rather than a third tap, which would decay. Left in, every
pass of the loop would carry half a second of silence and a thud. Cut at 1.45s;
the normal tail trim then finds where the sound actually stops. Built: **1.83s →
1.12s**, two hits per pass.

---

## Climb and dive

`CONFIG.SFX.up` / `.down` — and they are the gun's opposite in every respect,
which is the useful way to hold the two in mind:

| | the gun | climb / dive |
|---|---|---|
| what it is | a **state** — on while the trigger is down | an **event** — the moment of the press |
| trigger | the held flag (`ray`) | the rising edge (`takeUpPress`) |
| loops | yes | never |
| release | stops it | does nothing — it plays out |

The edges come from `input.js`, computed in `poll()` where the keyboard and pad
have already been folded into one answer. They are **recomputed every frame
rather than queued**, unlike `takeCycle()`: an unread movement edge is stale,
not pending, so a press during the fly-in evaporates instead of firing a whoosh
the moment control is handed over.

⚠️ **A second press of the same direction while it is still playing is
IGNORED** — not restarted, not stacked. "Plays entirely" and "retriggers on
every press" cannot both be true. Restarting interrupts (the one thing the
sounds must not do) and stacking, in a game where the player nudges up and down
constantly, is a pile of overlapping whooshes. The two directions are
independent, so reversing direction always speaks.

Nothing stops these — not releasing the key, not the run ending, not a restart.
They are short, they were asked for, and a sound cut off half way is more
noticeable than one that finishes a beat late.

⚠️ **These takes needed `START_DURATION`, added to `build-sound.py` for them.**
Both open with a click a fraction of a second into the dead air — the thumb on
the screen, the mic switching on. Without a minimum sustained duration, the trim
stops at that click and keeps everything after it: `cima` would have kept 315ms
of silence and `baixo` 437ms, so the whoosh would arrive a third of a second
after the key press. 50ms is far longer than any such artefact and far shorter
than any real note. ⚠️ Changing it changes where takes start, which for the
trilha stems would invalidate the alignment baked into `trilha-mix.ogg` — the
mtime skip protects a normal run, but `--force` after changing it would not.

---

## Game clock

`src/game-clock.js`. Deliberately not the wall clock:

1. It ticks at `gameClockRate: 1.15` — a minute of real play reads **01:09**.
2. It is **scrubbable**, and now actually scrubbed: coins call `rewind()`, and
   the clamp at 0 is gone (see Below zero).
3. `started` is separate from `running` — "has this run begun", never cleared
   by a pause. Two pauses depend on it (time over, no-time mode) and a caller
   testing `running` would undo them on the next frame.

⚠️ **The rate scales the CLOCK ONLY.** The simulation still steps on the real
delta, so the world and the clock disagree about *when* things happened: 60s of
fly movement is stamped 69s of game time.

That is fine for what was built, because the rewind here is **event-based, not
reconstructive** — coins move the clock, and flies come back from a stamped
snapshot rather than by replaying the world to a game time. A rewind that
genuinely reconstructed state by game time would need the sim on `advance()`'s
return value first. Worth deciding at that point whether the world should also
run 15% faster, or whether the rate drops to 1.0 and the urgency comes from
elsewhere.

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

## NEXT SESSION: the aging attack, and the art

The fight is BUILT and playable end to end: he is shot, he throws, he has two
stages, he can be killed, and the player can die. What is left:

**1. The aging attack — designed but not built, and it needs a shape.** The
brief: "a special attack where he makes you older, like time passes faster for
the character". The machinery is already there for it — `plane.wear` is
continuous precisely so something can add a *fraction* per frame rather than a
whole point — so this is a boss behaviour to author, not a health system to
build. What it is not decided is:

- is it a **field** the player has to fly out of (aging while inside it), an
  **instant** hit that costs a stage outright, or a **lingering curse** that
  ages you for a while after it lands?
- what telegraphs it? The obvious one is free: **facing IS velocity**, so
  forcing him front-on stops him dead and already reads as a wind-up. A special
  attack that begins with him squaring up to the camera costs nothing and is the
  most legible tell in the entity.

**2. The deteriorated character art.** Three stages, two of them missing. See
The player's health — the hook, the naming and the fallback are all in place;
flip `planeWearSheets` and empty `planeWearFilter`.

**3. The Mosca Boss fight is one idea.** Stalk and contact damage, and that is
all it does — no projectile, no special, no second stage. Whether that is enough
is a play-it call; the Time Boss's stage split (`stage()` derived from health)
is the pattern if it wants one.

**4. Nothing follows victory.** The run just carries on with four minutes of
game time and no coins. That may be enough, or beating the boss may want to be
worth something the player can see.

**Numbers that have never been played, only reasoned about** — all of the
fight's timing is a first guess: `bossHealth 88` (13.2s of connected fire),
`orbEveryMs 1500`, `orbSpeed 330`, `planeHurtMs 1100`, and every `flyBoss*`
number. Expect to move them.

---

## Open items

1. **HUD font** — Futura is not bundled and isn't on most non-Mac machines.
   Ship a webfont (licensed Futura, or a free geometric lookalike like Jost)
   with an `@font-face` + `package.sh` copy, or accept the fallback stack.
   Affects the HUD *and* the TIME OVER title.
2. **The rewind economy is enormous.** At `coinRewindMs` 5s and `coinHealth` 7,
   the five coins of wave 1 alone hold **175s** against a 120s run, and four
   drained coins take you from 0:00 to the boss. Live-editable from the
   controls, so tune it in play.
3. **Sim on game time** — see Game clock. Only needed if a *reconstructive*
   rewind is ever wanted; the event-based one does not need it.
4. **Plane clips the frame edges** — at full stick up/down the sprite is half
   off-screen (pre-existing). A clamp on the drawn position would fix it at the
   cost of a slightly smaller reachable band.
5. **Coins have no pickup** — shooting one is still the only thing that can
   happen to it.
6. **Empty sky at GO!** — was ~600ms at `liftSpeed: 1.2`; at 1.0 it should be
   ~150ms. Re-check by eye before touching `introBeats[11]`.
7. **Nothing follows TIME OVER but a restart.** No score, no summary.
8. **The plane's wear filter is a stopgap** for art that doesn't exist yet, and
   it is the ONLY thing telling the player they have been hit apart from the
   blink. Worth checking it is legible before the real packs land.
