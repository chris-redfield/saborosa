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

## Where this got to on 2026-08-18

A long session. Everything below is the detail; this is the map of what moved,
so a fresh reader knows which sections are new.

**The coconut got its own sprite sheet** and stopped borrowing the main game's.
13 illustrator rows, ragged (not a grid), per-frame anchors, and the game went
from six facings to **two**. The combo went from three faked punches to a real
five, and the two combo rows now intercalate off one button — uppercut, low
punch, uppercut. See *The sprites* and *Combat*.

**The filmed backdrop landed and is the plate.** It is the mp4 itself, projected
behind the fighters and scrubbed by the camera. A stitched panorama was tried
and **rejected — do not re-propose it.** See *The one constraint*.

**The level became rooms.** The street runs the whole 29.5s shot; the Mosca
became a **sub-boss** mid-street; and a **boss room** follows it through a fade,
with its own 5.2s clip cut at the pan's turn and re-encoded so its camera can go
**both ways**. See *Rooms*.

**The camera was rewritten** to move only because the player moved. See *The
level*.

**Dev mode exists and is ON.** 50 damage a punch, number keys jump rooms,
`package.sh` refuses to build. See *Open*.

**Six bugs, all documented** in *Bugs whose causes are not guessable*, and five
of them are the same shape: something was mid-state — playing, falling, seeking,
queued — when the thing driving it changed underneath. That is the family to
suspect first in this codebase.

---

## And then on 2026-08-19

The villains, and the screen that ends the level.

**TWO VILLAINS WITH ART OF THEIR OWN, and the cast is nearly redrawn.** JUIXY
and TOM are gone; **CIGARRO** and the **stub** — a pair of cigarettes, 8 rows
each — took their waves and their stats, so no fight's time-to-kill moved when
the art did. Only ERKPA is still on a borrowed main-game pack. See *The sprites*.

**THEY FIGHT DIFFERENTLY FROM ANYTHING BEFORE THEM.** They throw a three-hit
STRING rather than a single swing, and they JUMP IN — the first enemy in the
game to leave the floor. Both are per-kind data, so ERKPA is untouched. See
*The enemy combo* and *The jump-in*.

**THE SMOKE REWROTE THE CUTTER.** It sizes nothing, anchors nothing, and on the
second sheet it welds frames and bridges rows — so the sheet is now cut on
BODIES found by connected components, not on empty pixel rows and columns. Three
separate rules for "which frame does this wisp belong to" mangled the atlas
without ever failing. See *The sprites*.

**THE LEVEL ENDS ON A BOARD**, not the word CLEAR: hits, accuracy, damage both
ways, time and enemies downed, counted up over 4 seconds and stamped with a
rank. `src/stats.js` is new. See *The CLEAR board*.

**Seventh bug in the list, and it is a new shape** — an early `return` out of
`loop()` that never scheduled the next frame. Everything else in that list is
something changing under a value already read; this one is the loop simply
stopping. Worth knowing both shapes exist.

---

## And then on 2026-08-21

Sound, a front door, and the bugs.

**THE GAME MAKES NOISE NOW, and it is three separate systems.** A looping
background bed, one-shot hit effects, and the tooling that cut both out of raw
phone recordings. See *Sound* below. `M` mutes everything, in every phase.

**IT OPENS ON A TITLE SCREEN.** The flying dungeon's, borrowed whole — its
crawling vermin as a backdrop with the SABOROSA logo over them, any button to
start. See *The title screen*.

**THE CAST TURNED OVER AGAIN, TWICE.** CIGARRO3 arrived and took ERKPA's waves
and stats, which retired the last borrowed main-game pack; then the **BARATAS**
arrived and took the whole stretch after the sub-boss. See *The sprites* and
*The barata charge*.

**THE ENEMY BRAIN BRANCHED FOR THE FIRST TIME.** Every fighter before the
roaches ran one loop — approach, circle, wind, commit — and differed only in
numbers. The charge cannot be expressed in it, because it ends with the enemy
*leaving the fight*. See *The barata charge*.

**AND THE PUNCHES LEAVE A MARK.** `effects-porrada-01.png` arrived at the end of
the day and the code-drawn starburst is gone. Six four-frame bursts, one picked
at random per blow. See *The impact burst*.

**AND THE GAME HAS A FINAL BOSS.** A HORSE, in the boss room, after the wave
that already lived there. Five rows of art, no damage frames at all, and a
moveset that is exactly what was drawn. See *The horse boss*.

---

### Sound

Three pieces, and they were built in this order because each needs the one
before it.

**The music is ONE FILE, ONE LOOP, NO MIXER.** `trilha-mix.ogg`, 6.146s,
seamless. It is three of five recorded takes layered and aligned in
`tools/beat-music-lab.html`. The game does none of that layering: three
`<audio>` elements started together drift apart within a minute and the browser
gives no way to bind them, which is the flying dungeon's finding inherited
whole. Playback is `AudioBufferSourceNode`, not `<audio>`, because the latter
can drop a few ms at the wrap — inaudible on a song, fatal on a six-second bed.

⚠️ **`musicLoopSec` IS LOAD-BEARING.** `loop = true` with no bounds wraps at
whatever the decoded buffer turned out to be, and decoders disagree about an
Opus file's length by a few ms of codec padding — this file's container claims
6.1525s for 6.1460s of music. Left alone that is six milliseconds of silence
inserted every six seconds: an audible tick you would go looking for in the
music rather than in the decoder. `loopStart`/`loopEnd` are pinned to the
config number instead.

**The shipped track came from the tool's `export wav`, NOT from the bake
script**, and that is an open sore. `tools/bake-beat-trilha.py` exists, reads
`DEFAULT_MIX`/`DEFAULT_MASTER` out of the lab the way `bake-trilha.py` reads
`music-lab.html`, and **does not reproduce the browser's render**. What is
known: pass SPACING agrees exactly (2223.5ms for tchum 4, 2093.5 for tchum 3),
pass COUNT was wrong once and is fixed (see PASS_EPS), and a least-squares fit
of the export against the script's own layers still leaves about three quarters
of its energy unexplained with tchum 3 fitting at −19dB where it should be 0.
The likeliest suspect is decoded CONTENT rather than placement — ffmpeg and a
browser disagree about where an Opus stream starts as well as how long it is.
Until that is chased down the bake writes `trilha-mix-baked.ogg`, deliberately
NOT the shipped name, so a re-run cannot quietly replace an approved mix.

**PASS_EPS, and the bug that produced it.** The repeat generator emitted a
second full pass of the bed 13ms before the loop end, because ffmpeg hands out
6.133s of PCM where the container says 6.1465 — so six seconds of bed wrapped
onto the head and doubled against itself out of phase. Both the lab and the
bake now treat a pass starting within 30ms of the loop end as the *next*
cycle's first pass. 30ms is far larger than codec padding and far smaller than
any gap a person would place deliberately.

**The effects are CUT, not played whole.** `single-hit.ogg` is 2.17 seconds and
the hit is 300ms of it starting at 958ms; played raw the punch lands a second
before you hear it. `tools/build-beat-sfx.py` finds the events in a take and
lifts one out. ⚠️ **Its gate is set two ways and the stricter wins** — a floor
+ margin rule alone failed on the very first file, because that take holds both
room tone at −61dB *and* a stretch of digital silence at −92, so the floor read
−69, the gate landed under the room tone, and 900ms of room tone counted as the
sound. The gate is also held within 40dB of the file's peak.

**The finisher is its own recording.** `combo-1-4-hits.ogg` is three ordinary
punches and a different sound at the end; the last event lifts out cleanly on a
75ms gap. It correlates at −0.00 with `single-hit` — a genuinely different
sound, not a louder punch, which is why it is its own clip rather than a pitch.
`Fighter.attack()` stamps `last: i === defs.length - 1` on the attack when it
starts, because that is the only moment the string and the position in it are
both known; a frame later `comboIndex` survives but the array it indexed does
not.

⚠️ **Ordinary hits are DETUNED per link, the finisher is not.** The rising pitch
exists to stop four copies of one sample reading as a stuck record. The finisher
is heard once against three that were not it, so there is nothing to tell it
apart from.

⚠️ **A clip cannot be made louder by re-cutting it.** The cut effects are
normalised to −1 dBFS, so a hotter render is a flatter one. `SFX_GAIN` is a
playback trim per effect, and Web Audio has the headroom the file does not.
At `sfxVolume` 0.9 × 1.2 the finisher sits at −0.27 dBFS: 3% of headroom left.
Past about 1.3 it clips against the music instead of getting louder, and the
thing to turn down at that point is `musicVolume`.

### The title screen

`src/title.js`. The flying dungeon's three crawling-vermin frames as a
full-bleed backdrop with the SABOROSA logo over the middle; any button, keyboard
mouse or pad, fades to black over 600ms and hands off to the fight.

**Both images are read IN PLACE** out of `assets-v2/flying-dungeon/` — the same
frames its endings crawl on and the same logo its finale lands on. Two copies of
a picture drift the moment one is recut. The crawl frames go through the `big`
loader, not `image`: they are 3002px wide drawn at 1280, and handing the GPU
that full-size texture is the VRAM thrash PERFORMANCE.md already records once.
The holds (105ms, cycling 1·2·3) are that game's, tuned in its own tool.

⚠️ **`boot()` SCHEDULES THE FIRST FRAME ITSELF NOW and must not also call
`start()`.** `start()` schedules a frame of its own — that is the contract every
caller inside `loop()` depends on — so doing both leaves TWO
requestAnimationFrame chains running the same loop, and the game runs at double
speed with every `dt` halved. It would read as a physics bug and would not be
one. This is the same family as the CLEAR board's early `return`.

### The barata charge

The roach curls into a ball, rolls at the player, and **leaves the screen**. A
beat later he walks back in from the side he vanished off.

**IT IS BUILT AS AN EXIT, NOT A DASH, and that is the design.** A charge that
stops next to the player is a fast approach with a hitbox on it, and it leaves
him standing in punching range — which makes the biggest move in his repertoire
the safest thing he can do. Running him off screen costs him his place in the
fight: the crowd is one shorter while he is gone, and the player has bought
several seconds by stepping out of the lane.

**IT IS DODGED IN Z, NOT IN X.** The direction is latched on the tell and never
corrected — the jump-in's rule. ⚠️ **The trigger has no `dz` test on purpose.**
The leap checks depth because it is aimed AT the player; the charge is a line
down the lane he is already in. Adding a depth condition would quietly turn it
into a homing attack that only fires when it is already going to hit, so
`chargeReachZ` is the real difficulty dial.

**The tell is the attack's own `startup` window**, so the curled drawing and the
harmless window are the same thing by construction and cannot drift apart. That
is also why the ball is ONE pose of five frames rather than two poses.

⚠️ **The ball spins on a clock — the only attack pose that does.** Attack frames
normally read off the three phases (startup → 0, active → 1, recover → last) so
a punch's picture can never drift from the window that can hit. A charge is one
long active window lasting until he leaves the screen; read off the phases it
would hold a single frozen drawing the whole crossing — a ball sliding, not
rolling.

**Three bugs found building it, all worth keeping in mind:**

* **A roach punched out of its roll was teleported off-screen by a jab.**
  `Fighter.hurt` clears `atk`, and losing the attack looked identical to having
  crossed the wall. He drops back to `approach` now, so reading the tell and
  stepping IN is a real counter.
* **The crowd handed the attack token to roaches that were off-screen**, where
  it sat unspendable — their branch only counts down — while the enemies still
  fighting waited for a turn that was never coming. `gone` is skipped like
  `enter`.
* **Enemy hits had `lift` and `knockdown` hardcoded to `0, false`** in
  `combat.js`; no enemy attack in the game could put the player on the floor.
  They are read from the def now. Not one cigarette punch sets either flag, so
  every existing swing behaves exactly as it did.

### The horse boss

The boss room's occupant, decided 2026-08-21 after being open since the room was
built. **The wave stays and the boss comes after it** — clearing the three mooks
is what brings him out, so the room is now an opening and a finale rather than a
placeholder.

**THE ART DECIDED THE FIGHT.** Five rows arrived, named by the illustrator in
one line: *ataque correndo*, *trotando*, *caminhando*, *coice*, *parado
virando*. So the moveset is a run-attack, a trot, a walk, a backward kick and a
turn, and nothing else. He closes at a trot, charges the length of the room, and
kicks anyone who gets underneath him. No move here is invented.

**HE ARRIVED AT 27329x7922 AND 18MB.** Reduced to a quarter in place by the new
`tools/shrink-master.py` before anything else touched it — 3.2MB, and the frames
still come out at ~280px, which is the ceiling on how large he can ever be
drawn. Cropping the dead canvas was worth 0.8MB of 18; the size is the drawn
pixels and scale is the only lever.

**HE IS NOT AN `Enemy`, AND THAT IS NOT LAZINESS.** Every villain in the game is
one `_think` — approach, circle, wind, commit — with different numbers. A horse
does not circle, its main attack crosses the whole room and ends at a wall, and
coming about costs it half a second. The barata's charge already forced that
loop to branch once; this would have been a second, deeper branch for an animal
that shares none of the assumptions. It is its own class answering the same
interface, exactly as `FlyBoss` is.

**⚠️ THE TURN IS THE FIGHT.** Everything else in this game changes facing with a
negative x-scale, for free. He plays a seven-frame rotation — left profile,
head-on, right profile — and can do nothing while it runs. **Getting behind him
is the whole strategy**, and `turnMs` is therefore the most load-bearing number
in `HORSE_BOSS`: shortening it makes him harder in a way no other knob does.

That row is also the one piece of art in the game that **must not be mirrored**.
It already contains both profiles, so flipping it folds the rotation in half and
he appears to turn back the way he came. `HorseBoss` draws it by passing the
pack's own native side as the facing, which is how you say "leave this alone"
without `sheets.js` needing to know what a turn is. The same trick gives him an
idle: he has no idle row, so he stands in frame 0 or frame 6 of the turn.

**⚠️ THE KICK LANDS BEHIND HIM.** `coice` is a hind-leg kick, so its box is on
the opposite side to every other attack in the game — which is what makes it the
answer to a player who has walked round the back. Measured, not assumed: frames
5-7 reach **-189, -281 and -300px** from the ground anchor while the front of
the frame pulls in to +84.

**⚠️ AND THAT MEASUREMENT CAUGHT A REAL BUG BEFORE IT SHIPPED.** The kick's
reach was first written as 132 by eye. The hooves reach 300. That is precisely
the failure the cigarettes' strings still have — see the section above — and the
only reason it did not happen again is that the frame extents were printed
*before* the number was chosen. **Do not write a reach without printing the
extents of the row it belongs to.** It is now 260, which also has to clear
`kickRange` (210), the distance he commits from.

**THE ROOM'S WAVE IS ALL COCKROACHES** (2026-08-21). It opened with three
cigarettes, inherited from when it was placeholder. The baratas own the whole
stretch after the sub-boss, so the run now arrives here already in roach country
and the boss room reads as the end of that stretch rather than a reprise of the
street's gang.

**⚠️ HOW HE CHOOSES WHAT TO DO, AND THE FOUR WAYS IT WENT WRONG FIRST.** The
shape that works: **distance decides what is in the hat, a roll decides what
comes out of it, and there are THREE actions, not two.**

    gap >= chargeMinRange (240)  ->  roll: charge  or approach
    gap <  chargeMinRange        ->  roll: kick    or approach

`approach` is him closing the distance, or giving himself room, committing to
nothing. **It is the reason there are three actions:** with only charge and
kick, every roll taken at range was a charge and the fight was one move on a
loop. The user asked for it in those words — *"he should also try to approach
you normally"*.

Everything that went wrong went wrong the same way: **the move was chosen by
geometry that his own movement then destroyed.**

1. *Distance picked the move outright.* He trots at you at 200px/s, so by the
   time the check ran he had closed 300px and was never far enough — he had to
   START 620px out. The charge fired about once a fight, and the user reported
   it as never happening, which was very nearly true.
2. *A pure roll, with a back-off to manufacture range.* A player who stays close
   follows him as he retreats, so the range never arrives. **0 charges in three
   minutes.**
3. *Roll inside a distance band, but with `chargeMinRange` at 320.* He settles
   at 210-300 after any approach or kick, so the band was almost never entered.
   Starved again.
5. *And then the opposite failure.* With the threshold at 240 and every approach
   settling at a fixed 300, EVERY walk-up left him able to charge, and the fight
   came out `walk > CHARGE > walk > CHARGE > walk > CHARGE`. The user's words:
   *"he walks towards you for a while, then immediately starts charging."* A
   walk that always ends in a charge is not movement, it is a tell -- which
   destroys the reason the approach exists. Two things fix it: the settle
   distance is **rolled across a band that straddles `chargeMinRange`**
   (165..340), so you cannot read the walk-up; and a **`chargeCooldownMs`**
   keeps the charge out of the hat for 2.4s after a pass, so something else has
   to happen in between.
4. *An approach that could only close.* Then nothing ever opened the gap, and
   after a charge he landed in the pocket between the wall and the player —
   median 36px away, permanently walled, kicking forever. He now walks to a
   **standoff spot** (either side of the player, nearest one that is inside the
   room), which in a corner means walking PAST them to get his room back.

Two more that were pure thrash, both found by counting rather than watching:
**idle used to turn him toward the player before an approach**, which then
turned him back to travel — 45% of the fight spent pirouetting. And **the
standoff spot was recomputed every frame**, so it flipped as he crossed the
midpoint and he flapped between the two: 78% turning, one kick in four minutes.
Whoever moves picks the facing, and a destination is chosen once.

⚠️ **A clamp bug hid inside all of this.** A charge deliberately overruns the
player's walls, so he finishes a pass outside them; the next phase clamped him
back to the wall — onto the player he had just charged past. `_limits()` is now
the one set of bounds every moving phase uses.

⚠️ **AND THE MEASUREMENT ITSELF WAS WRONG TWICE.** Counting phase entries
overcounts approaches, because a turn taken mid-approach re-enters the phase --
that read as "73% of approaches are followed by another approach" when the real
number was 50, exactly as configured. **Count at the DECISION.** The other
miscount: an approach whose rolled target landed where he already stood ended on
its first frame and re-rolled, so two thirds of the fight was a horse shuffling
on the spot. `approachMinTravel` is the floor under that.

6. *And the last one was the relationship itself being backwards.* Past the
   threshold the charge's weight was FLAT, so 250px and 900px were the same
   roll -- and with the cooldown on top, a RETREATING player saw fewer charges
   than one milling about nearby. The user caught it from the table: *"it should
   be half of when he is away, not the opposite."* A gate says whether a move is
   allowed; it cannot say that a move gets more attractive the further you are.
   That needs a **ramp**: the weight rises from `chargeNearWeight` at the
   threshold to full at `chargeFarRange`, and the cooldown relaxes across the
   same span (`chargeCooldownFarScale`) so it stops fighting the ramp out where
   the charge is the obvious answer.

⚠️ **AND ONE MEASUREMENT SCENARIO WAS A LIE TOO.** The row labelled "keeping
distance" pinned the player in a CORNER, which lets the horse walk into the
pocket beside them -- so it was really testing a cornered player, and only 17%
of his decisions in it were taken at charge range. Modelling an actual retreat
(run toward whichever wall is further from him) inverted the result. **Name a
scenario after what it does, not after what you meant it to do.**

Measured after all of it, over thirty simulated minutes each, counted at the
decision. Charge odds against the distance he decided from -- which is the
relationship that matters:

| distance at the decision | chance he charges |
|---|---|
| under 240px | 0% (kick instead) |
| 240-360px | ~20% |
| 360-520px | ~45% |
| 520px+ | ~50% |

| player | charge | kick | approach | charge every |
|---|---|---|---|---|
| running away | 35% | 11% | 54% | 7.9s |
| moving around | 22% | 27% | 51% | 11.1s |
| glued to him | 0% | 53% | 47% | never |

The last row is the design, not a bug: inside 240px he kicks, and the kick moves
you only 70px (`knockback / knockbackDecay`), so hugging him is a real choice
with a real answer.

**THE GENERAL LESSON, and it is worth more than this fight:** a weighted choice
is a lie if the thing it picked can be silently vetoed downstream, and a
distance condition is a lie if the character's own movement destroys it. Also:
**count the actions, do not watch them.** Every one of these was described
confidently before it was measured, and every description was wrong.

**HE TAKES DAMAGE WITH NO DAMAGE ART.** No hurt, no knockdown, no death row —
confirmed by the user rather than assumed missing, and the Mosca has the same
gap. A hit reads as an additive flash plus a blink, with the new impact burst
stamped on top. Death is drawn rather than animated: he tips over and fades.
**Do not press a movement row into service as a hurt pose** — a horse that trots
when you punch it reads as a horse ignoring you.

**FOUR THINGS THE WIRING GOT WRONG FIRST, ALL SILENT:**

* **Boxes in this game are EDGES (`x0/x1/z0/z1`), not centre-and-half-extent.**
  Written the other way, `overlaps()` compares against `undefined` and answers
  false forever: the boss simply cannot be punched, and it presents as a
  hitbox-tuning problem.
* **`combat.bossHits()` sets `boss.hasHit`, on the instance, not on the
  attack.** Gate the box on `atk.hasHit` instead and the flag lands on an
  unread property — the charge then damages the player *every frame* it
  overlaps them.
* **`sheets.draw()` takes a POSE, resolved through the pack's pose table, and an
  unknown pose falls back to `idle`.** This pack has no idle, so the fallback
  lands on frame 0 of the first row — every pose, forever, without an error.
  His five rows are declared as five identity poses for exactly that reason.
* **`sheets.rect()` CLAMPS the frame index, it does not wrap.** A free-running
  millisecond counter rides up to the last frame of the walk and stays there: a
  horse frozen mid-stride while sliding along the belt, which looks like a
  physics bug and is not one. Every looping row wraps against `poseLength`.

And one that was not silent, just wrong: **a turn has to know what it is FOR.**
It first always handed back to `idle`, so the kick — which needs him facing
*away* — could never happen. He closed in, turned his hindquarters to the
player, went to idle, idle turned him back, and he trotted in again. An infinite
pirouette that never threw a kick. `_face()` now takes the phase to enter when
the turn completes.

---

### The impact burst

`effects-porrada-01.png` is the first piece of impact art the project has had,
and it replaced the four-spoke starburst `combat.js` drew in code. That shape
carried a comment saying it was placeholder and that a shape drawn in code is an
honest one where a borrowed sprite would quietly become permanent; the comment
did its job, so it went with the shape.

**THE SHEET IS SIX ANIMATIONS, NOT EIGHT.** It arrives as an 8x3 grid, and the
first reading — three frames down a column — is wrong. The animation runs ALONG
a row, inside one colour block: the star is solid, then a hollow outline, then a
broken one, then a scatter of dots, and it GROWS about 40% while it does it.
Measured before anything was built: fill ratio falls 0.46 → 0.21 → 0.14 → 0.08
left to right while the bounding box goes from 236px to 342px. That is a burst
dissipating. Down a column nothing progresses at all — the three rows are simply
three different drawings, and the right-hand half of the sheet is the left-hand
half recoloured (all twelve pairs have identical bounding boxes). So: three
stars, two colours, four frames each.

**ONE IS PICKED PER BLOW, AND THE PICK IS REMEMBERED.** That is the whole point
of having six — the placeholder stamped the identical mark on all five hits of a
combo. The choice is made in `Combat._impact`, when the blow lands, and stored on
the impact event; rolling it inside the draw would cycle all six inside a fifth
of a second and read as static rather than variety. A random horizontal mirror
rides along with it, which covers twelve marks with six animations.

**THE COLOUR IS PART OF THE RANDOM DRAW, AND THAT IS A DECISION THAT CAN GO
EITHER WAY.** As shipped, all six are in the hat whoever is being hit, which is
what the art was asked for. `CONFIG.HIT_FX.colorByRole` makes the colour carry
information instead — yellow when the player lands one, red when the player takes
one — which is the convention most of the genre uses. Both are one line; it is a
look-and-feel call and those are the user's.

**THE BURST IS DRIVEN BY THE IMPACT EVENT'S OWN CLOCK, WHICH FREEZES DURING
HITSTOP.** `combat.tick()` is not called while the simulation is held, so the
solid first frame — the one with the most ink in it — is held for exactly as long
as the picture is, and the dissipation starts when time restarts. That was free
rather than designed, but it is the right behaviour and it is worth not breaking:
if the FX ever grows a clock of its own, it loses this.

**⚠️ THE THREE STARS KEEP THE SIZES THEY WERE DRAWN AT — 236x276, 210x238 and
201x195 — AND THE PACK HAS ONE SHARED `baseSize`.** Every frame of every variant
scales by the same factor, so both the growth across a burst and the spread
between the variants arrive intact.

It was built the other way first: one reference per animation, normalised on
sqrt(w*h), so all three read at one apparent mass — reasoning that the variant
the dice picked should not change how big the hit looked. The user stopped it.
**Art is wired as it was drawn; do not rescale it to even it out.** The effect
is real, but whether the spread is wanted is a question about the art, not a
normalisation applied quietly on the way in. The same rule is why the horse's
atlas draws at 1:1.

**SIZE COMES FROM THE BLOW.** `HIT_FX.sizePx` for an ordinary hit, `bigSizePx`
for a finisher and for everything the Mosca lands, both `* BODY_SCALE` like the
fighters. At the shipped numbers the ordinary burst peaks at about two thirds of
a fighter's height and the finisher at about all of it, stamped at
`chestRel` (0.42) of the way up the victim — the height the placeholder used, so
the art landed where the shape it replaced did.

### ⚠️ THE CIGARETTES HAVE NEVER LANDED HIT 2 OR HIT 3

Found on 2026-08-21 while fixing the barata's reach, and **not fixed**, because
fixing it rebalances three enemies at once.

An enemy swings from `enemyStandoffX` — 63.4px — and **does not step in between
the hits of a string**: the `combo` branch throws the next hit from exactly
where it stood. Knockback decays exponentially at `knockbackDecay` 6, so a blow
of k moves the player k/6 px. Every hit therefore has to reach far enough to
cover the gap its own predecessor opened, and no cigarette's does:

| | hit 1 | hit 2 | hit 3 |
|---|---|---|---|
| CIGARRO | +2.9 | **−15.5** | **−22.3** |
| CIGARRO2 | +2.9 | **−18.8** | **−28.9** |
| CIGARRO3 | +2.9 | **−20.5** | **−32.3** |
| BARATA | +11.5 | +4.0 | +3.7 |
| BARATA2 | +11.5 | +3.2 | +4.9 |

The stand-off tolerance is ±14px, so the smallest miss cannot be closed by
where the enemy happened to stop. **Their strings are animation only past the
first punch.** Which means the damage table is fiction: CIGARRO's advertised
3 + 3 + 5 = 11 has always been 3, and the whole "the damage is spread, not
added" argument — the thing every string in this file was designed around —
has never actually reached the player.

It also means the fight economy has never been judged, even with dev mode off:
what was played was one-hit enemies wearing three-hit animations.

**Three ways to fix it, and they are not equivalent:**

1. **Drop mid-string knockback** to near zero and leave the finisher launching.
   This is what the baratas now do and it is the genre-standard answer — a
   flurry should not shove you out of itself. Cheapest, and it changes how the
   cigarettes FEEL the least.
2. **Grow the mid-string reaches** to cover stand-off + push. Keeps the shove,
   but the fists visibly outrun the reach already (see *Scale*), so this makes a
   known problem worse.
3. **Let the enemy step in between hits.** Truest to the genre and the biggest
   change: it turns a string into a pressure tool that follows the player.

Whichever is chosen, **every enemy's damage per turn roughly triples**, so the
HP table and `maxAttackers` want re-reading straight afterwards.

### The silent-config trap, and it will happen again

⚠️ **AN ENEMY WITH A STRING IN `ENEMY_COMBOS` AND NO ENTRY IN
`enemyComboWeights` THROWS EXACTLY ONE HIT, FOREVER.** `Enemy._rollCombo`
returns 1 when the kind is missing. Nothing errors, nothing warns, and it reads
in play as "that one does not have a combo" — which is exactly how it was
found, by the user asking why CIGARRO3 only hit twice. **Adding a kind means
adding it in BOTH tables.**

### Scale, and why `drawScale` keeps moving

Both cigarettes went up 45% over three requests and the roaches 89%. Worth
knowing what that number does and does not touch:

⚠️ **`drawScale` IS DRAWN SIZE ONLY. Hurtboxes and reaches do not follow it.**
`ENEMY_COMBOS` still swings the 92/92/108 × BODY_SCALE the cigarettes had when
they were drawn a third smaller. Both are now well past the 1.2 this file
originally flagged as the point where a fist visibly outruns the reach behind
it. Growing those reaches to match is a REBALANCE — it makes them hit from
further away — which is why it has not been done.

**`flyBossSizePx` is the opposite case** and needs no such warning: it drives
the simulation as well as the picture, so growing it moved the hurtbox with the
sprite. At 304 the Mosca is over twice a fighter's 137px and takes up more of
the belt it sweeps along, so its ground pass is harder to stand clear of than
when that attack was tuned.

⚠️ **A ROACH IS NOT AS BIG AS ITS NUMBER SAYS.** Packs are scaled so the idle
BODY is `fighterSizePx` tall. For a cigarette every pixel of that is cigarette;
for a barata the top 44px of 168 — **26%** — is horns and antennae, so the
animal itself gets the remaining 124. That is why they needed 1.888 to stand as
big as the gang they replaced rather than merely as tall.


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
| `src/backdrop.js` | the layer stack and its sources (tile / image / film / **video**) |
| `src/stage.js` | the level director: **rooms**, segments, camera, locks, spawning |
| `src/fighter.js` | the shared body: belt position, health, attacks, knockdowns |
| `src/player.js` | the coconut — input → intent, and nothing else |
| `src/enemy.js` | the villains, and `Crowd`, which owns **the attack token** |
| `src/fly-boss.js` | the Mosca Boss: ambush entrance, swoop, ground pass |
| `src/combat.js` | hit resolution and hitstop |
| `src/hit-fx.js` | the impact burst: six variants, picked per blow |
| `src/horse-boss.js` | the HORSE: the final boss, and the last fight |
| `src/sheets.js` | two pack formats, **two facings**; see below |
| `src/life-bar.js` | STILL LIFE's hand-drawn bar, player and boss |
| `src/hud.js` | health, GO prompt, end cards, **the CLEAR board** |
| `src/stats.js` | the run's tally: what the CLEAR board counts up |
| `src/debug.js` | everything the C key draws |
| `src/input.js` | keyboard + pad; owns the pad mapping merge-back |
| `tools/build-go-glyph.py` | cuts "GO!" out of the title lettering sheet |
| `tools/build-manifest.js` | prints & checks what package.sh copies |
| `tools/build-beat-coconut-defs.py` | cuts the coconut's ragged sheet + anchors |
| `tools/build-beat-enemy-defs.py` | the same for a VILLAIN sheet, plus the smoke rules |
| `tools/build-beat-fx-defs.py` | cuts the impact-burst sheet into six animations |
| `tools/shrink-master.py` | crops + downscales an artist master; **overwrites, lossily** |
| `tools/build-boss-plate.py` | crops the boss shot at its turn, re-encodes for reverse |
| `tools/build-plate-panorama.py` | **unused** — the rejected panorama; see the plate note |

## The sprites

**THE COCONUT HAS ITS OWN SHEET NOW.** It was drawn for this game and replaces
the borrowed 9×5 pack: 13 rows, 74 frame slots, cut by
`tools/build-beat-coconut-defs.py` into a 45-frame packed atlas. See README.md
for the row table and the cutter.

**AND SO DO TWO OF THE VILLAINS.** JUIXY — the main game's orange, read as a
puncher — was replaced wave for wave by **CIGARRO**, a lit
cigarette drawn for this game: 8 rows, 44 slots, 40 unique frames, cut by
`tools/build-beat-enemy-defs.py`. His stats are the orange's untouched (34 HP,
0.88 speed, same placements), so no fight's time-to-kill moved when the art did.
What is new is that **he throws a combo** and **jumps in** — see those sections.

**TOM went the same way**, replaced by the second sheet: a shorter, fatter tan
stub with yellow gloves, same eight rows, who took TOM's 40 HP and 0.72 speed.
The two of them are one gang with two tempos — the white one is quick and light
(3+3+5, leaps 10% of turns), the stub is slow and heavy (4+4+7, leaps 5%) — and
that difference is entirely numbers, not a second system.

⚠️ **NORMALISING BY `bodyH` ALSO FLATTENS SIZE DIFFERENCES THE ARTIST DREW.**
Scaling every pack so its idle body is `fighterSizePx` tall is what stops a
sheet drawn at another size arriving as a giant, and it made the two cigarettes
exactly the same height on screen — which was wrong, and read in play as the
stub being too small. In the masters his body is 405px against the other's 348,
so his `drawScale` is **1.164**: the artist's own difference, measured rather
than chosen. Drawn heights are now COCONUT 123, CIGARRO 137, the stub 159. **Only ERKPA is still
on a borrowed 9×5 pack**, so `sheets.js` carries two formats for one more
character.

⚠️ **THE SECOND SHEET FORCED THE CUTTER TO STOP CUTTING ON INK.** Banding rows
and splitting frames on empty pixel rows and columns works only while nothing
reaches outside its own frame, and the stub's smoke does: it BRIDGES TWO PAIRS
OF ROWS vertically and WELDS TWO FRAMES horizontally. That method found 6 rows
where the art has 8, and a 534px frame that was two. **No gap threshold fixes
it — the pixels genuinely touch.**

So the sheet is labelled into connected components and everything over
`BODY_AREA` is a character. On both sheets the smallest body is 36417px and the
largest wisp 6312px — a 5.8x gap — and each has exactly 44 bodies for its 44
frame slots. Rows and frames are found on the BODIES ALONE, which never touch
each other, and every loose wisp is then given back to the body nearest it.

⚠️ **TWO NARROWER RULES FOR "WHICH FRAME DOES THIS WISP BELONG TO" BOTH MANGLED
THE ATLAS WITHOUT FAILING.** Nearest in x only: a plume is adopted by whichever
body anywhere below it lines up horizontally, often three rows down, and the
atlas went from 1745px tall to 5116. Then "the body must start below the wisp",
which is true of a rising plume and false of the impact puffs — they sit BESIDE
the head and start above it, so their own body was excluded and one tile came
out 1100px wide. The rule that works is the nearest body by the GAP BETWEEN THE
BOXES in both axes, with no assumption about which way the smoke lies.

⚠️ **FRAME RECTANGLES OVERLAP once smoke is included**, so each tile is MASKED
to its own components rather than cropped. A plain crop carries the neighbour's
plume into the tile and draws it attached to the wrong character.

⚠️ **THE BODY INSIDE A TILE IS THE BIGGEST COMPONENT, NOT THE LOWEST ONE.** The
lowest-pixel rule reads well — a cigarette stands on the belt and a wisp does
not — and it is wrong in the frames where the stub picks himself up off the
floor, because there is a puff of smoke drawn BELOW him. The anchor came off the
puff, so its bottom became the ground line and he was drawn hanging in the air.
Caught by drawing every frame against one ground line before wiring anything;
it would have been invisible in a still and obvious only in play.

⚠️ **THE POSE TABLE IS NOW PER PACK, and it had to be.** `CONFIG.POSE_RAGGED`
was one shared map of pose → row-slice, which was correct while exactly one
sheet was ragged. Two ragged sheets do not hold the same moves in the same rows:
the coconut's knockdown row is six frames of falling over, the cigarette's is a
fall AND a stand-up. A character now overrides only the entries its own art
contradicts (`CHARACTERS.<kind>.poses`), and the shared table is the default.

⚠️ **HIS PUNCH ROW NEEDED NO OVERRIDE, AND THAT IS LUCK WORTH KNOWING ABOUT.**
`combo1`..`combo3` slice a row into wind-up/strike PAIRS, and his six-frame
punch row is three pairs, so the coconut's existing entries land on his hits
exactly. Those three entries are now read by two characters with different rows
behind them.

⚠️ **THE SMOKE IS PART OF HIM AND MUST NOT BE COUNTED AS PART OF HIM.** It
rises off his ember, it is drawn in the same white as his body, and it is a
third of the frame's height. It is drawn like any other pixel — it is excluded
from the two MEASUREMENTS it would wreck, and both had to be added:

- **`bodyH`**, the idle frame's height without the smoke. `sheets.js` scales a
  pack so its idle frame is `fighterSizePx` tall; measured on the raw frame that
  is a two-thirds-height cigarette standing under a full-height plume.
- **`bh`** per frame, the body's height above its own anchor, which is what
  `size()` now reports. `hud.js` floats an enemy's health bar above that number;
  on the frame it hovers a plume's height over an empty patch of sky.

⚠️ **WHAT SEPARATES SMOKE FROM BODY IS CONNECTEDNESS, NOT COLOUR.** They are the
same white, so no palette test can do it. The body is the component containing
the LOWEST opaque pixel — a cigarette stands on the belt, a wisp never does —
and every detached wisp and puff is some other component. No threshold, no
palette, nothing to tune.

⚠️ **A LEANING BODY MUST NOT DRAG ITS OWN FEET.** The coconut's anchor is the
centroid of its whole body, which is right for a ball. A cigarette LEANS: on the
lunging punch his top travels most of a body-width forward, and a whole-body
centroid would slide his feet backwards to pay for it — the punch would visibly
cost reach. His horizontal anchor reads the bottom 30% of him only, on body
white, so neither a thrown arm (tan) nor a leaning head (black) can move his
feet.

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
no enemy's time-to-kill moved. Enemy HP: CIGARRO 34, STUB 40, ERKPA 55.

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

## The enemy combo

*Knobs: `CONFIG.ENEMY_COMBOS` (one attack def per hit, per kind) and
`CONFIG.enemyComboWeights`. Code: `Enemy._think`'s 'combo' branch.*

⚠️ **AN ENEMY WITH A COMBO IS NORMALLY A BOSS, and this file said exactly that
until the cigarette arrived with three punches drawn for him.** What keeps him a
mook rather than a small boss is that **the string is declared before it is
thrown**: `Enemy` rolls its length at the top of the wind-up and then honours
it, so a one-hit jab and a three-hit string open identically and the player is
never asked to react to a decision made mid-swing.

| hit | startup | active | recover | dmg | reachX |
|---|---|---|---|---|---|
| combo1 | 200 | 90 | 200 | 3 | 66 |
| combo2 | 150 | 90 | 200 | 3 | 66 |
| combo3 — the lunge | 190 | 110 | **460** | 5 | 78 |

Weights `[4, 3, 3]` — one hit, two, or three. Weighted toward the SHORT one on
purpose: three hits every time is a rhythm the player stops reading and starts
waiting out, and it is the jab that *might* be the start of a string that makes
them respect the wind-up.

⚠️ **THE DAMAGE IS SPREAD, NOT ADDED.** JUIXY hit for 5 and the cigarette took
his waves, so the string is 3 + 3 + 5: any single hit costs the player *less*
than the orange's did, and only the full string costs more. Eating all three
means having stood still for 900ms.

⚠️ **NO HIT'S STARTUP MAY DROP BELOW `hurtMs` (260).** A player stunned by hit
one would then be unable to leave before hit two lands, and the whole string
becomes unavoidable the moment it starts — a mook that is a guaranteed 11
damage on contact rather than a fight.

⚠️ **THE LAST HIT'S RECOVERY IS THE PUNISH WINDOW.** 460ms against the others'
200 is what the player buys by backing out of a string, and the only reason
doing so is worth anything. Shorten it and the cigarette becomes a wall that is
never safe to approach.

⚠️ **THE STRING DOES NOT RE-CHECK RANGE BETWEEN HITS.** A committed string that
stopped when the player stepped out of it would be a fighter that can never be
made to miss, and the recovery above would never be paid. Whiffing into empty
air is the point of committing.

⚠️ **`attack()` TAKES A FORCED INDEX NOW, and the AI is the only caller that
passes one.** A player's chain advances because their press landed inside the
cancel window — that window IS the mechanic. An enemy has no presses; reading
its own combo window would silently drop it back to hit one whenever the window
lapsed between two hits, and the string would loop instead of ending.

⚠️ **THE TOKEN IS HELD FOR THE WHOLE STRING.** Between two hits `atk` is
momentarily null, and an enemy that stopped counting as committed for that one
frame could have its turn handed to somebody else while it is still visibly
punching. `ai === 'combo'` counts as busy for exactly that frame.

## The jump-in

*Knobs: `CONFIG.ENEMY_LEAP`, `enemyLeapChance` and the `enemyLeap*` band. Code:
`Enemy.takeTurn` / `_startLeap` and the 'leap' branch of `_think`.*

⚠️ **HE PUNCHES ON THE WAY DOWN, AND THAT IS GEOMETRY RATHER THAN TASTE.**
`verticalReach` is 70 and the jump apex is 85, so **a fighter at the top of his
own jump cannot reach the floor**. An air attack timed to the apex — which is
where you would put it — passes cleanly through a standing player every single
time, and reads as broken hit detection rather than as a miss.

```
jumpY = sin(PI * p) * 85   <= 70   when p <= 0.31 or p >= 0.69
p 0.69 of jumpMs 620       =  429ms after take-off
```

So `startupMs` is 420: the hitbox opens just before he drops back through the
reachable band and stays live until he lands. **Retiming `jumpMs` or
`jumpHeight` moves that band, and this number has to move with it or the move
silently stops connecting.**

⚠️ **THE LEAP IS AN APPROACH, SO IT IS DECIDED BEFORE HE CLOSES IN.** A fighter
who walks all the way into punching range and only then decides to jump has
nothing left to jump over. The roll happens when the attack token arrives, and
the leap fires from 90..520px out.

⚠️ **THE CHANCE IS ROLLED ONCE PER TURN, NOT PER FRAME.** At 60fps a 2%
per-frame roll is a certainty inside a second — it would not be a rare surprise,
it would be his entire personality.

⚠️ **AND IT IS ROLLED ON A CALLBACK FROM CROWD, NOT BY WATCHING `hasToken`
CHANGE. This cost a build, and the symptom pointed the wrong way.** Watching for
the token going false→true means keeping last frame's value, and the token is
RELEASED from three places that run at different points of the frame: `_think`
(a string or a leap ending), `hurt()` (called by Combat, which runs *after* the
crowd has updated) and Crowd itself. Wherever in `update()` the snapshot is
taken, one of those three releases lands on the other side of it — the `false`
is never recorded, so the next grant does not look like a new turn. He leapt on
the first turn of the fight and then never again, which reads as a broken random
roll rather than as a missed edge. `Crowd` now TELLS the enemy its turn has
begun (`takeTurn()`), because a grant is one event in one place and cannot go
stale.

**That is the sixth time this game's recurring shape has bitten** — something
changed underneath a value that had already been read. Anything watching for a
change in a flag `_think` writes has to be read after `_think` has run, and
anything watching a flag COMBAT writes cannot be read inside the update at all.

⚠️ **THE SPEED IS DERIVED, NOT SET.** Distance to cover divided by the time in
the air, capped, so he lands beside the player instead of at a fixed hop length
that only occasionally reaches. He also commits to a LANE before take-off and
cannot steer in depth — the same bargain the Mosca's ground pass makes, and the
reason there is an answer to it at all.

⚠️ **THE FRAMES BELONG TO THE ARC, NOT TO THE ATTACK PHASES.** Every other
attack in the game draws off startup/active/recover, which is three frames. The
air-punch row is drawn as a whole jump — take-off, rise, the punch, the fall —
so seven drawings would collapse to three and the punch would be thrown at a
height it was never drawn for. `frameStep` spreads it across `jumpMs` while he
is airborne, and the attack's own recovery takes over the moment he lands.

**`enemyLeapChance` is 0.10 — one turn in ten — and that number came out of
play.** It was built and judged at 1, where the leap was the only thing he did
and the ground combo never appeared, then set to a rate. It is a rate of
SURPRISE rather than a difficulty dial: the reason the move lands at all is that
his ordinary approach is a walk, so raising it far stops the jump-in being
something that happens to you and makes it the fight.

A turn that rolls a leap while he is already inside `enemyLeapMinX` is not
re-rolled — he walks in and throws the ground combo instead, and the roll is
spent. The alternative is an enemy who backs away to make room for a jump, which
telegraphs it completely.

---

**A mook's blow still cannot floor the player** — `crowdHits()` passes lift 0
and knockdown false for the whole crowd, so the lunge shoves rather than
knocks down. That is one line if the finisher should ever put the player on the
floor.

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
| 1 | arena | CIGARRO, STUB, ERKPA, **+ERKPA, CIGARRO from behind** | |
| 2 | scroll | to x3300 | 77% |
| 3 | **sub-boss** | the Mosca Boss | |
| 4 | scroll | to x3690 | 88% |
| 5 | arena | CIGARRO, STUB, **ERKPA behind**, STUB, **CIGARRO behind** | |
| 6 | scroll | to x4092 | **100%** |
| 7 | arena | ERKPA, CIGARRO, **STUB behind**, **ERKPA behind**, STUB | |

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

## The CLEAR board

*Knobs: `CONFIG.RESULTS`. Code: `src/stats.js` (the tally) and
`Hud.drawResults` / `Hud._resultsTimes` (the drawing and the two moments).*

Clearing the last room used to write CLEAR and stop. It now counts the run up a
row at a time: hits landed of swings thrown, accuracy, hits taken, damage dealt
and taken, time, enemies downed with a by-name breakdown, and then a RANK.

⚠️ **EVERY FIGURE COMES FROM `combat.js`, WHICH IS THE ONE PLACE HITS ARE
RESOLVED.** `src/stats.js` is counters and formatting with no knowledge of the
fight; the resolver tells it what happened. Counting swings in player.js and
hits in combat.js would be two sources for one ratio, and accuracy would drift
the first time either changed.

⚠️ **A SWING IS COUNTED WHEN ITS HITBOX GOES LIVE, NOT WHEN THE BUTTON IS
PRESSED, and in `playerHits` that is the order of two lines.** A punch the
player was knocked out of during its own start-up never became a punch. Counted
before the `if (!box) return`, every wind-up interrupted by a hit scores as a
miss and accuracy stops measuring aim and starts measuring how often they were
interrupted. It is deduped by the attack OBJECT, because the active window is
several frames long and Fighter builds a fresh attack per swing.

⚠️ **THE KILL IS READ ON THE TRANSITION, NOT THE FLAG.** `dead` stays true while
the body falls and fades, so testing it alone scores one death every frame of
the fall.

⚠️ **THE WHOLE BOARD IS DERIVED FROM ONE CLOCK.** No row holds its own progress
and nothing accumulates, which is what makes the SKIP a single number: setting
the clock past the end finishes the tally exactly as if it had run, with no
state to reconcile. `boardSkip` in game.js is that number.

**The count-up is 4.0s end to end**, asked for after watching it at 2.4s and
3.0s. Rows start 0.5s apart and each number rolls for 1.0s, so the last row
starts at 3.0s and lands on 4.0s; the rank follows at 4.8s and the prompt at
5.2s. Add the 0.45s the board waits before starting for the times from CLEAR.

⚠️ **THE TOTAL IS `(rows - 1) x stagger + rowMs`, so a stagger raised on its own
moves the finish by six times what it looks like.** And the split between the
two is the FEEL rather than just the total: a long stagger with a short roll
gives every row its own beat, while a short stagger with a long roll has all
seven numbers climbing at once, which reads as noise.

⚠️ **`rankDelayMs` USED TO LIE ABOUT ITS OWN UNITS.** The stamp time counted one
stagger per row, but the last row STARTS at (n-1) staggers in — so a knob set to
260 produced a 410ms gap. Fixed with the retime; if the rank ever feels early or
late, that knob now means exactly what it says.

⚠️ **THE FIRST PRESS SKIPS THE TALLY, IT DOES NOT DISMISS IT.** A player
pressing during the count-up has said "get on with it", not "I have finished
reading numbers I have not been shown yet". The next press restarts.

**THE RANK JUDGES THREE THINGS AT ONCE, because any one alone is farmable:**
accuracy rewards poking at one enemy from safety, damage taken rewards running
away, and time rewards skipping the fights. Weighted 40/40/20 they describe a
player who hit what they aimed at, did not get hit back, and kept moving. Both
budgets are deliberately generous — two full health bars of damage, a 150s par —
because a rank that is hard to read is a participation letter. Measured on
sample runs: 87% accuracy and 22 damage taken clears S; a middling run lands B;
40% accuracy with 165 taken lands C.

**The run clock is ticked in `update()` and nowhere else**, so it is time spent
PLAYING — fades between rooms, the walk-out and every end screen are outside it.

**Under dev mode the damage figures are inflated and the board says so**, since
every punch does 50. The hit counts, accuracy and time are unaffected.

**The layout is written out, not computed.** Seven rows plus a breakdown line
have to clear the stamp; at the first numbers tried the breakdown landed
directly under the word RANK. Add a row and `rankY` moves with it.

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

⚠️ **THE CLEAR BOARD FROZE THE WHOLE GAME ON THE FIRST PRESS, and every press
after it did nothing.** The board's skip branch — a press part-way through
finishes the tally instead of dismissing it — was written as `{ boardSkip = ...;
return; }`. But `render()` and `requestAnimationFrame(loop)` are BELOW that
branch, and the only other early return there is a `start()`, which schedules
its own frame. So the skip left the loop unscheduled: the game stopped dead on a
board that looked completely normal, and no input was ever read again. It reads
exactly like an input bug and is not one.

**Anything leaving `loop()` early must have scheduled a frame.** This is the same
lesson as the shadow exception above, arrived at from the other direction: that
one escaped the loop by throwing, this one by returning.

Next to it was a second fault of the same family — the "still rolling" test used
`!boardSkip` where it meant "is the tally still running", so a press on a
FINISHED board was eaten as a pointless skip and only the second press worked.
Both the board and the shell now read one `promptAt` from `Hud._resultsTimes`;
computed separately they drift, and the gap between them is a window where the
screen says "press anything" and ignores you.

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

- ⚠️ **DEV MODE IS ON** (`CONFIG.DEV.on`), so every punch does 50. `package.sh`
  refuses to build until it is off. Number keys 1-9 jump rooms; the marker in
  the top right says which room you are in.
- **THE BOSS ROOM HAS ITS BOSS** (2026-08-21): a HORSE, after the wave. See
  *The horse boss*. What is still open there is smaller: he has no name (the
  user names the characters), and the fight has never been judged with
  `CONFIG.DEV.on` false — at 50 damage a punch he dies in three combos.
- ⚠️ **THE CIGARETTES' STRINGS DO NOT CONNECT PAST HIT 1** — see the section
  above. This is the single most consequential open item in the file: the
  advertised damage numbers have never reached the player, so the fight economy
  is unjudged whatever dev mode is set to. The baratas are already fixed and
  are the worked example of option 1.
- **The belt is unjudged in motion** — 520 came from measuring the plate, not
  from play. Hold C: the magenta bands are the no-walk regions, each labelled
  with the knob that resizes it.
- **The street's camera cannot reverse and the boss room's can.** That asymmetry
  is a property of the FOOTAGE, not a decision — see the Rooms section. Making
  the street reversible means re-encoding its 8.3MB shot with dense keyframes.
- **The first fight is now what used to be the second one** — 5 enemies incl.
  ERKPA and two from behind, tuned as an escalation rather than an opener. Worth
  replaying once dev mode is off.
- **Villain sheets: DONE, and something is now removable.** ERKPA is gone —
  CIGARRO3 took his waves and stats on 2026-08-21 — so every character in the
  game is a ragged pack. `sheets.js` no longer needs to carry two formats and
  `CONFIG.POSE` (the grid pose→column table) is dead weight. Deleting both is a
  loader refactor and was deliberately not bundled with the cast change.
- **FOUR characters have no name.** `cigarro2` carries `name: 'BAGANA'`,
  `cigarro3` carries `CIGARRO3`, and the roaches carry `BARATA` / `BARATA2` —
  all placeholders next to the real COCONUT and CIGARRO. Nothing draws the
  field, so each is one line.
- **The strings and the jump-ins have been watched and liked**, at
  `enemyLeapChance` 0.10 / 0.05. What is still unjudged is the fight ECONOMY,
  because dev mode changes the player's damage only: their blows land for real,
  but every fight they land in is over in one combo. The combo weights, the
  460ms punish window and the leap chances are the knobs to feel out with dev
  off. Neither cigarette's plain `jump` row (row 3) is wired — they never jump
  without punching.
- **`rankParS` (150s) is a guess.** The CLEAR board now prints the clear time,
  so one honest run with dev off settles whether the pace third of the rank is
  generous or brutal. It is the only number on that board I could not derive.
- **The lift mechanic is HALF WIRED.** The button exists (L/E, pad B), the
  `pickup` state exists, and BOTH animations are wired and chosen by weight —
  `pickGround` (row 9, a stoop) for a light thing, `lift` (row 7, a hoist) for a
  barrel. What does not exist is anything to pick up. `Player._liftTargetHeavy()`
  is the entire seam: it returns false, so the stoop always plays. Objects,
  carrying (`carryWalk`, row 10) and throwing (`liftThrow`, row 8) are still to
  do.
- **Cut but unwired — the PLAYER's air punch.** The coconut's row 4 has no
  jump-attack state; it is cut, named and mapped, so it is a wiring job rather
  than a trip back to the illustrator. Note the enemies' equivalent row IS wired
  now (it is their jump-in), so `airPunch` being in `POSE_RAGGED` no longer
  means "unused" — check per character.
- **Sound: music and hits are in; nothing else is.** No footsteps, no enemy
  death, no UI, and the four `enemy-hit-*.ogg` takes plus `combo-2-5-hits.ogg`
  are sitting uncut in `assets-v2/beatemup-dungeon/audio/`.
  `tools/build-beat-sfx.py` does each in one line. The second combo take is the
  obvious next one: the player's two strings currently END ON THE SAME CLIP,
  because `COMBO_ALT_FINISH` has no sound of its own.
- **`Escape`/`P` are captured but do nothing** — `takePause()` exists, no pause
  state does.
- **The font.** Futura is not bundled; the stack falls through geometric sans.
  Same open decision as the other two games.
- **Enemy variety, and it moved a long way.** The two cigarettes differ from
  each other in tempo and weight (3+3+5 against 4+4+7, 10% leaps against 5%) and
  from ERKPA in kind — he has no string and no jump-in, because he has no art
  for either. What they still SHARE is one `_think`: approach, circle, wind,
  commit. A grappler, a thrower or anything that keeps its distance would need
  that to branch.
- **The impact burst is real art now** (2026-08-21) and the code-drawn
  starburst is gone. What is still open is a taste call rather than a gap: the
  colour is currently part of the random draw, and `HIT_FX.colorByRole` flips it
  to yellow-for-landed / red-for-taken in one line. Decide by playing it.
- **Enemy bars stay plain slabs.** The hand-drawn bar is 11 inked squares in a
  333px frame; at the ~50px a floating bar occupies they turn to mush.
