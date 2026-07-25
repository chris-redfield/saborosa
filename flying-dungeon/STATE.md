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

- `flyCount: 30`, `flyHealth: 3`, `rayDamage: 1`.
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

**Not built:** coins do nothing yet. No pickup, no effect on the clock or
score, and no respawn — the 12 just circle the world forever.

`package.sh` copies `coin/*.webp` as a glob, so it currently ships 02's 241KB
unused. That's deliberate: swapping variants stays a pure config change with no
packaging edit.

`package.sh` copies `coin/` (added when the folder was created, rather than
after shipping a build without it — which is how `enemy-sheets/` went missing).

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
