# Flying Dungeon — Saborosa jam game

A standalone shoot-'em-up spun off from the main Saborosa game: pilot a fruit
plane over an orbiting fruit-tray dungeon that rotates as you fly. Built to ship
independently on itch.io, but written to fold back into the main game later.

## Run (dev)

Serve the **repo root** over http (the game reads shared assets at
`../assets-v2/flying-dungeon`), then open the game:

```
# from the repo root
python3 -m http.server 8199
# then visit:
http://localhost:8199/flying-dungeon/
```

Opening `index.html` from `file://` won't work — the frame decode uses `fetch`.

## Controls

- **Arrows / WASD** — fly. Up/down move; left/right turn the plane and spin the
  dungeon (right → reverse, left → regular).
- **Hold Space** — machine gun.
- **1** — switch pilot (lemon → tomato → eggplant).

## Publish to itch.io

```
cd flying-dungeon
./package.sh
```

This builds `dist/` (self-contained: code + a local copy of the assets, with
`ASSET_BASE` rewritten to `./assets/…`) and `flying-dungeon-itch.zip`. On itch,
create an HTML project, upload the zip, and set `index.html` as the launch file.

## Architecture (why it's split this way)

Two layers, matching the main game's plain-globals-via-`<script>` style:

- **Portable core** — `src/config.js`, `src/plane.js`, `src/tray-background.js`.
  Framework-agnostic: no DOM, no globals, dependencies injected (an assets store
  exposing `getDrawable`, a config, and an input snapshot). These are what you
  lift into the main game.
- **Disposable shell** — `src/game.js` (canvas + loop + wiring), `src/assets.js`
  (loader), `src/input.js` (keyboard), `index.html`. The main engine already
  provides all of this, so on integration you drop the shell.

### Integrating into the main game later

1. Copy `plane.js` + `tray-background.js` into `src/entities/` and add them to
   the main `index.html` script list.
2. They already call `getDrawable(key)` — the main game's accessor — so just
   register the frames there (paths in `assets-v2/flying-dungeon`).
3. Feed them the main game's input object (same `{left,right,up,down,firing,
   engaged}` shape) and call `update(dt, input)` / `render(ctx, W, H)` from its
   loop. Fold the constants from `config.js` into the game's config.
4. Delete `game.js`, `assets.js`, `input.js`.
