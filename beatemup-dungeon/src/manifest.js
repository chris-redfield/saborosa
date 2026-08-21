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

  /* The title screen. `big` rather than `image` for the crawl frames: they are
     3002px wide and drawn at 1280, and handing the GPU the full-size texture
     for that is the VRAM thrash that cost the main game its frame rate once
     already (see PERFORMANCE.md). The logo is small and goes through as-is. */
  if (CONFIG.title) {
    (CONFIG.TITLE_FRAMES || []).forEach((src, i) =>
      out.push({ key: 'title' + i, src: src, how: 'big' }));
    out.push({ key: 'logo', src: CONFIG.LOGO_SHEET, how: 'image' });
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
