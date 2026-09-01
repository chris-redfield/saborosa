/**
 * assetManifest() — THE one list of everything this game loads.
 *
 * THIS EXISTS TO KILL A WHOLE CLASS OF SHIPPING BUG. The flying dungeon's
 * package.sh carries a hand-written `cp` line per asset folder, and its own
 * STATE.md records the consequence: a folder was added, the copy line was not,
 * dev kept working because it read the repo, and EVERY PACKAGED BUILD WENT OUT
 * WITHOUT FLY SPRITES. Nothing catches that, because the only difference between
 * a working dev run and a broken build is a path that resolves in one and 404s
 * in the other.
 *
 * So the list is not written twice. `src/game.js` loads from this function, and
 * `tools/build-manifest.js` reads the SAME function to decide what package.sh
 * copies. Adding an asset means adding it here, once, and the build follows.
 *
 * IT MUST STAY DEPENDENCY-FREE AND SIDE-EFFECT-FREE. The build tool evaluates
 * this file in Node with nothing but CONFIG in scope — no DOM, no Image, no
 * fetch. Reaching for a browser global here breaks packaging, not rendering, so
 * it fails at the worst possible moment.
 *
 * Each entry is { key, src, how }:
 *   key  the name the game stores it under (Assets.getDrawable / getJSON)
 *   src  a config-style path: 'v2:...' resolves under ASSET_V2_BASE, anything
 *        else under ASSET_BASE. See Assets.resolve().
 *   how  'image' | 'json' | 'big'   — 'big' decodes and downscales off-thread
 */
function assetManifest() {
  const out = [];

  /* The four character packs. Each is a cropped game PNG plus its frame defs,
     stored under ONE key — Assets keeps images and JSON in separate maps, so the
     shared key is deliberate and not a collision. These are the MAIN GAME's
     files, read rather than copied in dev so a re-run of its
     tools/build-character-defs.py updates both games at once. */
  for (const kind of Object.keys(CONFIG.CHARACTERS)) {
    const base = CONFIG.CHARACTERS[kind].sheet;
    out.push({ key: kind, src: base + '-game.png', how: 'image' });
    out.push({ key: kind, src: base + '-sprites.json', how: 'json' });
  }

  /* The title screen: one photograph, and the name is drawn as type rather than
     loaded. `big` rather than `image` -- it is 2400px wide and drawn at 1280,
     and handing the GPU the full-size texture for that is the VRAM thrash that
     cost the main game its frame rate once already (see PERFORMANCE.md). `big`
     also caps it at `bigTextureCap`, which is the number the file on disk was
     reduced to in the first place; see tools/shrink-master.py. */
  if (CONFIG.title) {
    out.push({ key: 'titleBg', src: CONFIG.TITLE_BG, how: 'big' });
  }

  /* THE FRUIT SELECT'S THREE PICTURES: nobody highlighted, and one per hero.
     ⚠️ KEYED BY PACK (`select:<kind>`) RATHER THAN BY SLOT, exactly as
     CONFIG.SELECT.PICKED is written -- the screen asks for the picture belonging
     to the character it is showing, never for "the second image".

     ⚠️ GATED ON BOTH FLAGS. It is part of the title screen, so `title: false`
     takes it as well; and `SELECT.on: false` restores the old screen without
     paying for three pictures nothing draws. */
  if (CONFIG.title && CONFIG.SELECT && CONFIG.SELECT.on) {
    const S = CONFIG.SELECT;
    if (S.NONE) out.push({ key: 'select:none', src: S.NONE, how: 'big' });
    for (const kind of Object.keys(S.PICKED || {})) {
      out.push({ key: 'select:' + kind, src: S.PICKED[kind], how: 'big' });
    }
    /* ONE LAYER PER COCONUT, two states each -- what lets the punch pop only the
       figure that was chosen. ⚠️ LOADED ALONGSIDE THE OLD THREE RATHER THAN
       INSTEAD OF THEM, because the old pack is still the fallback for a build
       where one of these four fails: a missing layer must cost the per-figure
       pop, not the ability to see who you are choosing between. */
    for (const kind of Object.keys(S.LAYERS || {})) {
      const L = S.LAYERS[kind];
      out.push({ key: 'sel:' + kind + ':off', src: L.off, how: 'big' });
      out.push({ key: 'sel:' + kind + ':on',  src: L.on,  how: 'big' });
    }
  }

  /* THE CONTINUE PANEL: two figure drawings, ten digits and the grey dead frame.
     ⚠️ THE DIGITS ARE GENERATED FROM `seconds`, not listed. Ten paths written out
     by hand is ten chances to typo one that only shows up when the count reaches
     it -- nine seconds into a screen you have to lose a run to see. Keyed
     `continue:n<d>` so continue.js can ask for the number it is showing.

     ⚠️ AND `blank-02`, THE DARK BOARD, WHICH USED TO BE DELIBERATELY ABSENT. It
     is the beat between digits -- the sign with its flap mid-turn -- and it is
     loaded like any other frame of the number layer. See CONTINUE.flapMs.

     ⚠️ `blank-01`, THE LIT BOARD, IS STILL ABSENT AND NOW ON PURPOSE TWICE. The
     first cut of the flip alternated the two blanks; the user asked for the dark
     one alone, so nothing draws the lit one and nothing downloads it. */
  if (CONFIG.CONTINUE && CONFIG.CONTINUE.on && CONFIG.CONTINUE.DIR) {
    const D = CONFIG.CONTINUE.DIR;
    out.push({ key: 'continue:fig0', src: D + 'figura-01-game.png', how: 'big' });
    out.push({ key: 'continue:fig1', src: D + 'figura-02-game.png', how: 'big' });
    out.push({ key: 'continue:dead', src: D + 'contagem-dead-game.png', how: 'big' });
    /* THE BOARD BETWEEN DIGITS. Keyed by what it LOOKS like rather than by its
       file number: `blank-02` says nothing, `flapDark` says why it is here and
       why the lit one is not. */
    out.push({ key: 'continue:flapDark', src: D + 'blank-02-game.png', how: 'big' });
    const n = Math.max(0, Math.min(9, CONFIG.CONTINUE.seconds != null
                                        ? CONFIG.CONTINUE.seconds : 9));
    for (let d = 0; d <= n; d++) {
      out.push({ key: 'continue:n' + d, src: D + 'contagem-0' + d + '-game.png',
                 how: 'big' });
    }
  }

  /* THE CRAWLING VERMIN: three frames read IN PLACE out of the flying dungeon's
     folder, and loaded ONCE for the TWO screens that use them -- the logo screen
     at the front and the game over panel at the end. `big` because they are
     3002px wide and drawn at 1280 -- the same VRAM reasoning as every other
     oversized plate here.

     ⚠️ GATED ON EITHER CONSUMER. Turning the game over panel off must not take
     the front door's backdrop with it. */
  const wantsVermin = (CONFIG.GAME_OVER && CONFIG.GAME_OVER.on !== false)
                   || (CONFIG.LOGO && CONFIG.LOGO.on);
  if (wantsVermin) {
    (CONFIG.VERMIN_FRAMES || []).forEach((src, i) =>
      out.push({ key: 'vermin' + i, src: src, how: 'big' }));
  }

  /* THE HAND-LETTERED FRONT END: every word outside a fight, on one sheet.
     Same two-file pack shape as the scenery and the game over words. `image`
     rather than `big`: it is 1363x2381 and the title is drawn at 922, so a
     downscale would throw away pixels the front end still wants.

     ⚠️ NOT GATED ON ANYTHING. Four separate screens read it -- the title, the
     select, the HUD and the options/credits -- and a gate would be four
     conditions that have to agree. It is 909KB and the game cannot show its own
     name without it. */
  if (CONFIG.LETTERS && CONFIG.LETTERS.SHEET) {
    out.push({ key: 'letters', src: CONFIG.LETTERS.SHEET + '-game.png', how: 'image' });
    out.push({ key: 'letters', src: CONFIG.LETTERS.SHEET + '-sprites.json', how: 'json' });
  }

  /* THE SEVEN WAYS OF SAYING YOU LOST -- the game over panel's lettering, which
     is a drawing now rather than type. One sheet and its rects, in the same
     two-file shape the scenery pack uses.

     `image` rather than `big`: the atlas is 1396x2054 and the widest phrase is
     drawn at 1024, so a downscale would only throw away pixels the panel still
     wants. ⚠️ GATED ON THE PANEL ALONE, unlike the vermin above -- the logo
     screen shares the crawl but not the words. */
  if (CONFIG.GAME_OVER && CONFIG.GAME_OVER.on !== false
      && CONFIG.GAME_OVER.title && CONFIG.GAME_OVER.title.SHEET) {
    const S = CONFIG.GAME_OVER.title.SHEET;
    out.push({ key: 'goWords', src: S + '-game.png', how: 'image' });
    out.push({ key: 'goWords', src: S + '-sprites.json', how: 'json' });
  }

  /* The SABOROSA logo, for the front door. `image` rather than `big`: it is
     705x166 and drawn at 666 wide, so there is nothing to downscale. */
  if (CONFIG.LOGO && CONFIG.LOGO.on && CONFIG.LOGO.SHEET) {
    out.push({ key: 'logo', src: CONFIG.LOGO.SHEET, how: 'image' });
  }

  /* The ending plate. Same treatment as the title's for the same reasons, and
     NOT gated on `CONFIG.title` -- turning the title screen off must not take
     the ending with it. */
  if (CONFIG.ENDING && CONFIG.ENDING.BG) {
    out.push({ key: 'endingBg', src: CONFIG.ENDING.BG, how: 'big' });
  }

  // The GO prompt: the main game's pointing hand, and the hand-lettered word.
  out.push({ key: 'hand', src: 'intro-hand.png', how: 'image' });
  out.push({ key: 'go', src: CONFIG.GO_SHEET, how: 'image' });

  /* The impact burst. Sheet plus defs under ONE key, exactly like a character
     pack -- Assets keeps images and JSON in separate maps, so the shared key is
     deliberate and not a collision. */
  if (CONFIG.HIT_FX && CONFIG.HIT_FX.on !== false) {
    out.push({ key: 'hitfx', src: CONFIG.FX_SHEET + '-game.png', how: 'image' });
    out.push({ key: 'hitfx', src: CONFIG.FX_SHEET + '-sprites.json', how: 'json' });
  }

  /* STILL LIFE's explosion, for the horse boss's death. One small webp read in
     place out of that game's folder; `image` rather than `big` because it is
     1228x845 and every frame on it is drawn at a couple of hundred px, so
     there is nothing to downscale. */
  if (CONFIG.BOOM_SHEET) out.push({ key: 'boom', src: CONFIG.BOOM_SHEET, how: 'image' });

  /* THE BACKGROUND FLIES: STILL LIFE's small fly, one sheet, read in place out
     of that game's folder like the Mosca's. `image` rather than `big` -- it is
     1324x381 and every fly on screen is 30px tall, so there is nothing a
     downscale would save that the GPU is not already throwing away.

     ⚠️ GATED ON `FLIES.on`, so turning them off costs the download too. */
  if (CONFIG.FLIES && CONFIG.FLIES.on && CONFIG.FLIES.SHEET) {
    out.push({ key: 'fly', src: CONFIG.FLIES.SHEET, how: 'image' });
  }

  /* THE GROUND COVER: the desert's cigarette mounds. A pack in the same two-file
     shape a character uses (`-game.png` + `-sprites.json`), but NOT in
     CONFIG.CHARACTERS -- it is scenery, not a fighter, and putting it there
     would hand it to `sheets.build()` and to everything that walks the cast.
     So it is listed by hand, and the key `scenery` is spelled here twice and
     read in src/scenery.js.

     `image` rather than `big`: the atlas is 699x857 and every mound is drawn at
     its own size, so there is nothing a downscale would save. ⚠️ GATED ON
     `SCENERY.on`, so turning the floor off costs the download too. */
  if (CONFIG.SCENERY && CONFIG.SCENERY.on && CONFIG.SCENERY.sheet) {
    out.push({ key: 'scenery', src: CONFIG.SCENERY.sheet + '-game.png', how: 'image' });
    out.push({ key: 'scenery', src: CONFIG.SCENERY.sheet + '-sprites.json', how: 'json' });
  }

  /* THE BOOKCASE'S ELEVATOR: three hand-drawn frames of one platform. Same
     two-file pack shape as the ground cover and listed by hand for the same
     reason -- it is scenery, not a fighter, so it has no business in
     CONFIG.CHARACTERS where `sheets.build()` and everything that walks the cast
     would find it.

     `image` rather than `big`: the atlas is 1146x891 and the widest the lift is
     ever drawn is about 1010, so a downscale would be throwing away pixels the
     screen is about to use.

     ⚠️ GATED ON `LEVEL3.on`, which is the switch that takes the whole room --
     so a build without the bookcase does not pay 729KB for its furniture. */
  if (CONFIG.LEVEL3 && CONFIG.LEVEL3.on !== false && CONFIG.LEVEL3.platform
      && CONFIG.LEVEL3.platform.sheet) {
    const s = CONFIG.LEVEL3.platform.sheet;
    out.push({ key: 'elevador', src: s + '-game.png', how: 'image' });
    out.push({ key: 'elevador', src: s + '-sprites.json', how: 'json' });
  }

  // STILL LIFE's hand-drawn health bar, and the Mosca Boss's two flap sheets.
  out.push({ key: 'lifeBar', src: CONFIG.BAR_SHEET, how: 'image' });
  CONFIG.MOSCA_SHEETS.forEach((src, i) =>
    out.push({ key: 'mosca' + i, src: src, how: 'image' }));

  /* Backdrop sources, whatever kind they are. A `film` source contributes one
     entry per FRAME, which is the case this loop exists for: when the footage
     lands it will be hundreds of files, and nobody is going to maintain that by
     hand in a shell script. */
  for (const [name, cfg] of Object.entries(CONFIG.SOURCES || {})) {
    if (!cfg) continue;
    if (cfg.kind === 'film') {
      (cfg.frames || []).forEach((src, i) =>
        out.push({ key: `${name}#${i}`, src: src, how: 'big' }));
    } else if (cfg.kind === 'video') {
      out.push({ key: name, src: cfg.src, how: 'video' });
    } else if (cfg.src) {
      out.push({ key: name, src: cfg.src, how: 'big' });
    }
  }

  /* The music. It is in the manifest so the BUILD copies it -- that is what
     this list is for -- but it is loaded as raw BYTES and decoded later by
     sound.js, because decoding needs an AudioContext and a browser keeps one
     suspended until the player has interacted with the page. Fetching is not
     gated on that; decoding is. */
  out.push({ key: 'music', src: CONFIG.MUSIC_TRACK, how: 'audio' });
  /* The horse's theme, under its own key. Loaded exactly like the bed -- raw
     bytes now, decoded by sound.js when there is a context to decode into. */
  if (CONFIG.BOSS_TRACK) out.push({ key: 'musicBoss', src: CONFIG.BOSS_TRACK, how: 'audio' });
  /* The title screen's theme, same again. ⚠️ ITS ASSET KEY IS `musicTitle` AND
     TWO OTHER PLACES SPELL IT: CONFIG.MUSIC_LOOP (where it wraps) and
     CONFIG.MUSIC_GAIN (how loud). Both are keyed by asset key, so renaming this
     silently unpins the loop and drops it back to `musicVolume` flat -- neither
     of which errors, and both of which are audible. */
  if (CONFIG.TITLE_TRACK) out.push({ key: 'musicTitle', src: CONFIG.TITLE_TRACK, how: 'audio' });
  /* The Mosca's theme -- Still Life's soundtrack, read in place out of that
     game's folder the way her sprite sheets are. ⚠️ ASSET KEY `musicMosca`,
     spelled again in CONFIG.MUSIC_LOOP and in FlyBoss's `musicKey`. */
  if (CONFIG.MOSCA_TRACK) out.push({ key: 'musicMosca', src: CONFIG.MOSCA_TRACK, how: 'audio' });
  /* EXTRA VOICES that play WITH a track -- the whistle over the street bed.
     Walked out of CONFIG.MUSIC_LAYERS so declaring a layer is one entry there
     and nothing here, the same bargain CONFIG.SFX already has. */
  for (const list of Object.values(CONFIG.MUSIC_LAYERS || {}))
    for (const L of list) out.push({ key: L.key, src: L.src, how: 'audio' });
  for (const [name, src] of Object.entries(CONFIG.SFX || {}))
    out.push({ key: 'sfx:' + name, src: src, how: 'audio' });

  /* The controller mapping. OPTIONAL — the game must never sit on a loading bar
     waiting for a pad profile, so game.js does not await it and it is not part
     of the progress total. It is in the manifest anyway because the BUILD still
     has to carry it; `optional` tells the packager not to fail without it. */
  out.push({ key: 'gamepad', src: CONFIG.GAMEPAD_MAPPING, how: 'json', optional: true });

  return out;
}

// Node (the build tool) picks it up here; the browser gets it as a global.
if (typeof module !== 'undefined' && module.exports) module.exports = { assetManifest };
