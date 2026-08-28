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

Controls: **arrows/WASD** move · **J / Z / Space** punch — tap again to combo,
and **stand on food and press it to pick the food up** · **K / X** jump ·
**hold C** debug.

⚠️ **L / E does NOTHING** as of 2026-08-24 (`CONFIG.pickupButton` false), so
barrels cannot be lifted, carried or thrown. See *Food is taken on purpose now,
and the pickup button is off*.

On a pad: **A** (bottom face) jump · **X** (left face) punch · **B** (right
face) is the dead pickup button · **d-pad / left stick** move · any button
dismisses an end screen. The mapping is the main
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

**THE CAST HAS NAMES AND THE INTERFACE SPEAKS PORTUGUESE.** LEBRON, DUDU, DIDI,
DEDÉ, CLAUDINHO, ZIDANE, NARUTÃO, HIPÓLITO — given by the user, no placeholders
left. And nothing on the results board is in English any more: the labels are
slang (PORRADAS, SAGACIDADE, VACILOS, ESTRAGO, PREJUÍZO, TEMPO, RANGO, NOTA),
losing says PERDEU!, and the end card is OBRIGADO POR JOGAR / THANK YOU. See
*The CLEAR board* in README.md.

⚠️ **TWO ASSUMPTIONS ARE BAKED IN AND BOTH ARE ONE LINE TO UNDO.** The three
cigarettes and the two roaches were named as bare lists and mapped onto
`cigarro`/`cigarro2`/`cigarro3` and `barata`/`barata2` in the order given —
nothing confirms DIDI is the stub rather than DEDÉ. And COMÉDIA, which was
offered as flavour, is not used anywhere: it reads as a bottom RANK TIER ("you
are a joke") rather than as a row label, and the tiers are single letters drawn
at 76px, so using it is a drawing change rather than a string.

**AND LIVES ACTUALLY WORK.** `player.lives` existed from the start and nothing
ever decremented it, so "LEBRON x2" beside the bar was decoration and one death
was the whole run. Dying now spends a life and puts him back where he fell with
1.5s of invulnerability -- the genre's arrangement -- and only the third death
reaches the panel. See *Lives* in README.

**AND DYING HAS A SCREEN NOW TOO.** It used to dim the fight and put a small
PERDEU! over it, which read as nothing happening. It gets the FLYING DUNGEON'S
game over panel instead -- its crawling vermin, its timings, its lettering, with
the word taken from `RESULTS.LABELS.lost` so PERDEU! is spelled in one place.
Read that game's `src/game-over.js` before changing anything structural; the two
screens are meant to look like the same screen. See README.

**AND THERE IS AN ENDING.** ⚠️ *He is drawn at `scale: 1.0` there — exactly his
size in the fight. It shipped at 1.55 and was wrong on sight: a character who
changes size between the level and the ending stops reading as the same
character, and the ending is the last thing the player sees him do. If the shot
needs him larger, crop the plate.* Beating the horse walks LEBRON out to the right and
into a photograph, where he stands with his arms up before the tally arrives.
See *The ending screen* in README.md. Two things it changed elsewhere: the last
fight now WALKS HIM OUT (it used to hand straight to the board, and the note
saying that would be "walking him out of the level into nothing" has expired),
and the tally draws over the ending plate rather than over the room he left.

**AND THE TITLE SCREEN IS ITS OWN NOW.** The flying dungeon's vermin panel and
the SABOROSA logo are gone; it opens on a photograph of a wall, holds it bare
for two seconds, and fades the name up over it. See *The title screen* in
README.md for the knobs. Two things worth keeping: **the wait is the design** —
open on the bare photo and it reads as a place, cut the type in at zero and it
reads as a background for text — and **input is accepted from the first frame**,
because a title screen that ignores you for two seconds reads as one that has
hung.

**AND THE GAME HAS A FINAL BOSS.** A HORSE, in the boss room, after the wave
that already lived there. Five rows of art, no damage frames at all, and a
moveset that is exactly what was drawn. See *The horse boss*.

---

## And then on 2026-08-22

A pass of ten small requests, and three of them overturned decisions this
document argued for. They are listed here so nobody re-argues them from the old
notes, which are still in place further down.

**A PROJECTOR WAS BUILT AND THEN SWITCHED OFF, ALL IN ONE DAY.** Still Life's
old-film post effect — grain, brightness flicker, a vignette, gate weave, the
odd scratch — was copied over file-for-file and value-for-value, on the ask that
the two games look like they came off the same reel. Then it was seen in this
game and turned down: *"it causes a terrible feeling"*.

⚠️ **IT WAS SOFTENED BEFORE IT WAS REFUSED, so the refusal is not about the
numbers.** The first note back was that it blinked too much, and the real
culprit was `filmFlickerMs` — at Still Life's 24ms the lamp value is re-rolled
~42 times a second, which the eye reads as strobing rather than as a lamp. It
went to 80 (~12 changes/s), the dip came down 30% and the scratch with it. It
was still not wanted. **Do not re-propose this as a tuning problem.**

⚠️ **IT WAS KEPT WIRED AND OFF ON REQUEST — AND THEN DELETED FIVE DAYS LATER.**
On 2026-08-22 nothing was removed: `CONFIG.film: false` was the whole off switch,
`src/film.js` and `renderFilmed()` stayed live, and the config carried the line
*"Do not delete any of it to tidy up"*. On **2026-08-27** the user asked for
exactly that — *"remove this film thing, this is badness from the past"* — and it
is now gone: the file, the `CONFIG.film*` block, the `index.html` entry and the
`game.js` wiring. `renderFilmed()` is `renderFrame()` and only clears the frame.

⚠️ **A "DO NOT DELETE THIS" NOTE HAS A SHELF LIFE.** It was correct when written
and it was not a veto on the next decision. Written as *this is the state now*
rather than as a prohibition, it would not have needed overturning at all — the
same lesson the coverage target taught by moving three times in one day.

⚠️ **AND "FILM" STILL MEANS THE PLATE.** The backdrop is filmed footage: a
`video` source the camera scrubs, plus a `film` source kind for frame sequences,
in `backdrop.js`, `stage.js` and `SOURCES`. When this deletion was asked for, the
word was ambiguous enough to be worth confirming before touching anything — the
projector went, the footage stayed.

**THE TITLE NO LONGER WAITS, AND IT LANDS WITH A BOUNCE.** The 08-19 note below defends a two-second hold on
the bare photograph before the name arrives — *the wait is the design* — and the
name now **falls in from off the top of the frame on the first frame** instead.
The argument was heard and overruled; the hold is one config line away
(`titleDropAtMs`) if it is ever wanted back.

⚠️ **AND THE FALL AND THE BOUNCE ARE ONE MOVE.** Asked for as "a little bit of
juice, no exaggeration": the block overshoots down 12px, springs back and
settles, on a damped sine. Turning the bounce on also changes the FALL, from
eased-out to accelerating -- a fall that decelerates to a stop and then bounces
reads as two unrelated moves back to back, because the type has already arrived
before anything shakes it. `titleBouncePx` 0 puts both back.

**AND LEBRON WALKS ACROSS IT.** Once the name has landed he enters from the left
and leaves by the right, drawn out of the same packs the fight uses. ⚠️ He is
DRAWN, not simulated — two numbers and a frame clock, exactly the choice
ending.js makes and for the reasons its header gives. Crossing once is what was
asked for; `titleWalkRepeatMs` sends him round again.

**AND THE GLOSS UNDER IT READS (BIG COCONUT BASH).** It was `(Coconut Bash)`;
BATIDÃO is the augmentative and dropping it lost the joke rather than
translating it.

**DYING NOW ENDS THE RUN PROPERLY.** The game over panel used to hand straight
back into play, on the arcade rule that a death is a retry. ⚠️ That rule is
about a DEATH and this is not one — the retry already happened twice, and the
third one is the end of the run in exactly the sense the CLEAR board is. It goes
back to the title now, like winning does.

**AND IT ENDS ON STILL LIFE'S MUSIC.** That game's `game-over.ogg`, read in
place, played the way it plays it: 10% slow with a second voice 50ms behind it,
and the level's bed stopped to make room. `CONFIG.GAME_OVER_STING` holds the
three numbers; `Sound.play` grew a `delaySec` so the double is scheduled on the
audio clock rather than by a timer. See *Sound*.

**AND TAKING A PUNCH MAKES A NOISE.** The porrada sample, pitched down
(`sfxTakeHitRate`), on every path that damages the player. Deliberately the same
recording rather than a second one: a fight should sound like one fight, and the
pitch is what says which direction the blow went.

**THE ROACHES AND THE HORSE ARE BIGGER.** Both were asked for flat: +30% each,
and the roaches then gave 10% of it back the same day (1.888 → 2.4544 →
2.20896). ⚠️ The roaches took the drawn size ONLY — their boxes did not move, so
the picture is about 17% wider than what can be hit, which is the standing
warning on `drawScale` and it is now a real gap rather than a theoretical one. The horse
took it properly: `drawScale`, `HORSE_BOSS.sizePx` (the hurtbox) and both attack
REACHES all went up by 1.3, because this file's rule is that a reach is measured
off the drawing. His DECISION ranges did not, so a kick he commits to now lands
more reliably — a bigger animal doing what a bigger animal does, but it is a
difficulty change and it was not separately asked for.

**AND ENEMIES NOW START FURTHER OFF SCREEN, BY MEASUREMENT.** The roaches got
big enough that their horns were visible at their spawn point, announcing where
they would come from before they walked on. The spawn margin was a flat 70px in
stage.js; it is now `spawnMarginPx` of clearance ON TOP OF what `Sheets
.overhang()` measures the walk cycle to reach past the fighter's ground point --
169px for a barata against 60-68 for a cigarette, which is why this had never
shown before. ⚠️ It is derived, so it follows `drawScale` from now on. That is
the recurring failure in this codebase caught one more time: a number measured
off a drawing that did not move when the drawing did.

**AND THE HORSE BLOWS UP.** He used to tip over and fade, for want of a death
row; he now goes up in a string of seven explosions rolled once on the frame he
dies and walked across his body over a second. ⚠️ The tip is dead code on
purpose — `DEATH_BOOM.on` false brings it back, and a body toppling THROUGH the
blasts read as two deaths playing at once. The art is Still Life's explosion
sheet, read in place. `dieMs` went to 2000 to cover the string; that number and
the blast timings have to be checked against each other.

**AND HE CASTS NO SHADOW.** The only character in the game without one. The
ellipse is load-bearing for everyone who jumps or who can stand behind someone
else; he does neither, and the boss room holds exactly two characters.

---

## And the rest of 2026-08-22: things in the level

The second list of the day, and the first one that added a MECHANIC rather than
retuning what was there.

**THE LEVEL HAS THINGS IN IT NOW.** Barrels, which can be punched apart or
picked up and thrown, and FOOD, which is stooped for with the punch button
(walked over and eaten until 2026-08-24). One sheet
(`barril-coconutbash.png`), one new cutter, one new file (`src/prop.js`), and
they are placed by hand in `CONFIG.ROOMS[n].props` the way enemies are placed in
segments. See *Props* below and *Barrels and food* in README.md.

⚠️ **THEY ANSWER THE FIGHTERS' INTERFACE AND THAT IS THE WHOLE DESIGN.** A
barrel has `x`, `z`, `jumpY`, `vulnerable()`, `overlaps()`, `hurt()`,
`groundX()`, `depthScale()` and `draw()` -- the same shapes `Fighter` and both
bosses answer -- so the z-sort, the shadow pass and the hit resolver took props
with no branch anywhere. The whole mechanic cost combat.js about ten lines. That
is the same bargain HorseBoss made, and it is now the pattern for anything new
that lives on the belt.

⚠️ **THE LIFT SEAM WAS ALREADY THERE AND IT FITTED EXACTLY.** `Fighter.pickup()`,
the `pickup` state, the pickup BUTTON, and the coconut's `lift` / `liftThrow` /
`pickGround` / `carryWalk` rows were all cut and wired on 2026-08-18 against a
mechanic that did not exist, with a note in player.js saying what would have to
change when objects arrived: "finding what is in reach and asking it how heavy
it is". That turned out to be true to the line.

⚠️ **AND THE CARRY ART HOLDS NOTHING.** `carryWalk` is five drawings of him with
both arms raised and empty space between them, so the barrel is a separate draw
at `carryYRel` above his feet -- 96px, MEASURED off the top of that drawing
rather than guessed. It shipped at 157 first and floated half a barrel above his
fingers.

**THREE WAYS TO ORPHAN A BARREL, ALL FOUND BY READING RATHER THAN PLAYING**, and
they are all one shape: `player.carrying` and `prop.holder` are ONE relationship
stored TWICE, and every path that ends a hold has to break both ends.

* Press pickup while already holding one: a second reach begins, `carrying` is
  overwritten, and the first barrel follows the player forever with nothing able
  to release it. (Pickup now PUTS DOWN when his hands are full.)
* Die holding one: the prop noticed and let go, the player did not, so he
  revived stuck in the carry pose with the punch button throwing an invisible
  barrel.
* Walk out of the room holding one: the room's prop list is discarded on entry
  to the next, and what is left is a prop that exists only as `player.carrying`
  -- never drawn, never updated, never released.

A FIFTH turned up when the hoist was animated: the barrel now ARRIVES a frame
before his hands close on it (`held` while `carrying` is still null), so being
hit in that one-frame gap cleared the reference without letting go of the
barrel. `Prop.letGo()` covers `lifting` and `held` together for that reason.

`Prop._release()`, `Prop.letGo()` and `Props.enterRoom(room, player)` are the
fix; both ends, every time.

**THE MOSCA BLOWS UP TOO**, and the horse's explosion machinery moved into
`src/boom.js` the same day to make that one line rather than a copy. Fewer and
smaller blasts than the horse gets, because it dies in the AIR where there is no
floor to hide the bottom of a blast. Its tumble out of the sky is kept and one
flag away, exactly like the horse's tip-over.

**THE IMPACT MARKS MEAN SOMETHING NOW.** `HIT_FX.colorByRole` was built on
2026-08-21 as a taste call with both sides argued, and it is on: yellow is
always the player landing one, red is always the player taking one. ⚠️ The
six-variant random draw is now a three-variant draw INSIDE a colour -- the
variety did not go away, it moved. And it only works because `_impact` is TOLD
which way the blow went; any new damage path that gets `byPlayer` wrong now
tells a lie rather than tossing a coin.

**AND THE GAME HAS TWO FRONT SCREENS AGAIN.** The crawling vermin with the
SABOROSA logo -- the screen that WAS the title until 08-21, when a photograph
replaced it -- is back, in FRONT of that photograph rather than instead of it:
logo (3s, or a press) -> title (a press) -> the fight. `src/logo.js`, a sibling
of title.js and ending.js with the same contract.

⚠️ **IT COST ONE 30KB FILE.** Nothing was recovered from the deleted code --
there was nothing to recover, it was six lines of draw call -- and neither asset
had ever been removed: the three frames are the game over panel's, and the logo
had sat unused in the other game's folder since July.

⚠️ **THE TWO SCREENS SHARE THE FRAMES *AND* THE DRAW.** `VERMIN_FRAMES` is one
list loaded once (`vermin0..2`, renamed from `gameover0..2`, which stopped being
an honest name the moment the front screen drew them again), and the crawl comes
from `GameOver.renderBackdrop()` so the two can never end up on different frames
of one animation. Still Life's split, and its reasoning.

⚠️ **THE LOGO AUTO-ADVANCES AND THE TITLE DOES NOT.** That is what keeps two
screens from being two things to dismiss. And a restart goes back to the TITLE,
not through the logo (`LOGO.onRestart` false): the run ending at the front of
the game was decided when the game over panel was pointed there, and three
seconds of branding after every death is a different decision.

**THE TITLE SCREEN STAYS SILENT.** The main game's theme (`assets/MIKE.mp3`)
was wired to it late on 2026-08-22 -- read in place, like the character packs --
and taken out the same day: it did not suit the screen. Nothing is left behind;
the front screen stops the music and plays none, exactly as before. The
multi-track machinery in `Sound` stays, because the boss room needs it.

> ⚠️ **REVERSED ON 2026-08-24, at the user's request, and not by re-doing it.**
> What was wired here in August was the WHOLE 4m10s song from its quiet opening;
> what is here now is a 60s loop cut out of the fullest part of it. See *And
> then on 2026-08-24*. The 08-22 finding was not wrong -- that song, on that
> screen, from that point, did not suit it.

**THE BOSS ROOM HAS ITS OWN SONG.** 4m39s of finished track, playing from the
moment the player walks through the door -- ⚠️ **not from when the horse
arrives**, which is what it did first and which left the room's opening wave
playing under the street's bed. It is a property of the ROOM (`ROOMS[n].music`),
because the room is the unit the player experiences.

⚠️ **AND NOTHING STOPS IT.** Requested: it runs through the fight, the horse's
death, the walk-out, the ending photograph and the tally, so the last thing the
player hears is what they beat the game to. Only `toTitle()` ends it. `Sound`
grew a second track for this and the level bed's `musicLoopSec` pin is now
guarded to the bed alone -- applied to a four-minute song it would cut it off
after six seconds.

---

### Props

`src/prop.js`. Two classes and a collection: `Prop` (a barrel), `Pickup` (food),
`Props` (what the room has). The states a barrel moves through, and every arrow
out of `held` clears BOTH ends of the hold:

```
     idle ──punched──► smash ──► gone
       │                 ▲
     lifted              │
       │                 │
     held ──thrown──► thrown ─(lands, or hits someone)─┘
       │
     dropped (hit, or the pickup button again) ──► idle
```

**HOW MANY THERE ARE, after two thinning passes on the day they were built:**
**six barrels in the whole game** -- four in the street, two in the boss room --
against eleven when it was first laid out, plus two drumsticks in the street and
nothing in the boss room. ⚠️ Barrels are also most of the FOOD, at
`dropChance` 0.35 each, which is why "there are three things on the floor and
the config places two" is not a contradiction: the third came out of a barrel.
The DEV readout counts placed and dropped food separately for exactly that
reason, and counts them off the LIVE list rather than off the config.

⚠️ **THE WHOLE MECHANIC HAS A SWITCH: `PROPS.barrel.on`.** Asked for on
2026-08-22, ON, against the possibility that barrels do not survive
playtesting -- so that removing them is one line rather than an excavation. Off,
none are laid out and the pickup button goes back to a stoop at empty air, which
is what it did before they existed. It does not take the FOOD with it (its own
feature), does not delete the placements, and does not unload the art (one
sheet). The gate is `Props.add()`, the one funnel every prop goes through.

**A barrel is not solid**, and that is a decision: nothing in this game has body
collision -- fighters walk through each other, which is what stops a five-enemy
crowd wedging the player against a wall -- and one solid object in a world with
no collision is where a player gets stuck.

**A barrel breaks in one punch** because the resolver only hits the NEAREST
target, so a barrel between the player and an enemy eats a blow meant for the
enemy. At two punches every barrel becomes an ambush.

**A thrown barrel is the hardest single blow in the game** (22 against a full
five-hit combo's 36) and it knocks down. It hits ONE enemy and breaks --
`throwPierce` makes it carry through the crowd, which is a much stronger move
than the one that was asked for. It hits BOSSES too: the first thing anyone does
with a barrel and a horse in the same room is throw one at the other, and having
it pass through would read as the mechanic being broken.

**Food WAS taken by walking over it** -- see *Food is taken on purpose now*
below, which replaced this on 2026-08-24. The reasoning below is why it never
went on the PICKUP button, and that half still stands. The button lifts
barrels, and two things on one button means the player who wanted the barrel
gets the chicken lying next to it. It is NOT eaten at full health, so it cannot
be wasted on the way past.

⚠️ **THE HEAL IS CAPPED, NOT BANKED.** Half a bar for a chicken and a third for a
drumstick, and anything past full is LOST -- it does not roll over into
restoring a life. Both readings of "podendo até recuperar para a barra anterior"
were put to the user and this is the one chosen.

---

### Sound

Three pieces, and they were built in this order because each needs the one
before it.

**The music is ONE FILE, ONE LOOP, NO MIXER.** `trilha-mix.ogg`, 5.115s,
seamless. It is three of five recorded takes layered and aligned in
`tools/beat-music-lab.html`. The game does none of that layering: three
`<audio>` elements started together drift apart within a minute and the browser
gives no way to bind them, which is the flying dungeon's finding inherited
whole. Playback is `AudioBufferSourceNode`, not `<audio>`, because the latter
can drop a few ms at the wrap — inaudible on a song, fatal on a six-second bed.

⚠️ **`musicLoopSec` IS LOAD-BEARING.** `loop = true` with no bounds wraps at
whatever the decoded buffer turned out to be, and decoders disagree about an
Opus file's length by a few ms of codec padding — this file's container claims
5.1215s for 5.1150s of music. Left alone that is six milliseconds of silence
inserted every five seconds: an audible tick you would go looking for in the
music rather than in the decoder. `loopStart`/`loopEnd` are pinned to the
config number instead.

⚠️ **AND SINCE 2026-08-24 IT IS THE CROP SCRIPT'S `--length`, NOT THE LAB'S
`loopMs`.** Those were the same number until the loop turned out to be wrapping
into 0.9s of the bed take's own dead air. See *And then on 2026-08-24*.

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

### ⚠️ A REACH COMPARISON THAT FORGOT THE TARGET'S HURTBOX

**This section used to say the cigarettes' strings had never landed a second or
third hit and that their damage tables were fiction. THAT WAS WRONG.** The user
had played them and said so; re-measured against the actual overlap test, four
of the five strings land in full.

**The error:** the reach was compared against `enemyStandoffX` (63.4px) alone.
But the hit test is EDGES AGAINST HALF-WIDTHS — `box.x1 >= target.x - hw` — and
the box runs from the attacker's CENTRE out to `reachX`, connecting with the
player's near EDGE. So the real centre-to-centre reach is `reachX + bodyW/2`,
and `bodyW/2` is **26.6px**. Leaving it out understated every reach in the game
by that much, which is the entire distance between "nothing past hit 1 lands"
and "almost everything lands".

⚠️ **THAT IS THE SAME MISTAKE TWICE IN ONE DAY.** The horse's first hitbox was
written as centre-and-half-extent against a codebase that uses edges, and would
silently never have connected. **Boxes in this game are `x0/x1/z0/z1`, and any
reach arithmetic has to add the TARGET's half-width.** Check against
`Fighter.overlaps()`, not against intuition.

Re-measured, simulating the string with the real inter-hit timings and the real
exponential knockback decay:

| | hit 1 | hit 2 | hit 3 |
|---|---|---|---|
| DUDU | hit | hit (+12.6) | hit (+6.6) |
| DIDI | hit | hit (+8.3) | **miss by 1.7** |
| DEDÉ | hit | hit (+6.0) | **miss by 6.2** |
| CLAUDINHO | hit | hit (+31.2) | hit (+31.3) |
| ZIDANE | hit | hit (+31.2) | hit (+31.8) |

**What is actually true is small, and the user likes it.** The two HEAVY
cigarettes knock the player out of their own finisher: DIDI's mid-string
knockback is 130 and DEDÉ's 140, against DUDU's 110, and those extra few px are
enough to put the third hit out of range. The light cigarette and both roaches
keep the player close enough to land everything. Told about it, the user's
answer was "no problem at all, I like that" — a heavy enemy shoving you out of
its own combo is a property, not a bug. **Do not "fix" it.**

So the damage tables overstate DIDI and DEDÉ by their finisher alone (7 and 10),
not by two thirds of a string, and the fight economy is NOT unjudged. The
options below are kept only as the record of what the reach knobs do.

**The three knobs that move a string's reach**, kept as a reference rather than
as a to-do — nothing here needs fixing:

1. **Drop mid-string knockback** to near zero and leave the finisher launching.
   This is what the baratas now do and it is the genre-standard answer — a
   flurry should not shove you out of itself. Cheapest, and it changes how the
   cigarettes FEEL the least.
2. **Grow the mid-string reaches** to cover stand-off + push. Keeps the shove,
   but the fists visibly outrun the reach already (see *Scale*), so this makes a
   known problem worse.
3. **Let the enemy step in between hits.** Truest to the genre and the biggest
   change: it turns a string into a pressure tool that follows the player.

⚠️ **THE OLD VERSION OF THIS ENDED "whichever is chosen, every enemy's damage
per turn roughly triples, so the HP table and maxAttackers want re-reading".
That followed from the mistaken premise and is not true.** Closing DIDI's and
DEDÉ's third hit would add 7 and 10 damage to one of their strings — a real
change, but a tuning one, and it is not wanted anyway.

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
big as the gang they replaced rather than merely as tall. ⚠️ **They took another
flat 30% on 2026-08-22, then gave 10% back (2.4544 → 2.20896) and a last 5% on
2026-08-23 (→ 2.3194), and that is past this argument either way** — they are
not matching a cigarette's mass any more, they are bigger than the men, and
their boxes did not move with them.

---

## And then on 2026-08-23: the jam pass

Four small items before submission — three of them one number each, and one new
file.

**THE ROACHES AND THE HORSE ARE 5% BIGGER.** Both flat requests, both the same
recipe the 08-22 pass established, and the recipe is the interesting half.
`CHARACTERS.barata*.drawScale` is **drawn size only** and moved alone, because
nothing under a roach knows about it — its picture is now well wider than its
boxes and that is a known, standing gap. The horse moved as a SET: `drawScale`
2.2243 → 2.3355, `HORSE_BOSS.sizePx` 304 → 319 so the hurtbox tracks the
picture, and `chargeReachX` 218 → 229 / `kickReachX` 338 → 355 because both were
measured off the drawing and a reach that does not follow it stops where his
chest used to be. The DEPTHS (`hitZ`, `kickReachZ`, `chargeReachZ`) and the
DECISION RANGES (`kickRange`, `chargeMinRange`) were left alone — the first
because a 2-D drawing does not get deeper when it gets taller, the second
because they are about the fight's spacing rather than about the art.

**THE STREET HAS NO BARRELS LEFT.** Asked for flat: *"remova todos os barris na
fase principal, mantenha somente na boss room"*. Four entries commented out of
`ROOMS[0].props` — commented, not deleted, because where they went took two
thinning passes to decide. The two in the boss room stay, and the food is
untouched. ⚠️ **That moves where the mechanic is taught.** The barrel at x 1450
sat in the opening walk precisely so the lift and the throw were learned
somewhere nothing could hit back; the first barrel a player now meets is on the
floor of the last fight, with a horse on it. Flagged rather than worked around —
it is the level's shape, not a bug.

**AND THE SKY HAS FLIES IN IT.** STILL LIFE's small fly, borrowed the same way
its Mosca, its blast sheet, its health bar and its worms already were — crossing
the band ABOVE the belt, right to left, in the street only. New file
`src/flies.js`, `CONFIG.FLIES`, a `flies: true` on the room and a `flies` entry
in `LAYERS`. See *The flies* below.

⚠️ **THE PORT WAS A DELETION, NOT A COPY.** That game's `src/fly.js` is 430
lines; this is 200, and the 230 that did not come across are all one of two
things — machinery for being SHOT (health, i-frames, knockback, a burst, a
corpse that falls and lands on a pile) or machinery for being REWOUND (a memory
of every heading it has flown, a snapshot of the instant it died). A beat 'em up
has neither a gun nor a clock. What was worth carrying was the STEERING, which
is the part that makes a fly look like a fly. **"Bring X from the other game"
means read X and decide what of it this game can even express** — the same
lesson the title screen and the music lab taught on 2026-08-21, arrived at from
the other direction.

---

## And then on 2026-08-24: the loop had a hole in it

One thing, and it was a crop rather than a mix. The street bed wrapped into
about nine tenths of a second of near-nothing every pass — the user called it a
vacuum, which is what it was.

**The cause was in the loop LENGTH, not in the arrangement.** `loopMs` in the
lab opened at 6146ms because that is tchum 1's whole file length, and that was
the honest starting point: one pass of the bed with nothing cut is the only crop
that is certainly not wrong before anyone has listened. But the take is a phone
recording of somebody playing, so it has 727ms of dead lead-in before the first
hit and 472ms of dead tail after the last one. Looping the file puts those two
next to each other. Read off a 20ms envelope the wrap was 580ms below −32dB in
one unbroken run, and the ~900ms around it held exactly two isolated ticks from
the other two takes. Every other rest in the piece is 300ms or under. The hole
was twice the longest thing the music actually plays.

**The fix re-cuts the approved render rather than re-rendering it.**
`tools/crop-beat-trilha.py` (new) treats `beat-trilha-mix.wav` as a CYCLE and
takes `render[(start + t) mod 6146]`: start 745ms, length 5115ms. That is the
attack of the bed's loudest hit, and three bars of it. `musicLoopSec` moved to
**5.115** with it. Longest silence anywhere in the loop is now 320ms, and it is
an internal rest the groove already plays — nothing straddles the wrap.

⚠️ **It re-cuts rather than re-renders BECAUSE THE BAKE STILL DOES NOT
REPRODUCE THE EXPORT** (below, and unchanged). The lab's `export wav` is the
only render known to sound like the mix that was approved and played, so every
balance decision in it is preserved bit for bit and only the loop points move.

⚠️ **AND IT COULD NOT HAVE BEEN DONE IN THE LAB.** The obvious move — trim the
bed by 745ms and set `loopMs` to 5115 — does not express the same thing. There a
layer `repeat`s to fill the loop and its overhang WRAPS onto the head; a bed
trimmed to its downbeat is 5388ms against a 5115ms loop, so its last 273ms would
double back over its own first beat. Discarding a tail is not a setting on that
model. So the pipeline is now two stages with a clean split: **the lab owns the
arrangement, the crop script owns the loop points.** The lab's `loopMs` stays at
6146 and must, because the crop reads the whole render and needs the material
outside the loop window to still be there.

**HOW THE SEAM IS KEPT CLICK-FREE.** A cut chosen for musical reasons lands
where it lands, and 5860ms is in the middle of a decaying hit. Cutting flat
would put a click on every wrap. Instead the material that CONTINUES past the
cut — the rest of that ring, 100ms of it, faded — is summed onto the head, which
is where it was going to be heard anyway. Same rule the lab already uses for its
own render overhang. `--dry-run` prints `|first − last|` against the median
neighbouring sample step (0.0165 vs 0.0114) so the seam can be checked as a
waveform rather than trusted.

**The level is deliberately untouched.** The export has 120 samples pinned at
full scale with a 22-sample flat top, which is the browser clamping into 16-bit
and cannot be fixed by re-exporting. Pulling the mix under a ceiling would be
right in a bake and wrong here: the bed has been played and balanced against the
punch effects, and a dB off it is a change nobody asked for.

**The measurement that made this quick, and it is the same one as last time:**
print the ENVELOPE and read it. The hole is invisible in a waveform, obvious in
a 20ms RMS dump, and the whole diagnosis is one picture. Note the FLOOR matters
as much as the source — at a 1ms hop a single stray sample splits one 580ms
silence into two short ones and the number stops describing anything anybody
hears.

### The jiggle, and the crowd grew a middle ring

**THE SHIVER WAS A DIRECTION DERIVED FROM A POSITION THAT THE MOVEMENT
CHANGES.** Reported 2026-08-24: cigarettes "get jiggly at a distance from the
player". The orbit read

    this.orbit += CONFIG.enemyCircleSpeed * dt * (this.z > player.z ? 1 : -1);

-- so an enemy circling across the player's DEPTH line flipped its own
direction, walked back over the line, and flipped again. Parked on the crossing
it shivered there for the rest of the fight. **A feedback loop, not a jitter:
the sign came from the thing the sign was moving.** `orbitDir` is decided once
and kept.

⚠️ **AND SEEDING IT FROM THE SPAWN POSITION CLUMPED**, which was the first fix
and was wrong in a way only the real placements showed: `floor(x*0.013 +
z*0.019) % 2` put ALL FIVE of the first arena's cigarettes the same way round,
because the x coefficient times the gap between two placements is smaller than
one parity step. The whole wave circled as one -- the queue the orbit exists to
avoid. `Crowd.add` deals the direction out ALTERNATING instead: it is a property
of the GROUP, like the attack token, because what matters is that a wave splits
both ways and no enemy can know that on its own. ⚠️ **Test a "spread" hash
against the actual data, not against the idea of it.**

**AND THE CROWD IS THREE RINGS NOW, NOT TWO.** Asked for in the same message:
`maxAttackers` 2 -> **3**, plus ONE understudy holding at `enemyReadyRadius`
130 while everybody else stays out at 210.

**THE MIDDLE RING IS THE POINT OF THE CHANGE.** With one radius, a freed slot
was filled by whoever was nearest -- and nearest was still 210px away, so every
hand-over cost a walk and the fight visibly breathed in and out. 130 is close
enough to step straight in and still outside `enemyStandoffX` (63), so the
understudy reads as WAITING rather than crowding. It circles at half speed for
the same reason: someone about to move in should look settled.

⚠️ **AND THE FIRST VERSION OF THE UNDERSTUDY PUT THE JIGGLE STRAIGHT BACK.** It
was rechosen every frame by distance, "deliberately not sticky" -- so the flag
ping-ponged between the two nearest candidates whenever they were about equally
far, and since being the understudy moves your target radius by 80px, the pair
lurched between 130 and 210 on alternate frames. Reported within the hour as
"the 4th and the 5th are very very wiggly, its the same bug we had before", and
it was: **the same shape as the bug it was written to fix -- a decision derived
from a live quantity that the decision itself moves -- reintroduced one function
away, in the fix for it.**

**IT IS STICKY NOW:** held until that enemy takes a turn, is hit, goes down or
dies. ⚠️ And the reason "not sticky" was written -- that a remembered understudy
would keep its close radius after drifting to the back -- **cannot happen**,
because being the understudy pulls an enemy IN. It can only get nearer while it
holds the flag. The argument for the broken version was about a failure mode
that the mechanism itself rules out.

Set BEFORE `update` so the flag is read on the frame it is decided.

⚠️ **AND WHAT RULED THE OTHER SUSPECT OUT WAS ARITHMETIC, NOT LOOKING.** Before
touching anything, the per-frame step was measured against the deadzone: 2 to
3px of movement against a 10px band, so `ix`/`iz` cannot flip from overshoot.
That left exactly one candidate.

⚠️ **`maxAttackers` 3 IS A DIFFICULTY CHANGE AND THE HP TABLE HAS NOT MOVED.**
The file's own note calls 3 "a beating". It lands on a player whose finisher now
sweeps and whose air attack launches -- both of which exist to answer exactly
this -- so the two are meant to be judged together.

### The last of the wiggle: a fighter can only walk at one speed

**THE UNDERSTUDY WAS STILL TWITCHING** after the orbit direction was fixed and
after the flag was made sticky -- "mainly in the fourth guy". Third cause, and
nothing to do with the first two.

⚠️ **A DEADZONE DOES NOT SMOOTH A FOLLOW; IT QUANTISES IT.** `walk()` takes a
direction of -1/0/1, so an enemy tracking a moving point can move at FULL speed
or not at all. The orbit target's speed is `enemyCircleSpeed x radius`:

    outer ring   189 px/s   against a walk of 192 -- near enough matched, so it
                            walks continuously and looks smooth
    understudy    81 px/s   against the same 192 -- it sat inside the 10px
                            deadzone for SEVEN frames, jerked 3.2px, and stopped

**That is why it was the fourth guy specifically: his target is the SLOWEST, so
he spent the most time unable to move at all.** The fifth looked fine for the
same reason the fourth did not.

**`_seek()` REPLACES THE DEADZONE WITH A SCALE.** The step is scaled down to
exactly close the gap when the gap is smaller than a full step -- which removes
the overshoot the deadzone existed to prevent AND lets him move at 81px/s. In
the steady state he now covers exactly the 1.35px his target opened.

⚠️ **AND THE FIRST CUT OF IT INTRODUCED A WIGGLE AT RIGHT ANGLES.** Passing
`(±1, ±1)` to `walk` makes a fighter one pixel out in DEPTH walk a full
diagonal, sail past in z and flip back next frame. `walk()` normalises whatever
it is handed, so the RAW DELTA is a proportional direction -- the difference
between "walk northeast" and "walk mostly east". Caught by arithmetic before it
was ever seen.

**THREE CAUSES, ONE SYMPTOM, AND THEY HAD TO BE FIXED IN ORDER:** a direction
derived from a position it moved (the orbit), a flag derived from a distance it
moved (the understudy), and a controller that could not move slowly (this). Each
fix made the next one visible. ⚠️ **"It is better but not gone" is a report to
take literally** -- it meant a different bug, not an insufficient fix.

### The barrel can have a bomb in it

**35% SOMETHING, THEN 50/50 CHICKEN OR BOMB** -- so a barrel is 17.5% chicken,
17.5% bomb and 65% empty. Asked for 2026-08-24. ⚠️ **Both rolls happen at BIRTH,
not at the break**, which is the rule `dropChance` already followed: what is IN
a barrel does not change, and breaking it twice cannot give two answers.

⚠️ **AND I READ HALF THE ART WRONG.** `bomb2` is not "the same bomb with a
coiled fuse", it is the bomb's OTHER FACING -- fuse to the right, fuse to the
left. The user had to say so: "it also has front and back". They are HAND-DRAWN
VIEWS rather than mirrors (the coil differs, the highlight differs, the anchors
sit at 41% and 59% of the frame), so `Bomb._frame` picks the ROW from the facing
and `draw` passes the pack's NATIVE side -- letting `sheets.draw` flip one would
have mirrored the left drawing back to the right and left `bomb2` unused, which
is what was happening. ⚠️ **The same pairing exists for `side`/`side2` and the
barrel uses only `side`** -- not an oversight to copy: a barrel lying down is
near enough symmetrical for a flip to pass and a lit fuse is not.

**THE ART TOLD ME WHAT THE BOMB DOES.** The pack has had `bomb` and `bomb2`
sitting in it unused -- three frames each of a round black bomb whose FUSE BURNS
DOWN, the spark walking in toward the casing and the sprite losing 8px of height
doing it. A straight fuse and a coiled one: two drawings of ONE object, not two
stages, so a bomb picks one at birth and keeps it. Nothing else fits a burning
fuse, so it lands, burns, and goes off.

⚠️ **WHO IT HURTS WAS THE ONE THING NOT SPECIFIED, AND THE READING IS: EVERYONE
IN RANGE, PLAYER INCLUDED.** That is what makes the 50/50 with the chicken a
GAMBLE rather than a reward -- break a barrel and you might get a heal or you
might get a problem -- and it is why `fuseMs` is 1400, about two and a half
walking seconds to get clear. Flagged rather than assumed; sparing either side
is one test in `Props._blast`. ⚠️ Bosses are NOT damaged: they are not in
`crowd`, and adding them would let a barrel chip a boss from across the room.

**AND THEN IT BECAME A WEAPON, WHICH REWROTE THE CLASS.** Asked for within the
hour: pick it up, throw it, it explodes on whatever it hits -- and on nothing at
all if it hits nothing -- and 8 seconds if you leave it. It went in as a class of
its own (land, burn, explode) and that was right for the first spec and wrong
for this one.

⚠️ **`Bomb extends Prop` NOW, AND THAT IS THE WHOLE DESIGN.** A throwable that
breaks on impact is a BARREL THAT ENDS DIFFERENTLY: the lift arc, the carry, the
throw, the tumble, `combat.propHits`, the reaper and the punchability are all
already written and already tuned. Three overrides -- the fuse, the smash, the
frame -- and it goes off FOUR ways of which only the last is its own code:
thrown into an enemy, thrown onto the floor, punched where it lies, or the fuse.
**When a new thing acquires an existing thing's verbs, it is that thing.**

⚠️ **THE FUSE RUNS WHILE IT IS HELD**, deliberately: picking one up starts a
countdown you are now carrying and the throw is how you spend it. Pausing it in
his hands would make holding a lit bomb the safest thing in the game.

⚠️ **AND `smash()` HAS TO RELEASE THE HOLDER FIRST.** `Prop.smash` nulls its own
`holder` and stops there -- fine for a barrel, because nothing smashes one in a
player's hands. A bomb does, EVERY TIME THE FUSE WINS, and half a released
reference is the two-references bug this file has now hit six times: the player
keeps `carrying` pointed at something that has exploded, stays in the carry
pose, and the punch button goes on trying to throw it.

⚠️ **AND THE SUBCLASSING BROUGHT ITS OWN TRAPS, ALL FOUND BY RUNNING IT:**
* `cfg` is a FIELD on Prop, and it had been a METHOD on the standalone Bomb.
  `Props._blast` still called `bomb.cfg()` -- a crash reachable only by an
  explosion, which is to say only in play.
* `Prop`'s constructor rolls `drops` for EVERYTHING, and `Props.update` spawns a
  drop for any prop that smashes with it set. Without `this.drops = false` a
  bomb would explode and leave a chicken in the crater.
* `smashMs` must be at least as long as the BURST -- `gone` arrives that long
  after the smash and the reaper removes it then. 1100 was one draft: 21ms
  SHORTER than the 1121ms burst, so the explosion would have been deleted
  before its last frame.
* `throwDamage` cannot be 0: `combat.js` reads it as `C.throwDamage || 22`, the
  falsy trap this file documents in four other places. 8, and the blast is the
  rest.
* The boom sheet is read through `sheets.assets`. The shell hands everything in
  the sorted pass `(ctx, sheets, camX)` and only a BOSS gets raw `assets`, by
  declaring `usesSheets` false -- a bomb needs BOTH, so it takes what it is
  given rather than growing a second exception in `render()`.

**IT WAS SIMULATED RATHER THAN ASSUMED**, after `node --check` had already
passed over two real defects earlier in the same feature: the 8s fuse, the
lift/throw/land path, the fuse running out while held (and releasing the
holder), the blast radius hitting a player 30px away and sparing an enemy 500px
away, one blast per bomb, and the reap landing at 9.3s and not 9.0s.

**THE BLAST GOES THROUGH `hurt()` LIKE ANY OTHER BLOW**, so the knockdown, the
i-frames, the flinch and the stats all behave as they do for a punch -- nothing
in there knows what a bomb is except the numbers. Its radius weights DEPTH
DOUBLE, the same weighting the crowd's token uses: a belt 190 deep against a
screen 1280 wide means an unweighted circle would cover most of the lane.

**THE LAST THREE SECONDS PANIC.** The fuse flickers 75ms -> 40ms a frame and a
RED GLOW blinks with it. ⚠️ A STEP rather than a ramp, deliberately: a threshold
is something you can NOTICE -- the moment it changes is the warning -- where a
gradual acceleration is only visible in hindsight, by which time it has gone
off.

⚠️ **"TOGETHER WITH THE NEW SPRITE FREQUENCY" IS A REQUIREMENT ABOUT TWO THINGS
AGREEING, AND IT IS MET BY DERIVATION.** The glow is lit on step 0 of the
three-frame cycle, so it pulses at exactly a third of whatever rate the fuse is
flickering at -- measured, 8.6 blinks a second and lit 34% of the time -- and it
follows `animPanicMs` automatically if that ever moves. Given a timer of its own
the two would drift into and out of phase and read as two effects rather than
one alarm. **When two effects are asked to be "together", make one read the
other rather than giving them matching numbers.**

⚠️ **THE BOMB ITSELF IS PAINTED RED, AND A GLOW AROUND IT WENT IN FIRST AND WAS
HORRIBLE.** The halo was reached for because it is cheap and because
`sheets.draw`'s `flash` pass cannot do colour -- it is `lighter` with the sprite
as its own source, and adding a black bomb to itself adds nothing. **Cheap was
not the requirement**, and the argument written to justify it ("on a black bomb a
halo reads better anyway") was a rationalisation of the easy option. It is a
MASKED FILL now: the frame is drawn into a shared scratch canvas, `source-in`
replaces every opaque pixel with flat red while keeping the alpha, and that
silhouette -- fuse, spark and all -- is blitted over the bomb.

⚠️ **THE SCRATCH CANVAS IS A STATIC ON THE CLASS**, cleared each use and resized
only when the drawn size changes. One per bomb per frame would be an allocation
25 times a second.

⚠️ **AND THE RED IS SKIPPED DURING THE HOIST.** `Prop.draw` shifts `drawY` while
a prop is being lifted -- the arithmetic that keeps a turning barrel's centre
still -- and this pass draws at the plain ground point, so the two disagree for
the 640ms of a pickup. Rather than copy that arithmetic into a second place
where it could drift, the red simply does not paint then. The wick is still
flickering, so the bomb is not silent.

⚠️ **NO EXPLOSION SOUND.** There is no boom in `CONFIG.SFX` and none was
invented.

**A PLACEMENT CAN OVERRULE BOTH ROLLS** -- `drops` and `dropKind` on a
`ROOMS[].props` barrel entry, threaded through `Props.add` as the whole
placement rather than as two more arguments. The first test barrel has
`drops: true`: at the real 35% you would break four barrels to see one chicken,
and that barrel exists to be broken the moment a run starts. The KIND is left to
the honest 50/50, which is what "always drop a chicken or a bomb" asks for.

⚠️ **AND WIRING IT TURNED UP A LIVE BUG I HAD JUST SHIPPED: `dropKind` WAS NEVER
WRITTEN.** An earlier edit had added `o.dropKind || 'chicken'` at the break site
while the constructor half of the same change never reached the file -- so the
field was undefined and **every barrel dropped a chicken. The bomb could never
have appeared.** It would have been reported as "the bomb does not work" and
looked like a drawing or a spawn problem.

⚠️ **AND `node --check` PASSED THE WHOLE TIME, TWICE.** It is a SYNTAX check: it
cannot see an undefined field, and it did not see `place` being read as an
undeclared identifier inside a class either -- which is a hard ReferenceError on
every barrel, in strict mode, which classes always are. **A syntax check is not
evidence that code runs.** Instantiating the class once, with each shape of
argument, found both in seconds and also confirmed the distribution: 35.1%
drops, 49/51 bomb to chicken over 20,000 rolls.

### The white flash became the bosses' tell by being nobody else's

**`hitFlash: false`.** Mooks and the player no longer whiten when they are hit;
the two bosses still do. Asked for 2026-08-24.

**IT COSTS THE FIGHTERS NOTHING** because a fighter already announces a hit
three other ways: the flinch pose, the knockback, and -- since this same session
-- a grunt if it was floored. The flash was the fourth cue on an event that was
never ambiguous.

⚠️ **AND THE BOSSES HAVE NO HURT ART AT ALL.** `horse-boss.js` says so at the
top -- "there is no hurt, knockdown or death art, confirmed rather than
assumed" -- so for them the flash is the ONLY thing that says a punch landed.
Taking it off everybody else is what turns it from decoration into their tell.

**THE KNOB CANNOT REACH THEM, AND THAT IS STRUCTURE RATHER THAN LUCK.**
`FlyBoss` and `HorseBoss` do not extend `Fighter`; each keeps its own `flash`
field, sets it in its own `hurt()` and decays it in its own `update()`. So
`CONFIG.hitFlash` is the FIGHTERS' knob by construction and cannot silence a
boss by accident -- which is also why the asymmetry needs no test anywhere.

The machinery stays: `flash` is still a field, still decays, still reaches
`sheets.draw`. One boolean brings it back.

### Fourth cause: a threshold coarser than the slowest step

**"IT APPEARS AS IF HE IS BETWEEN TWO LOOPS, AND IS STUCK BETWEEN THEM."** That
description located it. The two points are the ENDS of the orbit ellipse.

⚠️ **`_seek`'s ARRIVE THRESHOLD WAS 1px, AND A THRESHOLD IS A DEADZONE BY
ANOTHER NAME.** It fails the same way and for the same reason: it has to be
smaller than the SLOWEST step the target ever takes, and the orbit is an ELLIPSE
-- so the target's speed varies around it.

    side of the ellipse   1.35 px/frame   fine
    end of the ellipse    0.47 px/frame   BELOW a 1px threshold

At the two ends the understudy stopped dead, the target crept past 1px, he took
one step onto it and stopped again. Only him, because his ring turns at half
speed and his target is the slowest thing on screen -- which is the same reason
he was the one still twitching in the round before. 0.05px now: small enough
that nothing in this game can hide under it, and it exists only to keep `gap`
out of a divisor.

**AND THE RADIUS IS EASED RATHER THAN SWITCHED**, `enemyRingEase`. This is belt
AND braces: read fresh each frame, becoming the understudy teleported the target
30px inward, so the flag changing for ANY reason lurched the enemy between two
circles. Held as state and eased, a promotion reads as stepping in, and a flag
that ever did flicker could not produce more than a fraction of a pixel.

⚠️ **THAT IS THE SAME CLASS OF BUG FOUR TIMES IN ONE SESSION** -- a value read
fresh from something that moves. The orbit direction, the understudy flag, the
seek deadzone, the ring radius. **The fix that lasts is not a better threshold,
it is removing the thing that can be read fresh:** `orbitDir` is dealt once,
`ready` is sticky, `ringR` is eased, and the deadzone is gone rather than
retuned. A threshold small enough today is a bug waiting for a slower target.

### The outer ring wanders off

**EVERYBODY PAST THE UNDERSTUDY GETS BORED.** `ENEMY_STROLL`: every 4 to 9
seconds an enemy with no turn and no understudy flag walks to the far end of the
arena from the player and then rejoins the ring. Asked for 2026-08-24 -- "the
5th and beyond can distract themselves from time to time, going to the other end
of the screen and coming back to check the fight".

**AND THE UNDERSTUDY WENT BACK TWO STEPS**, `enemyReadyRadius` 130 -> 180: "the
4th guy is still too close". At ~192px/s a step is about 40px, so that is
literally the couple of steps asked for. Still inside the 210 ring and still far
outside `enemyStandoffX` (63) -- the intent at 130 was right and the number
overshot.

⚠️ **THE DESTINATION IS READ ONCE**, at the moment the stroll begins: the far
end of the walkable span from where the PLAYER was standing then. Recomputing it
per frame is the bug this file has already produced TWICE in one day -- the
orbit direction, then the understudy flag -- and here it would be worse than a
jiggle: the enemy would turn round every time the player crossed the middle of
the arena.

⚠️ **A SUMMONS ENDS A WANDER, AND `stroll` IS NOT IN THE TOKEN'S SKIP LIST.**
That is the "coming back to check the fight" half of the request and it needed
no code: the token branch runs before this one. What it DID need was clearing
the flag in `takeTurn()` -- otherwise, the moment his turn ended, he would
resume walking towards a place chosen for a fight that had since moved.

⚠️ **AND TWO CLOCKS HAD TO BE ARGUED WITH, NOT GUESSED:**
* `strollT` starts SEEDED, not at zero. At zero the countdown is already expired
  and every enemy set off the instant it stopped attacking -- the whole back of
  the crowd walking away at once, which is the opposite of the effect.
* `maxMs` must be LONGER THAN A CROSSING or it is the normal exit rather than a
  safety net. It was 4000 for one pass: the arena is 1160px, an enemy at the 210
  ring is ~840px from the far target, and at 163px/s that is 5.1 seconds -- so
  nobody ever arrived, they turned round three quarters of the way, and it read
  as aimless rather than as going somewhere. 6000.

### The enemy answers a knockdown

**`enemy-hit-1.ogg` PLAYS WHEN A BLOW PUTS A FIGHTER DOWN** -- the finisher and
the air attack. Asked for 2026-08-24.

⚠️ **IT WAS A TAKE, NOT AN EFFECT, AND THAT IS THE THIRD TIME.** 1.93s of
recording with the grunt 452ms of it starting at **734ms** -- played raw the
enemy would have answered three quarters of a second after hitting the floor.
`build-beat-sfx.py enemy-hit-1` cuts it. **Envelope every borrowed or raw file
before wiring it**; the coin, the victory clip and now this one all looked
equally finished from the filename and two of the three were not.

**LAYERED UNDER THE PUNCH, NOT INSTEAD OF IT.** The blow is the event and this
is the reaction -- the same arrangement `_takeHitSound()` already makes for the
player. `SFX_GAIN` 0.7, about 3dB under `comboFinish`, which is itself lifted to
1.2: at 1.0 the two arrived level and fought.

⚠️ **TRIGGERED BY `box.def.knockdown`, NOT BY THE MOVE'S NAME**, so a third
knockdown attack gets it without touching this.

⚠️ **AND `t.scores !== false` IS THE "IS THIS A FIGHTER" TEST**, the same one the
kill counter uses. A barrel answers the whole target interface and is struck by
exactly this code, so without it a finisher that caught only a crate would play
a grunt for a crate.

⚠️ **ONCE PER SWING, NOT ONCE PER BODY** -- the `sweep` lesson again, and the
fourth thing on that path to need it.

**AND THE HERO GOT A VOICE, OUT OF THE ENEMIES' POOL.** `enemy-hit-3` was the
enemies' second grunt for about an hour and was then moved: it plays for the
PLAYER now, under the pitched-down punch, on every hit he takes. The enemy pool
is back to one entry -- and is still a POOL, because it has already been both
sizes in a day.

⚠️ **ONLY ON A KNOCKDOWN, AND I GOT THIS WRONG FIRST.** It went in on EVERY hit
he takes, on the argument that "a knockback hit" describes every blow because
every enemy attack carries knockback -- and that only the barata's charge sets
`knockdown`, making the narrow reading a once-a-level event. **The count was
wrong.** I had read the cigarettes' plain punches, which set nothing, and
generalised from them. FOUR attacks bowl the player over:

    BARATA_CHARGE.knockdown        the rolling ball, all through the roach waves
    HORSE_BOSS.chargeKnockdown     his charge
    HORSE_BOSS.kickKnockdown       his kick
    FlyBoss, `knockdown: ambush`   the Mosca's ambush pass

So "a knockback hit" IS a real category in this game. ⚠️ **Counting how often a
flag is set is not the same as grepping the first place it could be set** --
the cigarettes are the enemies you meet most and they were the least
representative sample available.

**AND HE HAS A DEATH CRY** (`enemy-hit-2`, cut to `player-death`). On the blow
that kills, IN PLACE OF the knockdown voice -- the killing blow also floors him,
so both would fire on one frame. Same precedence the enemies' death takes over
their grunt. The strike still plays; he was still hit.

⚠️ **IT IS NOT `GAME_OVER_STING`.** That is MUSIC, it stops the bed, and it only
happens on the LAST life. This is a voice on EVERY death, and when the two
coincide they are a beat apart: this one on the blow, that one once the death
has finished being watched.

**ALL FOUR TAKES ARE NOW USED, AND TWO OF THEM TURNED OUT TO BE HIS.** They were
recorded as enemy noises -- `enemy-hit-1` is the enemy grunt, `-3` became the
hero's, `-4-oof` the enemy death, `-2` his. ⚠️ Their gains are all DERIVED
rather than judged: the first three cuts land between -14.2 and -14.6 dBFS and
share 0.7, while `player-death` measures -10.8 and so takes 0.47 to sit in the
same place. A file being hotter is not the same as a sound being louder.

**AND THEN THE BOSSES CAME OUT OF IT, the same day.** `bossHits` passes `false`,
so of those four only the BARATA CHARGE reaches the voice -- both bosses come
through one function and both were grunting. Requested, and it holds up: a
boss's blows already announce themselves. The Mosca's ambush drops the player
for no damage at all as its whole point, and the horse's charge has a wind-up
you are meant to read; a voice under either is one cue too many on the loudest
moments in the game. The strike still plays for both.

**AND IT IS THE SOUND THAT SAYS WHO WAS HIT.** The pitched punch is the same
recording he hears when HE connects -- deliberate, so the fight has one
vocabulary -- and a pitch shift alone is a thin way to tell the two directions
apart in a crowd. The voice is the difference, the same job the enemies' grunt
does for a knockdown.

**AND THERE WERE TWO OF THEM FOR AN HOUR, ROLLED PER KNOCKDOWN** (`ENEMY_HIT_SFX`,
`enemy-hit-1` and `enemy-hit-3`). ⚠️ **RANDOM, NOT ALTERNATING**, and with two
entries that is a real difference: strict alternation is perfectly predictable
-- every other knockdown the same sound -- which is the pattern an ear finds
fastest. A free roll repeats sometimes, and a grunt repeating is what a person
knocked down twice actually sounds like. ⚠️ The roll is on the EVENT, never per
frame, which is the rule the impact art already follows. Kept as a LIST so a
third costs one entry and nothing in combat.js.

**AND A THIRD SOUND FOR THE BLOW THAT KILLS** (`enemyDeath`, cut from
`enemy-hit-4-oof`). ⚠️ **IT REPLACES THE GRUNT RATHER THAN STACKING WITH IT** --
the killing blow also knocks down, so both tests pass on the same frame, and two
vocal samples out of one body at once is a mess. The death is the more
interesting of the two, so it wins.

⚠️ **READ ON THE TRANSITION, NOT ON `dead`.** A body stays `dead` for its whole
0.8s fade, so a sweep that clipped one would announce a death that happened
seconds ago. `!wasDead && t.dead`, tracked OUTSIDE the `stats` block because a
sound must not depend on there being a scoreboard.

**A THROWN BARREL GETS IT TOO** -- a death should sound like one however it
arrived, and `hitIds` already guarantees one visit per enemy per throw.

⚠️ **AND THEN THE BOSSES WERE TAKEN OUT OF IT, WHICH WAS FLAGGED IN ADVANCE.**
When this went in, `scores !== false` was the only gate, so the Mosca and the
horse grunted and cried like mooks -- noted at the time as probably wrong and
left for the user, who reported it: "the fly boss is still making getting hit
noises, I want just the punch hit noise, not the cry."

**`voiced: false` ON BOTH BOSSES**, and it is a SECOND gate rather than a
widening of the first, because the two ask different questions: `scores` is "is
this a fighter" (it keeps barrels out), `voiced` is "does this one make noises
about it". A boss is announced by its own art, its own health bar and its own
death; the grunt and the cry belong to the mooks. ⚠️ A property on the target
rather than a `kind` test in combat.js -- the bargain every other thing about a
boss makes -- so a third boss is silent by declaring it.

⚠️ **enemy-hit-3's TAKE PEAKS AT 1.015** -- already clipped on the phone. The
cutter's -1 dBFS ceiling is what makes it usable, and the two cuts land within
0.3dB of each other, so one `SFX_GAIN` does for both and the random pick cannot
double as a volume change.

**A TOOLING NOTE WORTH KEEPING:** the cut failed the first time with "Unknown
encoder 'libopus'". `/home/cmoryah/anaconda3/bin/ffmpeg` is first on PATH in
some shells and does NOT have it; `/usr/bin/ffmpeg` does. Every audio tool here
shells out to bare `ffmpeg`. It failed loudly and wrote nothing, which is the
right failure -- but if a bake ever produces silence, check which ffmpeg ran.

### The pause screen, and most of it already existed

**ENTER OR START.** `CONFIG.PAUSE`. Almost none of this was new plumbing:
`input.takePause()` and `_pauseQueued` have been in the file since early on,
wired to P and Escape, and `game.js` had the line

    if (input.takePause() && (phase === 'play')) { /* reserved */ }

sitting exactly where the check needed to go. The pad profile has ALSO named the
button all along -- `pause: 9`, Start -- and nothing had ever read it. **Look for
the stub before building the mechanism**: this is the third time today (the
`enter` state, `stopOnce`'s absence, and now this).

⚠️ **ENTER PAUSES *AND* STILL COUNTS AS AN ANY-PRESS**, which P, Escape and M
beside it deliberately do not. It can afford to: pause is read only in PLAY and
`_anyPress` only on the front and end screens, so one press can never do both --
and every end screen flushes the queue on entry anyway. Enter is the key a
player reaches for to dismiss a card and taking that away would be the worse
trade.

**IT IS A FLAG, NOT A PHASE, AND THAT IS THE DESIGN DECISION.** The play phase
holds a segment, a crowd, a camera and a boss mid-anything, and a phase change
is the one thing in this file that has repeatedly torn state like that in half.
Held as a flag, `play` is still `play` and a pause is simply a frame that does
not advance it.

⚠️ **READ ABOVE EVERYTHING, INCLUDING THE HITSTOP RETURN.** That branch leaves
`loop()` early for a few dozen ms after every connect; below it, a pause pressed
on a hit would be eaten.

⚠️ **`phase === 'play' || paused` IS NOT BELT AND BRACES.** Without the second
half a pause could never be LIFTED: the branch returns before anything can
change the phase, so the test would keep asking about a phase nobody is in.

⚠️ **AND IT SCHEDULES A FRAME.** Leaving `loop()` without one is this game's
recurring bug and it presents as input being dead on a screen that looks
completely normal -- which, on a pause screen, would look exactly like a pause
screen and might never have been noticed.

**THE CONTROLS LIVE ON IT.** The key list was removed from the bottom of the
canvas the same day for cluttering the shot; a pause screen is where a player
who needs it goes to look. Portuguese, with the way out as the last line so it
reads as an instruction rather than as one more item.

**THE SOUND STOPS WITH IT**, asked for immediately after. ⚠️ **By suspending the
AudioContext, NOT by stopping the music.** `stopMusic()` releases the source, so
coming back means `playMusic()`, which starts a track from ZERO -- harmless on a
five-second bed and wrong on the horse's four-and-a-half-minute song, which
every pause would rewind to the top. A suspended context freezes its own clock:
every voice resumes on the sample it stopped on, and the whistle layer keeps the
phase against the bed that a scheduled start was needed to establish in the first
place. Effects go with it, which is what a pause means.

⚠️ **AND `Sound._resume()` HAD TO LEARN ABOUT IT.** It is bound to keydown and
pointerdown on the window for the autoplay unlock -- so the very press that opens
the pause screen would have resumed the context a moment after this suspended
it. One flag, checked first.

**AND THE SCREEN IS ONE WORD.** A control list was put on it -- reasonable, on
the day the key list came off the bottom of the canvas -- and taken back out
within the hour. ⚠️ So the game now tells the player nothing about its controls
anywhere. That is a decision made twice, in two places, in one day; the itch page
is what is left.

### A thrown barrel gives up what was in it

**ITEMS ONLY COME OUT OF A BARREL BROKEN BY PUNCHING IT.** Asked for
2026-08-24. `Prop.smash` clears `drops` when the break is `sideways`.

**`sideways` ALREADY CARRIED THE ANSWER AND NOTHING NEW HAD TO BE TRACKED.** It
picks the rotated splinter scatter, and it is true in exactly the three cases
that mean THROWN -- landing, hitting a wall, hitting an enemy -- and false only
for `hp <= 0`, which is a barrel punched apart where it stood. Nothing else
calls `smash()`. The flag now has two jobs and the header says so.

**IT READS AS A CHOICE RATHER THAN A NERF.** A barrel is either a WEAPON or a
container, and throwing it spends it as the weapon. Before this the throw was
strictly better than the punch: same break, same drop, plus damage to whoever it
landed on.

⚠️ **CLEARED IN `smash()`, NOT TESTED IN `Props.update`**, so there is one place
that knows a barrel's contents are gone and `drops` never lies about what is
still inside. It stays a BIRTH roll -- what is in the barrel does not change,
only whether it survives the way the barrel was opened.

⚠️ **`dropChance` 0.35 MAY NOW BE TOO LOW.** It was tuned when every barrel was
a potential chicken however it broke; it is now the chance per barrel the player
chooses to PUNCH. If food feels scarce, that is the knob -- not the placed
drumsticks.

### One flinch drawing per blow, alternating

**THE HURT ROW NO LONGER CYCLES.** Each blow that stuns picks ONE of its two
drawings and HOLDS it for the whole stun; the next blow gets the other.
`hurtVariant`, bumped where the hurt state is entered and taken modulo the row's
length in `frameStep`. Asked for 2026-08-24: "for every hit we use one of these
frames, they should alternate for each hit."

⚠️ **THIS OVERRULES A NOTE THAT ARGUED THE OPPOSITE, AND THE ARGUMENT WAS NOT
WRONG.** `frameStep` carried "HURT CYCLES, IT DOES NOT HOLD -- a flinch drawn as
two poses is a shudder, and a shudder that freezes on its second frame reads as
a fighter that got stuck." Coherent, and not what the game wanted: cycling meant
EVERY hit played the same 0-1-0 shudder, so the two drawings read as one
animation instead of as two different flinches. Held and alternated, the sheet's
two poses are two ways of being hit.

**`stateT` IS NOT READ FOR THIS POSE AT ALL NOW** -- the drawing is chosen by
the BLOW rather than by time, which is why it holds: there is nothing to
advance. `POSE_MS.hurt` is dead for it as a result, left in the shared table
because nothing else reads it wrongly.

⚠️ **THE COUNTER IS BUMPED ON STUNS ONLY, not on every blow.** A knockdown never
draws the flinch, so counting it would spend a drawing nobody saw and let the
next two stuns show the same one. Same reasoning as `_comboDefs()` flipping only
when a chain begins.

**IT IS THE SAME TRICK AS THE TWO FINISHERS**, and taken modulo the row rather
than hardcoded to two -- re-cut the sheet with three flinches and it cycles
three without this line changing.

### Being hit moves in steps too

**THE KNOCKBACK NOW JUMPS INSTEAD OF SLIDING** -- `hurtStepPx: 10`. Asked for
2026-08-24 as "the same thing you did to the barrel pickup, like choppy".

⚠️ **WHAT WAS FLUID ABOUT BEING HIT WAS NEVER THE DRAWING, AND THAT IS WORTH
CHECKING BEFORE TOUCHING AN ANIMATION.** The `hurt` row is TWO frames cycling at
100ms -- it cannot flow. The continuous thing is the SHOVE: the knockback
sliding the body along under a drawing that was already stepped, which is
exactly the two-motions-at-two-rates the barrel's hoist had. The fix is in
`_drift`, not in `frameStep`.

⚠️ **THE SIMULATION IS STEPPED, NOT THE DRAWING.** Rounding one entity's drawn
position while the world scrolls sub-pixel is a flicker this project has already
been bitten by, and it would put the body somewhere its hitbox is not.

**AND THE REMAINDER IS BANKED, NOT DROPPED** (`_driftAcc`), so the total
distance a blow moves someone is exactly the `knockback / knockbackDecay` it
always was -- it simply arrives in jumps. An enemy jab (110) lands in 2 jumps, a
string's last hit (300) in 5. ⚠️ Cleared on a fresh `hurt()`, or a banked
remainder from the last blow would land on the first frame of the next one and
read as a hit connecting early.

**DEPTH IS LEFT SMOOTH** -- a shove is along x, and stepping z would make anyone
nudged sideways twitch across the belt. **And the death fall is untouched**,
because it is `state: 'down'` rather than `hurt`.

⚠️ **IT APPLIES TO EVERY FIGHTER.** The `hurt` state is shared, and a choppy
shove on the player against a smooth one on the enemies he is hitting would be
two visual languages in one fight.

### A barrel is put DOWN in front of him, not through him

**`drop()` USED TO LAND IT ON `by.x` EXACTLY** -- the barrel stood in the same
place he did and drew over him. Reported 2026-08-24. It now goes down on the
side he is FACING (`facingSign(by.facing)`), so putting one down reads as
setting it down.

⚠️ **THE OFFSET IS CAPPED BY `liftRangeX`, AND THAT NEARLY MADE THIS A HALF
FIX.** Clearing the two hitboxes needs 89 -- his half-width 26.6 plus the
barrel's 62.4 -- but the reach to pick a barrel up was 74, so anything that
actually cleared him was a barrel he could no longer pick back up. The choice
looked like "still overlapping" or "a silent softlock on his own barrel".

⚠️ **WHICH TURNED UP THE SAME BUG AS THE THROW SPEED, THE SECOND TIME IN A
DAY.** `liftRangeX` is measured CENTRE TO CENTRE, so the margin a player feels
is it minus the barrel's half-width: 74 - 44 = **30px** against the old 110px
barrel, and 74 - 62.4 = **11.6px** once it grew to 156. The barrel got 43%
bigger and the reach never followed -- grabbing one had quietly become four
times fussier and nobody had reported it yet. **Rescaling a sprite silently
retunes every distance AND every speed measured against it; after a `drawScale`
change, walk the numbers that touch that object.**

**SO BOTH MOVED, AS ONE DECISION:** `liftRangeX` 74 -> 105 (the range scaled by
156/110) and `dropAheadPx` 89 (derived, exactly where the boxes stop
overlapping), leaving 16px of slack. ⚠️ Scaling the RANGE is not the same as
restoring the MARGIN -- 105 gives 42.6px where the original was 30, and an exact
restore (92) would have left only 3px over the drop, which one frame of movement
would eat. The more generous of the two was taken deliberately.

**NOT TOUCHED:** the holder DYING while carrying still leaves the barrel at his
position (`Prop.update`'s held branch releases and zeroes `jumpY` rather than
calling `drop`). A barrel on a corpse is not the thing that was reported, and
the two paths do different jobs.

### The hoist blinks between four positions

**THE BARREL NOW STEPS INSTEAD OF GLIDING** while it is being picked up --
`LIFT_ARC.steps: 4`. Asked for 2026-08-24: "when you are picking the barrel up,
make 4 frames and blink between them".

**4 IS THE LIFT ROW'S FRAME COUNT AND THAT IS THE POINT, not a coincidence.**
The coconut's `lift` is exactly four drawings. A barrel gliding continuously
past an arm that moves in four steps is two motions at two rates -- which is the
same complaint as the throw one entry down, answered the other way round: there
by speeding the barrel up, here by taking the smoothness out. ⚠️ Re-cut the
sheet with more `lift` frames and this number has to move with it.

⚠️ **THE SMOOTHSTEP IS STILL UNDERNEATH, AND THE SAMPLING SITS ON TOP OF IT.**
That is the difference between a hoist and a lift shaft: sampling an EASED curve
spaces the four positions the way the ease did -- close together at both ends,
further apart through the middle. Stepping a linear ramp would put them evenly
apart, which is machinery rather than an arm.

**WHERE THE FOUR LAND**, against the arc's own 0..1: raw 0.00 / 0.33 / 0.50 /
0.68. So the barrel is in his hands at 78% of the whole reach (`startRel` 0.3
holds it on the floor for the first 30%), while the arm's fourth and final
drawing starts at 75% -- they arrive together, which is what makes the last step
read as the catch rather than as an early finish. ⚠️ `state` still becomes
`held` on the CLOCK, at 100%, so the pose is `lift` frame 3 for that last 140ms
and then `carryWalk` frame 0 -- and those two are the same drawing by design
(see `spinDeg`), so there is nothing to blend and no new flicker.

### The throw started lagging because the barrel got bigger

**+20% ON `throwSpeed` (520 -> 624)** and the carried barrel down 10px
(`carryYRel` 0.70 -> 0.627). Reported 2026-08-24: "the throwing animation is
dissincronyzed with the barrel actually moving".

⚠️ **THE THROW WAS NOT RETUNED. THE BARREL GREW 43% AN HOUR EARLIER AND THAT IS
ALMOST CERTAINLY THE CAUSE.** Speed reads RELATIVE TO THE SIZE of the thing
moving, and the numbers say it plainly: in the 231ms of follow-through after the
release, 520px/s carries the barrel 120px. Against the old 110px barrel that was
1.09 of its own width -- it cleared itself while the arm finished. Against 156px
it is **0.77 of a width**: less than crossing its own body, which is what reads
as trailing the animation.

    520 px/s   120 px   0.77 widths   (what was reported)
    624 px/s   144 px   0.92 widths   (the 20% asked for)
    737 px/s   170 px   1.09 widths   (the ORIGINAL feel, size-matched)

20% was what was asked for and is the conservative half of the distance. **737 is
where the arithmetic points** if it still trails.

**THE GENERAL LESSON, AND IT WILL RECUR:** rescaling a sprite silently retunes
every SPEED it interacts with, because motion is judged in body-widths and not
in pixels. Nothing about the throw changed; the yardstick did. ⚠️ After any
`drawScale` change, look at what MOVES that thing before assuming the movement
was always wrong.

**WHAT WAS RULED OUT.** `throwReleaseRel` 0.45 of a 5-frame row is frame 2 of 5
-- the middle of the swing, which is right, so the release MOMENT is not the
problem. ⚠️ If speed alone does not fix it, `throwLift` is the next suspect and
not the release: the barrel leaves travelling UP at 120px/s and does not reach
its apex for another 133ms, so for the first half of the follow-through it is
rising while the arm is coming down.

**AND THE 10px DROP IS ONE NUMBER FOR BOTH HALVES.** `carryYRel` is the barrel's
ground point while held, and `throwFrom` starts the throw from `_carryY()` --
so the throw leaves from the lower place too, which is what keeps carrying and
throwing looking like one motion.

### The pick-up flickered on its last frame, and the cause was frame ORDER

**ONE FRAME OF HIM STANDING WITH HIS ARMS DOWN, under a barrel that was already
over his head.** Reported 2026-08-24: "quando o personagem pega o barril, nos
últimos frames da animação, ele dá um grande flicker".

**IT WAS NOT THE ANIMATION.** `lift` is spread across the ACTION (`stateT /
pickupMs` in `frameStep`), not run at a fixed rate and not looped, so the
drawing cannot cycle or finish early. That was the first thing checked and it
ruled out the obvious suspect.

⚠️ **IT WAS THE ORDER INSIDE ONE FRAME.** `player.update` runs BEFORE
`props.update`. On the frame the reach ends:

    player.update   his own clock runs out -> state 'pickup' -> 'idle'
                    ...and `carrying` is still null
    props.update    the barrel's arc finishes -> state 'held'
    DRAW            pose(): not 'pickup', nothing carried -> plain 'idle'

The catch that set `carrying` ran on the NEXT frame, so he snapped back up into
`carryWalk`. Exactly one frame, and very visible, because the barrel was at full
carry height while his arms were at his sides.

**THE FIX IS WHO ANNOUNCES THE ARRIVAL.** The barrel now sets
`holder.carrying = this` on the frame it reaches `held`, and `Player.update`'s
block is reduced to dropping its `liftTarget` reference and handling the three
ways a hoist can fail. ⚠️ **That is not a new owner -- it is the symmetric
half of one it already had.** `_release()` has always cleared BOTH ends of the
hold, and `Prop.update`'s header already said "every path that ends a hold goes
through here or drop(); both clear both ends". The prop wrote `carrying` on the
way out and merely failed to write it on the way in.

**AND IT KILLED A DOCUMENTED RACE RATHER THAN CATCHING IT.** The hurt branch
carried a warning that a barrel arriving "this very frame" was `held` while
`carrying` was still null, so clearing the reference without letting go stranded
it on him forever. Those two are now set together, so the race cannot occur.
Both calls are still made -- `drop` then `letGo` -- and that is safe on a single
object, because `letGo` returns immediately for anything neither `held` nor
`lifting`. **Prefer removing the possibility to catching the instance**, which
is this file's own rule and was written about a different bug.

**THE BARREL ALSO GREW 43%**, in two asks: drawScale 0.8 -> 1.04 (+30%) ->
1.144 (+10%), 110px -> 156px. ⚠️ Two numbers each time -- `CHARACTERS.barril
.drawScale` is the picture and `PROPS.barrel.sizePx` is what can be hit, and a
barrel drawn bigger than it can be punched is invisible until someone swings.
`hitWRel` is a fraction so the width followed on its own; `hitZ` deliberately
did not, because a taller barrel does not stand in more of the lane.

### The barrels came back, and the flag paid for itself

**`pickupButton` IS TRUE AGAIN**, the same day it went false. That is the whole
story of the decision to leave the machinery behind a flag rather than delete
it: `Prop.lift`/`_liftArc`/`throwFrom`, `Props.liftTarget`, `Player.carrying`/
`liftTarget`/`throwHeld`, `combat.propHits` and three poses were all still here
and still correct, so restoring the verb was ONE BOOLEAN. ⚠️ Worth remembering
the next time a feature is switched off on this project: it gets switched back
on.

**AND IT DID NOT CLASH WITH FOOD**, which moved to the PUNCH button in between.
That was the argument at the time and it held: punch stoops for food and throws
a held barrel, pickup lifts and puts down. The two verbs never wanted the same
button, and turning one back on needed no thought about the other.

**TWO TEST BARRELS IN THE OPENING WALK**, x 430 and x 620. The opening segment
is a PASSAGE rather than a fight, so it is the safest place in the game to learn
a verb -- nothing can hit back while he is holding one.

⚠️ **THE FIRST IS IN HIS OWN LANE AND THAT IS NOT DECORATION.** `liftRangeZ` is
46 and he walks on at z 114, so the first placement (z 55) was 59 away and would
NOT have lifted until he stepped up -- the mechanic looking broken while working
exactly as specified, on the very barrel put there to prove it works. z 110 is
instant; the second at 165 is a step away, so the depth reach is exercised
deliberately rather than discovered as a bug. **Check a reach against the spawn
position before placing a test rig.**

⚠️ **THESE ARE NEW PLACEMENTS, NOT THE JAM PASS'S FOUR BROUGHT BACK.** Those are
left commented out exactly as they were -- whether the street wants barrels
again is a level decision and this is a test rig.

### He walks on at the start of a run

**INSTEAD OF BEING THERE ALREADY**, asked for 2026-08-24: "make him come from
the left". `CONFIG.playerEnterPx` 360 -- his centre starts 140px off the left
edge and he walks to his mark in 1.2s at `walkSpeedX`.

⚠️ **`state: 'enter'` ALREADY EXISTED AND NOTHING HAD EVER SET IT.** `canAct()`
and `vulnerable()` have both tested for it since the fighter machine was
written: the controls are dead and nothing can hit him, with no new gate added
anywhere. It was a state waiting for a user. **Look for one before inventing a
flag** -- the alternative here was an `entering` boolean plus two new tests in
exactly the two places that already had them.

⚠️ **BUT THE POSE HAD TO BE TAUGHT.** `walk()` only ever promotes `idle` to
`walk`, which is precisely what keeps `enter` meaning "not in the player's hands
yet" while he is moving -- so `pose()` returned `idle` and he SLID on. One line
in `pose()`. The half of a state that nothing had exercised was the drawing.

⚠️ **NO BOUNDS ON THE WALK**, the same reason the enemies' walk-in passes none:
he starts OUTSIDE the left gate, and clamping to it would teleport him to the
wall on his first frame -- the materialising-in-front-of-you problem the walk-on
exists to avoid, with an extra step.

**IT IS MEASURED FROM WHERE HE WOULD HAVE STOOD**, not to a fixed mark: the
caller has already placed him (the room's `startX`, or wherever a DEV jump put
him) and `enterWalk` backs him off THAT. ⚠️ Which is why it is called AFTER the
DEV room jump in `start()` -- read before it, it would measure against the
street's mark and walk him in from the wrong place in every other room.

**THE CAMERA NEEDED NOTHING.** `_followCamera` only moves when the player pushes
past the focus band, and going the other way it returns unless the room allows
reverse -- so a player at -140 leaves `camX` at 0. Checked rather than assumed.

### The boss room froze its own backdrop, and the cause was in the camera

**THE HORSE FIGHT LOCKED THE CAMERA, AND A LOCKED CAMERA IS A FROZEN SHOT.**
Reported 2026-08-24: "the background animation gets stuck when the boss enters",
and confirmed by the user in the same breath -- "the arena already works, it
just stops working after the horse boss enters".

⚠️ **THE PLATE IS SCRUBBED BY CAMERA POSITION AND BY NOTHING ELSE.**
`_drawVideo` derives the target time from `scrollX / worldPxPerSecond`, and when
the camera stops it PAUSES the element ("the player stopped: freeze the frame").
So the shot is only alive while the camera is moving. The roach wave before the
horse is `lock: false`, so it follows the player and the footage runs; the boss
segment always locked, so the room froze on one frame for the whole fight.

⚠️ **AND A COMMENT HAS BEEN LYING ABOUT THIS SINCE THE FILM SOURCE WAS
DESIGNED.** The boss branch called `setMode('plate', 'play')` under "the world
carries on around a fight" -- but `setMode` only touches a source of kind
`film`, and the plate is kind `video`, which has no 'play' mode at all. The call
has been a no-op for as long as the plate has been a video. It is kept (a film
plate would want it) and the comment now says so. **A mode that exists in one
source kind and not in another is a rule that reads as satisfied and is not.**

**THE FIX IS THE ARENA'S OWN ESCAPE HATCH, WHICH THE BOSS BRANCH NEVER GOT.**
`lock: false` already existed and already meant "follow instead of pen"; the
boss branch simply never honoured it. It does now, and the horse's segment
declares it. The two branches are deliberately the same shape.

⚠️ **SAFE FOR THE HORSE, AND IT WOULD NOT BE FOR THE MOSCA.** He is pure world
coordinates -- the `camX` his constructor takes is vestigial and never read. She
computes `enterFromX`/`enterToX` FROM THE CAMERA AT SPAWN, so a camera that
moved afterwards would fly her in to somewhere that is no longer the middle of
the screen; and the street cannot seek backwards at all (keyframes eleven
seconds apart, which is why `allowReverse` is the boss room's alone). ⚠️ **Her
backdrop does still freeze during her fight.** Same cause, different answer
needed, and it was left rather than quietly changed.

**AND THE LAST `beltDepth * 0.6` WENT.** `enterRoom` had the third copy of the
spawn depth that `playerStartZRel` was extracted for; it reads the knob now.

### The whistle plays OVER the bed, and nothing was baked

**A SECOND LOOPING VOICE AT RUNTIME**, asked for 2026-08-24: the whistle plays
together with the gameplay song, looped together, and NOT combined into one file
unless there was no other way.

**THERE WAS ANOTHER WAY, AND THE REASON MATTERS MORE THAN THE FEATURE.** The
"ONE FILE, ONE LOOP, NO MIXER AT RUNTIME" rule at the top of the music section
is inherited from the flying dungeon and it is about `<audio>` ELEMENTS: three
of those started together drift apart within a minute and the browser gives you
no way to bind them. This game plays music through `AudioBufferSourceNode`,
which is **sample-accurate by specification** and scheduled against ONE audio
clock. Two started at the same `currentTime` cannot drift -- there is no second
clock to drift against. **The constraint was never about layering; it was about
the element**, and it had been carried for months as though it were about
layering. So the whistle stays whole and uncut and the bed stays the approved
mix.

⚠️ **AND A LAYER NEED NOT DIVIDE THE TRACK'S LOOP.** The lab flags one that does
not, because it RENDERS to a single file and the remainder splices onto the
head. Nothing is rendered here: each voice loops itself cleanly at its own
pinned length and the two PHASE against each other. 7.5735s over 5.115s means
the whistle is never in the same place twice -- which on a soundtrack already
built from takes repeating at 2.09s and 2.22s inside a 6.15s arrangement is the
feel rather than a fault.

**NOTHING WAS CUT, AND THAT WAS CHECKED RATHER THAN ASSUMED.** The whistle loops
on itself as delivered -- its last second decays and its first builds, so the
wrap is a breath: seam step 0.0019 against a near-silent head, longest quiet
stretch across it 380ms. A crop was considered and rejected on evidence: the
best 5.115s window inside it scores **0.23** for seam similarity against MIKE's
0.64, because it is a through-composed melody rather than a repeating phrase.
There is nowhere good to cut it.

**FOUR RULES THE IMPLEMENTATION KEEPS**, and the second one is the one that
would have bitten:
* Every layer is decoded BEFORE anything starts, or it begins at whatever moment
  its decode happened to finish.
* ⚠️ **But an optional voice must never hold its track hostage.** A failed
  decode is remembered (`failedDecode`) and the bed plays without it -- the
  first version would have left the street SILENT because a whistle was broken.
* Layers are STOPPED with the track. They ride the same bus so the fade takes
  them down, but nothing would ever stop them and the bus comes back up for
  whatever plays next: a whistle under the boss theme is what that looks like.
* Each layer's level is its own gain node, not the bus -- the bus carries the
  main track's trim and `stopMusic()` puts it back to plain volume.

**AND IT IS THE BARATAS' SOUND.** Asked for immediately after the layer was
built: silent by default, up only while a cockroach is on screen. `gated: true`
on the layer, `WHISTLE_GATE` for the rest.

⚠️ **THE VOICE IS NEVER STARTED AND STOPPED, ONLY FADED, AND THAT IS THE WHOLE
DESIGN.** Restarting it would play the melody from its first note every time a
roach walked on -- and would throw away the one property the layer exists to
have: it is locked to the bed's clock and phases against it. Riding the gain
means it surfaces WHEREVER IT HAPPENS TO BE, which is a layer coming out of a
mix rather than a cue being triggered.

⚠️ **THE MARGIN IS NOT SLOP.** Baratas WALK IN from off the edge; a bare screen
test would snap the whistle on somewhere in the middle of an arrival. 160px
either side means it starts when they do. And the test is ALIVE, not present --
gating on `crowd.list` would hold it up for the 0.8s a corpse takes to fade,
which is a sound outliving its reason.

**ASKED EVERY FRAME, WHICH IS THE OPPOSITE OF `bossMusic()` AND BOTH ARE
RIGHT.** A gate reading the world has to ask every frame, and `setLayerOn` is a
no-op when it is already where it is being asked to go -- so there is no edge to
detect and no flag to leave stale. `bossMusic()` must be edge-triggered because
its other branch calls `roomMusic()`, which would fight the boss room's theme
every frame. The difference is whether the "off" branch is inert.

⚠️ It is called from `update()` and not from `loop()`, so only the PLAY phase
moves it -- it was written into `loop()` first, where it would have re-decided
over the death screen and the tally.

**LEVEL: 0.64 (0.8 FIRST, TAKEN DOWN 20% ON HEARING IT), AND NOT BECAUSE IT IS
QUIET.** Measured, the whistle is -16.4 dBFS
RMS against the bed's -16.9 -- nearly identical. But one is a MELODY and the
other percussion, and matched by RMS a melody sits in FRONT of a groove rather
than on it.

### The title screen's press moved from the end to the start

**THE NAME LANDS, THE SCREEN WAITS, A PRESS SENDS HIM ACROSS, AND THE GAME
BEGINS BY ITSELF ONCE HE IS GONE.** Asked for 2026-08-24. It used to be one
step: he set off on his own a beat after the name landed, and a press at any
point dismissed the screen out from under him. There is still exactly one press
on this screen -- it now BUYS the walk rather than skipping it.

**AN EARLY PRESS IS REMEMBERED, NOT IGNORED.** It is still accepted from the
first frame, before the name has arrived, because the hold is there to be looked
at rather than sat through and a title screen that ignores input reads as one
that has hung. What it sets is `go`; `_tickWalk` spends it the moment the name
has landed, so he never walks out from under falling type. **A screen that
swallows presses and one that acts on them out of order are both worse than
waiting a beat.**

**`titleWalkExitXRel` IS NEW AND IS NOT `titleWalkEndXRel`.** He counts as GONE
at 1.06 and the fade starts there; he keeps walking to 1.12 underneath it, which
is what that number has always been for. 1.12 is 154px past the edge -- three
times his half-width -- which as decoration costs nothing and as a WAIT would be
366ms of a still title screen with nobody on it.

⚠️ **THE CROSSING IS 7.2 SECONDS AND THAT IS NOW A WAIT RATHER THAN A
DECORATION.** 1587px at `titleWalkSpeed` 210. Nobody sat through it before,
because the walk was scenery and any press left immediately; now it is the whole
distance between a click and the fight. The speed is 210 because it MATCHES THE
ENDING'S, where he only walks to the centre (~3.5s) -- so raising it here breaks
that pairing. Flagged rather than changed: this is a feel decision and it is not
mine to make silently.

⚠️ **`titleWalkRepeatMs` IS DEAD** and kept at 0. It was the gap before he came
round again; the FIRST crossing now ends the screen, so a second can never be
reached -- and above 0 it would also wrap the clock the exit test reads.

### The title walk lines up with the fight

`titleWalkGroundYRel` was 0.93 of the canvas -- y 670 -- and in the fight his
feet are at `beltTopY + beltDepth * 0.6` = **634**. Thirty-six pixels too low.
Asked for 2026-08-24: "ele deve estar alinhado com a posição y que o coco está
quando começa o jogo de fato".

**IT IS WRITTEN AS THE ARITHMETIC, NOT AS 0.8806.** A literal would be correct
today and silently wrong the first time `beltTopY` moved -- and the whole point
of the request is that these two AGREE. A JS object literal cannot refer to its
own siblings, so `BELT_TOP_Y` / `BELT_DEPTH` / `PLAYER_START_ZREL` / `CANVAS_H`
are hoisted above CONFIG the way `BODY_SCALE` already was, and the entries below
read the consts. The names everything uses are unchanged.

**AND THE SPAWN DEPTH BECAME A KNOB ON THE WAY.** `CONFIG.beltDepth * 0.6` was
written twice in game.js -- the start of a run and the DEV room jump -- and the
title screen needed to be a third. `playerStartZRel` is the one name now.

⚠️ **THE SCALE ALREADY MATCHED.** `beltFarScale` is 1.0, so a fighter is drawn
the same size at every depth and `titleWalkScale` 1.0 was already his in-game
size. Nothing to do -- but if perspective is ever turned on, that number stops
being right and has to be derived too.

⚠️ **THE ENDING SCREEN WAS LEFT AT 0.93, ON PURPOSE.** It is the same walk on a
sibling screen and it would have been easy to "fix" both -- but it is a
DIFFERENT PHOTOGRAPH, a rock rather than a wall, and its ground line answers to
the picture rather than to the belt. Only the title was asked about, and only
the title has a reason to agree with the fight.

### Corpses clear in a third of the time

`corpseFadeDelayS` 0.6 -> **0.25**, `corpseFadeS` 1.2 -> **0.55**: "os inimigos
precisam desaparecer um pouco mais rápido depois que eles morrem, tipo hoje
parece 1 segundo, talvez menos de 1 segundo". 1.8s of lying and fading became
0.8.

⚠️ **THE CLOCK DOES NOT START AT THE DEATH, AND THE ESTIMATE IN THE REQUEST WAS
LOW BY MORE THAN HALF.** `stateT` resets when the body reaches the FLOOR, so the
real span from the killing blow was `downLandMs` + 1.8 = **2.32s**, not the ~1s
it was remembered as. It is 1.32s now. Anyone reading "how long does a corpse
last" off that pair alone is out by half a second -- worth saying out loud
rather than silently tuning to the number in the request.

⚠️ **`downLandMs` WAS DELIBERATELY LEFT ALONE.** It is the knockdown ARC and
belongs to every fighter who is floored and gets back UP as much as to the ones
who do not. Shortening it to force the total under a second would have sped up
every knockdown in the game, the player's included -- a much larger change than
the one asked for, made silently.

### The win got a fanfare, and the horse's song got an ending

Two changes to the last minute of the game, 2026-08-24.

**HE HOLDS THE POSE A SECOND LONGER.** `ENDING.poseHoldMs` 1500 -> 2500:
"deixa mais um segundo" before the numbers start. ⚠️ It is measured from the
POSE LANDING, not from the start of the walk-in, so lengthening the walk later
will not quietly eat it.

**AND THE WIN IS TWO MOMENTS, NOT ONE.** The first version of this put both on
the same frame and the correction was immediate: *"when the boss fight ends and
the screen fades out (the cavalo boss fight), stop the song of the boss fight.
Then the last screen is loaded and the coconut comes from the left, start
playing the victory song."*

  1. `endBossMusic()` at the `'clear'` outro -- the horse's song rolls off over
     1.2s as he walks out of the boss room.
  2. `playVictory()` on the frame the ending screen begins -- Still Life's
     10.7s fanfare, as he comes in from the left.

**THE BEAT OF SILENCE BETWEEN THEM IS THE POINT**, and it is the whole reason
this is two calls rather than one: the song ENDING is what makes the fanfare an
arrival. Fused, it would have been a crossfade, which is a transition rather
than a punctuation mark.

⚠️ **THIS REVERSES THE HORSE'S "NOTHING EVER STOPS IT" RULE**, which was itself
an explicit request on 2026-08-22 -- the song was to run through his death, the
walk-out, the ending photograph and the tally, "so the last thing the player
hears is the same thing they beat the game to". That is now the fanfare instead.
Both notes are kept in config.js, because the reasoning has not stopped being
good; it was outvoted.

⚠️ **`only on the win`, AND `outroTo` IS THE TEST.** The other outro is a walk
to the NEXT room, which already has its own handling -- the fade calls
`roomMusic()` at its blackest point -- and stopping the bed there would leave
that walk-out silent for nothing.

**`Sound` GREW `playOnce`/`stopOnce` FOR THIS, AND IT IS NOT A CONVENIENCE.**
The fanfare is 10.7s; the ending screen plus the whole results board is about
ten. A player who skips the tally reaches the title with it still ringing, under
MIKE. Still Life had already found this and has its own `stopOnce('victory')`
with the note "at 10.7s it easily outlives a run" -- inherited rather than
rediscovered. `play` stays fire-and-forget for everything else, because tracking
a 300ms punch would be bookkeeping for a sound that cannot outlast anything.
`_voice()` builds both so a clip cannot be routed two different ways depending
on which call started it.

⚠️ **AND THE STOP WENT IN `frontEnter()`, NOT AT THE CALL SITE THAT NEEDED IT.**
It was first written into `toTitle()` -- and actually landed in `boot()`, one
function off, which is the same mistake one step earlier. Every route to the
front screens goes through `frontEnter()`: boot, the logo handing to the title,
and toTitle after a win, a loss or a skip. At one call site it would have been
correct today and wrong the first time a fourth route appeared. **Put a cleanup
where the possibility ends, not where today's instance is.**

**NO CUTTING NEEDED, AND IT WAS CHECKED.** `victory-sound-01.ogg` is a finished
clip that starts on its first beat, so it is READ IN PLACE like the death sting.
The coin tick next to it looked equally finished and was a take with the event
672ms in -- so the envelope was read before wiring, not after.

### The results board counts up in coins

**STILL LIFE'S COIN HIT TICKS WHILE THE NUMBERS CLIMB**, asked for 2026-08-24
and then narrowed in a second message: *"o sfx precisa acompanhar a contagem dos
números, começa quando os números começam a subir e para junto com eles"*. Once
every 90ms, pitched up 1.0 to 1.25 across the whole roll, for exactly as long as
a figure is moving.

⚠️ **THE FILE LOOKED LIKE A FINISHED EFFECT AND WAS A TAKE.** `coin-hit-01.ogg`
in the flying dungeon's folder is 1.11s and holds TWO events: something quiet at
the top, and the actual coin **672ms in**, peaking at 831ms. Played raw it would
have ticked two thirds of a second late, every time. This game's own SFX note
already warns about exactly that shape -- "the takes are performances into a
phone" -- and `tools/build-beat-sfx.py` exists to find the event and cut it.
That other game plays the file from 0 with no offset, which is worth someone
looking at over there. **A borrowed sound is not automatically a cut one:
envelope it before wiring it.**

**SO THIS ONE IS COPIED WHERE EVERYTHING ELSE BORROWED IS READ IN PLACE.** Her
sheets, her music and the death sting all point straight at the other game's
files; a CUT cannot, because it is a new file rather than a view of the
original, and leaving it beside that game's take would give that game a file
only this one plays. `build-beat-sfx.py` grew a `--src` for it: the take can now
come from anywhere in the repo, and the cut always lands in this game's `sfx/`.

⚠️ **IT STOPS AT `resultsRollS`, WHICH IS A THIRD MOMENT THE BOARD DID NOT
HAVE.** The board already knew two: `stampAt` (the rank lands) and `promptAt`
(it asks to be dismissed). The numbers actually STOP `rankDelayMs` before the
first of those, and that 400ms of silence is what makes the stamp land -- tick
through it and the rank arrives in the middle of a noise. `resultsRollS` is
derived from `_resultsTimes` rather than re-multiplied, so the sound and the
drawing cannot disagree about when the numbers stopped.

**A SKIPPED BOARD GOES QUIET WITH NO CASE OF ITS OWN.** Pressing during the roll
sets `boardSkip` to the END of the board, which jumps the clock straight past
the roll -- so the same `t >= until` test that ends a normal tally ends a
skipped one. That is the whole reason `boardTick` reads the same clock
EXPRESSION `drawEndCards` draws from, rather than counting its own time.

**THE LEVEL IS DERIVED AND THEN DELIBERATELY IGNORED.** Still Life plays this
clip at 0.605 on a 0.6 bus, so it reaches master at 0.363; matching that on this
game's 0.9 bus is 0.40, which is the same arithmetic `gameOver: 0.67` uses. ⚠️
**Matching it would be far too loud**, because that game plays ONE coin and this
plays about fifty, three or four ringing at once. What has to match is the sound
of the EFFECT, not of one voice in it -- so `coin` is 0.14, about a third of the
derived figure. If the tick is ever pulled apart from the roll (one per row,
say), 0.40 is the number to go back to.

### The player's corpse was the one thing the freeze applied to

**HE NOW FALLS BACKWARDS WHEN HE DIES, LIKE THE ENEMIES DO.** Asked for
2026-08-24: *"o player tem que cair pra trás depois ao morrer, igual os
inimigos. um pouco launched"*.

⚠️ **AND IT WAS NOT A TUNING PROBLEM. HIS BODY WAS NOT MOVING AT ALL.** The
world STOPS the moment the player dies -- `update()` is not called for anything,
which is right, because nothing should still be punching a dead player. The one
thing still running was `player.tickDeath(dt)`, and it ticked `deathT` and
`animT`: the DRAWING. So `stateT` never advanced, `_updateDown` never ran, the
knockdown arc never happened and `vx` never moved him. The death ROW played out
over a body standing exactly where it was hit.

**AN ENEMY LOOKED RIGHT FOR THE OPPOSITE REASON:** it dies in a world that is
still running, so `crowd.update` gives it the arc and the drift for free. The
two deaths ran through completely different amounts of code and only one of them
was a fall. That is why the request came in as "like the enemies" rather than as
"he does not move".

⚠️ **THIS IS THE SAME BUG AS THE COMMENT SITTING DIRECTLY ABOVE IT.** That note
already said "THE WORLD IS STOPPED, BUT THE CORPSE IS NOT" -- it was written
when the death ANIMATION was found frozen on frame one, and it fixed the clock
it noticed. The body was the other half and went unnoticed for months. **When
something is exempted from a freeze, list everything it needs, not the thing
that was visibly wrong.** A corpse needs exactly three: its own clocks, the
knockback drift, and the knockdown arc.

**`_drift()` IS A METHOD NOW** rather than six lines inside `update()`, because
a corpse needs it too and a second copy would have been a second copy. ⚠️ It
takes `bounds` -- unclamped, a death near the edge of a locked arena slides the
body out through the wall.

**AND `DEATH_THROW` IS THE SECOND HALF.** `{ up: 140, back: 300 }`, both FLOORS
on the fatal blow rather than replacements. `up` had always been here as a bare
140 in fighter.js; `back` is new. Enemy jabs are worth 45 to 140 of knockback,
which at `knockbackDecay` 6 is 7 to 23px of travel -- a stumble. 300 is 50px,
which is what the player's own finisher already gives an enemy, so a death now
reads the same whichever way round it happened.

⚠️ **IT APPLIES TO ENEMY DEATHS TOO, ON PURPOSE.** One rule. In practice it
changes almost nothing: enemies are usually finished by the 320/420 finisher and
the player is usually killed by the 200-300 blow that ENDS an enemy string, so
both common cases were already over the floor. It catches the odd death by a
weak hit, which was the same stumble on both sides.

### The Mosca brings her own music

**STILL LIFE'S SOUNDTRACK PLAYS WHILE NARUTÃO IS ALIVE**, and the street gets
its bed back the moment she dies. Asked for 2026-08-24: *"botar a música do
still life quando a mosca boss entra. Quando ela morre, volta o batidão tchum
tcha normal."*

**IT IS THAT GAME'S FILE, READ IN PLACE.** `v2:flying-dungeon/audio/trilha-mix
.ogg`, 14.45s, 240KB -- exactly the arrangement `MOSCA_SHEETS` already makes
with her sprites, and for the same reason: this boss IS that game's boss, so the
fight should be able to change there and change here. Nothing was copied and
nothing was cut.

⚠️ **THIS IS THE FIRST BOSS-SCOPED TRACK, AND THE ASYMMETRY WITH THE HORSE IS
THE DESIGN.** `ROOMS[n].music` exists because the horse's room OPENS with a wave
of roaches -- hanging his song on the boss made it arrive a minute late, with
the room's first fight playing under the street's bed, and that is written up
above as a thing that was wrong on sight. The Mosca is a SUB-BOSS MID-STREET:
the bed is already playing, she flies in, and **the switch IS the event.** There
is no room change to hang it on, so nothing room-scoped could have expressed it.
Both rules are now in the file and neither is the general case.

⚠️ **AND HERS STOPS, WHICH IS THE EXACT OPPOSITE OF HIS.** The horse's theme is
documented as "⚠️ AND NOTHING EVER STOPS IT" -- it runs through his death, the
walk-out, the ending photograph and the tally, because his death IS the end of
the game. Hers ends because the street carries on without her: there is a roach
stretch after the Mosca, and it gets the bed.

**THE BOSS DECLARES IT; game.js DOES NOT ASK WHICH BOSS THIS IS.** `FlyBoss
.musicKey` is `'musicMosca'`, the horse has no such field, and `bossMusic()`
reads the property. That is the bargain every other thing about a boss makes
here -- `combat.js` and the debug overlay talk to an interface and never test a
type -- and it means "the horse's theme belongs to his ROOM" is expressed as an
ABSENCE rather than as a branch.

⚠️ **EDGE-TRIGGERED, AND THE CHEAP VERSION WOULD HAVE BROKEN THE HORSE.**
`playMusic` is a no-op for the track already playing, so calling it every frame
looks free -- but the OTHER side of the test calls `roomMusic()`, and that would
have fought the boss room's theme on every frame after the horse died, which is
precisely his rule being broken by the cheaper implementation. One boolean,
compared against the world rather than against itself, and reset in `start()`
because it is run-scoped.

⚠️ **IT REVERTS ON `dead`, NOT ON `finished()`.** She has a death fall and a
fade, and the segment holds her until they are done; waiting for that would
leave her theme playing over her own corpse. "Quando ela morre" is when she
dies.

**NO `MUSIC_GAIN` ENTRY, AND THAT IS MEASURED RATHER THAN ASSUMED.** Her track
is -17.2 dBFS RMS against our bed's -16.9, so it already sits where the bed sits
and the punches stay balanced against it. ⚠️ Its `MUSIC_LOOP` pin (14.452) is
NOT ours to re-derive -- it is `loopMs` out of `tools/music-lab.html`, the
flying dungeon's arrangement. The container says 14.4585, so unpinned it ticks
every fourteen seconds.

### Food is taken on purpose now, and the pickup button is off

**L / E / PAD B NOW DOES NOTHING.** Asked for immediately after the food change,
with the consequence named by the user before they asked: *"I understand that
now the player won't be able to pick up the barrels, ok?"*. `CONFIG
.pickupButton` is false.

**WHAT WENT WITH IT:** lifting a barrel, carrying one, throwing one, putting one
down. That is the whole verb, and it is all that button did.

**WHAT DID NOT:** barrels are still punched apart and still drop a chicken, so
they keep the job they do in the level. And the stoop animation is not orphaned
-- taking food plays it now, which is what the previous change was for.

⚠️ **THE MACHINERY IS BEHIND A FLAG, NOT DELETED, AND THAT IS A JUDGEMENT
RATHER THAN TIMIDITY.** `Prop.lift`/`_liftArc`/`throwFrom`, `Props.liftTarget`,
`Player.carrying`/`liftTarget`/`throwHeld`, `combat.propHits` and three poses
are a WORKING FEATURE with one caller switched off. This is a taste call made in
play -- the kind this project reverses (the title theme, the panorama, the film
filter, the fly sizes twice) -- so it should cost one boolean to come back, not
a re-implementation. Deleting it would also strand `PROPS.barrel`'s throw
tuning, which is real data nobody would reconstruct.

⚠️ **THE PRESS IS STILL CONSUMED.** `input.takePickup() && CONFIG.pickupButton`
reads the queue and then discards it, so a press cannot sit there and fire later
if the flag is turned back on mid-run. Guarding the flag FIRST would have left
exactly that.


**WALKING OVER A DRUMSTICK DOES NOTHING.** Standing on it and pressing PUNCH
makes him stoop for it -- `pickGround`, row 9, the same drawing the pickup
button already uses for a light object. Requested 2026-08-24, in Portuguese:
*"ao invés de agaixar ao apertar o L, fazer ser o soco em cima da coxinha ou o
frango pra ele agaixar e pegar"*. Nothing was cut for it and nothing new was
drawn.

⚠️ **IT WENT ON THE PUNCH BUTTON, AND THE OLD ARGUMENT IS WHY.** The note that
stood in prop.js said food must not share the PICKUP button, because "the player
who wanted the barrel gets the chicken that was lying next to it". That is still
true, and it is exactly why the verb moved to the other button: punch already
chooses its verb by what is in his hands -- it throws when he is carrying -- so
a third case costs nothing new to explain. The pickup button is untouched.

⚠️ **THE PRICE IS THAT A PLAYER STANDING ON FOOD CANNOT PUNCH**, and it is
accepted rather than solved. Making it conditional on no enemy being in range
would be a button that silently does a different thing depending on something
the player cannot see. The level already places food BETWEEN fights rather than
inside them, so the case is rare BY DESIGN -- ⚠️ put food inside an arena and
this is the thing that will go wrong.

**`pickup()` IS ASKED, NOT TOLD, and that removed a test rather than adding
one.** It already refuses in mid-air, so `if (food && this.pickup(false))`
falls through to the AIR ATTACK for a player who jumps over a drumstick and
punches. Writing a `jumping` test at the call site would have been a second copy
of a rule that already existed one level down, and the two would have drifted
the first time either moved.

**THE FOOD OWNS THE REACH, NOT THE PLAYER.** `Pickup.claim(by, ms)` takes the
animation's own clock -- the same bargain `Prop.lift()` makes with the hoist --
and the food applies the heal itself when that clock runs out. ⚠️ It ABORTS if
the hand reaching for it is knocked over, the same test and the same reason as
`Prop._liftArc`: a heal applied to a player who is at that moment being punched
across the room is this game's recurring bug family, and it would have read as a
chicken vanishing for nothing. The player's `eatTarget` is then only a reference
to drop -- there is nothing left for it to decide, which is the point.

⚠️ **IT IS TAKEN AT FULL HEALTH TOO, WHERE IT IS WORTH NOTHING.** The first cut
kept the old rule -- refuse it at a full bar so it cannot be wasted -- and that
was changed on request within the hour. The rule was right for eat-on-contact,
where the player had no say and losing a chicken was an ACCIDENT. On a button it
is a CHOICE, and a punch coming out of a press the player made to pick something
up is worse than a wasted drumstick. **A guard that existed to protect the
player from an accident stops making sense the moment the action becomes
deliberate** -- worth checking for whenever an automatic thing is put on a
button.

⚠️ **AND `_comboDefs()` IS NOT REACHED ON THIS PATH**, for the same reason the
air attack does not reach it: it flips which finisher the next chain ends on,
and stooping for a chicken must not quietly consume the alternation.

### The air attack, and what `sweep` cost the geometry

**PUNCHING IN THE AIR IS ITS OWN MOVE** as of 2026-08-24, asked for straight
after the finisher sweep: it should launch everyone the same way. Until then a
jump-punch played the next link of the ground combo in mid-air -- one target, no
knockdown, drawn with a standing punch. `CONFIG.AIR_ATTACK` sweeps, knocks down
and launches.

**IT WIRES ART CUT ON 2026-08-17 AND UNUSED EVER SINCE.** The coconut's row 4 is
a SEVEN-FRAME air punch drawn as a whole jump -- take-off, rise, punch, fall --
and `POSE_RAGGED.airPunch` has mapped it all along with nothing selecting it.
`frameStep` already married an `airPunch` pose to `jumpT` rather than to the
attack phases, for the enemy jump-in. Nothing in the animation machine changed;
the move is a config entry and one branch in `Player.update`.

⚠️ **`reachY` IS THE WHOLE REASON IT CONNECTS, AND IT IS A NEW IDEA.**
`verticalReach` is 70 and the jump apex is 85, so **a fighter at the top of his
own arc cannot reach the floor.** That is deliberate and load-bearing for the
ENEMY jump-in, which is scripted: it opens its window at `startupMs` 420 as it
drops back through the band. The player presses at a moment of their own
choosing, so under the same rule the move would pass cleanly through a standing
enemy about half the time -- which reads as broken hit detection, not as a miss.
So a def may now override the vertical reach, and the air attack does (120).

⚠️ **AND THE OVERRIDE HAD TO GO ON THE HITBOX, NOT IN THE RESOLVER.**
`verticalReach` was read as a bare CONFIG lookup in `Combat.playerHits`, in
`Combat.crowdHits`, and in TWO places in the debug overlay -- four copies of one
rule. Adding a per-def override to the resolver alone would have left the
overlay calling a hit a miss on exactly the move whose reach is unusual, which
is the [[verifiable_debug_views]] failure in its purest form. `reachY` is now
returned by `Fighter._attackGeom()` next to `x0/x1/z0/z1`, which is the method
whose header already said *"ONE SOURCE OF GEOMETRY, read by both the resolver
and the debug view. They must not each compute it."* The third axis had simply
never been in the box.

**THE DEBUG READOUT LEARNED BOTH.** It prints the live blow's own `reachY` and
`SWEEP` in the header, and it no longer reports two of three enemies as
"overlaps, but not closest" on the very move whose point is that it hits all
three -- it reads `g.def.sweep`, the same field the resolver branches on.

⚠️ **THE DAMAGE IS DELIBERATELY LOW (8, against the finisher's 12).** This is
the finisher's crowd-clear available from ONE press instead of five. It is a
POSITIONING move: it buys the room, it does not win the fight. If it becomes the
only thing worth doing, that number is the reason and it comes down before the
launch does. The cost is commitment -- 620ms of jump with only the direction
latched at take-off, the ground string broken, and 190ms of recovery after
landing. ONE PER JUMP falls out of the timings (690ms total against a 620ms
jump) rather than being enforced by a flag, which is the better kind of limit.

⚠️ **`_comboDefs()` IS NOT CALLED ON THE AIR BRANCH.** It has a side effect --
it flips which finisher the next chain ends on whenever the cancel window has
lapsed -- so a jump-punch would have quietly consumed the alternation and a
player who jumped between chains would get the same ending twice. The air attack
still BREAKS the chain, as any attack does, so the next ground press starts
fresh and alternates: the same courtesy a chain broken by a hit already gets.

### The finisher: a step into it, and it sweeps the box

Two changes to the same move, asked for one after the other, and together they
are what a finisher in this genre is supposed to be.

**IT SWEEPS.** `sweep: true` on an attack def hits EVERY valid target in the
hitbox instead of only the nearest. Both finishers have it and nothing else
does. The note in combat.js used to say "a sweeping attack that hits everyone
would be a different move with a different name" -- this is that move. Every
other link still hits one person, which is the genre's default and what stops
mashing from clearing a room; the ENDING is the one that buys space back when
three of them have walked up. It already knocked down and launched for exactly
that reason, and hitting one of the three was the half that never worked.

⚠️ **EACH BODY TAKES THE FULL DAMAGE, NOT A SHARE.** Splitting would make the
finisher WORSE the better it connected, which is backwards. So a finisher into a
crowd of three is 36 damage rather than 12, and **the HP table was not moved for
it**. The fight gets easier when the player is surrounded -- that is the point --
but it is a real change to the economy and the first thing to look at if crowds
stop being frightening.

⚠️ **FOUR THINGS HAD TO BE MADE ONCE-PER-SWING RATHER THAN ONCE-PER-BODY**, and
three of them were already right by accident:
* `hasHit` still closes the box after the sweep, or the finisher would re-hit
  everyone every frame of its 100ms window. (Had to be written.)
* The hitstop does not stack -- `_impact` already took the LONGEST pending
  freeze rather than summing, for exactly this case one enemy at a time.
* The impact MARK is per body, which is right and is the point of the move
  being visible.
* The SOUND had to be lifted out of the per-target path. Three copies of one
  300ms sample in the same frame is a flanged punch, not three punches.

⚠️ **AND ACCURACY WOULD HAVE READ 300%.** `Stats.hits` is documented as "swings
that connected" and `accuracy()` is hits/swings, so a punch that caught three
bodies calling `hit()` three times breaks the board. `Stats.hit()` now takes the
attack OBJECT and dedupes on it -- the same trick `countSwing` was already
doing one line above. Damage still accumulates per body. ⚠️ Omitting the
argument counts every call, which is what the thrown barrel wants: it is not a
swing and has no attack object.

**AND HE STEPS INTO IT.** `lungePx` on an attack def moves the body forward
across the blow -- asked for as "as if he was actually physically punching". 30
for the uppercut (22px drawn, it plants and rises), 50 for the low ending (36px,
it is literally a lunging punch). The drawing decides, the same way it decides
everything else about that pair. ⚠️ Raised from 18/30 on sight: over the 220ms
the step spans, 50 averages 164 px/s and PEAKS NEAR 490 as the ease-out opens,
against a walk of 300 -- the low ending briefly outruns a run, which is what a
lunge is. That peak is the number to watch if it is pushed again; past roughly
double it stops reading as weight and starts reading as a dash.

⚠️ **ONLY THE FINISHERS HAVE IT.** A five-hit string where every link stepped
would walk the player across the room and turn a combo into a charge.

⚠️ **IT IS A DISPLACEMENT AND DELIBERATELY NOT `vx`.** `vx` is the KNOCKBACK
channel -- it decays at `knockbackDecay` and it is what a blow landing on this
fighter writes into. A step pushed through it would be eaten by the decay curve,
would fight a knockback arriving mid-swing, and would have no idea when it was
finished. The attack owns its step and ends it, which is this codebase's rule
for anything with its own clock -- the same rule the corpse reaper and the
segment scroll were rewritten to follow.

⚠️ **IT STARTS ON THE STRIKE FRAME, AND THAT IS A COMBAT DECISION.** `hitbox()`
is rebuilt from the body's x every frame, so any distance covered before the
active window opens is reach the move did not have before. Starting at
`startupMs` means the FIRST active frame tests from exactly where it always did;
the extra ground is covered while the window is already open. The finisher does
therefore gain a little reach as the body arrives -- which is what stepping into
a punch is -- but at the END of the window rather than the start. **The HP table
was NOT moved for this.** If the fight starts reading easier, that is the cause,
and the exactly-neutral version is `reachX -= lungePx` on that pose, not
deleting the step.

**HITSTOP GETS IT RIGHT FOR FREE**, and that is worth noticing rather than
engineering. A connect freezes the simulation, so the step holds at the instant
of impact and completes afterwards -- precisely the weight the freeze exists to
sell. Nothing in the lunge knows hitstop exists.

**THE TIMING IS DERIVED, NOT CONFIGURED:** from `startupMs`, for
`activeMs + recoverMs / 2`, eased out cubic. One number per pose instead of
three, and retuning a pose's windows carries the step along instead of leaving a
stale second copy. A LINEAR ramp was not used -- it reads as a slide, which is
the one thing a step must not be.

### MIKE on the title screen, and the flies both ways

Three more things landed the same day, all of them asked for while the loop fix
was still warm.

**MIKE IS ON THE TITLE SCREEN, WHICH REVERSES 2026-08-22.** That entry (above)
still stands as written -- the whole 4m10s song, from its quiet opening, on a
screen the player sees for ten seconds, did not suit it. What is there now is a
**60s loop cut out of the fullest part of the track**, 105.151s..165.258s of the
original, 28 bars at 111.8 BPM. A title screen wants the part of a song that
sounds like the MIDDLE of one.

⚠️ **IT IS A SEPARATE FILE AND assets/MIKE.mp3 IS UNTOUCHED.** That file is the
MAIN game's intro theme and `src/main.js` still plays it whole and looping;
shortening it would have silently re-cut another game. `tools/cut-song-loop.py`
(new) writes `mike-title.ogg` into this game's own audio folder. 7.4MB -> 812KB,
which is 89% and the reason the cut was asked for at all.

**HOW THE CUT POINTS WERE FOUND**, because it is reusable and it is not by ear:
onset flux -> autocorrelation gives the tempo (111.8 BPM, so a 4/4 bar is
2.1467s); combing the flux with a bar-long pulse train gives the PHASE, without
which every candidate lands mid-bar; then every (downbeat, whole-bar-length)
pair is scored by how alike the music is at S and at S+L on a 24-band log
spectrogram over a 4s window. A loop's seam works when the music arriving at the
end sounds like the music about to begin. The 28-bar winner scored 0.637.

⚠️ **AND THE BED'S SEAM TRICK DID NOT TRANSFER.** `crop-beat-trilha.py` sums the
material past the cut onto the head, and that was tried first here. It works on
the bed because the bed's head is a downbeat with near-silence in front of it --
adding a ring to nothing is still the ring. A SONG has no silence anywhere, so
the head's own first sample is full level and the summing leaves the step
exactly where it was: |first - last| measured 0.0584 against a median
neighbouring step of 0.0032, an eighteen-fold jump, which is a click. The fix is
a real equal-power crossfade -- head faded IN while the continuation is faded
OUT -- which is continuous at t=0 by construction rather than by being quiet.
**Two loops, two different right answers, and the difference is whether the head
is quiet.**

⚠️ **THE FIRST BOOT MAY BE SILENT AND THAT IS THE BROWSER, NOT THE WIRING.** No
page plays audio before the visitor has interacted with it, and on a cold load
the first interaction is the press that LEAVES the title. So the theme is asked
for one screen EARLY, on the logo -- a press that skips the logo unlocks the
context with the title still to come.

> ⚠️ **SUPERSEDED THE SAME DAY, AND THE WORKAROUND BECAME THE PROBLEM.** MIKE
> now starts on the TITLE and the logo is silent (asked for: "make the MIKE song
> only start at the second intro screen"). That is safe ONLY because the title's
> press was changed to start the WALK rather than dismiss the screen -- the
> press unlocks the context, `wanted` is already set, and there are seven
> seconds of crossing left to play over. Two changes that were made for
> unrelated reasons cancelled each other's constraint. `frontEnter()` stops
> things, `titleMusic()` starts the theme.

**`musicLoopSec` BECAME `MUSIC_LOOP`, KEYED BY ASSET KEY.** The pin was one
number and `sound.js` applied it `if (key === 'music')` -- a guard that existed
because the horse's 4m39s song would have been cut off after six seconds by the
bed's crop. A second CROPPED track made that guard wrong in the other direction:
the title loop would have gone unpinned and ticked once a minute. Keyed by asset
key -- the same shape `MUSIC_GAIN` already had -- absent means "loops at its own
end", which is what a finished song wants and what a cropped one never does.
**A special case that was right about one track was a rule that was wrong about
the next one.**

**MIKE ALSO NEEDED LIFTING, NOT TRIMMING.** `MUSIC_GAIN` had only ever pulled a
track down. Measured RMS: the bed -16.9 dBFS, the horse's song -13.7, MIKE
-26.5. It is mastered quiet, so `musicTitle` is **2.6** -- above 1, which the
bus always allowed and nothing had needed. It sits deliberately a little UNDER
the bed: matched by RMS, a dense full mix reads louder than a sparse percussion
loop. ⚠️ The bed's own level is the fixed point and does not move, because it is
balanced against the punches.

**THE FLIES CROSS BOTH WAYS NOW.** `countRight: 1` on top of `count: 2`. A
rightward fly is the same fly with every x term negated -- same steering, same
band, same recycle -- drawn h-flipped, and `dir` is rolled once and kept for its
whole life exactly like `size`. Two going one way is a procession the eye learns
in about four seconds; one going against them is what stops it reading as a
conveyor. ⚠️ The mirror is applied BEFORE the rotate in `draw`, because flipping
the axes also flips the sense of the bank -- rotate first and the rightward
flies bank into their dives.

⚠️ **IT TAKES THE TOTAL TO THREE, WHICH 08-23 CUT BACK FROM.** That finding was
about three flies going the SAME way, all crossing the same line at the same
angle. This is a different picture and was asked for after it. If it reads busy
in play, `countRight` goes to 0 before `count` is touched.

**AND THE SIZE BAND MOVED UP, IN TWO STEPS, IN ONE SESSION.** It was `sizePx`
30 with `sizeJitter` 0.28 -- a 22..38px roll, which reads in play as three
sizes: a small, a medium and a big. First ask: every fly the size of the SMALL
one (22 flat, jitter 0). Watched again, second ask: **medium and big, and no fly
small.** So it is 34 +/- 12% -- 30..38px, the TOP HALF of the original roll,
with the bottom 8px gone.

⚠️ **THE TWO NUMBERS ARE A RANGE WRITTEN AS A CENTRE**, and the request was made
in terms of the range, not the centre. The axis being tuned here is the FLOOR --
how small the smallest fly may be -- and `sizePx` alone moves both ends
together, which is the wrong knob for that ask. Worth remembering the next time
one of these comes in as "no X should be Y".

The roll had been justified as the only depth cue they have (no z up there, no
parallax off the plate). ⚠️ **It is not a reliable one:** at the old floor the
big ones read as flies that had come CLOSER rather than as flies further away --
the cue landing backwards. A narrower band high up is what survived that.

---

## ESPETO, and the sheet the cutter could not read

The desert has a villain: **ESPETO**, a black spiky ball with a red toothed
mouth and two yellow fists. The first enemy in this game drawn for a room other
than the street, and the first through the cutter that needed it changed.

**NINE ROWS AGAINST THE CIGARETTES' EIGHT** — their plan with a second combo row
in it, and the row names came from the user with the sheet, as they always do:

| row | | frames |
|---|---|---|
| 1 | idle | 3 |
| 2 | walk | 6 |
| 3 | jump | 6 |
| 4 | airPunch (jump + attack) | 7 |
| 5 | **combo** | 10 — five wind-up/strike PAIRS |
| 6 | **comboLow** (combo 2) | 10 — the same opening, another ending |
| 7 | hurt | 2 |
| 8 | knockdown | 6 |
| 9 | **death** | 10 — **he BURSTS** |

60 slots pack to **33 unique tiles**, because rows 5 and 6 share their first
eight drawings and rows 7, 8 and 9 share their opening.

### He bursts, and the body cut cannot see it

⚠️ **THE LAST FOUR FRAMES OF HIS DEATH ROW HAVE NO BODY IN THEM.** He does not
fall over and lie there — he explodes into a cloud of loose spines. The cutter
finds frames by CONNECTED COMPONENTS over a size threshold (that is what the
cigarettes' smoke forced it to do), so on this row it found **8 frames where the
art has 10** — and then the wisp pass adopted every spine of both bursts onto the
nearest body it could see. **One tile came out 1278px wide against its
neighbours' 183: a corpse with an explosion welded to it from three frames away.**

Two changes, and they are separate:

* **A row may now say `{'cut': 'columns'}`** — split on empty COLUMNS over all of
  that row's own ink, each run a frame carrying every piece inside it.
  ⚠️ **PER ROW AND NEVER PER SHEET**, because the column cut is the *weaker*
  rule — it is what the body cut was introduced to replace. On this same sheet it
  finds 5 frames in the 6-frame jump row and 6 in the 7-frame air punch: those
  frames genuinely touch.
  ⚠️ **The row's ink is not its band.** The band comes from bodies and stops at
  the last body's feet; his bursts throw spines 73px below it and 106px above.
* **The wisp search now offers FRAMES as owners, not bodies.** A column-cut group
  answers "where is this frame" exactly as a body does, so it competes on the
  same terms. That is what stopped the spines being adopted three frames away —
  the `cut: 'columns'` change alone did not fix it.

⚠️ **AND `bodyArea` IS 50000 ON THIS SHEET, NOT THE SHARED 15000.** Two fragments
of the bursts come in at 22522 and 21030 — over the shared threshold — so at the
default the tool finds 60 bodies for 58 and adopts two pieces of an explosion as
frames. A sheet may now also state `bodies:` explicitly, which is the check that
catches exactly this: a column-cut row breaks the "one body per slot" identity
the count was derived from, so it has to be said out loud.

**Existing sheets cut byte-for-byte identically** after all of it — checked
against md5, not assumed.

### What was measured rather than guessed

* **`native: 'right'`.** Getting this wrong does not error, the character simply
  walks backwards for a whole build. The yellow fists sit right of the body
  centre on every strike frame of both combo rows (+33, +33, +138 source px), so
  he punches right, like every other sheet here.
* **His REACHES, and he is the only one in the file.** The fist tip is 88.8 drawn
  px right of the anchor on the common strike, 70.0 on the third pair, 87.3 on
  the fifth → 123 / 97 / 121 × BODY_SCALE. ⚠️ **The third hit reaches LESS while
  hurting more**, because that is what the drawing does: he balls up and
  headbutts instead of extending. Both cigarettes still carry the 92/108 they had
  when they were drawn a third smaller.
* **`scale` 0.38** brings his 451px idle body to 171px in the atlas, where every
  other pack lands.

### He was floating, and the cause was the spike tip

Reported on first sight: *"the espeto is standing too high, it looks like it is
floating… when you see it next to the coconut you can understand it better."*

⚠️ **HIS GROUND LINE WAS ON THE TIP OF HIS LOWEST SPIKE.** The cutter finds the
bottom of a body as the last row with at least `BODY_MIN_RUN` (6) pixels in it —
a guard written against an antialiased tail. He is a ball of spikes: on the idle
frame the lowest one is **39px below his feet**, on the walk 17px. So he was
drawn hanging off a spike, with his feet in the air.

⚠️ **ANCHORING ON HIS FEET WOULD HAVE BEEN WORSE.** The yellow is at different
heights in different frames — 39px of spike under it in idle, 17 in walk — so a
palette rule would have made him BOB by the difference. What is stable is where
the silhouette becomes *substantial*, which is what the threshold already
measures. `bodyMinRun: 80` per sheet: he drops **27px onto his feet** and his
frame-to-frame spread improves too, 10.3px → 8.3px.

⚠️ **AND IT MADE HIM 24% BIGGER, WHICH IS THE PART TO KNOW.** The same threshold
finds the TOP of the body, so `bodyH` went 170.6 → 137.2 — it now measures the
solid ball rather than spike-tip to spike-tip. `sheets.js` scales a pack so its
`bodyH` is `fighterSizePx`, so the ball became full size and the spikes became
extra on top: 137px drawn → 170px. That is arguably what `bodyH` is *for* (it
exists to keep a cigarette's smoke out of its height), but it was not asked for.
`drawScale` 0.80 puts the old size back.

⚠️ **HIS MEASURED REACHES HAD TO BE RE-MEASURED.** 123/97/121 was correct for a
sprite that no longer exists; they are 146/116/138 now. **Any change to the
cutter's sizing invalidates them** — that is the cost of being the one character
whose reaches come off the art.

### …and 10px more, by eye, which is a different knob on purpose

*"He is still too high, bring him down a little bit more."*

⚠️ **THE SECOND 10px IS `groundNudge`, NOT A SECOND RE-CUT**, and the split
matters. `bodyMinRun` moved his ground line off a spike tip onto his body — a
real correction, worth 27px — but it also decides `bodyH`, so another pass of it
would move his drawn SIZE and the reaches measured off him **again**, for what is
a pure vertical taste call. `CHARACTERS.espeto.groundNudge` is drawn px, down,
applied in `Sheets.draw` beside the existing per-pose `poseNudge`.

⚠️ **IT MOVES THE PICTURE, NOT THE FIGHTER.** The hurtbox, the reaches, the
shadow and `depthScale` all still use the ground point, so this is the one knob
on him that makes the drawing disagree with the simulation. 10px against a 170px
body is nothing; **it is the wrong tool for a big number**, and if it ever wants
30, re-cut.

**WHY HE NEEDED BOTH AND NOBODY ELSE NEEDS EITHER:** his IDLE row is drawn with
the ball tucked up. Feet 24px above the line on the first idle frame, 7 on the
third, against 4–7px across the whole walk — so the pose the player looks at
while standing still is the one that reads as floating.

### The burst got its own clock, and the corpse had to wait for it

*"The big explosion frame is too fast. Try the same principle we used for the
little fly explosion of the flying-dungeon folder."* Read rather than remembered:

**The fly's burst has never been part of another animation.** `FLY_RECTS[1..4]`
play on `flyBurstMs` (70) — its own number — and `Fly._scale()` derives one
factor from frame 0 and applies it to every frame, so because the burst frames
are drawn BIGGER on the sheet the explosion visibly expands as it comes apart.

Half of that was already true here for free: espeto's burst tiles are 302px
against his ~180px body and the pack scale is one number, so his expands too.
**What was missing was the clock.** `CONFIG.DEATH_BURST` gives a death row a
second rate from a given frame on:

| frame | starts | held |
|---|---|---|
| 0–5 (going down) | 0 | 130ms each |
| 6 | 780ms | 140ms |
| 7 | 920ms | 210ms |
| 8 (the widest) | 1130ms | **294ms** |
| 9 (the scatter) | 1424ms | 224ms |

⚠️ **THOSE FOUR ARE x0.7 OF WHERE THEY LANDED FIRST.** The burst was slowed from
520ms to 1240ms, watched, and then *"accelerate the explosion frames by 30%"* —
868ms now. The SHAPE was kept (the widest frame still holds longest); only the
tempo moved. Worth knowing that the first number was overshoot and the second is
the watched one.

`ms` takes one number or one per frame. The fly uses a single rate; a list is
what lets the biggest frame hold longest, which is the specific thing that read
as too fast.

⚠️ **AND THE CORPSE HAD TO LIVE LONG ENOUGH TO PLAY IT.** His death went 1.30s →
2.02s, past the 1.32s at which a body is reaped — so he was being deleted
mid-explosion. `Fighter.corpseGone` now also waits for the death ANIMATION.

⚠️ **FRAMES ONLY, NOT `deathWatch`.** That adds `deathHoldMs` (1000ms), which is
the beat the game holds after the PLAYER dies before the panel; borrowing it here
would leave every corpse in the game lying around a second longer than it does
today. `deathAnimS` is the frames alone, and `deathWatch` is now written in terms
of it so the two cannot drift.

⚠️ **THE REAPER NEEDED THE DRAWINGS.** How long a death row takes is a property
of the sheet, so `Crowd.update` now takes `sheets` and passes it to
`corpseGone`. Optional — without it the reaper falls back to the fade clock
alone, which is exactly what it did before.

⚠️ **NOTHING ELSE MOVED.** A cigarette's row is 8 × 130 = 1.04s, already inside
the 1.32s fade clock, so every existing corpse leaves on the same beat it always
did. Until his burst was slowed, the fade was always the longer of the two and
nothing had ever noticed there were two clocks.

### The hit had to wait for the explosion to reach you

⚠️ **`DEATH_BLAST.atMs` WAS 780 — TECHNICALLY THE FIRST FRAME OF THE BURST, AND
WRONG.** Reported: *"the hit is hitting too early, before the explosion even
starts."* Frame 6 genuinely IS the burst's first frame, but it is a tight
starburst barely wider than the body, so a hit landing on it reads as damage
arriving before anything exploded.

**So the rule is not "when the burst begins", it is "when it reaches you".**
`atMs: 920` is the start of frame 7, and the 300ms window then spans frames 7 and
8 — the two widest drawings. That is where the picture looks like it is arriving
at the player, which is the only thing a hitbox on an explosion has to agree
with.

⚠️ **AND IT IS A NUMBER DERIVED FROM `DEATH_BURST`, WHICH NOTHING ENFORCES.**
Re-time the burst and `atMs` is silently pointing at a different frame. The frame
table above is the thing to re-read; it is also why speeding the burst up 30% and
delaying the hit had to be done in the same pass rather than one at a time.

### An explosion has no feet

*"Looks like he is moving while exploding — we want him to explode in the same
place, in an expansive animation. Kind of a problem of anchor in these last few
frames."* Exactly right, and it was.

⚠️ **EVERY FRAME IN THIS GAME IS ANCHORED ON THE GROUND IT STANDS ON** — the
bottom of the body, the centroid of its base. A burst has neither. Its bbox grows
in all directions as it expands, so its bottom drops and its centre drifts frame
to frame; pin the bottom of that to the belt and the whole explosion **walks
across the floor while it plays**.

`centreFrom: 6` on the row: frames 6 onward are anchored on their own **centre**,
held at a fixed height, so successive frames — which are drawn larger and larger
— expand about one unmoving point.

**THE HEIGHT IS READ OFF THE LAST FRAME BEFORE THE BURST** — the body's own bbox
centre above its ground point — so the explosion starts where the animal's middle
was rather than at a number somebody chose.

⚠️ **THAT IS THE FLY'S PRINCIPLE AGAIN, the other half of it.** The first half
was the burst having its own clock; this is the burst being drawn *at the point
it died* and scaled by one factor. `Fly.draw` never had to think about it because
a fly in that game has no ground line to be anchored to in the first place — it
is a thing in the air. Bringing the idea to a belt game is where the anchor had
to be said out loud.

⚠️ **`centreFrom` MUST AGREE WITH `CONFIG.DEATH_BURST.espeto.from`.** They are
the same frame index in two files — the cutter decides which frames stop being a
body, and the game decides which frames slow down. Splitting them was deliberate
(one is about the atlas, one about time) but they describe the same boundary.

⚠️ **`bh` FOR A BURST TILE IS THE TILE**, because there is no body left to
measure. It only feeds the floating enemy health bar, and a corpse has none.

### He is 10% smaller, and five numbers moved with him

`drawScale` 1.0 → **0.9**, on request. The note added when he shipped predicted
exactly this and it was followed:

| | at 1.0 | at 0.9 |
|---|---|---|
| string `reachX` | 146 / 116 / 138 | **131 / 104 / 124** |
| blast `reachX` | 208 | **187** |
| blast `reachZ` | 70 | **63** |
| `groundNudge` | 10 | **9** |

⚠️ **`drawScale` IS DRAWN SIZE ONLY.** Shrinking it alone would leave him
swinging and exploding further than he looks — which is the discipline both
cigarettes failed at over three size changes, and which their own notes now admit
to. **Move the scale, move these five.**

He now draws at 123px of body, the same as LEBRON.

### A latent bug found on the way: `baseWhite` has never been passed

`anchor(tile, base_white=True)` takes the flag; the call site has always been
`anchor(t)`. So the horse's `baseWhite: False` — a spec field with a paragraph
explaining that his chrome highlights defeat the white test — **has never done
anything**, and he has been anchored on whichever leg caught the most light
since the day he was cut.

⚠️ **NOT FIXED.** Passing it would move the anchors of a boss who is tuned,
shipped and played, in a session about a different character — and he looks right
today, whatever the reason. It is one argument whenever someone takes it on
deliberately, and the horse wants looking at frame by frame when they do. It
costs ESPETO nothing: his only white is his teeth, which sit above the bottom
`BASE_FRAC` of him, so the white base comes up short of 20px and `anchor` falls
back to the whole body — which is what the flag would have asked for anyway.

### He does not fade, and his corpse hits you

Two more asks the same day.

**NO CORPSE FADE.** *"Trust the sprites, don't touch the opacity of it."*
`CHARACTERS.espeto.corpseFade: false`, read in `Fighter.draw`.

⚠️ **IT WORKS FOR HIM AND WOULD NOT FOR THE OTHERS.** The fade exists because a
cigarette's death row ENDS with a body on the floor and something has to take it
away. His ends with the body GONE — four frames of spines scattering, the last
almost empty. The drawing already does what the fade was added to do, so doing
both is dimming an explosion.

⚠️ **IT IS THE OPACITY ONLY.** `corpseGone()` deliberately does not read the
flag, so he is reaped on exactly the same clock as every other body. Skipping
that as well would leave the last frame of the burst lying in the desert for the
rest of the level. The two were described as "the same arithmetic"; they are one
CLOCK, and now only one of them draws.

**THE BURST DAMAGES.** *"When he dies, that explosion gives damage."*
`CONFIG.DEATH_BLAST.espeto` — 8 damage, knockdown, live for 300ms from `atMs`
780, which is frame 6 of his 10-frame death row at `POSE_MS.death` 130.

⚠️ **IT IS THE ONE ATTACK NOBODY DECIDES TO THROW**, and that makes it the first
move in this game that is a CONSEQUENCE rather than an intention. Killing an
espeto at arm's length now costs you; killing him from outside the burst is worth
learning.

⚠️ **`radial: true`, AND IT IS NOT DECORATION.** Every other hitbox extends
FORWARD from the fighter only — deliberately, so a player cannot clear a crowd by
standing in it and mashing. An explosion that only went the way the corpse
happened to be facing would be the one hitbox in the game you could beat by
standing behind it. The flag is on the DEF, not the fighter: the same body throws
directional punches while it is alive.

⚠️ **`external: true`, AND WITHOUT IT THE CORPSE STANDS BACK UP.** The blast is
armed by `Enemy._deathBlast` off `deathT` — the same clock the death row is DRAWN
from, so the box and the picture cannot drift. It does **not** go through
`attack()`: that path calls `canAct()` (false for a corpse, correctly), and the
attack tick it would hand to ends by setting `state = 'idle'`. Its def has no
`startupMs`, so every comparison in that tick is against NaN and falls straight
through to exactly that branch. `Fighter._updateAttack` now returns early on
`external`. **Found by reading the order, not in play.**

⚠️ **`hasHit` IS WHAT MAKES IT HIT ONCE.** An explosion that re-hit on every
frame of its 300ms window is an instant kill. `combat.crowdHits` writes the flag
back, exactly as it does for a punch — which is the whole reason the blast wears
the ordinary `atk` shape rather than a new one.

⚠️ **IT HITS THE PLAYER ONLY.** `crowdHits` never tests enemies against each
other, so an espeto bursting in a crowd does not scratch the espeto beside him.
Friendly fire is new code in the resolver, not a number in config.

⚠️ **AND IT KNOCKS DOWN, WHICH IS A CHOICE.** Nothing a mook throws floors the
player except the barata's charge. An explosion that merely stings is a tax; one
that puts you down is a thing you step away from, which is the point of giving a
corpse a hitbox at all. `knockdown: false` makes it a tax again.

### The size is an open question

⚠️ **HE SHIPS AT `drawScale` 1.0 AND IS THEREFORE THE SMALLEST VILLAIN IN THE
GAME.** Every other pack carries a number well over 1 — the cigarettes 1.452 and
1.691 after three rounds of *make them bigger*, the roaches and the horse 2.32.
At 1.0 his body is 137px, a shade taller than LEBRON's 123, so this is not a
mistake so much as the others being oversized. **Left at the honest number and
raised to the user rather than picked**, per the standing rule about never
rescaling drawn art to even it out.

⚠️ **GROWING HIM MEANS GROWING HIS REACHES BY THE SAME FACTOR.** `drawScale` is
drawn size only. His reaches are measured *at 1.0*; multiply one without the
other and he inherits the exact fault both cigarettes' own notes now admit to.

### In the fight

60 HP (between the two roaches — the desert follows the whole street, so the
floor is the toughest thing already beaten), 0.95 speed, `enemyLeapChance` 0.10
— the highest, because a ball that never leaves the floor is a ball nobody
believes in.

**THE ONLY FIVE-HIT STRING IN THE GAME**, and it is not five times the damage:
3+3+5+3+7 = 21, a shade under DEDÉ's 22 over three. No single blow costs more
than 7. Weights `[5, 3, 2, 1, 1]` — hardest-weighted to the short one of anyone,
because at flat weights a five-hit string is a fighter who pins you to a wall and
empties a magazine. He averages 2.2 hits and reaches the finisher 1 time in 12.

⚠️ **`enemyComboWeights` MUST HAVE FIVE ENTRIES.** `_rollChain` reads
`min(weights.length, combo.length)`, so four would silently cap him at three and
two of his ten drawings would never be seen.

⚠️ **THE TIMINGS ARE EXTRAPOLATED, NOT WATCHED** — the same admission DEDÉ's
entry makes. Every startup clears `hurtMs` 260, so the string is escapable by
design rather than by luck.

**One in each of the desert's three arenas**, entering 900ms after the cigarette
and on the near side of the belt (z 300 = 79% of this room's 380-deep band), so
the pair arrive as two things from two places rather than as a line.

---

## The belt became a property of the room

*"For the second level, double the height of the belt."* The band a fighter
walks in was **one size for the whole game** — 190px deep at screen y 520 — and
`src/belt.js` exists because it is not any more.

| room | `topY` | `depth` | near edge |
|---|---|---|---|
| street | 520 | 190 | 710 |
| **desert** | **330** | **380** | 710 |
| boss room | 520 | 190 | 710 |

**THE SHOT IS WHY.** The street was filmed low and tight and 190px is the ground
it has. The desert's plate is a high, open shot of dirt with the wall along the
top of the frame, so its walkable floor runs from about y 330 to the bottom of
the picture — and the default band left the bottom third of it unusable. A room
is a PLACE; how much floor it has is part of what makes it one, exactly like
`plate` and `music` already are.

⚠️ **`topY` AND `depth` ARE A PAIR AND THE FUNCTION TAKES THE ROOM FOR THAT
REASON.** `z` runs `0..depth` and lives at `topY + z`, so doubling the depth
alone would put the near edge at 900 — 180px below a 720-tall canvas, and the
player would walk off the bottom of the screen. 330 + 380 = 710 puts the near
edge exactly where the street's is. `Belt.set(room)` cannot be handed one without
the other.

⚠️ **NOTHING MAY READ `CONFIG.beltTopY` / `CONFIG.beltDepth` DIRECTLY ANY MORE**
— 26 reads across 8 files became `Belt.topY` / `Belt.depth`, and that is the
discipline the file asks for. A single read left on CONFIG is a body standing on
the street's floor in the desert, and **it presents as a sprite-anchor bug rather
than as a missed find-and-replace.** CONFIG keeps the two as the DEFAULT, which
is what every room but the desert still gets.

Two reads on CONFIG are correct and stay: `Belt`'s own fallback, and
`titleWalkGroundYRel` — the title screen is not a room and has no belt to be a
property of.

⚠️ **`Belt.set()` GOES BEFORE THE PLAYER IS PLACED, IN BOTH CALLERS.** Where he
stands is `depth * playerStartZRel`, so setting the band one line later puts him
on the previous room's floor — 114 into a 380-deep desert instead of 228. Stage
does it in `reset()` and `enterRoom()`, the two places the room can change.

⚠️ **EVERY `z` IN A ROOM IS ON THAT ROOM'S BAND.** The desert's enemies moved
110 → 220: the same 58% across the belt, a different number. A `z` copied from a
street wave lands at half the depth it means, and looks like the enemy standing
too far up the picture.

**What did NOT change is the perspective.** `depthScale` is `z / depth`, a
fraction, so bodies still shrink from far to near across exactly the same range.
A deeper belt is more room to move, not a different camera.

### The C-key overlay follows it, including the labels

The debug view reads `Belt` like everything else, so its no-walk bands, walkable
region, `z=0 FAR` / `z=380 NEAR` ruler and the plan view's height all follow a
room's belt without being told. The plan panel's background is already derived
from the depth, so it simply grows.

⚠️ **AND THE LABELS NAME THE ROOM'S OWN KNOB.** The no-walk bands print *"lower
it to eat into this"* against the number that governs them, and hard-coded that
said `beltTopY` — a CONFIG line with no effect on the room being looked at.
`Debug.beltKnob()` now prints `ROOMS[1].belt.topY` where the room overrides and
`CONFIG.beltTopY` where it does not. **A debug label that names the wrong knob is
worse than no label, because it is followed** — the same rule as *verifiable
debug views*.

### And he walks into a room now

*"The character should enter level 2 in the same way he did for level 1, walking
from the left."* The walk-on existed since 2026-08-24 but only fired at the start
of a RUN; a room reached through the fade simply had him standing on his mark
when the black lifted, which reads as a cut into a static pose after a walk-out
that was all movement.

`player.enterWalk(CONFIG.playerEnterPx)` is now called on **every** room entry:
the fade, and the DEV number-key jump as well.

⚠️ **THE DEV JUMP MATTERS AS MUCH AS THE FADE.** The number keys are how a room
gets LOOKED AT, so a shortcut that skipped the walk-on would hide the very thing
it is being used to check.

⚠️ **AFTER `enterRoom`, ALWAYS.** `enterWalk` measures from where he has already
been placed and backs him off THAT — the same rule that made the one in `start()`
sit after the DEV `startRoom` jump. Read before the swap, it walks him in from
the previous room's origin.

⚠️ **IT IS EVERY ROOM AND NOT A DESERT FLAG**, because there is no honest way to
say "walk into this room but not that one". So the boss room gets it too, and its
wave of roaches now walks in while the player does. He is untouchable while
`state === 'enter'` and the wave takes its own beat to arrive, so they overlap
rather than collide — but that is a real change to a room that was working, and
one line is the whole of it if it reads wrong.

---

## The desert's floor is made of cigarettes

*"Spread these bad boys all over stage 2, in the walkable zone — these mounds
should behave as the ground, the player will step on top of them — cover like 80%
of the ground."* Three sheets arrived, **six drifts of cigarette butts**, two to a
file.

⚠️ **"BEHAVE AS THE GROUND" IS A DRAWING RULE, NOT A PHYSICS ONE**, and reading
it that way is what made this a day's work instead of a week's. They are painted
BEHIND every fighter and collide with nothing, so the belt is exactly as walkable
as it was — the player passes over the top because there is nothing there to stop
him. **The moment one of these has to be stood on for real — a height the
fighter's `z` or `jumpY` answers to — it stops being scenery and becomes a prop,
which is a different file and a different bargain.**

That bargain is the one *The flies* section already describes: a PROP is cheap
because it answers the fighters' interface with no branch; SCENERY is cheap
because it answers **nothing**. A mound has no hitbox, no z-sort entry, no
shadow, no crowd entry, no stats, and neither `combat.js` nor `stage.js` ever
asks it a question.

### Cut on bands, because a mound is not a body

`tools/build-beat-fundo-defs.py` is new and does **not** work the way the enemy
cutter does. That one finds frames as connected components over a size threshold,
because a fighter is one body. A mound is fifty loose butts, most touching and
several not — its components are the individual cigarettes. So the unit here is
the **row band**, and everything inside one band is one mound.

⚠️ **AND ONE BAND IS NOT A MOUND.** `coconut-cigarros-fundo.png` carries a stray
143×906 mark in its top-left corner that bands exactly like a drift does. Bands
under `MIN_W` are dropped and the tool asserts the final count, so a sheet that
gains or loses a mound fails at the tool rather than shipping a scrap of paper as
level art.

One scale for all six (0.11), the standing rule for a pack: the illustrator drew
one 3270px wide and another 6339px, and that difference is the point — the small
ones fill gaps the big ones leave. Atlas is 699×857, 587KB.

### The layout is hashed, not random

⚠️ **THE DESERT'S CAMERA REVERSES**, so the player walks back over ground they
have already seen. A layout rolled with `Math.random` — even once, at room entry
— would be fine until you turned round, and then it would be a *different desert
behind you* on a restart. Hashed off the row and the index instead: same room,
same layout, always.

### Coverage was measured, not estimated

The mounds were laid out at each setting and the belt's alpha counted at four
camera positions across the room:

⚠️ **THE TARGET IS 60%, NOT 80%.** The first ask was *"cover like 80%"*;
watching it in play changed it to *"its not 80%, its actually 60%"*. **That was a
new target, not a complaint** — and it was read as a complaint first, which cost
a round trip. At 80 the desert is a carpet of butts; at 60 it is a desert with
butts drifted over it, and the second is the one that was wanted.

⚠️ **AND THEN THE MOUNDS GREW TWICE** — `SCALE` 0.11 → 0.143 (+30%) → 0.157
(+10%), both on request. **Every coverage number below is tied to that size.**

⚠️ **THE SECOND BUMP NEEDED NO RETUNE, AND THAT WAS CHECKED RATHER THAN
ASSUMED.** At 0.157 the shipped 6 × 1.45 measures 67% against 66% at 0.143 —
inside the variation between one stretch of the room and the next. Only
`marginPx` moved, to clear the wider mound. The trend is roughly **+2 points of
coverage per +10% of size**, so a third bump will not be free. The scatter
spaces mounds by their own WIDTH so x looks after itself — but a bigger mound
covers more DEPTH, and the same 6 × 1.30 that gave 62% at the old size gives 68%
at this one. Re-cut the pack and re-measure; `rows` is what brings it back.

Measured over SEVEN camera positions, not four — once the mounds got big and
sparse the coverage varied 15 points from one stretch of the room to the next,
and a four-sample average hid that.

| rows × spacing, z span | belt | far / mid / near | drawn/frame |
|---|---|---|---|
| *at SCALE 0.11* | | | |
| 5 × 0.52, z .10–.90 | 78% | 95 / 91 / **42** | 31–35 |
| 9 × 1.05, z 0–1.05 | 81% | 92 / 84 / 83 | 29–32 |
| 6 × 1.30, z 0–1.05 | 62% | 71 / 63 / 68 | 15–16 |
| *at SCALE 0.143* | | | |
| 6 × 1.30, z 0–1.05 | 68% | 80 / 71 / 53 | 12–16 |
| 6 × 1.45, z 0–1.10 | 66% | 74 / 64 / 58 | 9–12 |
| 6 × 1.70, z 0–1.05 | 54% | 72 / 53 / 39 | 8–11 |
| *at SCALE 0.157 (current)* | | | |
| **6 × 1.45, z 0–1.10** | **67%** | **77 / 66 / 57** | **9–12** |
| 6 × 1.55, z 0–1.12 | 64% | 75 / 61 / 55 | 9–11 |
| 5 × 1.45, z 0–1.12 | 58% | 64 / 60 / 49 | 7–10 |

⚠️ **IT WILL NOT GO MUCH UNDER 65% WITHOUT GOING PATCHY AT THIS SIZE**, and that
is the trade to know. Each drift is most of a screen wide now, so thinning them
further stops meaning "more sand between mounds" and starts meaning "some screens
have a bare stretch". 66% with an even spread beat 60% with holes in it.

⚠️ **THE FIRST PASS HAD THE DIAL BACKWARDS.** It packed tighter in x (spacing
0.52) to chase coverage, which merged each row into one continuous ridge — "stuck
together too much" — and still left the belt at 78%, because what was uncovered
was never the gaps between mounds. It was the gaps between ROWS, and the near
edge, which no row reached at all.

⚠️ **AND THE AVERAGE HID IT.** 78% overall looked fine as a number and was **42%
where the player actually walks**, reported as "the lower part has no
cigarettes". A mound's ink sits entirely ABOVE its ground point (bottom-centre
anchor), so a row at z covers about `[z - 140, z]`; rows placed at band CENTRES
put the last one at 342 of 380 and spent a quarter of the field painting up the
wall. **That is a placement bug, not a density one** — and the near-third column
is the one to read.

**`rows` moves coverage; `spacing` above 1.0 is what leaves sand showing between
individual drifts.**

⚠️ **AND THE NUMBER UNDERSTATES WHAT IT LOOKS LIKE.** It counts alpha, and the
art is porous on purpose — a drift of loose butts with sand showing between them.
78% of alpha reads as a floor that is essentially covered, which is why it stops
there rather than chasing 90.

### It is the most expensive scenery in this game

9–12 mounds per frame at roughly 790×200 each — **well under one full-screen
blit's worth of fill** on top of the plate's own. It was two and a half at the
80% density; dropping to 60% and then growing the mounds (fewer, bigger) took it
down twice.

⚠️ **IT IS FILL, NOT VRAM, WHICH IS THE GOOD KIND OF EXPENSIVE HERE.** Every one
of those draws samples ONE 699×857 atlas, so there is a single texture bound and
nothing to thrash — and VRAM is what actually cost this project its frame rate
once (PERFORMANCE.md). Quad count is nothing to a GPU. If it ever needs turning
down, `rows` first.

⚠️ **THE CULL IS AGAINST THE ANCHOR, NOT THE WIDTH.** First pass allowed a whole
mound-width of slack either side and drew about a third more than the screen can
show. `ax` is the centre, so the left edge is `sx - ax` and the right is
`sx + (w - ax)`.

### And then the floor was given three speeds (2026-08-27)

*"One crazy feature: for the cigarrete bums mounts, we want to try to create a
parallax effect on them, it should be 3 layers, a closer one, a mid one and a far
away one, they should move in different speeds."*

The six rows are cut into three depth **bands**, two rows each, and each band
scrolls at its own rate — `CONFIG.SCENERY.parallax`, `near: 1.00 / mid: 0.90 /
far: 0.80`, the same meaning `parallax` has on a backdrop layer. Walk 1000px and
the back of the belt has drifted 200px against the sand under it. The belt reads
as having thickness instead of as one flat decal.

⚠️ **THIS DELIBERATELY BREAKS THE RULE THE SECTION ABOVE IS BUILT ON.** "They
behave as the ground" was the whole reason this was a day's work: a mound sits on
a fixed patch of sand and the fighters walk over it. A band under 1.0 does not —
it slides against the filmed plate, which is parallax 1.0, and against every
fighter, who are 1.0 by definition. **That is the effect, and it is only
affordable because of the same bargain: nothing in this game ever asks a mound
where it is, so there is nothing for the slide to be wrong about.** The two
features cannot both exist the moment a mound has to be stood on for real.

⚠️ **THE NEAR BAND IS PINNED AT 1.0, AND THAT IS A CHOICE, NOT THE DEFAULT.**
Textbook parallax anchors the FAR plane and races the near one — far 1.0, mid
1.1, near 1.25. Do that here and the ground **directly under the player's feet**
outruns him: he reads as skating on the butts rather than walking through them,
and this is a beat 'em up where the feet are the entire contract with the belt.
Anchoring the NEAR band instead keeps the ground he is standing on honest and
spends the whole effect on the depth behind him, which is where the eye goes for
it anyway. Both are one edit; what ships is the anchored-near version.

⚠️ **THE SPREAD IS THE DIAL, NOT THE THREE NUMBERS.** 1.00/0.90/0.80 is a 0.20
spread. Under ~0.06 total it is invisible and costs only the coherence; much over
0.25 and the back of the belt visibly crawls *backwards* under a fast camera,
which reads as a bug rather than as distance.

⚠️ **THE BAND COMES OFF THE ROW INDEX, NOT OFF THE JITTERED `z`.** `zJitter`
moves a row's ground point up to 30px, and a mound that changed SPEED because its
scatter landed slightly forward would tear the boundary open. Rows are what the
bands are made of, so rows are what get sorted into them — a clean 2/2/2 at
`rows: 6`, and the split follows `rows` if it changes.

⚠️ **A BAND OVER 1.0 COSTS SCATTER; A BAND UNDER IT COSTS NOTHING.** A mound is
drawn at `x - camX * p`, so filling the screen at the far end of the room needs
mounds out to `p * camMax + GAME_W`. Below 1.0 that is *inside* the room and the
existing field already over-covers it — which is why the shipped values needed no
new extent. Above 1.0 it is past `endX`, and `enterRoom` extends the scatter to
match or the last stretch of a fast layer would simply be bare. Per *frame* it is
one multiply per item: the 9–12 draws and the single atlas bind are unchanged,
and so is the ~67% coverage (shifting a row in x moves the holes, it does not
make more of them).

### ...and then the near band was drawn 10% bigger

*"The cigarettes in the first plan (closer to the screen), make them 10%
bigger."* `CONFIG.SCENERY.bandScale`, `near: 1.10`, the same three bands.

**It is the other half of the cue the speeds started.** A closer thing moves
faster *and* is bigger; doing only the first is a large part of why a parallax
can read as sliding rather than as distance. The bands now carry two independent
numbers each — a rate and a size — and either block can be off on its own.

⚠️ **THIS IS A BAND MULTIPLIER, NOT A RE-CUT, AND IT MUST NOT BECOME ONE.** The
pack is cut once at one scale (`SCALE` 0.157 in the cutter) and that stays the
art's size — the wire-art rule is one scale per pack, never normalised per
sprite. What is scaled here is a *band*, which is level composition; every frame
in it moves equally, so the six mounds' sizes relative to each other are
untouched. Do not push this into the cutter.

⚠️ **TWO THINGS HAVE TO SCALE WITH IT, AND EACH FAILS AS A DIFFERENT BUG.**

- **The anchor.** `ax`/`ay` are offsets in FRAME pixels. Draw a 219px mound at
  1.1x while still subtracting the raw `ay` and its top stays put while its bottom
  drops 22px past the ground point — **the band hangs below the belt line it is
  supposed to sit on**, which presents as a `z` bug and sends you looking in the
  wrong file. The anchors are exact bottom-centre (`ax = w/2`, `ay = h`), so
  scaling both nails the ground point and the mound grows up and out around it.
- **The spacing step.** `spacing` is a fraction of a mound's OWN width. Leave the
  step on the raw width and the band packs 10% tighter as well as growing, so
  **"bigger" arrives as "denser"** — a different change, and one that would land
  on the coverage number that was tuned over seven camera positions. Stepping
  with the scale keeps the composition exactly as tuned and simply enlarges it:
  ~9% fewer mounds, each 21% more area.

⚠️ **`marginPx` NO LONGER "CLEARS THE WIDEST MOUND" AND DOES NOT NEED TO.** The
widest is 995px and the near band draws it at 1094. The camera never goes below 0
(`minCam = reverseFloorX || 0`), so the left margin's only job is to put ink at
x=0. It stays at 1000 on purpose: `x0 = -marginPx` is where the scatter's index
starts counting, so moving it re-rolls the layout of *every* band to buy nothing.

**Cost:** the near third gains ~2 points of coverage (the +2-per-+10%-of-size
rule, because a bigger mound covers more DEPTH — x looks after itself via the
spacing). Fill is ~+10% on two of six rows, ~+3% overall; the draw count is
unchanged to within a mound. Nothing needed retuning. **At 1.0 the scale is an
exact no-op**, not a near-miss, so the other two bands and every other room draw
byte-for-byte what they did before.

### The near band came down the screen, and the mid one grew (2026-08-27)

*"Bring the first plane (closest to screen) 20% down on the screen, increase the
size of the cigarettes in the middle plane by 5%."* `bandOffsetZ.near: 0.20` and
`bandScale.mid: 1.05`. A band now carries **three** independent numbers — a rate,
a size and a place — and the three together are one depth cue.

⚠️ **"20% DOWN" WAS TAKEN AS 20% OF THE BELT'S DEPTH (76px of 380), NOT OF THE
SCREEN.** The belt is the unit every other z in `SCENERY` already uses
(`zFrom`/`zTo` are fractions of it), so that is the reading. 20% of `GAME_H`
would be 144px and is `0.38` — it crops most of the front row away. One number
either way, and the alternative is written down next to it.

⚠️ **THE BAND IS NOW PAST THE NEAR EDGE OF THE BELT, ON PURPOSE.** The near rows'
ground points move from z 334/418 to **410/494 against a belt 380 deep** — below
the walkable strip, and off the bottom of the 720px screen (740 and 824). That
works because a mound's ink sits entirely ABOVE its ground point: row 4 still
covers z 169–410 and row 5 covers 253–494, so both still blanket the near third
of the belt, and only the front row's lower half is cropped by the screen edge.
**Coverage here was reasoned from those spans, not re-measured** — row 3 still
covers what row 4 vacated. The seven-camera table above is how to check it
properly if the near third starts looking thin.

⚠️ **AND IT IS STILL NOT A FOREGROUND.** This is the one likely to disappoint.
Scenery is a single layer in `CONFIG.LAYERS`, drawn before every fighter, so a
mound at z 494 is painted **behind** a player standing at z 380 even though it is
now nearer the camera than he can ever get. It reads as ground sloping toward the
lens. It will **not** read as something he walks behind, and no number in
`SCENERY` will make it — that is a draw-ORDER change, a second scenery pass in
the `foreground` slot that is already in LAYERS at parallax 1.25 and `on: false`.

⚠️ **THE BAND HAD TO BE PICKED BEFORE `z`, NOT AFTER.** It was chosen off the row
index *after* z was computed, which was fine while a band only decided speed and
size. Now the band MOVES z, so the order in `enterRoom` is: row index → band →
z. Still the row index and never the jittered z, for the same reason as before.

### Back up to 80%, and the mid third had a hole in it (2026-08-27)

*"We asked to fill the ground by 60% with these cigarettes background props, lets
bring that up to 80% back."* **rows 6 → 11, spacing 1.45 → 1.35, and
`bandOffsetZ.mid` 0 → 0.10.** Measured 81.7%, thirds 86.5 / 78.4 / 80.3. (The
target moved again an hour later — see the next section. The `mid` ramp below is
the part of this pass that survived.)

⚠️ **THE TARGET HAS NOW MOVED TWICE AND THAT IS FINE.** 80 → 60 → 80. Each was a
NEW TARGET, not a complaint about the last one — the same lesson the 80→60 move
already taught, arriving in the other direction. The config comment used to say
*"do not fix this back up"*; it now says the number is the user's look and to
re-measure rather than defend whatever is in the file. **Do not argue the history
at someone asking for a number.**

⚠️ **AND THE FIRST THING THE MEASUREMENT FOUND WAS NOT THE DENSITY.** What
shipped before this ask measured **62.6% overall with the MIDDLE THIRD at 45.9%**
— a hole, not a shortfall. `bandOffsetZ.near: 0.20` had pulled two of six rows
down past the belt, leaving 129px between the mid band's last row and the near
band's first with nothing in it. The bands ran 0 / 0 / 0.20 — a step. Graded to
**0 / 0.10 / 0.20** the hole closes: the same 6 × 1.45 goes to 65.8% with thirds
66 / 64 / 67, which is the *evenest* this feature has ever measured. **The ramp is
a fix, not a coverage grab** — it bought 3 points of average and 18 of middle.

**This is "read the thirds, not the average" for the third time**, and the second
time *I* introduced the hole rather than inheriting it. The offset shipped last
turn with its coverage "reasoned from the ink spans, not re-measured" — the
reasoning was right about the near third and never looked at the middle.

⚠️ **`rows` DID NEARLY ALL THE WORK, AS THE ORIGINAL PASS SAID IT WOULD.** 6 → 11
rows; spacing only 1.45 → 1.35 and deliberately kept **above 1.0**, under which
the drifts in a row merge into one ridge (the old "stuck together too much").
Rows alone saturate — `11 × 1.45` measures 78.8% — so the last two points came
from the small tighten, not the other way round.

⚠️ **THE SHIPPED ROW IS THE EVENEST, NOT THE HIGHEST.** `11 × 1.25` measures
86.7% and `12 × 1.35` 83.5%; the one that ships is 81.7% because 86 / 78 / 80 is
the flattest spread anything measured and per-camera it runs 72–85% against the
old 48–75%.

⚠️ **AND THE NEAR BAND DID NOT MOVE.** Chasing coverage by pulling `zTo` back
down scores well (`9 × 1.00, z 0–0.80` measures 83.7%) and would have silently
undone the "20% down the screen" from the turn before. The search was constrained
to keep the near band's front row past 1.20 of the depth; at `rows: 11` its rows
land at z 1.08 / 1.19 / 1.30 against the 1.08 / 1.30 that shipped — **the same
two positions, with a third row added between them.**

**Cost: 18–23 drawn a frame, up from 9–12.** Still under the *first* 80% pass's
29–35: the mounds grew 30% since, and bigger means fewer for the same cover.

### "To the brim" — 100% measured, then 90% (2026-08-27)

*"Fill it 100% instead of 90, to the brim"*, and in the same breath *"if 100% is
unreasonable, try 90%"*. **rows 11 → 12, spacing 1.35 → 1.20. Measured 90.7%,
thirds 93.2 / 87.0 / 91.7, 23–27 drawn.**

⚠️ **100% IS REACHABLE AND WAS MEASURED, NOT ESTIMATED.** The art is porous on
purpose, so a solid mat is only a question of stacking enough porous layers, and
they do converge: `28 × 0.80` measures a true **100.0% at every third and every
camera**. It is not a wall you argue about; it is a price you look up.

⚠️ **AND THE PRICE IS WHERE THE KNEE IS — BETWEEN 90 AND 100.**

| coverage | drawn/frame | overdraw |
|---|---|---|
| 81.7% (before) | 18–23 | ~4 screens |
| **90.7%** (ships) | **23–27** | **~5 screens** |
| 99.5% | 49–55 | ~9 screens |
| 100.0% | 86–93 | ~16 screens |

**Four times the fill for the last nine points**, on the one project whose frame
rate has already collapsed once. Nine points of alpha that the eye cannot find,
because the porosity the measurement counts is the sand *between the butts inside
a drift* — the thing that makes it read as loose rubbish rather than a carpet.

⚠️ **THE USER MADE THIS CALL, NOT ME.** They offered 90 as the fallback in the
same message. What was owed was the measurement and the price, not a lecture:
100 was priced, the number was reported, 90 shipped. Compare the 80→60 episode —
the failure there was reading a new target as a defect. The failure available
here would have been *refusing a target on taste*. Neither is the job.

⚠️ **IF A TRUE CARPET IS EVER WANTED, MORE ROWS IS THE WRONG ANSWER.** Ninety
mounds a frame to paint one belt is the scatter being used as a fill tool. Bake
the six drifts into one wide repeating strip at build time and the floor becomes
two or three blits. **But a baked strip cannot have three bands moving at three
speeds over it — the parallax and the carpet are alternatives, not additions**,
and that trade is the thing to put to the user, not the row count.

### All three planes down 20%, and the field got cheaper (2026-08-27)

*"In the same way you pulled the first plane down by 20%, do the same thing with
the other planes, bring them down by 20%."* **`bandOffsetZ` far 0 → 0.20, mid
0.10 → 0.30**; near did not move again, having had its 20% the turn before. Read
the three as **a flat 0.20 the whole field sits on, plus the 0 / 0.10 / 0.20
ramp** that was already there.

⚠️ **MOVING THE FIELD DOWN RAISED COVERAGE INSTEAD OF LOWERING IT.** The obvious
guess is that vacating the top of the belt costs cover. The same `12 × 1.20` went
**90.7% → 95.0% at an identical draw count**. A mound's ink sits entirely ABOVE
its ground point, so the top rows had been spending a slice of themselves
painting up the back wall where it does nothing; moving them down brought that
ink into the belt for free.

**That one fact is behind most of the tuning in this whole section** — it is why
`zTo` runs past 1, why rows placed at band centres left the near edge bare on the
first pass, and now why the field got cheaper by moving down.

⚠️ **SO `rows` CAME BACK DOWN, 12 → 9, TO HOLD THE 90% THE USER SET ONE MESSAGE
EARLIER.** Two live instructions — "90%" and "drop the planes" — and the drop
alone would have shipped 95%, quietly overshooting a number chosen by watching.
The retune holds both: **90.3%, and 17–20 draws against 23–27.** The same look,
a quarter less fill.

⚠️ **AND IT IS THE FLATTEST THIS FEATURE HAS EVER MEASURED: 90.9 / 90.6 / 89.5**,
a spread of 1.4 points across the thirds against 6.2 for the row before it. Nine
rows land more evenly than twelve did, for the same reason — none of them is
wasting itself above the belt any more.

⚠️ **THE FAR BAND IS NOW THE ONE TO WATCH, AND THAT IS A REVERSAL.** Its first row
sits at z 0.200 (76px, screen y 406), so the top 76px of the belt has **no ground
point in it at all** and is covered only by ink hanging up from that row. It
measures 90.9% and is fine. But push the field down again and **the BACK of the
belt goes bare first** — the far edge, where this feature's original bug was at
the near edge. The next failure will look like the first one upside down.

#### How it was measured

There was no coverage tool — the earlier tables were measured once and the
instrument was not kept, so it was rebuilt. It is a port of `scenery.js` that
lays the scatter out with the same hash and the same math, blits the frames'
ALPHA into the belt strip at seven camera positions and counts.

⚠️ **A PORT'S ONLY CLAIM TO BE TRUSTED IS THAT IT REPRODUCES A KNOWN ROW.**
Calibrated against the shipped `6 × 1.45`: it prints 66.3% / 76.5 / 65.2 / 57.4
and 9–12 drawn against the 67% / 77 / 66 / 57 and 9–12 recorded in the table, on
an alpha > 63 threshold. Had it not landed there, every number it produced would
have been a fiction and the tuning would have been against one. It lives in the
session scratchpad rather than `tools/`; it is a measuring instrument and not a
harness, but it was not put in the repo without asking.

⚠️ **THREE BANDS MEANS TWO SEAMS**, and that is what "3 layers" costs over a
smooth gradient — rows 1 and 2 are 84px apart in depth and now differ by 0.10 in
speed. If a boundary ever reads as a tear rather than as distance, the fix is not
a smaller spread; it is giving every *row* a rate lerped from far to near, one
line in `scenery.js`. Three discrete layers is what was asked for, and it is also
the version you can see working.

## O ouriço trembles before he goes (2026-08-28)

*"O ouriço, quando ele vai explodir, tem que repetir o frame, como se ele desse
uma tremidinha, igual a bomba. Nesse momento, ele só passa um frame 'agonizando'
e depois ele explode, mas esse frame fica muito rápido."*

`CONFIG.DEATH_BURST.espeto.shudder` + `Fighter._deathFrame` / `deathAnimS` /
`deathFrameStartS` + `Enemy._deathBlast`.

⚠️ **"REPETIR O FRAME" DESCRIBES THE EFFECT, NOT THE MECHANISM, AND TAKING IT
LITERALLY WOULD HAVE MISSED IT.** Holding one drawing longer reads as the
animation STALLING. What makes the bomb read as live -- the thing being pointed
at with *"igual a bomba"* -- is that the picture keeps CHANGING while going
nowhere: three drawings eight pixels apart on their own fast clock
(`Prop._frame`). So the shudder LOOPS a range.

⚠️ **I PICKED THE FRAMES OFF THE DEATH ROW AND THEY WERE THE WRONG DRAWINGS.**
First pass looped death frames 3-5, reasoned from the packed row: *"no, that is
very bad."* The right ones were named by hand -- **row 4, sprites 6 and 7 of
`espeto-sprites-fim.png`** (the user counts rows and columns from 1) -- and they
are **not in the death row at all**. Row 4 is `airPunch`: its seven master widths
match that anim to the pixel, so the two drawings ship as `airPunch` frames 5 and
6. **Reading a packed row tells you what the cutter produced, not what the artist
drew for the moment**; when the art has a master sheet, the master is the source
of truth and the person who drew it is a faster lookup than any inference.

⚠️ **SO A DEATH CAN BORROW TWO FRAMES FROM ANOTHER ROW.** `shudder.pose` names
it, and the tremble is the ONLY thing that borrows -- *"these 2 sprites are just
for the agonizing state before blowing"*; the fall and the burst are untouched
and `airPunch` as an attack is unaffected. No new art, no duplicated frames in
the pack, no re-cut, and nothing rescaled.

⚠️ **THE POSE AND THE FRAME MUST BE ONE DECISION, AND THEY VERY NEARLY WERE NOT.**
`frameStep()` opens with `const p = this.pose(sheets)` and then has a branch
keyed on `p === 'airPunch'` for the jump arc -- so a corpse borrowing that row
would have been handed the ARC's frame index. `_shudderNow()` is asked once by
each and returns both halves together. **When two functions answer halves of the
same question, the borrow has to be resolved above both of them.**

⚠️ **The row had to be looked at before the numbers could be picked** -- the same
lesson [[beatemup_espeto]] and the fire frames both taught, and it did not stop
me guessing from the wrong sheet first.

⚠️ **THE BLAST NOW HANGS OFF A FRAME INSTEAD OF A HAND-COMPUTED TIME, and that
was not tidying -- it was the bug this change would otherwise have shipped.**
`DEATH_BLAST.espeto.atMs: 920` was 6 x `POSE_MS.death` + 140, correct when it was
written and **silently wrong the moment anything before frame 7 changed
duration.** The shudder is exactly that: it pushes the explosion 800ms later, so
a fixed 920 would have detonated him mid-tremble with the damage arriving a full
second before the picture. `atFrame: 7` asks `Fighter.deathFrameStartS`, which
walks the same clock the row is drawn from, so it moves by itself from now on.
**A number derived from an animation's pacing should ask the animation.**

⚠️ **`deathFrameStartS` TAKES NO `sheets`, DELIBERATELY.** The only thing the
row's length would buy is one optional guard, against threading `sheets` through
`Enemy.update` and `Crowd.update` -- churning a shared call site for a check
every caller already satisfies.

⚠️ **AND THE CORPSE HAD TO BE CHECKED AGAIN.** `corpseGone` waits on
`deathAnimS`, which now includes the shudder, so he survives the whole 2.448s.
That guard was added the last time this row got slower and it held -- but the
COMMENT beside it still said "2.02s". Numbers in prose go stale; the rule is to
read it off `deathAnimS`.

**Measured timeline** (was 1648ms end to end, now 2448ms):

| phase | frames | ms |
|---|---|---|
| the fall | death 0-5 once at `POSE_MS.death` | 0 - 783 |
| **the shudder** | **`airPunch` 5-6 alternating, 80ms** | **783 - 1583** |
| the burst | 6-9 at their own pacing | 1583 - 2448 |
| the blast | `atFrame: 7`, 300ms window | 1720 - 2020 |

The agony went from **one 130ms frame to 800ms of trembling** on the drawings
meant for it, which is what "muito rápido" was about. `holdMs` is the knob.

---

## Level 3 — the bookcase (2026-08-27)

*"Time to add level 3, push the horse boss room to the end... this video is
possible to reduce its size... there is one dark detail about this level, it has
vertical movement in 2 points."* Then, on being shown what the footage actually
does: *"the player will come from the right (elevator) and then goes to the left
(the final elevator)... the camera will move from right to left, and the player
must follow."* And then the constraint that decided the whole shape of it:
*"please isolate this behavior to this level, otherwise you will break other
levels... Trying to make this logic work alongside the other logic (the default
one) will be our demise. I am doing this for around 20 years now, I know a death
loop when I see one."*

`src/level3.js` (new) + `CONFIG.LEVEL3` + `ROOMS[2]` + `tools/build-level-3-plate.py`.

⚠️ **THE FOOTAGE IS A COMIC-BOOK BOOKCASE AND THE "TIERS" ARE SHELVES.** It was
worth extracting a contact sheet before designing anything: the shot pans right
along a shelf, rises, pans **left** along the next, rises, pans right along the
last. A switchback climb — which is exactly how you would traverse a bookcase,
and exactly what the user then described from memory without having been told.

⚠️ **"VERTICAL MOVEMENT IN 2 POINTS" WAS AN UNDERSTATEMENT OF THE PROBLEM, AND
THE LEFTWARD SHELF WAS THE REAL ONE.** The two rises are easy — the film goes up
while a man stands still in front of it. The middle shelf is what the engine
could not express, and it is the LONGEST stretch in the room. Surfacing it before
building was the right call; the user had a level design ready for it.

⚠️ **THE PLATE IS WOUND BY ONE RATIO AND A SWITCHBACK BREAKS IT TWICE.**
`_drawVideo` computes `filmTime = camX / worldPxPerSecond`, and:

* on shelf 2 the player walks LEFT, so camX falls — under that ratio that means
  REWIND, i.e. back down the lift onto shelf 1; and
* **it is not a sign flip.** A switchback visits the SAME camX three times at
  three different heights, so no function of camX alone can say which frame to
  show. Both halves have to be said or the fix looks like a one-liner.

So the two ideas come apart: **PROGRESS** (monotonic, in film seconds, drives the
plate) and **CAMERA X** (right, then left, then right).

⚠️ **ISOLATION WAS AN INSTRUCTION, NOT A PREFERENCE, AND IT MADE THE CODE
BETTER.** The instinct was to generalise — give segments a direction, give the
camera a forward vector, give the plate a piecewise path. That is the death loop
the user named: every room in the game would then depend on machinery that exists
for one. Instead level 3 REPLACES the stage for itself. **Six hooks, every one a
single guarded early return** (`stage.reset/enterRoom/update/bounds`, and two
lines in game.js's draw loop). Every other room reaches byte-for-byte the code it
reached before.

⚠️ **AND THE BEST HOOK IS THE ONE THAT CHANGED NOTHING.** `backdrop.js` was not
touched at all. `game.js` hands it `Level3.filmScroll()` in place of `camX`, and
`filmScroll()` multiplies by the very `worldPxPerSecond` that `_drawVideo` is
about to divide out — a round trip that looks silly and is the point: the
backdrop never learns that a room with its own clock exists. **When isolation is
the requirement, look for the seam where the shared code takes a NUMBER rather
than the one where it takes a decision.**

⚠️ **EACH WALK LEG GETS ITS OWN NON-OVERLAPPING BAND OF WORLD X** and the player
is teleported between them mid-lift. That sounds violent and is invisible: the
plate is drawn stationary and wound by progress, so nothing on screen is a
function of world x. Letting shelf 2 walk back over shelf 1's x would have made
world x ambiguous for anything placed in the room later.

⚠️ **`px` IS CAMERA TRAVEL AND IT IS THE SYNC** — a leg's camera runs exactly the
leg's own pan, so the background moves 1:1 with the feet, which is all
`worldPxPerSecond` ever bought the other rooms. **The three shelves pan at 192,
386 and 181 screen px per second**, so one ratio could never have covered this
room even if it went one way: shelf 2 pans twice as fast as the others.

### The three bugs the user found, and what they had in common

Reported from a build taken mid-session: *"the character vanishes and the
elevator goes up by itself... it skips the part where the player goes left... at
the end it's beating the game."* All three were already fixed by the time the
report arrived, and **all three were the same class of mistake — a value read
from the wrong place, not logic that was wrong.**

⚠️ **`stage.bounds()` IS CALLED BEFORE `stage.update()`** (game.js:870 vs 890),
which is deliberate — the walls the player just walked into, not the ones a
segment change is about to install. It means **anything level3 reads off the
stage inside `bounds()` is one frame stale**, and the bands are 4000px apart, so
stale is not "slightly wrong", it is a different shelf:

* **the vanishing player.** `bounds()` returned the platform rect RAW during a
  lift — and the platform lives in SCREEN space, because it must hold still
  while the film climbs past it. Screen coordinates used as world coordinates
  put the walls at x 423–857 while the camera sat at 3867, so the player was
  clamped to **screen x −3010**. He did not vanish; he was thrown three screens
  to the left, and the lift carried on without him.
* **the skipped left walk.** Reading `stage.camX` in `bounds()` on the frame a
  lift hands over gave walls from the previous band and a player from the next,
  so `minX` came out ABOVE `maxX`; the clamp resolves to `minX` and put him on
  the far end of shelf 2, which the arrival test then read as "done". **Shelf 2
  completed in one frame.**

**The rule that came out of it: level3 is the source of truth for its own camera
and the stage is the MIRROR, not the other way round.** `bounds()` reads
`this._camX`. Anything added to this file follows that or gets the same bug.

⚠️ **THE THIRD ONE WAS NOT A COORDINATE BUG, IT WAS A VOCABULARY BUG.**
`Level3.update` returned `'clear'` when it ran out of legs — and game.js reads
that with the same switch it reads the shared stage's: **`'room'` is a door and
`'clear'` is the end of the whole game.** Finishing the bookcase rolled the
ending card. It now asks `hasNextRoom()` rather than hard-coding either answer,
so moving this room again cannot silently turn the credits on mid-game — which
matters, because this room was itself INSERTED to push the horse to the end.

⚠️ **THE HORSE WAS PUSHED TO THE END BY INSERTION, WHICH IS THE ONLY MECHANISM
THERE IS.** A room's place in the game is its index in `CONFIG.ROOMS`; nothing
reads a room number. Order is now street / desert / bookcase / boss room, and the
DEV number keys followed the array without a line of input code changing —
**1/2/3/4**. The stale thing was, again, the COMMENT: it had already gone stale
once through the desert's insertion and has now done it twice, both times while
containing a warning that it would.

### The lift became a place instead of an event (2026-08-28)

*"The elevator, it just appears out of nowhere, after the player hits the
boundary... the player only goes up after he touches the border, he kinda gets
pushed to the middle of the screen and goes up, I don't want that to happen, I
want the elevator to already be there, and when the player steps like in the
middle of the final frame, the elevator goes up."*

⚠️ **TWO SYMPTOMS, ONE CAUSE, AND THE CAUSE WAS A COORDINATE SYSTEM.** The
platform was drawn at a fixed SCREEN position -- which was defensible while it
only existed during the ride, since a lift that holds still while the film climbs
past it is the whole illusion. But **a thing pinned to the screen cannot be
walked up to.** So it had to be conjured at the moment the far wall was hit, and
the player had to be dragged onto it (a 0.35s `boardSec` ease). Give it a WORLD x
and both complaints go at once: it stands at the end of the shelf, slides into
view as the camera approaches, and stepping on it is the event. `boardSec` is
deleted rather than tuned -- **the ease existed only to paper over the wrong
coordinate system.**

⚠️ **AND IT IS STILL MOTIONLESS ON SCREEN DURING THE RIDE -- FOR A REASON NOW
RATHER THAN BY CONSTRUCTION.** The camera is pinned at the end of its range
before the player can reach the landing, so `worldX - camX` stops changing on its
own. That is also what makes the hand-over seamless: measured, the player moves
**0px** on the frame the ride starts.

⚠️ **WHERE THE LIFT MAY STAND IS DECIDED BY THE CAMERA, NOT CHOSEN.** The film
has to FINISH the shelf before the lift takes over -- otherwise `progress` is
short of the leg's end, the lift starts from its own `film[0]`, and the shot
jumps ~0.7s (~270px of pan on shelf 2). The camera pins when the player is
`focus + deadzone` past its end walking right (667.6px) and `focus - deadzone`
walking left (407.6px), so the landing must sit at screen x >= 667.6 rightward
and <= 407.6 leftward. Measured from the END WALL instead of the frame,
`landingInsetPx: 300` gives 940 and 340 -- mirror images, and it reads as the
lift being at the end of the shelf, which is what it is.

⚠️ **SO "THE MIDDLE OF THE FINAL FRAME" WAS NOT DELIVERED, AND SAYING SO IS THE
JOB.** 640 is inside the pin point in BOTH directions -- with a deadzone follow
the player is never at screen centre while the camera is still. It is not a near
miss to be quietly rounded to; it is a thing the camera makes impossible, and the
user asked for it in good faith without that constraint in front of them. Told,
with the two numbers, rather than shipped as if it had been done.

**Verified in game.js's real order:** lift on screen 4.1s / 3.4s before boarding,
0 frames with the player off screen, film gaps at the hand-overs 0.00s and 0.03s,
still returns `'room'`. A switch to call the lift was floated for later and
deliberately not built.

### The sixth layer, 30% down — UNDECIDED, awaiting a look (2026-08-28)

*"Bring the 6th layer 30% down, if that collide with the 5th layer, let me know,
but I want to see it."* `backLayer.zFrom/zTo` -0.05/0.15 -> **0.25/0.45**.

⚠️ **IT COLLIDES, AND IT WAS REPORTED RATHER THAN QUIETLY ADJUSTED.** Read in the
belt's depth like every other z here, 30% is 114px, and it puts the layer INSIDE
the far band instead of behind it:

        z  95 (y 425)  rate 0.70   <- 6th
        z 129 (y 459)  rate 0.75      5th
        z 171 (y 501)  rate 0.70   <- 6th
        z 187 (y 517)  rate 0.75      5th

**42px of shared depth**, and the 6th's second row now draws IN FRONT of the
5th's first. They are woven together rather than stacked.

⚠️ **AND THE TWO SLIDE THROUGH EACH OTHER: 64px per screen of camera travel**
(0.75 against 0.70, over 1280px). Two rows at nearly the same depth moving at
different speeds is the exact thing that reads as a glitch rather than as
distance -- it is the seam problem from the five-band pass, but between two rows
that now occupy the same z.

⚠️ **IT IS ALSO NO LONGER IN THE DEAD AREA**, which is what the layer was FOR one
message earlier. Both ground points are inside the belt now (425 and 501 against
a belt starting at 330). That is not a fault in the 30% -- it is simply where 30%
of the belt lands from where it started -- but it means the ask and the layer's
purpose have drifted apart, and saying so is part of delivering it.

**Shipped anyway, because it was asked for explicitly** (*"but I want to see
it"*) and a look is a legitimate reason. **Three separate fixes if it reads
wrong, and they do different things:**

* back to `zFrom: -0.05 / zTo: 0.15` -- the dead-area version;
* keep the position, set `parallax: 0.75` -- it moves WITH the far band instead
  of through it, losing the separation but killing the slide;
* about 15% down -- sits just above the 5th without overlapping.

---

### A sixth layer of cigarettes, in the dead area (2026-08-28)

*"Testar outra camada de cigarros (sexta, no fundo): essa camada não vai no belt
normal do jogo, ela vai na área morta, uma parte dela vai pegar na área morta e a
outra pode estar no belt, ela pode ser do mesmo tamanho que a quinta camada."*

`CONFIG.SCENERY.backLayer` + a second pass in `Scenery.enterRoom`.

⚠️ **IT IS NOT `bands: 6`, AND REFUSING THAT IS THE WHOLE REASON IT IS SAFE TO
TEST.** The five bands share ONE row ladder running `zFrom -> zTo`; adding a
sixth band means `rows` 10 -> 12 to keep the split even, which re-spaces the
ladder and **moves all five planes the user tuned by eye**. Measured: the belt
rows land at z 129/187/198/226/271/308/373/434/483/511 before and after, to the
pixel. An additive block also means `on: false` takes it straight back out --
which is what *"testar"* asks for.

⚠️ **THE FEATURE IS NEGATIVE z, AND NOTHING ELSE IN SCENERY USES IT.** z measures
DOWN from the belt's top edge, so a negative ground point is above the belt
entirely. The first row lands at z -19 (screen y 311), the second at 57 (y 387).

⚠️ **AND `zTo` IS POSITIVE ON PURPOSE** -- that is the *"uma parte na área morta e
a outra no belt"* half. A mound's ink sits ENTIRELY above its ground point, so a
row placed just inside the belt still spends most of itself in the dead area and
only its bottom edge crosses the line. The layer paints y 111-387 against a belt
starting at 330: about 80% dead area, the rest belt.

⚠️ **IT ANSWERS NONE OF THE COVERAGE RULES**, and that is a real simplification
rather than an oversight. Belt coverage is measured on the belt strip and this
layer is almost entirely outside it, so the 90% the user set by watching is
untouched and needed no retune. **It is backdrop, not ground cover** -- the third
category this feature has grown, after "scenery that covers the floor" and "a
band pushed past the near edge".

⚠️ **ITS PARALLAX BREAKS THE 0.25 CEILING ON PURPOSE (0.70, a 0.30 spread).**
That ceiling is about GROUND: a belt band under it visibly crawls backwards and
stops reading as the floor the player stands on. This layer is up the back wall,
where a slower rate is simply distance. **A rule's scope is the thing it was
measured against** -- worth saying out loud rather than either obeying it
reflexively or breaking it quietly. 0.75 (matching the far band) is the fallback
if it reads as sliding.

⚠️ **THE HASH SEED HAD TO MOVE CLEAR OF THE BELT ROWS.** The scatter is keyed on
the row index, so reusing 0 and 1 would lay this layer out in lockstep with the
two rows at the back of the belt -- the same drifts at the same x, which reads as
one band drawn twice rather than as depth. Seeded at 100+.

**Also this session:** espeto's tremble went **80ms -> 40ms**, *"the same
frequency as the bomb when its about to blow"* -- literally
`PROPS.bomb.animPanicMs`, not a number of its own. It sits right at the strobe
wall the bomb's own note describes (25 drawings a second, "faster than about 40
and it starts to strobe"), which the bomb spends its last three seconds at and
espeto spends 800ms at. `tintMs` defaults to `ms`, so the red re-timed with it
for free: 40ms lit every 120ms, the bomb's pattern exactly.

---

### He blows up like the bomb now (2026-08-28)

*"Remove the character explosion frames. Like keep the 'when he is going to blow'
frames, but the actual explosion frames that he has, remove those. Make him blow
like the bomb, including flashing red."*

`DEATH_BURST.espeto.hideBurst` + `shudder.tint` + `Fighter.bodyHidden` /
`_shudderTint` / `deathBoomPeakS` + `DEATH_BLAST.espeto.atBoomPeak`.

⚠️ **A BOMB HAS NO EXPLOSION DRAWINGS, AND THAT IS THE WHOLE MODEL.** It
flickers, it goes red, and then it is simply NOT THERE while `boom.js` does the
exploding. Espeto now does exactly that: the fall and the tremble stay, his four
burst frames are never reached, and the body disappears on the same instant the
boom fires. **Both hang on `deathFrameStartS(from)`**, so there is no frame where
a hedgehog and an explosion are both on screen -- which is the one way this could
have looked wrong.

⚠️ **THE FOUR DRAWINGS ARE SWITCHED OFF, NOT DELETED, AND `ms` IS KEPT WITH
THEM.** `hideBurst: false` brings the old death straight back. The `ms` array
([140, 210, 294, 224], the widest frame holding longest) is dead config on
purpose: it is the RECORD of how those frames were paced, and re-deriving it
would be a day's work for a flag flip. **Dead config that documents a reversible
decision earns its place; dead config that documents nothing does not.**

⚠️ **THE RED BLINKS ONE BEAT IN THREE, AND THREE IS LOAD-BEARING.** The bomb's
own pattern is `(fuseT * 1000) % (ms * 3) < ms`, and copying the NUMBER rather
than just the idea mattered: the tremble swaps drawing every `ms`, so a two-beat
blink would light the SAME drawing every cycle and read as *"one of his two poses
is red"* instead of as flashing. At three the red walks across both frames --
verified in the trace, it lands on airPunch 5, then 6, then 5, then 6.

⚠️ **THE FILTER STRING IS COPIED, NOT SHARED.** It is the bomb's `panicTint`
verbatim, and it is duplicated deliberately: these are two objects that happen to
want the same colour today, and aliasing would tie a hedgehog's death to any
future retune of the bomb's panic. If they must always match, that is a decision
to take on purpose.

⚠️ **AND THE RED IS DECIDED IN THE SIMULATION, NOT IN `draw()`** -- the rule
prop.js already records, because it is a value read off a moving clock and this
game has been bitten by putting those in the render pass.

⚠️ **THE DAMAGE HAD TO MOVE ONTO THE BOOM.** The rule is unchanged -- *"when the
explosion reaches you"* -- but the explosion is now the boom rather than a
drawing of his, and death frame 7 is not painted at all. `atBoomPeak` asks
`deathBoomPeakS` for the WIDEST frame of the explosion sheet (index 4 of 12,
+284ms), so re-cutting that art moves the hit with it. **Third knob today to go
from a hand-computed millisecond to a question.**

**Timeline:** fall 0-783ms · tremble + red 783-1583ms · body gone AND boom fires
1583ms · damage 1864ms · boom ends 2431ms · corpse reaped just after.

⚠️ **ONE THING LEFT DELIBERATELY ALONE: `DEATH_BOOM.espeto.sizePx` IS STILL 208.**
That number was set one message earlier ("make it 20% smaller") while the boom
was a flash layered INSIDE his own 302px drawn burst. It is now the entire
explosion, and there is a real case for putting it back up -- but the user set it
by watching, so it is theirs to move. Flagged, not changed.

---

### A real explosion on top of the drawn one (2026-08-28)

*"Lets add an explosion to the last frames, at the same time the espeto blows up,
the other explosion should appear as well, this explosion is the same that is
used in the bosses, but lets use a single one. Try to sync both explosions."*

`CONFIG.DEATH_BOOM.espeto` + `Fighter._armDeathBoom` / `deathBoomEndS` + a draw
call at the tail of `Fighter.draw`. **No new effect code.**

⚠️ **THE REFACTOR PAID OFF SIX DAYS LATER.** `boom.js` was lifted out of
horse-boss.js on 2026-08-22 the day the Mosca was asked for the same death, and
the note on it said the only things that differ are *how many, how far apart, and
how big, which is why all of those are config and none of them are in here*. A
third caller cost one config block and a two-line draw. **When a second caller
forces an extraction, write the extraction so the third one is free.**

⚠️ **"SYNC" MEANS `atFrame`, NOT A MILLISECOND.** The boom hangs on death frame 6
-- the first drawn burst frame -- through `deathFrameStartS`, the same clock the
row is drawn from. Written as a raw time it would be right today and wrong the
next time the fall, the shudder or the burst is retimed. Second knob moved to
`atFrame` after the blast, same day, same reason.

⚠️ **AND THAT IS WHERE THE BUG WAS: `deathFrameStartS` GOT ITS OWN BOUNDARY
FRAME WRONG.** The guard read `i <= B.from`, so asking for the FIRST BURST FRAME
took the plain-clock path and answered **780ms instead of 1580** -- the time it
would have started if the shudder did not exist. The boom would have gone off
800ms early, on top of the tremble. Every other frame was right, which is exactly
why it survived being written and read: `atFrame: 7` (the blast) was correct, and
`atFrame: 6` was the first caller ever to ask about the boundary. **An off-by-one
on a boundary hides behind every interior case being right.**

⚠️ **IT WAS CAUGHT BY PRINTING THE WHOLE TABLE, NOT BY CHECKING THE ANSWER.**
The trace printed the start time of all ten frames next to the boom's fire time;
780 against a burst that visibly starts at 1580 is obvious in a column and
invisible in a single assertion. **When a function answers "when does X happen",
print its answer for every X.**

⚠️ **THE CORPSE HAD TO BE KEPT ALIVE, FOR THE THIRD TIME.** `corpseGone` now
waits on `max(deathAnimS, deathBoomEndS)`. At the shipped numbers the boom ends
at 2431ms against a row ending at 2448 -- it fits by seventeen milliseconds,
which is not a margin, it is a coincidence waiting for someone to raise `sizePx`
or add a second blast. **Whatever the death plays, the body outlives.**

⚠️ **ONE BLAST WANTS ZEROS, AND `||` WAS EATING THEM.** `boom.js` read
`cfg.spreadXRel || 0.55` and `cfg.spreadYRel || 0.75`, so a single centred
explosion asking for no spread silently got the seven-blast scatter. Fixed at the
READ SITE with `!= null` -- the knob-set-to-zero-that-does-nothing trap this
project already has a rule about. The horse's values are all non-zero, so its
pattern is unchanged to the pixel. `baseYRel` was added at the same time so one
blast can sit on a torso instead of hugging the feet.

⚠️ **`refPx` IS THE DRAWN SIZE, NOT `fighterSizePx`.** The latter is 136.8 and is
a nominal body height for the hit resolver; espeto is drawn about 180px tall, and
a blast has to sit on the PICTURE rather than on the hitbox.

**Timeline:** boom fires 1580ms (with the first burst frame), damage 1720ms,
boom ends 2431ms, row ends 2448ms.

---

### He was blowing up twice, and it was not the new code (2026-08-28)

*"He does what we talked about, and that was great, so he blows up. but then,
another frame appears with him again, and then he blows up AGAIN."*

⚠️ **THE DESCRIPTION WAS LITERALLY THE FRAME LIST.** Reproduced exactly: death
frame **6** (the starburst), then frame **1** (him writhing) for 300ms, then
frame **8** (the explosion again). Not a loop, not a replay -- three drawings in
that order, and the middle one had no business being there.

⚠️ **`Fighter.frameStep` HAS AN ATTACK BRANCH ABOVE ITS DEATH BRANCH** (line 909
against 967), and ESPETO's death blast arms an attack box **on the corpse**
(`Enemy._deathBlast`). So for the blast's 300ms window that branch answered for a
dead fighter and returned `Math.min(1, n - 1)` -- frame 1 of whatever row was
current, which for a corpse is the death row, which is him writhing.

⚠️ **THE FIX COMPLETES A CONTRACT THAT ALREADY EXISTED RATHER THAN ADDING A
SPECIAL CASE.** `_updateAttack` already returns early on `a.external` -- *somebody
else owns this box's clock* -- and the blast is the only external box in the
game. It owns neither the fighter's state NOR its frame, so `frameStep` now skips
external boxes too. One condition, and it generalises: any future box put on a
fighter from outside cannot hijack the picture either.

⚠️ **AND IT IS OLDER THAN THE CHANGE THAT EXPOSED IT.** At the old `atMs: 920`
the blast replaced frames 7 and part of 8 in exactly the same way. What changed
is that the death is now worth watching -- 800ms of tremble draws the eye to it
-- so a 300ms interruption between two explosion frames is obvious where it used
to be lost in a fast, chaotic burst. **A bug that only becomes visible once the
thing around it gets better is still an old bug, and saying "my change did not
cause this" is worth nothing next to fixing it** -- but it is worth knowing,
because it means the same hazard was live for every corpse-mounted hitbox added
since.

⚠️ **WHAT MADE IT FINDABLE WAS ARMING THE BOX IN THE TRACE.** The first trace of
this animation walked `pose()`/`frameStep()` with `atk` never set, and it printed
a perfectly clean sequence -- which is why the GIF looked right while the game
did not. **A trace that omits the state the bug lives in will confirm whatever
you already believe.** The second one set `atk` exactly as `Enemy._deathBlast`
does, and the wrong frame appeared on the first run.

---

### The video

**15.26 MB → 5.04 MB (3.0x)**, same 848x478, same 74.006s, GOP 12.

⚠️ **THIS "MASTER" WAS NOT A MASTER**, and that is why the desert's two big
levers were already spent: it arrived at 848x478 h264 at 1.47 Mbps where the
desert's tool started from 1920x1080 HEVC at 17.7 Mbps. What was left:

* ⚠️ **A 256 kbps AAC TRACK ON A SILENT BACKDROP — 2.4 MB, 15% of the file, for
  audio nothing ever plays.** `-an`. Free, and the first thing to check on any
  clip that came off a phone.
* CRF 30. Ladder measured against the master at the 1280x720 the player sees:
  8.24 / 6.40 / **5.04** / 4.01 / 3.23 MB at CRF 26/28/30/32/34.

⚠️ **THOSE SSIM NUMBERS ARE NOT COMPARABLE TO THE DESERT TOOL'S** and reading
them as "much better than 0.867" would be wrong twice over — they score a second
encode against a first one, not against clean footage. **And it was NOT
rescaled**: the desert's "resolution is the wrong knob" finding applies harder
here, with no oversampling left to spend.

⚠️ **THE TOOL MEASURES BOTH AXES**, unlike the other three plate tools, and
segments the shot into legs by *which axis is moving* rather than on a hard-coded
frame list — so re-cutting the clip re-derives the table instead of silently
desyncing it. `--measure` re-runs the analysis without the encode.

### What is not there yet

**No enemies, deliberately.** What was asked for was the level, the reorder, a
smaller video and a placeholder lift to test. It is also the honest build order:
the switchback and the lifts are the parts that could be wrong, and a fight on
top of them would only make that harder to see. Fights go in
`CONFIG.LEVEL3.legs` when they arrive — **and the obvious first one is enemies
riding up with you**, which is also the answer to the 13.7s lift having nothing
to do in it. Do NOT answer that by speeding the lift up; it plays at 1x because
a filmed plate cannot fast-forward convincingly.

---

### Three planes became five (2026-08-27)

*"Instead of 3 planes of layers, I actually want 5 planes of layers, I don't know
how that is a good idea, but we are being forced to do it, please give it your
best try, if this sucks we roll back, if its good, we present it tomorrow."*

`CONFIG.SCENERY.bands: 5`, `rows: 10`, `spacing: 1.25`, `zFrom: 0.12`, spread
0.20 -> 0.25, and the three per-band blocks turned from `{far, mid, near}`
objects into far -> near LISTS.

⚠️ **THE REAL CHANGE IS THAT THE COUNT IS DATA NOW, AND ADDING TWO NAMES WOULD
HAVE BEEN THE WRONG SHAPE OF FIX.** Three was hardwired as `const BANDS = 3` in
`scenery.js` and spelled out three times over in the config. Writing `veryFar`
and `veryNear` next to `far`/`mid`/`near` works exactly once and leaves the next
ask in the same place. Each block is now a **curve sampled at `bands` points**
(`Scenery._ramp`), so 3, 5 and 7 all read the same file.

⚠️ **THE ROLLBACK THE USER ASKED ABOUT UP FRONT IS FIVE NUMBERS, AND `bands: 3`
ALONE IS NOT IT** -- I nearly wrote that it was. The count did not arrive alone:
the spread widened, the ladder re-graded and the density came back down with it,
so dropping only the count leaves a THIRD configuration that nobody has measured
or looked at, which is the worst of the three outcomes. It is written out
verbatim in `CONFIG.SCENERY` and in the README so it is a paste rather than a
reconstruction. **A feature offered with "if this sucks we roll back" owes an
exact rollback, not a plausible one** -- and the check that caught it was running
the promised rollback and printing what came out, not re-reading the sentence.

⚠️ **AND THE RESAMPLING IS A CORRECTNESS THING, NOT A CONVENIENCE.** Indexing a
3-long array with band 4 gives `undefined`, which becomes `NaN` in the z
expression and draws nothing -- **two entire planes missing with no error
anywhere in the console**. That is the failure mode a "just add more entries"
version invites every time someone edits one list and not the other three.

⚠️ **FIVE PLANES DIVIDE THE DEPTH BUDGET FIVE WAYS, WHICH IS THE ONE THING THE
ASK DOES NOT ASK FOR AND THE MAIN REASON IT COULD HAVE SUCKED.** What the eye
reads is the STEP between neighbouring planes, not the count. The spread has
always been the dial (0.20 across three bands = a 0.10 step, which is what has
been watched and liked); the same 0.20 across five is a 0.05 step, half of it.
**Shipping the count alone would have been a more expensive way to look like
three planes.** So the spread went to 0.25 -- the documented ceiling, above which
the back of the belt visibly crawls backwards -- and the step is 0.0625. That is
still smaller than what shipped this morning, and saying so is the honest version
of the answer: five discrete planes are *necessarily* less individually distinct
than three, and the ceiling is real. **"Make it 7" has no room left in it**; that
one would be the per-row lerp, not more bands.

⚠️ **THE FIRST WORKING VERSION WAS A TRAP AND THE INSTRUMENT CAUGHT IT.**
Changing only `bands` and `rows` measures 91.4% average -- above target, looks
done -- with the thirds at **95 / 90 / 89**, a 7-point spread against the
three-plane 1.4. Ten rows on a ladder graded for nine piled ink into the FAR
third at the near one's expense. **This is "read the thirds, not the average" for
the FOURTH time in this one feature, and it is now predictable rather than
unlucky: whenever the field's SHAPE changes, the average barely moves and one
third quietly pays for it.** `zFrom` 0 -> 0.12 re-grades the whole ladder down
and evens it to 90 / 92 / 88. A placement fix, again -- never a density one.

⚠️ **AND THE COVERAGE TARGET WAS HELD AT 90 ACROSS THE CHANGE, DELIBERATELY.**
`rows` had to go 9 -> 10 for a clean 2-per-band split, and ten rows at the old
`spacing` measures 91.7% against the 90% the user picked by watching. Loosened to
1.25 it is 90.1%. Same rule as the last time two live instructions collided:
apply the new one, retune the standing number back, **say that you did**.

⚠️ **`zTo` DID NOT MOVE, AND THAT WAS A CONSTRAINT ON THE SEARCH RATHER THAN AN
OUTCOME OF IT.** `zTo + bandOffsetZ` = 1.30 puts the front row's ground point at
z 494, which is the "20% down the screen" the user set earlier the same day.
Several higher-scoring configs get to 90% by pulling `zTo` back, which would have
silently undone it -- the same trap as the last pass, and it was pinned before
the sweep rather than noticed after.

⚠️ **THE PREDICTED FAILURE ARRIVED, MEASURED AND SMALL.** The last pass wrote
down that pushing the field down again would make **the back of the belt go bare
first**, the reverse of this feature's original near-edge bug. It did: the top
QUARTER runs 83-95% across 13 camera stops against the three-plane 86-96%. Three
points, behind everything, and the whole belt's worst camera actually improved
(83% against 81%). Judged affordable and written down rather than smoothed over.

⚠️ **`bandOffsetZ` WENT FLAT AND THAT IS A DELETION, NOT A LOSS.** It was
0.20 / 0.30 / 0.20, and the 0.10 bump was a PATCH: it closed a 129px hole three
coarse bands opened between the mid band's last row and the near band's first.
Five bands, ten rows and the re-graded `zFrom` close that hole geometrically --
the ground points land evenly 41px apart from z 122 to z 494 -- so carrying the
patch forward would have put a bump back into an even ladder. **A number that
existed to fix a problem should be re-derived when the problem is gone, not
inherited.**

⚠️ **`bandScale`'S ENDPOINTS WERE LEFT ALONE, AND THAT IS WHERE THE NEXT DIAL IS
IF THIS READS FLAT.** 1.00 is the pack's own size and 1.10 is a user-set "10%
bigger"; five planes only subdivides between them, so the new steps are 0.025 --
near-invisible, meaning the depth cue is carried almost entirely by speed.
Widening the ladder DOWNWARD (`[0.95, 0.99, 1.02, 1.06, 1.10]`, shrinking the far
drifts rather than growing the near ones) is the one line that makes distance
read as size. Not done, because shrinking the far end is a decision nobody asked
for and it costs coverage in the far third -- but it is the first thing to try if
"5 planes" doesn't land tomorrow.

**Cost: 19-21 drawn a frame against 17-20.** Band count is free -- one multiply
per item either way; the two extra draws are the tenth row.

**What was verified, and how.** The coverage instrument (a python port of
`scenery.js`) had been thrown away with the last session, so it was rebuilt and
calibrated against the row it was about to replace -- the shipped three-plane
config -- printing 90.3% | 90.9 / 90.4 / 89.5 | 17-20 against the recorded 90.3%
| 90.9 / 90.6 / 89.5 | 17-20. **It has now been rebuilt twice; ask next time
whether it should live in `tools/`.** Separately, `enterRoom` was run against the
real `CONFIG` and the real defs to confirm the runtime path actually produces ten
rows in five rate/scale pairs with nothing non-finite -- the config being right
and the code reading it being right are two different claims.

---

## The day passes over the desert (2026-08-27)

*"A color filter on stage 2 ... begin with a color like orange, and end with
purple, that will give the player the impression that the day is passing ... it
should affect everything on screen, except the HUD ... smooth transition, almost
unperceivable."* `src/grade.js` + `CONFIG.GRADE` + `ROOMS[1].grade`.

One composited rectangle over the whole frame, walking orange to purple as the
player crosses the room.

⚠️ **"EXCEPT THE HUD" IS THE DRAW ORDER AND NOTHING ELSE.** `game.js` paints the
layers, then the combat FX, then `grade.draw`, then the bars. There is no mask
and no second canvas, and that is not a shortcut — it is the cheapest correct
answer, and it makes the exclusion list READABLE: anything that must stay
ungraded goes after that one call. The room fade, the dev text and the debug
overlay were already there and needed nothing.

⚠️ **IT IS DRIVEN BY DISTANCE, NOT TIME, AND THAT IS WHAT MAKES THE BRIEF
LITERALLY TRUE.** "Purple at the end" is a promise about a PLACE. A wall clock
keeps it only for a player who moves at the speed you imagined — it turns the sky
purple early for one who lingers in the first fight and leaves it orange for one
who runs. The cost is that the sunset pauses inside a locked arena, which is
invisible: nothing is moving to compare it against.

⚠️ **AND IT IS A HIGH-WATER MARK, SO THE DAY NEVER RUNS BACKWARDS.** This room
reverses. A raw `camX / span` would rewind the evening every time the player
walked back over ground they had already crossed. `peak` only goes up.

⚠️ **THE RAMP HAS STOPS BECAUSE ORANGE TO PURPLE IS NOT A STRAIGHT LINE.** Lerped
channel-wise in one hop, `#ffa24a` to `#6b3fa0` passes through a dead grey-brown
around the middle — the two sit on opposite sides of the wheel, so the straight
line between them runs through the middle of it. The stops bend the path the way
a sky goes: orange, red, pink-purple, purple. Sampled every 10%, saturation never
drops below 0.53.

⚠️ **`multiply`, NOT A FLAT RECTANGLE.** Source-over at 20% is a sheet of coloured
plastic over the picture: it lifts the blacks and flattens the frame toward one
value. Multiply is coloured LIGHT — black stays black, the midtones take the
tint, and the picture darkens as the tint darkens, which is what an evening does
to a desert. The alpha ramps with the colour, so dusk is dimmer than noon with no
separate darkening pass.

### It shipped too strong, and the fix was a knob rather than four edits

*"We want the filter to be slightly lighter, its too strong, too perceivable, can
you make it more subtle."* **`GRADE.strength`, 1.0 -> 0.50 -> 0.70.** The halving
went further than wanted and it settled one step back up: *"instead of 0.5 in the
knob, make it 0.7"*. **The useful range is narrow and the answer was the middle of
it** — worth knowing before anyone reaches for the ends again.

⚠️ **THE STOPS ARE THE SHAPE; `strength` IS THE LEVEL.** Retuning "too strong" by
editing the four stop alphas is four chances to change the SHAPE of the day while
trying to change its WEIGHT — the relative build from noon to dusk is the part
that was right. One multiplier over the whole ramp preserves that by construction
and leaves exactly one number to argue about — which is exactly what happened:
1.0, then 0.50, then 0.70, three edits to one line with the shape untouched
throughout. 0.35 is barely there and the end stops reading as purple; 0.50 reads
as a warm/cool shift that is easy to miss; 1.00 was refused.

⚠️ **AND "TOO PERCEIVABLE" MEANT THE TINT, NOT THE TRANSITION.** The brief asked
for a change that is almost unperceivable, so the phrase could have sent this at
the RATE — spreading the stops further apart, easing the ends. It did not: the
rate is already spread over 5006px of camera travel, minutes of play, and what
was too much was the weight of the colour at any given moment. Two different
dials that the same words can point at; the one that was wrong is the level.

⚠️ **THE BOSS ROOM IS NOT GRADED AND THAT IS A DECISION TO REVISIT.** The desert
now ends purple and cuts to an ungraded room, which reads as the lights coming
back on. It was left alone because the ask named stage 2 — one `grade: true` plus
a stops list that OPENS where this one closes is the fix if the cut looks wrong.

### How it was previewed without playing it

Headless Chrome boots the game and proves it loads, but **it cannot get past the
title screen** — that needs a keypress — so no screenshot of the graded desert
was available. The ramp was previewed instead by compositing it in Python over a
real frame pulled from `desert-plate.mp4` with the same multiply maths the canvas
uses. That is what the colour and strength calls were made against.

⚠️ **IT IS A PREVIEW, NOT A RENDER.** It has the plate and the grade and nothing
else — no mounds, no fighters, no HUD. Good enough to choose a colour and a
strength, not good enough to sign off the look.

---

## Boss nameplates, and the roll-call left the board

Two asks in one, 2026-08-27: *"Add the boss names under their HP bars, remove the
name of the guys we beat at the end screen."* Both names have existed since
2026-08-21 with nothing drawing either.

**NARUTÃO and HIPÓLITO now sit under the boss bar**, centred, in the HUD colour
at the same relative size as the player's own name under his — `hud.drawBoss`,
which now owns the bar as well, because a bar and its nameplate are one readout
and drawing them from two files is how they drift apart.

⚠️ **THE NAME IS ASKED OF THE BOSS, NOT DERIVED FROM ITS `kind` IN THE HUD.** The
two get theirs from different places and always will:

| | where the name lives | why |
|---|---|---|
| HIPÓLITO | `CONFIG.CHARACTERS.horse.name` | he is a proper ragged pack |
| NARUTÃO | `CONFIG.MOSCA_NAME` | two raw flapping sheets, no pack entry |

Each constructor sets `this.name`; the HUD prints it. A branch on `kind` in the
drawing would have been the *third* place that has to know which boss is which,
and a third boss would have added a fourth. ⚠️ **Do not "tidy" the Mosca into a
`CHARACTERS` entry to make them symmetric** — that table is the PACK table
(sheets, scale, cut) and an entry would put her in front of everything that walks
the cast.

⚠️ **THE GATE STAYED IN `game.js`.** When a boss bar may be shown — arrived, not
dead, not fleeing — is a fact about the fight, not about the drawing, and the
reasons for each of those three are written at the call site.

**And the CLEAR board lost its roll-call.** The DOWNED row carried
`downedBy()` under it — *"DUDU x7   DIDI x5   CLAUDINHO x4"* — and the line is
gone. The **count** stays; it is who they were that went.

⚠️ **NOTHING WAS DELETED FOR IT.** `Stats.downedBy()` and the whole `note`
mechanism in `hud.js` are intact and documented as unused where they live;
putting the line back is one field in `Stats.rows()`. And it costs the board
nothing meanwhile: `_resultsTimes` reads `rows().length`, which a note never
contributed to, so the tally runs to exactly the same clock as before.

---

## And then on 2026-08-27: a second room, and the horse moved to the end

**THERE IS A DESERT BETWEEN THE STREET AND THE BOSS ROOM.** Asked for as a new
level after the Mosca rematch, with the horse's room *"passed to the end of
everything"*. The order of the game is now street → **desert** → boss room.

⚠️ **MOVING THE BOSS ROOM WAS INSERTING AN ENTRY ABOVE IT, AND THAT IS THE
POINT.** A room's place in the game is its index in `CONFIG.ROOMS` and **nothing
in the codebase reads a room number** — `stage.roomIndex` walks the array,
`hasNextRoom()` looks one ahead, the fade does `roomIndex + 1`. So re-ordering
the level is editing level data. Not one line of the horse's room, its music,
its props or its two `lock: false` segments changed.

**IT IS THE STREET'S LOGIC AND NOT A NEW KIND OF PLACE**, which is what was
asked for. A filmed plate scrubbed by camera position, `reverse: true` paired
with the plate's `allowReverse`, and a list of segments alternating walking with
fighting. What differs is only what the FOOTAGE decides — see below.

**ITS TWO ARENAS WERE PLACED EMPTY AND THEN GIVEN ONE BODY EACH.** First:
*"Don't add any enemies yet, just try to add 2 arenas, but when the player
enters the arena, he can already move forward, he doesn't get blocked."* An
arena with an empty `enemies` list became a **doorway** — see below, it is still
there and still works. An hour later: *"add one cigarrete enemy, so I can test
the arena effect."* Both now hold one **DUDU**, the lightest of the three
cigarettes (34 HP, 5 damage), which is what a rig wants — the arena is the thing
under test and a long fight is in the way of looking at it.

**AND THEN A THIRD, AT THE VERY END: THE BOSS ARENA.** *"Place a final arena at
the end of the level, this will be the boss arena."* It is still `kind: 'arena'`
with DEDÉ standing in, because the desert has no boss decided; the room's last
segment being a fight is what makes clearing it the door into HIPÓLITO's room.
It costs no film — an arena locks the camera, and the walk before it has already
spent all 5007px of the shot, the same trade the street's last two fights make.

⚠️ **"THE CAMERA WILL NOT GO BACK ANYMORE AFTER EACH ARENA" NEEDED NO CODE.**
That is what a cleared LOCKED arena already does, in this room as in the street:
`_checkpoint()` raises `reverseFloorX` to the camera, `_followCamera` clamps to
it, and `bounds()` derives the player's left wall from `camX` — one number moves
both. It was **absent** while the arenas were empty only because the doorway
path deliberately skips the checkpoint; putting an enemy in each turned it back
on by itself. The desert therefore reverses freely inside a stretch and never
past a fight it has finished, which is the street's behaviour exactly.

### The desert's numbers are the shot's numbers

`tools/build-desert-plate.py` is new and does what the other two plate tools do
between them: it MEASURES the pan by phase correlation and re-encodes the clip
so it can be scrubbed backwards.

| | street | desert |
|---|---|---|
| shot | 29.52s | **26.03s** |
| pan | 2266px of an 848-wide picture | **3317px** |
| `worldPxPerSecond` | 116 | **192.4** |
| camera travel | 3424px | **5007px** |
| `endX` | 4704 | **6286** |
| plays at `walkSpeedX` 300 | ~2.6x | **~1.6x** |

⚠️ **THE DESERT IS THE LONGEST ROOM IN THE GAME OUT OF THE SHORTEST WALKING
CLIP**, because its camera pans 1.7x faster. Camera travel is
`worldPxPerSecond * duration` and `endX` is that plus one screen — so the film,
not the level designer, decides how much room there is to walk in. Everything
in the segment list is derived from those two numbers and the ~668px the camera
trails the player by.

⚠️ **IT IS THE ONLY PLATE THAT WAS DOWNSCALED.** The master is 1920x1080 HEVC at
17.7 Mbps — **56MB, against a whole shipped itch build of 30**. The plate is
stretched to the 1280x720 canvas whatever its own size, so it is cut to the
848x478 both existing plates already are, with the per-frame blit cost left
exactly where PERFORMANCE.md measured it.

### Making it small, and the three levers that do not work

It first shipped at the street tool's `-b:v 3000k` and came out at **9.9MB**, on
a build that is 30MB whole. *"Drastically reduce the video size."* It is now
**CRF 32 → 4.8MB**, twelve to one against the master.

⚠️ **THE SIZE KNOB IS CRF, NOT THE RESOLUTION, AND THAT IS THE OPPOSITE OF THE
OBVIOUS MOVE.** Measured at the 1280x720 the player actually sees (comparing
plates at their own native size would flatter a small one for free):

| | size | SSIM |
|---|---|---|
| `-b:v 3000k` — what it shipped as | 9.9 MB | 0.904 |
| crf 28 | 7.9 MB | 0.897 |
| crf 30 | 6.1 MB | 0.884 |
| **crf 32** | **4.8 MB** | **0.867** |
| crf 34 | 3.8 MB | 0.845 |
| 640x360 crf 26 | 6.1 MB | 0.831 |
| 512x288 crf 28 | 3.0 MB | 0.749 |

**At the same file size, native resolution wins every time** — 848 crf 30 is
0.884 against 640 crf 26's 0.831 for the same 6.1MB — and it is visible, not
just a number: the scaled-down ones go mushy on the gravel where the high-CRF
ones only lose grain. ⚠️ **Do not shrink a plate by scaling it further.**

⚠️ **SSIM IS PESSIMISTIC ON THIS SHOT.** The picture is a field of gravel, the
texture SSIM punishes hardest; the chroma planes sit at 0.98 throughout. Read
the ordering, not the value.

Two more levers, both tried, both dead:

* ⚠️ **VP9 IS TWICE THE SIZE, NOT HALF** — 19.2MB at crf 34 against 10.2MB for
  x264 crf 26. The GOP is why: libvpx spends far more on a keyframe than x264,
  and a scrubbable plate is forced to carry 65 of them. VP9's usual advantage
  assumes long GOPs, which is exactly what this file cannot have.
* ⚠️ **DENOISING FIRST SAVES NOTHING** — `hqdn3d=4:3:6:4` came out 0.04MB
  smaller. The bits are going into real gravel, not sensor noise.

And the GOP itself is not where the size is either: 12 → 48 saves 2.7MB and
makes every backward step decode four times as far. Not a trade worth making in
a room whose camera reverses.

⚠️ **AND THE ASSERTION IN THAT TOOL IS THE DURATION, NOT THE FRAME COUNT.** The
street's tool asserts the count because `worldPxPerSecond` was measured against
it. This master is variable-rate (`r_frame_rate` 29.917, `avg_frame_rate`
30.046), so ffprobe counts 782 frames where a constant-rate decode yields 780 —
the same file, counted two ways. The sync is measured per SECOND, so the
duration is the thing that must not move.

### An empty arena had to be made into a doorway on purpose

Leaving `enemies` empty **already advanced on the first frame** — `crowd.cleared()`
is true when nothing spawned. It was not enough, because on the way through it
did three things only a fight has earned:

* **It left a checkpoint.** `_checkpoint()` raises `reverseFloorX` to the camera,
  a floor the player can never walk back past. Behind a cleared fight that is the
  design; in the middle of an empty walk it is an invisible wall across ground
  where nothing happened — and this room offers walking back.
* **It raised the GO arrow.** The prompt means *the way forward has OPENED*, and
  nothing had closed it. 2.6s of arrow over an uninterrupted walk.
* **It locked the camera for that frame** and dropped the follow reference, so
  the shot stopped for a frame in the middle of a scroll.

So the emptiness is read at the top of the arena branch, before any of it. The
segment still exists and is still consumed — write a wave into the list and the
branch stops matching, and it is an ordinary arena again with nothing to undo.

⚠️ **IT IS THE CURRENT SEGMENT FOR EXACTLY ONE FRAME, AND `bounds()` IS ASKED
BEFORE `stage.update`** — so the walls it would raise do apply for that frame.
Harmless where an empty arena can be: the scroll before it hands over with the
player around screen x 670 and the walls are at 40 and 1240. Worth knowing before
an empty arena is ever put somewhere the player could be against an edge.

**What the desert deliberately does NOT have**, both per-room declarations and
neither asked for: no `flies` (the street's were placed for its rooftops) and no
`props` (its barrels are a pickup test rig). Two decisions waiting to be made,
not oversights.

### And it plays nothing at all

*"Remove the main song from the desert level, we will use other songs later."*

⚠️ **THAT IS `music: false`, AND LEAVING THE FIELD OUT IS THE OPPOSITE OF IT.**
An absent `music` means *the level bed* — which is precisely the song being
removed, and is what the room shipped with an hour earlier. `roomMusic()` now
reads three states rather than two:

| `ROOMS[n].music` | what plays |
|---|---|
| absent | the level bed (`music`) — the default every room had until now |
| an asset key | that track |
| `false` | **nothing.** The music is stopped on the way in |

⚠️ **SILENCE CANNOT BE EXPRESSED BY PASSING A FALSY KEY DOWN TO `Sound`, which
is why the test is in `roomMusic()` and not in `playMusic()`.** `playMusic`
opens with `key || 'music'`, so `null`, `false` and `''` every one of them mean
the bed — and that is deliberate, because that fallback is what makes
`roomMusic()` safe to call for a room that declares nothing. A "no music" value
handed to it would be swallowed by the same line that makes the default work.

It uses `stopMusic()`'s own default fade rather than the 0.35 a track SWITCH
uses: this is the music ending, not one piece giving way to another. The layers
go with it (`layerVoices` is emptied), so the baratas' whistle stops too — and
`whistleGate()` can carry on being asked every frame, because `setLayerOn` walks
a list that is now empty.

⚠️ **NOTHING BRINGS THE BED BACK BY ITSELF.** Walking out into the boss room
starts the horse's theme because that room names one. A room added *after* the
desert with no `music` field would pick the bed back up mid-game — which is the
default doing its job, and would read as the street's song returning in a place
it was never meant to.

---

## The flies

Three of Still Life's flies, crossing the sky behind the street. Everything
about them is in `CONFIG.FLIES` and `src/flies.js`; the knobs are in README.md.
What is worth knowing here is why they are shaped this way.

**THEY FLY WHERE THE PLAYER CANNOT GO, AND THAT IS THE REQUEST.** "As moscas
deverão voar na parte da fase que o player não chega (fora do belt principal),
aquela parte de cima." `beltTopY` (520) is the far edge of the walkable strip,
so the band above it is exactly the part of the shot the fight never reaches.
`bottomY` is 404 — kept well clear of that line rather than sat on it, because a
fly grazing the back wall reads as one that is about to join in, and they must
never look like they can be punched.

**THEY ARE SCENERY AND THEY ANSWER NOTHING.** No health, no hitbox, no hurt
window, no death, no `z`, no shadow, no entry in the crowd, nothing in `stats`.
This is the opposite of the bargain props made — a barrel earned its cheapness
by answering the FIGHTERS' interface so the z-sort and the hit resolver took it
with no branch; a fly earns its cheapness by being outside all of that. Nothing
in `game.js` asks a fly anything. The two are worth holding side by side: the
question for a new object is which of the two it is, and answering "half of
each" is how a mechanic ends up wired into six files.

**RIGHT TO LEFT, ALWAYS, AND THE ERRATIC PART IS VERTICAL.** `vx` is re-rolled
on every heading change and is negative every time, so the wander cannot carry
one backwards; the dart in y flips sign freely, and that is what makes the path
read as a fly rather than as a bird. On top of it sits a fast micro-buzz and a
bank into whichever way it is climbing. Straight from Still Life's steering,
which is the only part that came across.

**RECYCLED, NOT WRAPPED.** Reach the left margin and a fly is moved to just past
the right one at a fresh height with a fresh heading — everything re-rolled
except its size, which is what keeps it the same fly. So they are a procession
across the shot rather than a couple of fixed paths on a loop.

⚠️ **AND THAT MAKES `count` A POPULATION RATHER THAN A RATE — WHICH IS THE ONE
THING ABOUT THIS THAT MISLED THE PERSON ASKING FOR IT.** The recycle happens on
the frame the fly leaves, so `count` flies are in the band at ALL times and no
gap ever opens: the number is literally "how many can be seen at once". Three
was asked for and three read as an infestation; the user corrected it to **two**
the same day, saying they did not know what the number meant. **A knob whose
name implies a frequency but whose behaviour is a headcount will be misread
every time — say which it is at the read site, not just in the doc.** If two is
still too many the answer is NOT one (the sky then sits empty for most of a
crossing, which reads as a bug); it is a fly waiting off-camera before
re-entering, which would make it a real frequency and does not exist yet.

⚠️ **THE RECYCLE TEST IS AGAINST THE SCREEN, NOT AGAINST A WORLD NUMBER.** They
live in WORLD x at parallax 1.0 — the fighters' axis — so they stay put in the
street while the camera travels, which is the whole reason they read as being in
the place rather than stuck to the viewport. But the camera crosses several
thousand px of street, so a fixed world bound would recycle every fly at the
same landmark. There is a second test the other way round for a camera that
moves LEFT out from under one; that cannot happen in the street, and it is there
because the boss room's camera pans both ways and a third room might.

⚠️ **SIZE IS THE ONLY DEPTH CUE THEY HAVE.** There is no `z` up there and no
parallax to separate them from the plate, so `sizeJitter` is not decoration —
without it the three read as one sprite drawn three times.

**THE STREET ONLY, DECLARED ON THE ROOM.** `flies: true` in `ROOMS[0]`, the way
`music` and `props` are already room data, rather than a room name tested inside
`flies.js`. The boss room does not get them: it is indoors, and a fly wandering
through the last fight is one more thing to read on a screen that already has a
horse on it. `Flies.enterRoom` is called at every site `props.enterRoom` is —
`start()`, the DEV room jump, and the room fade **at its blackest point**, which
is where the swap has to happen or three flies would blink out over a room that
is still visible.

**THEY TICK ABOVE THE PHASE MACHINE.** `play`, `outro` and `fade` — the walk-out
and the fade are both seconds long and both are watched, and hanging the flies
off `update()` alone would freeze them through each. They stop with HITSTOP,
because a held moment of impact is supposed to stop everything, and on `dead`,
because the world does. The licence for living outside the machine is that they
take nothing and change nothing: there is no order to get wrong and nothing that
can be left mid-state by a phase change, which is this codebase's one recurring
bug family.

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
| `src/backdrop.js` | the layer stack and its sources (tile / image / film / **video**) |
| `src/stage.js` | the level director: **rooms**, segments, camera, locks, spawning |
| `src/fighter.js` | the shared body: belt position, health, attacks, knockdowns |
| `src/player.js` | the coconut — input → intent, and nothing else |
| `src/enemy.js` | the villains, and `Crowd`, which owns **the attack token** |
| `src/fly-boss.js` | the Mosca Boss: ambush entrance, swoop, ground pass |
| `src/combat.js` | hit resolution and hitstop |
| `src/hit-fx.js` | the impact burst: six variants, picked per blow |
| `src/horse-boss.js` | the HORSE: the final boss, and the last fight |
| `src/title.js` | the photo title screen: the name drops in, LEBRON walks past |
| `src/prop.js` | barrels and food: punched, lifted, thrown, eaten |
| `src/flies.js` | STILL LIFE's flies, crossing the sky above the belt — **pure scenery** |
| `src/boom.js` | the string of explosions both bosses die in |
| `src/ending.js` | the WON screen: walk in, arms up, then the tally |
| `src/game-over.js` | the LOST panel: the flying dungeon's worms, saying PERDEU! |
| `src/sheets.js` | two pack formats, **two facings**; see below |
| `src/life-bar.js` | STILL LIFE's hand-drawn bar, player and boss |
| `src/hud.js` | health, lives, GO prompt, **the CLEAR board** |
| `src/stats.js` | the run's tally: what the CLEAR board counts up |
| `src/debug.js` | everything the C key draws |
| `src/input.js` | keyboard + pad; owns the pad mapping merge-back |
| `tools/build-go-glyph.py` | cuts "GO!" out of the title lettering sheet |
| `tools/build-manifest.js` | prints & checks what package.sh copies |
| `tools/build-beat-coconut-defs.py` | cuts the coconut's ragged sheet + anchors |
| `tools/build-beat-enemy-defs.py` | the same for a VILLAIN sheet, plus the smoke rules |
| `tools/build-beat-fx-defs.py` | cuts the impact-burst sheet into six animations |
| `tools/build-beat-prop-defs.py` | cuts the BARREL sheet: bands, not bodies; drops the ghosts |
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
| `street` | 3424px | the 29.5s dolly | 100% | **both ways** |
| `desert` | 5007px | a 26.0s dolly | 100% | **both ways** |
| `boss-room` | 337px | a 5.2s clip | 100% | **both ways** |

⚠️ **THE ORDER OF THAT TABLE IS THE ORDER OF THE GAME, and it is `CONFIG.ROOMS`
and nothing else.** No file reads a room number, so the desert went in between
the street and the horse on 2026-08-27 by inserting an entry. The street's
`reverse` also reads `true` here now — it was `false` until the shot was
re-encoded on 08-26.

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
Each ROOM has its own list; these are the two walking ones.

**The street**, read off `CONFIG.ROOMS[0]` on 2026-08-27:

| # | kind | | film |
|---|---|---|---|
| 0 | scroll | to x2100 — **the opening passage, 1880px / 6.3s** | 42% |
| 1 | arena | DUDU, DIDI, DEDÉ, **+DEDÉ, DUDU from behind** | |
| 2 | scroll | to x3300 | 77% |
| 3 | **sub-boss** | NARUTÃO, `fleeAt: 0.5` — **she breaks off and leaves alive** | |
| 4 | scroll | to x3690 | 88% |
| 5 | arena | DEDÉ, CLAUDINHO, **ZIDANE behind**, CLAUDINHO, **ZIDANE behind** | |
| 6 | scroll | to x4092 | **100%** |
| 7 | arena | ZIDANE, DEDÉ, **CLAUDINHO behind**, **ZIDANE behind**, CLAUDINHO | |
| 8 | **boss** | NARUTÃO again, no `fleeAt` — **this is the one that kills her** | |

**The desert**, added 2026-08-27. No cast of its own yet — every occupant below
is a stand-in:

| # | kind | | film |
|---|---|---|---|
| 0 | scroll | to x2400 — the opening passage, 2180px / 7.3s | 35% |
| 1 | arena | DUDU at x2600 — *lock ≈1732, walls 1772..2972* | |
| 2 | scroll | to x4000 | 67% |
| 3 | arena | DUDU at x4200 — *lock ≈3332, walls 3372..4572* | |
| 4 | scroll | to x5674 | **100%** |
| 5 | **the boss arena** | DEDÉ at x5900 — *lock 5006, walls 5046..6246* | |

⚠️ **SEGMENT 5 IS THE BOSS ARENA AND IT IS STILL AN `arena`.** The desert has no
boss yet; DEDÉ is holding the spot. Clearing it exhausts the room, which with the
horse's room still to come is a **door** — he walks off the right edge and fades
in there. No GO arrow, because `_goPrompt` self-gates to scroll segments and
there is nothing left to walk to.

⚠️ **WHEN A BOSS LANDS THERE, `who` IS NOT OPTIONAL.** `{ kind: 'boss' }` with no
`who` means the **Mosca** — a default that predates the horse and means her
everywhere it appears — and she is fought twice in the street and dies there.

⚠️ **AND THAT FIGHT WILL HAVE A STILL BACKDROP WHICHEVER WAY IT IS SET.** The
plate is scrubbed by camera position and nothing else, so a locked fight freezes
the shot — the boss room's answer was `lock: false`. That answer is worth less
here: this arena sits on the **final frame** of the film, so even unlocked the
camera has nowhere forward to go and the shot can only move if the player walks
back. Buying room for it means framing the fight deliberately with an explicit
`camX` a few hundred px short of the end.

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

### A configured ZERO is not a configured value (2026-08-22)

**`x.key || default` cannot tell "unset" from "deliberately zero"**, because 0
is falsy. Two of these were found on one day and they are worth knowing as a
family, because neither errors, neither logs, and both leave the config file
saying one thing while the game does another:

* **The food bob.** `PROPS.food.bobPx: 0` was set to stop drumsticks bobbing.
  `prop.js` read it as `F.bobPx || 3` and they kept bobbing at exactly the old
  rate. ⚠️ The config was right, the browser console answered `0`, the server was
  serving the correct bytes — and I checked all three and told the user their
  page was stale. It was not. **Verifying a value, and verifying its delivery,
  is not verifying its effect.** Fixed.
* **The alternate finisher's lift.** `COMBO_ALT_FINISH` was written `lift: 0`
  with a comment saying the low punch drives forward and down, shoving the
  target along the belt where the uppercut launches it. `fighter.js` reads it as
  `lift || 150`, so it has always launched — and at 150 against the uppercut's
  136.8, HIGHER than the uppercut. There is a second copy of the same trap in
  `_updateDown` (`this.launch || 150`), so fixing one line changes nothing.
  ⚠️ **NOT FIXED, DELIBERATELY.** The game has been tuned for weeks with both
  endings launching; the config was changed to `lift: 150` to record what
  actually happens. Restoring the design means fixing both reads AND judging
  what `downLandMs` (520ms of falling animation) looks like over a knockdown
  with no arc in it.

**The rule:** any knob whose OFF value is 0 must be read with `!= null`. When a
knob does not take effect, evaluate the expression the code runs before doubting
the file, the server or the cache.

### A scroll can be already finished before it starts

**Found in play, 2026-08-21: the wave after the Mosca spawned on top of the
player instead of being walked into.**

A `scroll` segment ends at an ABSOLUTE world x (`toX`). That is fine when the
player arrives from behind it, and wrong when they do not — and after a fight
they often do not. **An arena or a boss locks the CAMERA but still gives the
player the full width of the screen to move in.** The Mosca's lock sits around
camX 2762, so the walls run to roughly 4002, and the scroll that follows asks
for 3690. Finish the boss anywhere right of centre and that scroll is already
satisfied: it completes on its first frame, the arena after it spawns
immediately, and its enemies — declared at x 3450–3900 — arrive in the player's
lap. Nothing errors. It reads as enemies teleporting onto you.

`CONFIG.scrollMinWalkPx` (260) is the floor: a scroll now ends at whichever is
further, `toX` or that far from **wherever the player was standing when the
scroll began**. In the normal case the player is behind `toX` and it never
binds, so it costs no film.

⚠️ **AND IT IS CLAMPED TO `endX()`, WHICH IS NOT OPTIONAL.** In a scroll the
player may walk as far as the room's right wall and no further, so a minimum
measured from near that wall would ask for a position they can never stand in —
the segment would never advance and the game would sit there with nothing
visibly wrong. A fight ending against the right-hand gate is enough to cause it.

**The general shape, and it is a third instance of one in this file:** a rule
written as an absolute position is a rule that assumes where the player came
from. `toX` assumed it, and so did the camera lock before it was rewritten to
spend a budget earned by walking.

### The GO arrow pointed at a wall

**Found in play, 2026-08-21.** Clearing the boss room's wave raised the "GO →"
prompt, in a room where the next thing is HIPÓLITO and there is nowhere to walk.

The arrow means *the way forward has opened* — and it was raised on any segment
hand-off that had a next segment at all, which silently assumed every fight is
followed by a walk. True everywhere in the street, false in the boss room, where
an arena hands straight to a boss.

`Stage._goPrompt()` is now the one place it goes up, and it asks whether the
NEXT segment is a `scroll`. Verified across both rooms: the street is unchanged
(after segments 1, 3 and 5), the last street arena still gets none because it
returns a 'room' event, and the boss room now gets none at all.

### The last wave blinked out when the horse arrived

**Found in play, 2026-08-21.** Clearing the boss room's wave deleted the bodies
the instant HIPÓLITO spawned, cutting their fade off mid-way.

Two facts met: **`crowd.cleared()` means nobody is ALIVE, not that the bodies
have gone** — a corpse lies where it fell and fades over 0.8s (1.8s until
2026-08-24) — and **nothing
ever removed a corpse from the crowd**, so `crowd.clear()` at a segment boundary
was the only cleanup there was. The arena hands over the moment the last enemy
dies, the boss branch cleared on spawn, and every body still fading went with it.

Fixed at the cause rather than the symptom: `Crowd.update` now **reaps corpses
on their own clock**, once `corpseGone()` says they are fully transparent, and
the boss branch clears nothing. It has nothing to clear — that segment is only
reached when `cleared()` is true, so all that is left is bodies.

⚠️ **THE FADE AND THE REAPER READ THE SAME TWO NUMBERS** (`corpseFadeDelayS`,
`corpseFadeS`), which used to be literals inside `Fighter.draw()`. Split, they
drift, and the reaper starts deleting bodies that are still visible — the same
bug again, self-inflicted. Verified across the whole fade: the reaper never
fires while alpha > 0.

**THIS IS THE SIXTH INSTANCE OF THE FAMILY** — something mid-state when the
thing driving it changes underneath. The death row froze when the world stopped,
the end screens fired on a flag nothing consumed, the last corpse hung mid-fall
through the outro, the plate seek-stormed, `play()` restarted an ended video, and
now a hand-over deleted a fade.

⚠️ **AND THE NOTE THAT WAS SUPPOSED TO PREVENT IT — "ask what was still moving
when it started" — HAS NOW FAILED FIVE TIMES.** It is a thing to remember at
exactly the moment attention is somewhere else, which is the definition of a
rule that does not work. The five fixes before this one each patched their own
instance.

**THE RULE WITH TEETH IS STRUCTURAL: anything with its own clock decides when it
is finished, and a caller that deletes it is wrong by construction.** Corpses now
reap themselves; nothing outside has to know they exist. Applied to the whole
codebase afterwards, every other deletion site came back either a hard reset (a
run beginning or ending), hidden behind the room-change black, or already
guarded by an owner-decides test (`this.boss = null` waits on `boss.finished()`)
— **except one**, which the audit caught before it was ever seen: `_spawn` still
cleared the crowd at arena start, and with the new minimum walk that is ~0.87s
after the last body landed against the fade (1.8s at the time, 0.8s now). It
is `clearLiving()` now.
`clear()` survives only for hard resets and is labelled as such.

### Stuck on the ending screen

**Found in play, 2026-08-21, and mine.** After the tally, pressing anything left
the player on the ending photograph forever.

Nothing was frozen. `endingShown` makes `render()` draw the ending plate INSTEAD
of the world and return early, and it was never cleared — so the restart ran the
entire game underneath a still picture. Input worked, the level was playing, the
screen simply never changed again. **A stale render flag does not present as a
stale flag; it presents as the game hanging.**

Cleared in both `toTitle()` and `start()`, because those are the two ways a run
can begin (the title hands to `start`, and so does the DEV room-jump).

**And the two endings now part company.** Finishing goes back to the TITLE — the
run is over and that is where a run begins. Dying used to go straight back into
play, because a death is a retry and making the player sit through a title
screen to have another go is the one thing an arcade game must not do.
⚠️ **THAT WAS OVERTURNED ON 2026-08-22 AND THE ARGUMENT ABOVE HAS AN ERROR IN
IT: this panel is not a death.** The retry already happened, twice — a life is
spent and the fight resumes where it fell — and only the THIRD death reaches
the panel, by which point the run is over in exactly the sense the CLEAR board's
is. Both endings go to the title now. `Title.reset()` is what makes that work,
so the screen plays again from the top.

### The one I added and the user caught

`const ending = new Ending(assets, sheets)` was placed one line ABOVE
`const sheets = ...`. `const` is not hoisted the way `var` is, so reading it
early throws *"can't access lexical declaration 'sheets' before initialization"*
and takes the whole boot down — a black page, before any of the new code runs.
Not subtle, and entirely avoidable: **the shell's declaration block is ordered
by dependency, and anything added to it has to go after what it takes.** All 15
constructions in that block were checked afterwards; it was the only one.


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

- ⚠️ **THE BALANCE IS UNPLAYED, AND THE FIRST ITCH BUILD SHIPPED THAT WAY**
  (2026-08-22). Dev mode had been on since the game was started, so no fight had
  ever been seen at real damage; turning it off for the build was the first
  time. On top of that the player's combo was raised on request in the same
  pass — 4+5+6+4+9 = 28 became 5+6+8+5+12 = 36 (+28.6%; 30% exactly is 36.4 and
  these are integers), with the alternate finisher moved 9 → 12 so the two
  endings still cost the same.

  So the shipped numbers are a rebalance on top of an untested baseline. When
  judging it, expect to move the HP table rather than the combo.

  ⚠️ **AND "HP / 36" IS NOT A TIME TO KILL. I QUOTED IT AS ONE AND THE USER,
  WHO HAD ACTUALLY PLAYED IT, SAID THE BOSSES TAKE FAR LONGER.** They were
  right, twice over:

  * **A FULL COMBO LANDS 25, NOT 36.** Contacts fall at 55 / 180 / 320 / 455 /
    635ms and i-frames are `flyBossHurtMs` 150 on a boss and `hurtMs` 260 on a
    mook, so **hits 2 and 4 are eaten on every target in the game** — only 1, 3
    and 5 connect (5 + 8 + 12). Hitstop does not change this: it freezes the
    attack clock and `hurtT` together, so the relative spacing is unchanged.
  * **NARUTÃO IS USUALLY OUT OF REACH.** `verticalReach` is 70; it hovers at
    `flyBossHoverY` 150 and rises to 210 to telegraph. A grounded punch cannot
    touch it except at the bottom of a swoop or during the ground sweep, so its
    fight is paced by how often it descends, not by damage at all.

  Corrected: NARUTÃO 88 HP = **3.5** combos of damage plus the waiting;
  HIPÓLITO 150 HP = **6.0**, and he only opens up during his 460ms turn and his
  idle beat. Both are floors, not experiences.

  **THE STANDING LESSON:** an arithmetic quotient is not a measurement. Damage
  per second means nothing here — i-frames, reach and the openings the AI leaves
  are what set the pace, and none of them are in the division.

  `CONFIG.DEV.on` is `false` and the block is KEPT: `punchDamage` and the
  number-key room jumps are the tools for that pass. `package.sh` refuses to
  build while it is true.
- **THE BOSS ROOM HAS ITS BOSS** (2026-08-21): a HORSE, after the wave. See
  *The horse boss*. He is HIPÓLITO as of 2026-08-21. What is still open there:
  the fight has never been judged with
  `CONFIG.DEV.on` false — at 50 damage a punch he dies in three combos.
- **NEXT UP, AND DECIDED (2026-08-21): the bottom rank tier becomes COMÉDIA.**
  The board's grade is drawn as one 76px glyph — S / A / B / C — and C means
  "you finished, badly". In Brazilian slang *comédia* is what you call someone
  who is a joke, which is the same thing said with teeth. It was one of the
  words offered for the score board and is the only one that never found a row;
  it belongs here instead.

  ⚠️ **It is NOT a string swap.** `rankTiers` values are stamped as a single
  scaled letter, so a seven-letter word needs its own size and layout —
  `rankSize` cannot simply be reused. Scope agreed as the BOTTOM TIER ONLY;
  S, A and B stay letters unless the user names them too.

- ⚠️ **THE PLAYER'S COMBO HAS TWO HITS THAT CAN NEVER LAND.** Its contacts are
  125-180ms apart and every target's i-frames are longer (150 boss / 260 mook),
  so hits 2 and 4 are always inside the previous hit's invulnerability. The
  advertised 5+6+8+5+12 = 36 is really 5+8+12 = 25 against anything.

  Not obviously wrong — i-frames during hitstun are what stop infinite juggling
  — but **the damage table overstates the player by 30%**, which is the same
  shape as the enemy-string error above and was found the same way: by asking
  what actually connects instead of adding the column up. Either retime the
  chain so contacts clear `hurtMs`, or restate the table as 3 landing hits.
  Left alone for the balance pass.

- **The strings DO connect** — the claim that they never did was a measurement
  error and is corrected above. DIDI and DEDÉ miss only their third hit, by 1.7
  and 6.2px, because their own knockback shoves the player out of range; the
  user was told and likes it. **Left deliberately as is.**
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
- **THE CAST IS NAMED** (2026-08-21, by the user). LEBRON the coconut; DUDU,
  DIDI and DEDÉ the cigarettes; CLAUDINHO and ZIDANE the roaches; NARUTÃO the
  Mosca; HIPÓLITO the horse. No placeholders left.

  ⚠️ **THE ORDER OF THE THREE CIGARETTES AND THE TWO ROACHES IS AN ASSUMPTION.**
  They were given as bare lists — "Os cigarros DUDU, DIDI, DEDÉ", "As baratas
  CLAUDINHO e ZIDANE" — and mapped onto `cigarro`/`cigarro2`/`cigarro3` and
  `barata`/`barata2` in the order they were listed, which is the order those
  kinds were added. Nothing confirms DIDI is the stub rather than DEDÉ. Swapping
  any of them is one line each in `CONFIG.CHARACTERS`.

  NARUTÃO lives in `CONFIG.MOSCA_NAME` rather than in `CHARACTERS`, because the
  Mosca is a `FlyBoss` with two raw sheets and has no pack entry. ~~Nothing draws
  it~~ — **the boss nameplate does, since 2026-08-27.** It was recorded in
  advance for exactly that, and it is now its only reader; the CLEAR board's
  roll-call went in the same pass. See *Boss nameplates* below.
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
