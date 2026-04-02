# Saborosa

A 2D top-down game with isometric-style visuals, featuring a push/mass physics system and terrain depth rendering.

## Controls

- **WASD / Arrow Keys** — Move
- **Shift** — Dash (5x speed, 150ms duration, 1s cooldown)
- **E** — Interact (portals)
- **C** (hold) — Debug overlay (shows collision boxes, block coords)

## Architecture

```
src/
  engine/
    input.js      — Keyboard, mouse, gamepad input handling
    game.js       — Core game loop, canvas scaling, asset loading
  entities/
    player.js     — Player movement, collision, push mechanics
    environment.js — Rock entities with mass and collision
    spritesheet.js — Sprite loading and animation frames
    sand.js       — Sand boundary entity (ground layer)
    lava.js       — Lava boundary entity (ground layer)
    portal.js     — Stage transition portals
  world/
    world.js      — Block-based world, terrain rendering, depth effect
    stages.js     — Stage definitions (Endless Desert, Sand Bank)
  main.js         — Entry point, game state, update/render loop
```

## Isometric Style

The game uses a **perspective diamond checkerboard** to simulate an isometric look on a 2D plane.

### Checkerboard Pattern

Configured per stage via the `checkerboard` property:

```js
checkerboard: { tileSize: 77, color: '#b8875f', style: 'perspective' }
```

- `tileSize` — Full diamond width in pixels
- `color` — Alternating diamond color (other diamonds use `groundColor`)
- `style: 'perspective'` — Squashes diamonds vertically by `yRatio` (default 0.5)

Key derived values:
- `hs = tileSize / 2` = 38.5px (half diamond width)
- `hsY = hs * yRatio` = 19.25px (half diamond height after perspective)

### Isometric Collision Footprints

Since the game is viewed from a top-down isometric angle, collision boxes use the **bottom portion** of each sprite — the "ground footprint" — rather than the full visual rect.

**Player:**
- Visual size: 48 x 56px
- Collision footprint: 48 x 28px (bottom half, offset 28px from top)
- Debug: green rect = visual, red rect = collision

**Rocks:**
- Visual size: `size x size`
- Collision footprint: `size x (size * 0.5)` (bottom half)
- Debug: yellow rect = visual, red rect = collision

This allows sprites to visually overlap when one entity is "behind" another, while collision only happens at ground level.

## Terrain Depth (3D Cube Faces)

The Sand Bank stage renders **3D cube faces** at the bottom edge of the walkable terrain, creating the illusion of a raised platform.

### How It Works

The depth effect reuses the diamond grid from the checkerboard pattern. Each diamond on the surface becomes the **top face** of an isometric cube. At the terrain edge, the front faces of these cubes are drawn below:

```
Surface:      ◇ ◇ ◇ ◇ ◇ ◇ ◇     ← checkerboard diamonds (top faces)
Shaded row:   ◇ ◇ ◇ ◇ ◇ ◇ ◇     ← last row darkened (ground color at 75%)
Transition:    △ △ △ △ △ △ △      ← surface-colored triangles (seamless edge)
Cube faces:   ◁▷◁▷◁▷◁▷◁▷◁▷      ← front-left (60%) + front-right (70%) faces
Zigzag bottom: \/\/\/\/\/\/\/     ← jagged edge (no flat bottom)
Sand:         ▒▒▒▒▒▒▒▒▒▒▒▒▒▒     ← unwalkable sand below
```

### Rendering Layers (bottom to top)

1. **Sand fill** — Full block filled with `sandColor` as base
2. **Ground + checkerboard** — Clipped to diamond-aligned boundary
3. **Shaded ground strip** — Last 8px darkened to 75%, CB diamonds redrawn on top
4. **Cube front faces** — Parallelogram shapes extending `hsY` below each diamond vertex
5. **Surface triangles** — Diamond bottom halves in surface colors at the zigzag edge

### Configuration

```js
terrainDepth: 30,  // enables depth rendering
sandColor: '#d4a55a',
```

### STACK_OFFSET

```js
const STACK_OFFSET = 19; // one cube layer height (≈ hsY)
```

Exported globally. Used as the base unit for vertical stacking/piling and for determining how deep the player sinks into sand.

## Sand Mechanics

When the player walks off the walkable terrain onto sand:

- **Sinking** — The bottom `STACK_OFFSET` (19px) of the player sprite is cropped, making them appear to sink into the sand
- **Speed reduction** — Movement is 30% slower (`sandSpeedFactor: 0.7`)
- **Collision box unchanged** — The full footprint is still used for collision

### Terrain Detection

`world.isOnWalkableTerrain(x, y)` determines if a position is on the walkable platform:

- Returns `false` if on a non-walkable block
- Returns `false` if within the diamond-aligned inset at the left edge of a walkable block
- Returns `false` if within `LAVA_W` (40px) of the top edge
- Returns `true` if within `STACK_OFFSET * 2 + 25` pixels below a walkable block (the depth face area)

## Push / Mass System

Objects can be pushed based on a mass comparison. Mass is calculated from the **collision footprint area** (`colW * colH`).

### Mass Values

| Entity | Visual Size | Footprint | Mass |
|--------|------------|-----------|------|
| Player | 48 x 56 | 48 x 28 | **1344** |
| Small rock (25px) | 25 x 25 | 25 x 13 | 325 |
| Medium rock (37px) | 37 x 37 | 37 x 19 | 703 |
| Large rock (52px) | 52 x 52 | 52 x 26 | 1352 |
| Big test rock (80px) | 80 x 80 | 80 x 40 | 3200 |

### Push Rules

- **Can't push**: `rock.mass >= player.mass` — Player is blocked (rocks ~52px+ are immovable)
- **Push with effort**: `rock.mass < player.mass` — Rock moves at **50%** of player speed
- **Push with ease**: `rock.mass < player.mass * 0.5` — Rock moves at **70%** of player speed

### Push Behavior

- Player and rock move together (player snaps against rock's collision edge)
- Push is per-axis (X and Y checked independently, allows sliding along rocks)
- Push is blocked if the rock would collide with another obstacle
- Pushed rocks collide with other rocks, lava, and obstacles

## Stages

### Stage 1 — Endless Desert
- **Type**: Infinite (blocks generated around player)
- **Ground**: Dark brown (`#5c3317`), no checkerboard
- **Rocks**: 5-12 per block
- **Portal**: To Sand Bank

### Stage 2 — Sand Bank (starting stage)
- **Type**: Finite (3x3 block grid, center walkable)
- **Ground**: Tan checkerboard (`#c9a070` / `#b8875f`)
- **Sand**: Golden (`#d4a55a`), walkable, player sinks
- **Depth**: 3D cube faces at bottom edge
- **Rocks**: 3-7 per block + 80px test rock
- **Portal**: To Endless Desert

## Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `BLOCK_W` | 1280 | Block width in pixels |
| `BLOCK_H` | 720 | Block height in pixels |
| `LAVA_W` | 40 | Barrier strip width |
| `STACK_OFFSET` | 19 | One cube depth layer height |
