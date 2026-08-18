# Beat 'em up — state of play

Handoff notes. Covers what was built, why it is shaped the way it is, and what
is still open. Numbers here were read off `src/config.js` at the time of
writing — **trust the file over this document** if they ever disagree.

```
Edit it:     README.md is the knobs — sizes, animation timings, the sprite cut
Run it:      serve the repo root, open beatemup-dungeon/index.html
Debug it:    hold C
Package it:  ./package.sh   →  dist/ + beatemup-dungeon-itch.zip
Inspect it:  node tools/build-manifest.js --list
```

Controls: **arrows/WASD** move · **J / Z / Space** punch (tap again to combo) ·
**K / X** jump · **L / E** pick up · **hold C** debug.

On a pad: **A** (bottom face) jump · **X** (left face) punch · **B** (right
face) pick up · **d-pad / left stick** move · any button dismisses an end
screen. The mapping is the main
game's own `assets/gamepad-mapping.json`, shared and not copied — but it names
no `jump`, because the main game has none. `applyMapping` puts jump on the first
free button and **tries 0 first on purpose**, so it lands on A rather than
wherever the search order happened to reach.

---

## The one constraint that will break things if forgotten

**The backdrop is FILMED FOOTAGE, and it is a single shot.** THE FOOTAGE HAS
LANDED — `batidao-de-coco-background-original.mp4`, a 29.5s dolly tracking past
a wall of rubbish and produce on sand. The far scenery and the ground the
fighters stand on are the same photograph, so the render stack has exactly
**one `plate` layer at parallax 1.0**. That constraint held and still holds.

It began as two tiled layers at 0.35 and 1.0, and that was wrong: real footage
would have put a second copy of a shot that already contains its own floor
sliding underneath itself. Parallax 1.0 is also the only honest value for a
plate — a real camera move already carries its own parallax inside the frame.

⚠️ **IT IS THE VIDEO ITSELF — `kind: 'video'`, projected behind the fighters.**
Not the frame sequence this file originally planned for. `SOURCES.plate` points
straight at the mp4.

**The footage does not scroll; it plays.** The pan is inside the frame, so the
video is drawn stationary filling the canvas and the shot's own camera move
supplies the parallax. Sliding it as well would move the picture twice.

**It is driven by the camera, not by a clock.** Walking winds the shot forward,
standing still freezes it on a frame. That is `scrub` — the mode the film source
was designed around — done with a video element instead of a pile of decoded
stills.

⚠️ **RATE CONTROL, NOT SEEKING, AND THAT IS THE WHOLE IMPLEMENTATION.** The
honest reading of "frame indexed by camera position" is to write `currentTime`
every frame, and it stutters badly: a seek decodes from the nearest keyframe,
and keyframes are seconds apart, not frames. So the video is PLAYED at whatever
rate keeps it level with the camera, and `currentTime` is written only when the
two drift more than `resyncS` apart — a fresh level, or a camera that moved in
one jump. Continuous decode, one seek. The camera never runs backwards
(`_followCamera` clamps it), which is what makes a chase-forward rate safe.

⚠️ **`worldPxPerSecond` IS A MEASUREMENT, NOT A PREFERENCE.** Phase correlation
over all 887 frames puts the pan at 2266px of the 848-wide source across 29.52s;
drawn at 720 tall that is 3413 screen px in 29.52s = **116 px of camera travel
per second of shot**. Set right, the background moves 1:1 with the world, which
is what parallax 1.0 means. At `walkSpeedX 300` the shot runs at about 2.6x,
which reads as normal because the only motion in it is the pan. The level is now
cut to the full 29.5s, so the shot is used end to end and never runs out.

⚠️ **A STITCHED PANORAMA WAS TRIED HERE AND REJECTED. DO NOT PROPOSE IT AGAIN
FOR THIS LEVEL.** The whole shot stitched into one strip and drawn as
`kind: 'image'` is cheaper on every measure that can be counted — 507 KB against
8.3 MB, one static texture against a per-frame video blit — and it looked bad.
The plate is the MOVING footage; that is the point of it. The numbers are not
the argument and were not accepted as one. `tools/build-plate-panorama.py` and
its output are still on disk, unused and unreferenced.

A frame sequence, for the record, was never viable either: ~113 frames is ~46 MB
decoded at a resolution soft enough to notice, ~220 MB native.

**A later shot with real motion in it** — smoke, a crowd, anything that moves
while the camera is still — wants `kind: 'film'`, which is still wired:

| segment | mode | what it means |
|---|---|---|
| `scroll` | `scrub` | frame indexed by CAMERA POSITION — a dolly. Walking winds the footage forward, stopping stops it. |
| `arena` / `boss` | `play` | frame indexed by TIME, looping — the world alive around a locked fight. |

**The belt survived every one of those swaps, exactly as planned.** `beltTopY` /
`beltDepth` are a lane defined *over* the plate, not derived from it, and they
were the only thing that needed re-measuring. Hit tests, draw sorting, camera
and AI are all expressed in `z` and followed for free.

⚠️ **THE BUILD IS NOW 11.3 MB, up from 3.7.** The mp4 is 8.3 MB of it. That is
the price of the projection and it is worth knowing before shipping to itch;
re-encoding the shot smaller, or with denser keyframes to make the rare resync
seek cheaper, are both open.

Footage will be downscaled before shipping. `loadBig`'s cap is the knob; a frame
sequence is the most expensive thing this game will ever load — see
PERFORMANCE.md for what happened last time textures got away from us.

---

## The files

| file | role |
|---|---|
| `src/game.js` | the disposable SHELL — canvas, loop, phases, wiring |
| `src/config.js` | every tunable, plain data, no logic |
| `src/manifest.js` | **the one list of every asset**; the game AND the build read it |
| `src/backdrop.js` | the layer stack and its sources (tile / image / **film**) |
| `src/stage.js` | the level director: segments, camera, arena locks, spawning |
| `src/fighter.js` | the shared body: belt position, health, attacks, knockdowns |
| `src/player.js` | the coconut — input → intent, and nothing else |
| `src/enemy.js` | the villains, and `Crowd`, which owns **the attack token** |
| `src/fly-boss.js` | the Mosca Boss: ambush entrance, swoop, ground pass |
| `src/combat.js` | hit resolution and hitstop |
| `src/sheets.js` | two pack formats, **two facings**; see below |
| `src/life-bar.js` | STILL LIFE's hand-drawn bar, player and boss |
| `src/hud.js` | health, GO prompt, end cards |
| `src/debug.js` | everything the C key draws |
| `tools/build-go-glyph.py` | cuts "GO!" out of the title lettering sheet |
| `tools/build-manifest.js` | prints & checks what package.sh copies |

## The sprites

**THE COCONUT HAS ITS OWN SHEET NOW.** It was drawn for this game and replaces
the borrowed 9×5 pack: 13 rows, 74 frame slots, cut by
`tools/build-beat-coconut-defs.py` into a 45-frame packed atlas. The villains
are still on the main game's packs, so `sheets.js` carries **two formats** until
villain sheets exist. See README.md for the row table and the cutter.

⚠️ **TWO FACINGS NOW, NOT SIX.** The diagonals are gone. The new sheet is drawn
side-on only, and running the player on two facings while the enemies kept six
reads wrong immediately — enemies angling toward the camera beside a player who
never does. `up` and `down` were already never selected, for the genre reason:
fighters face ALONG the belt so the read of who is about to hit whom survives
three enemies closing at once. Two facings is that rule taken to its end. The
player can still MOVE diagonally; only the sprite stopped turning.

⚠️ **Which way a sheet faces is recorded in its defs, not assumed in code.** The
new sheet faces RIGHT; the main game's packs face LEFT. Each pack declares
`native` and the flip is "not that side". Getting it wrong does not fail loudly —
the character walks backwards, facing away from where it is going. It shipped
that way for one build.

⚠️ **Ragged frames need an ANCHOR, not a bbox centre.** Frame widths run 190px
to 285px because an extended arm is wider than a guard, so centring on the bbox
drags the body sideways on every punch. Each frame stores a point read off the
coconut BODY — horizontal centroid, body's lowest row as the ground line.

⚠️ **That lowest row means a RUN of body, not one matching pixel.** The arm's
antialiased edge passes through colours within tolerance of the body tan — one
pixel per row — and taking the lowest of those put the ground-pickup anchor 34px
low, at the tip of the reaching arm, drawing the coconut suspended off its own
hand. `BODY_MIN_RUN` in the cutter; the real body has 8-51 pixels a row against
the noise's 1, so it is not a tuned number.

⚠️ **A knocked-down fighter is rotated ONLY if its pack has no knockdown art.**
The grid packs have none, so the flattened carry pose gets tipped on its back.
The coconut has real falling and dying rows; rotating those tips a body that is
already lying down face-first into the floor.

**Animation clocks, and why there are three.** Attack poses are driven by the
attack PHASE, so a punch's drawing can never drift from the window that can
actually hit. `hurt` / `down` / `death` are one-shots that play once and hold.
`idle` / `walk` loop off a free-running clock. `jump` is driven by the ARC, so
retiming `jumpMs` retimes the animation for free.

⚠️ **Death needs its own clock, and two things had to be fixed before it played
at all.** The shell stops updating the world the moment the player dies, so a
death driven by the normal update never advanced past frame one — it now gets
`player.tickDeath(dt)` while everything else stays frozen. And `stateT`, the
obvious clock to use, is RESET when the knockdown goes `land` → `lie`, which
restarts the animation halfway through. `deathT` starts at death and only counts
up.

⚠️ **`BODY_SCALE` at the top of `config.js` is the only size knob.** It replaced
a literal `* 0.8` repeated twenty-odd times under a comment telling you to grep
for them all. Everything measured against a body scales with it; everything
measured against the level does not. See README.md.

---

⚠️ **`index.html` writes its own script tags** with a `?v=` cache-buster, for the
reason the flying dungeon records: a change landing in source *and* dist and
still throwing "X is not a function" because the browser held a cached copy of a
file whose URL never changed. **A new `src/*.js` must be added to that list** —
`package.sh` now refuses to build if one is missing.

---

## The belt

```
x       along the belt, world px
z       across it, 0 (FAR) .. beltDepth (NEAR)
jumpY   height off the floor — DRAWN ONLY

screenX = x - camX
screenY = beltTopY + z - jumpY      draw order = z ascending
```

⚠️ **`jumpY` never touches x or z**, and that is a rule. If height moved a
fighter in world space it could clear another's depth slab and land somewhere
the walk could not reach, and every question about who can hit whom would need a
third axis in it.

Current frame at `beltTopY 520`, `beltDepth 190` — **measured off the filmed
plate**. The rubbish pile the shot tracks past bottoms out between y 480 and
540, and sand is over 70% of every row below 586. At the old 430 the belt's FAR
edge sat inside the pile and fighters at `z = 0` stood in the rubbish.

| region | y | height |
|---|---|---|
| no-walk | 0–520 | 520px — lower `beltTopY` to eat into it |
| **walkable belt** | 520–710 | 190px |
| no-walk | 710–720 | 10px — raise `beltDepth` to eat into it |

⚠️ **`beltDepth` was deliberately NOT moved** when the belt came down onto the
sand. It is the depth dial of the whole genre; placing the band and changing the
difficulty are two edits, and doing both at once makes neither judgeable.

---

## Combat — what actually connects

**No polygons.** Two axis-aligned rectangles on the floor plane, plus four
conditions with no geometry at all:

```
hurtbox   59 × 24, centred on (x, z)          — same for every fighter
hitbox    reaches FORWARD by reachX, ±reachZ  — never behind you

connect = overlap in x  AND  overlap in z
          AND |attacker.jumpY − target.jumpY| < verticalReach (70)
          AND target is vulnerable (not in i-frames)
          AND this swing has not already hit (hasHit)
          AND it is the CLOSEST overlapping target
```

| attack | startup | active | recover | cancel | dmg | reachX | reachZ |
|---|---|---|---|---|---|---|---|
| combo1 | 55 | 70 | 85 | 230 | 4 | 69 | ±33 |
| combo2 | 55 | 70 | 85 | 230 | 5 | 72 | ±33 |
| combo3 | 70 | 80 | 100 | 250 | 6 | 79 | ±33 |
| combo4 | 55 | 70 | 85 | 240 | 4 | 72 | ±33 |
| combo5 | 110 | 100 | 240 | — | 9 | 85 | ±37 |

⚠️ **THE FINISHER ALTERNATES, off the same button.** Row 6 is the same string
as row 5 through hit four and ends in a LOW LUNGING PUNCH instead of the
uppercut, so the two combos are one move with two endings. Chains intercalate —
uppercut, low punch, uppercut — and the player never chooses. `CONFIG.COMBO`
holds the shared hits, `COMBO_ALT_FINISH` the other ending, and
`Player._comboDefs()` flips ONLY when a chain begins, so a finisher cannot
change out from under a combo in progress. Both do 9 damage: alternating is a
look, not a rotation to track, and an ending that hit harder would make mashing
optimal on every other chain.

**FIVE HITS, because the coconut's own sheet has five.** The old three were
faked out of the main game's lift-and-throw poses. Hit 3 is the leaning punch
and hit 5 the uppercut — the two frames drawn bigger than the rest, so they
carry the damage and the reach. Hit 5 knocks down and LAUNCHES.

Full combo = **28**, held exactly where it was when the combo was three hits, so
no enemy's time-to-kill moved. Enemy HP: JUIXY 34, TOM 40, ERKPA 55.

Reaches shrank with `BODY_SCALE` (see below), not with the combo change.
Player 110 — **a multiple of 22**, so each of the life bar's 22 squares is
exactly 5 damage. Keep it a multiple.

`reachZ` is the difficulty dial of the whole genre: ~49px of depth slack on a
190px belt, about a quarter of it.

⚠️ **One active window lands one hit**, enforced by `hasHit` on the attack rather
than i-frames on the victim. A punch is a discrete event.

⚠️ **Hitstop freezes the simulation, not the renderer.** The loop keeps drawing
at full rate; it just stops advancing time. Skipping the draw would read as a
dropped frame rather than a held moment.

⚠️ **No screen shake.** Built, then removed by request — the effect is not
wanted. Hitstop carries the weight of a blow. It was deleted rather than zeroed
so it does not read as an unfinished feature and get "fixed" back in.

---

## The attack token

⚠️ **The single most important AI rule here, and it is four lines.** However many
enemies are on screen, only `maxAttackers` (2) may be committing at once. The
rest close in, hover at a stand-off and circle.

Without it, six enemies that each attack when in range all attack on the same
frame, the player is hit from three sides at once, and the game is not hard — it
is arbitrary.

⚠️ **The count is of TOKEN HOLDERS, not of swinging enemies.** A token is a
reservation taken when an enemy starts closing in and held through the approach,
the wind-up and the swing. Counting only visible attackers hands tokens to
everyone still walking, and then they all arrive together — the same pile-on,
delayed by the length of a walk.

Being hit releases the token, so the turn passes immediately rather than stalling
the crowd for the length of a stun.

---

## Rooms

A **room** is a place with its own footage, its own length, and its own rule
about which way the camera may go. The level used to be one flat list of
segments against one plate; the boss room made that insufficient.

| room | travel | plate | film | camera |
|---|---|---|---|---|
| `street` | 3424px | the 29.5s dolly | 100% | forward only |
| `boss-room` | 337px | a 5.2s clip | 100% | **both ways** |

Rooms hand over through the walk-out and a **fade**: the player leaves the right
edge, the screen goes black, and the room swaps **at the blackest point** —
shot, camera origin and player position all move unseen. Anything switched
before or after shows as a cut on one side of the fade.

⚠️ **`reverse` IS PER ROOM BECAUSE IT IS NOT FREE.** The camera can only run
backwards where the plate can be scrubbed backwards, and video cannot PLAY
backwards — no browser implements a negative `playbackRate`, so reverse means
seeking, and a seek decodes from the previous keyframe. The street's shot has
keyframes eleven seconds apart and could never do it. The boss room's clip is
re-encoded at a keyframe every THIRD frame for exactly this, which is what makes
a backward step cost three frames instead of hundreds.

⚠️ **THE BOSS ROOM'S SHOT HAD TO BE CROPPED, AND THE CUT WAS FOUND, NOT
GUESSED.** The source pans right for 5.2s, rests, then returns to where it
started; played whole it would walk the player into the room and then drag the
room back past them. `tools/build-boss-plate.py` locates the turn by phase
correlation — frame 156, t=5.206s, after 224px — and cuts at the PEAK rather
than at the end of the twelve-frame plateau after it. A plateau left in is
camera travel that shows no movement: the room would feel stuck against its own
wall.

⚠️ **A FIGHT CAN FOLLOW INSTEAD OF LOCK.** `lock: false` on an arena keeps the
camera trailing the player and gives them the whole ROOM as walls instead of the
current screen. The boss room is 337px of travel — locking it would leave
nowhere to move, and a camera that goes back and forth is the entire reason its
footage was cut to be reversible. Everything else about an arena is unchanged.

---

## The level

A sequence of segments, alternating walking and fighting — the genre's spine.

| # | kind | | film |
|---|---|---|---|
| 0 | scroll | to x2100 — **the opening passage, 1880px / 6.3s** | 42% |
| 1 | arena | JUIXY, TOM, ERKPA, **+ERKPA, JUIXY from behind** | |
| 2 | scroll | to x3300 | 77% |
| 3 | **sub-boss** | the Mosca Boss | |
| 4 | scroll | to x3690 | 88% |
| 5 | arena | JUIXY, TOM, **ERKPA behind**, TOM, **JUIXY behind** | |
| 6 | scroll | to x4092 | **100%** |
| 7 | arena | ERKPA, JUIXY, **TOM behind**, **ERKPA behind**, TOM | |

⚠️ **THE LEVEL ENDS ON A WALK, NOT A FREEZE.** Clearing the last fight no
longer stops the world and throws up the card. It hands to an `outro` phase: the
coconut walks out to the RIGHT under the game's control, the camera does not
follow him, and the CLEAR card comes up once he is `outroExitPad` past the edge.

Two details that are the whole feel of it. **Input is not read at all** during
the walk-out — this is the game taking the character back, not the player
happening to hold right, and a stray key must not steer or stop it. And **depth
is left exactly where the last fight ended** (`iz` is zero), so he leaves in a
straight line across the belt rather than drifting to some tidier lane.

The camera is deliberately not ticked in that phase: it would chase him and he
would never reach the edge. **The crowd IS ticked**, and that is not optional —
the fight ends the instant the last enemy's HP hits zero, which is BEFORE it has
fallen. Its knockdown arc, its landing and its fade all run off `update`, so
ticking only the player left the body that had just died hanging in the air
mid-fall for the whole walk-out.

⚠️ **THAT IS THE THIRD TIME THIS SHAPE HAS BITTEN.** A phase change stops the
world, and something that was mid-animation stops with it: the player's death
row froze on frame one, the end screens dismissed themselves, and now the last
corpse hung in the air. **When adding a phase that does not call `update`, ask
what was still moving when it started.**

⚠️ **THE LEVEL OPENS ON A PASSAGE, NOT A FIGHT.** There was a wave at x1080,
680px in — an inch of walking and the camera locked again, before the player had
any sense of moving through a place. It was removed and the two opening scrolls
merged. 1880px of uninterrupted travel now establishes the shot, the belt and
the walk before anything asks for a fight, and it spends 42% of the film before
the first lock.

⚠️ **THE LEVEL IS AS LONG AS THE FILM.** The shot is 29.5s and
`worldPxPerSecond` is 116, so it is worth 3424px of camera travel. The level
used to give the camera 2632 and stop, leaving the last quarter of the footage
unseen. The segments past the sub-boss spend the missing 792px, and the last
fight plays out against the final frame.

⚠️ **WAVES ARE FREE, SCROLLS ARE NOT.** An arena LOCKS the camera, so a fight
costs no footage at all — only walking moves the film on. The number of waves is
therefore unconstrained; only the scrolls between them have to add up.

⚠️ **`levelEndX` IS A HARD CEILING ON HOW MUCH SHOT CAN BE SEEN.** `camX` is
clamped to `levelEndX - GAME_W`, so at 4000 the level stopped 792px short
whatever the segments asked for. It is 4704 now.

⚠️ **The boss no longer ends the level.** It used to set `done` and return
'clear' directly, which made it permanently the last thing in the game and
silently ignored anything placed after it. It hands off like any other segment
now, and still ends the level when nothing follows.

⚠️ **Arenas carry no `camX`, on purpose** — each locks wherever the camera had
got to when the scroll handed over, which can never disagree with it. The camera
trails the player by focus + deadzone (~670px), so a lock naively set to the same
x the scroll ended at yanks the view most of a screen forward exactly as the
fight starts. Set it only to *frame* a fight deliberately — which the filmed
backdrop will want, since a locked shot is a composed one.

The camera locking **is** the message that a fight has started; every player of
this genre already reads it. That is why the arena walls are invisible.

⚠️ **THE CAMERA ONLY EVER MOVES BECAUSE THE PLAYER MOVED.** It used to ease
toward a target POSITION, and that is the wrong quantity: any time the player
was outside the deadzone — which is most of the time after a fight, since they
finish it wherever they happened to be standing — the camera set off on its own
and kept going while they stood still. After an arena unlocked that was up to
**572px of travel the player never asked for**, arriving as a lurch, and it
dragged the film along with it.

The framing error is now closed out of a BUDGET earned by walking FORWARD:
`camFollowGain` px of camera per px walked. Stand still and the camera is still.
A deadzone still sits around the focus point so a single step does not drag the
background.

⚠️ **`camFollowGain` IS 1.0 AND THAT IS NOT A ROUND-NUMBER DEFAULT.** At 1 the
camera matches the walk exactly, so the player's position ON SCREEN never
changes — wherever they are when they push the edge is where they stay, and
where they will be standing when the next arena locks. Above 1 the camera
outruns them to re-frame the shot, which sounds tidy and reads as the player
sliding backwards across the frame under their own feet. It was 1.8, and that
was the complaint.

⚠️ **Only FORWARD walking earns budget.** It was `Math.abs` of the movement,
which meant walking left also drove the camera right and the player's screen
position fell away twice as fast.

⚠️ **THAT ALSO MADE THE PLATE'S SEEK STORM STRUCTURALLY IMPOSSIBLE.** Camera
speed is now bounded by `walkSpeedX * camFollowGain` = 540px/s, which is 4.66x
of film — under `maxRate` and nowhere near `resyncS`. Camera motion can no
longer provoke a seek at all; only a genuine discontinuity like a restart can.

⚠️ **`lastPlayerX` MUST BE NULLED WHENEVER THE CAMERA IS NOT FOLLOWING.** The
budget is the distance walked since the last follow frame, and `_followCamera`
does not run while an arena is locked — so a whole fight's movement would sit in
that budget and buy exactly the lurch it exists to prevent. It is nulled on both
locks and on `reset()`, and re-seeds on the next frame.

---

## The Mosca Boss

STILL LIFE's sprites, read in place from `assets-v2/flying-dungeon/`. Two
findings inherited whole: the sheet is a **7-pose turn** (profile-left → head-on
→ profile-right), and **the flap lives across files** as `[0,1,0]` — not `[0,1]`;
the doubled A at the seam is what the artist's three-file cycle does. 01 and 03
are byte-identical, so only two load.

**Entrance, two beats, and the ambush is the good part:**

⚠️ **The entrance is a free demonstration of the boss's signature attack.** Still
Life's version enters at the player's own *height*; on a belt that becomes the
player's own *lane* — which makes the ambush geometrically identical to the
ground pass. So it performs that move once, at full speed, before the fight
starts and before it can be hurt. By the time it does it for real the player has
been shown exactly what it looks like and what it costs.

`flyBossAmbushDamage: 0` — it knocks you down and costs nothing else. An ambush
is by definition unwarned, and chipping health for that is the genre's cardinal
sin; but an entrance that passes harmlessly through is a screensaver. A knockdown
lands, is felt, cannot kill. Raise the knob to make it bite.

Then it cuts to above the arena and descends turning head-on (1.09s), so it is
already looking at you when it stops.

**Rotation: swoop, sweep, repeating — deliberately not random.** Learning the
pattern *is* the fight; a coin flip cannot be learned.

⚠️ **The ground pass is the move the belt exists for.** It charges the entire
arena width at floor level in one lane at 980px/s — faster than the player runs.
There is nowhere along x to stand and nothing to outrun; the only answer is to
step **out of the lane in z**. The lane is locked to the player's depth *at the
tell*, not at the charge, so they are shown which line is about to become lethal
and given the wind-up to leave it. It runs to the far edge and does **not** stop
on contact — a pass that ended on a hit would reward standing in it.

⚠️ **You cannot jump over the ground pass.** The vertical tolerance that lets you
jump a mook's swing is deliberately not applied to the boss: the answer is depth,
not height, and letting a jump beat it deletes the reason the move exists.

**Reaching it.** It hovers at 150 — above a standing punch, inside a jump's apex.
At `jumpHeight 85` and `verticalReach 70` the window is **136ms of the 620ms
jump** (22%), centred on the apex, `dy` closing to 65. You can punch mid-air.
Note the trade: at apex the *mooks* go out of reach.

⚠️ **SHRINKING THE CAST NARROWS THIS WINDOW, and nothing warns you.** The window
was 221ms at `BODY_SCALE 0.8`; taking the cast 10% down dropped the apex to 85
and the window to 136ms. `verticalReach` is deliberately NOT scaled by
`BODY_SCALE` — if it were, a small enough cast could not reach the boss at all
and the fight would quietly become unwinnable. The knob to reach for instead is
`flyBossHoverY` (150): **142 restores the old window at 0.72 scale.**

88 HP — a multiple of 22, so exactly 4 damage a bar square.

---

## The debug view (hold C)

⚠️ **Read this before judging a box by eye.** Collision is entirely in the (x, z)
floor plane; nothing has a height. A hurtbox is a footprint at a fighter's
**feet** while the sprite towers 152px above it — so over the side view a
*correct* box looks wrong. That is the projection, not the box.

- **Plan view** (top-left) is the authority: x across, z down, one fixed scale,
  every box the true rectangle the resolver tests. An overlap there IS an overlap
  in the maths.
- **Dashed + dimmed = right place, wrong height.** A plan view drops the y axis,
  so a hovering boss draws exactly where a reachable one would. Everything is
  measured against the player's altitude.
- **Condition readout** names which of the six tests failed — `miss: DEPTH
  (dz 61)`, `miss: i-frames`, `blocked: swing spent`, `overlaps, but not
  closest`, `CONNECTS`.
- **Magenta = where the player cannot stand**, with each band labelled with the
  knob that governs it.

⚠️ **Every box drawn comes from the same function the resolver calls** —
`debugHitbox()` and `hitbox()` both return `_attackGeom()`. An overlay that draws
a box other than the one being tested is worse than none, because it is believed.

---

## Packaging

`./package.sh` → `dist/` + `beatemup-dungeon-itch.zip` (**3.9 MB, 32 files**,
`index.html` at the top of the zip, which is itch's one hard requirement).

⚠️ **The copy list is DERIVED, not written in the script.**
`tools/build-manifest.js` evaluates `src/config.js` and `src/manifest.js` — the
same two files the game runs — so it cannot drift from what the browser asks
for. This is a direct answer to the flying dungeon's shipped bug: a folder was
added, its `cp` line was not, dev kept working because it read the repo, and
every packaged build went out **without fly sprites**.

**Add assets in `src/manifest.js`. `package.sh` needs no edit, ever.**

It also refuses to build on: a `src/*.js` missing from index.html's loader, a
missing required asset, a failed base rewrite (a `sed` whose pattern no longer
matches does nothing and says nothing), or any manifest file absent from `dist/`.

Two asset roots are **mirrored** into the build rather than flattened, so
sub-paths survive and the rewrite is two lines. Unlike the flying dungeon, the
gamepad mapping resolves under `ASSET_BASE` like everything else, so it needs no
third rewrite.

Embed settings: **1280×720**, fullscreen **on**, mobile **off**, autostart
**off** — see flying-dungeon/STATE.md for why each.

---

## Bugs whose causes are not guessable

⚠️ **A missing config knob made the boss invisible.** `flyBossTurnMs` was
undefined; it divides into the turn rate, so `facing` went NaN → the pose index
went NaN → `MOSCA_RECTS[NaN]` was undefined → `draw()` returned early. The
**shadow kept working**, because it never reads `facing`. `poseIndex()` now falls
back to head-on if facing goes non-finite, turning that into "the boss will not
turn" — visible, and it points at the cause.

⚠️ **`jumpHeight` as a shadow reference broke on anything that flies.**
`drawShadow` normalised altitude by the *player's* 94px jump. The boss's descend
beat sits at 620 → scale `1 − 6.6×0.35 = −1.3` → **negative ellipse radius**,
which throws. It threw in the shadow pass, which runs *before* the sprite pass,
so no fighters and no HUD were drawn — and the exception escaped `loop()` before
scheduling the next frame. One bad radius froze the game. There is now a separate
`shadowLiftRef` (240) and a clamp.

⚠️ **THE BACKDROP WENT BLACK IN FIREFOX AND FROZE IN CHROME, at the exact
moment the GO arrow appeared. One cause, two symptoms, and neither is the
video's fault.**

When an arena hands over, the camera unlocks and yanks forward to re-acquire the
player — up to **572px in one movement, which is 4.93s of film**. `resyncS` was
0.75s, so the plate decided it was too far out of step to catch up by playing
and SEEKED. The camera then kept moving for another half second, so it seeked
again on the next frame, and the next: **each seek cancelled the one before it
and no frame was ever decoded.**

A video mid-seek has no frame to give. `drawImage` on it is a **silent no-op** —
so the plate painted nothing, the canvas kept the `#0b0714` it is wiped with
every frame, and the backdrop was black. Chrome holds the previously decoded
frame instead of nothing, so the same storm read as the shot freezing. The
divergence between the two browsers is the whole reason this looked like two
bugs.

Three changes, in order of importance:

1. **Never issue a seek while one is in flight** (`if (!v.seeking)`). This is the
   actual fix; the storm cannot form.
2. **`resyncS` raised to 6s**, above the size of that yank, so a handoff is
   absorbed by playing fast — the shot whips forward, which is what the camera
   is doing anyway. `maxRate` 10 closes the 4.93s gap in about half a second. A
   seek is now reserved for a genuine discontinuity, like a restart.
3. **A kept copy of the last good frame.** Whatever else goes wrong — a
   buffering stall, a seek that takes its time — the worst the plate can now do
   is hold a frame. It is captured at the start, before a seek, and on pause,
   never every frame.

⚠️ **THE BOSS ROOM FLASHED ITS FIRST FRAME AT THE END OF THE ROOM.** Walk to
the right-hand wall, nudge right again, and the shot cut to its opening frame
for a few frames before snapping back.

**`play()` ON AN ENDED VIDEO RESTARTS IT FROM ZERO.** That is the whole bug. The
plate had run to the end of the clip, so the element was `ended`; the next
forward nudge called `play()` to track the camera, the browser rewound it to 0
and started playing, and the resync only noticed a frame or two later — long
enough to see the room's beginning. An ended video is now moved with a SEEK,
never with `play()`.

It should not have reached the end at all, and that was the second fault: the
playback rate was floored at 0.1, so a shot that had already caught up with the
camera kept inching forward until it ran off the end of the clip. It now PAUSES
when the computed rate goes non-positive. In a big room that creep is invisible;
in a small one, where the camera crosses the whole shot, it happens every time
the player reaches the wall.

⚠️ **THE GO ARROW LIED, TWICE, AND BOTH WERE THE SAME LINE IN THE WRONG PLACE.**

The prompt is set when a fight clears and lasts `goMs` (2.6s). It was set
*before* asking what came next, and nothing ever took it down early. So:

- **It pointed the way out of a fight the player was locked into.** The walks
  between the post-boss fights were 260px — under a second — so the arrow was
  still on screen when the next arena penned the player in. They read "GO",
  walked into an invisible wall, and then the camera moved "out of nowhere" when
  the wave they had not noticed was finally cleared.
- **It appeared over the end of the level.** Clearing the LAST arena still set
  the banner, pointing onward at nothing.

Fixes: locking the camera sets `banner = 0`, because the arrow means the way is
OPEN and the moment it is not, it goes; and the banner is only set when
`_enter` did not return 'clear'. The post-boss stretch was also rebuilt from
three cramped 260px walks into two of ~400px, with the extra enemies moved
INSIDE the fights as staged `delayMs` arrivals — which cost no film, because an
arena locks the camera.

⚠️ **THE END SCREENS DISMISSED THEMSELVES, and no input was involved.**
"press anything" was already satisfied before it was drawn. `_anyPress` is set
by every keydown of the whole fight, and the ONLY consumer is the end screen's
own `takeAnyPress()` — so by the time the boss died the flag had been true for
minutes. The instant the screen's delay expired, the restart fired.

`input.flush()` existed for exactly this, with a docstring describing it, and
was only ever called on entering PLAY. It is now called on entering `clear` and
`dead` too, via `endScreen()`. The symptom looks like a timer bug and is not one
— the delay was working perfectly, and the press it was waiting for had been
queued since the first punch of the level.

It also silently defeated `deathHoldMs`: the death screen held for its full
2040ms and then dismissed itself anyway.

Both were one-line assumptions that held until something new arrived. Worth
grepping for others of the same shape — a flag with many writers and one
reader is the shape to look for.

---

## Open

- **The backdrop is IN** (see above) but unjudged in motion — the belt sits at
  520 from a measurement, not from play. Hold C: the magenta bands are the
  no-walk regions, each labelled with the knob that resizes it.
- **Villain sheets.** TOM, JUIXY and ERKPA are still the main game's 9×5 packs
  read as punches. Until they are redrawn, `sheets.js` has to carry two formats
  and the grid path cannot go.
- **The lift mechanic is HALF WIRED.** The button exists (L/E, pad B), the
  `pickup` state exists, and BOTH animations are wired and chosen by weight —
  `pickGround` (row 9, a stoop) for a light thing, `lift` (row 7, a hoist) for a
  barrel. What does not exist is anything to pick up. `Player._liftTargetHeavy()`
  is the entire seam: it returns false, so the stoop always plays. Objects,
  carrying (`carryWalk`, row 10) and throwing (`liftThrow`, row 8) are still to
  do.
- **Cut but unwired.** `airPunch` (row 4) has no jump-attack state. It is cut,
  named and mapped in `POSE_RAGGED`, so it is a wiring job rather than a trip
  back to the illustrator.
- **No sound at all.** The flying dungeon's `sound.js` is the model.
- **`Escape`/`P` are captured but do nothing** — `takePause()` exists, no pause
  state does.
- **The font.** Futura is not bundled; the stack falls through geometric sans.
  Same open decision as the other two games.
- **Enemy variety.** All three villains differ only in speed, HP and damage —
  they share one AI and one swing. A grappler or a thrower would need
  `Enemy._think` to branch.
- **The impact FX is drawn in code** (a starburst), honestly placeholder. There
  is no impact art in any Saborosa pack yet.
- **Enemy bars stay plain slabs.** The hand-drawn bar is 11 inked squares in a
  333px frame; at the ~50px a floating bar occupies they turn to mush.
