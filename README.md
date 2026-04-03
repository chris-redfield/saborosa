# Saborosa

A 2D top-down game with isometric-style visuals, featuring push/mass physics, object lifting and stacking, and terrain depth rendering.

## Controls

- **WASD / Arrow Keys** — Move
- **R** (hold) — Run (100% speed boost while held)
- **Shift** — Dash (5x speed, 150ms duration, 1s cooldown)
- **Space** — Lift / Drop objects
- **E** — Explore / Interact (enter fruit basket to travel to next stage)
- **P** — Pause
- **C** (hold) — Debug overlay (collision boxes, block coords, mass values)

## Architecture

```
src/
  engine/
    input.js      — Keyboard, mouse, gamepad input handling
    game.js       — Core game loop, canvas scaling, asset loading
  entities/
    player.js     — Player movement, collision, push, lift mechanics
    environment.js — Rock entities with mass, collision, stacking
    spritesheet.js — Sprite loading and animation frames
    sand.js       — Sand boundary entity (ground layer)
    lava.js       — Lava boundary entity (ground layer)
    portal.js     — Fruit basket (stage transition)
  world/
    world.js      — Block-based world, terrain rendering, depth effect
    stages.js     — Stage definitions (Endless Desert, Sand Bank)
  main.js         — Entry point, game state, update/render loop, transitions
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
Sand:         ▒▒▒▒▒▒▒▒▒▒▒▒▒▒     ← walkable sand below
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
- **Sand is walkable** — No collision barriers on sand stages; the player can freely walk between the walkable platform and sand

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

### Stack Mass

When rocks are stacked, the **total stack mass** (base + child) is used for push calculations. Two medium rocks stacked together may become too heavy to push even though each one individually is pushable.

### Push Behavior

- Player and rock move together (player snaps against rock's collision edge)
- Push is per-axis (X and Y checked independently, allows sliding along rocks)
- Push is blocked if the rock would collide with another obstacle
- Pushing a stack moves all rocks in the stack together
- When colliding with a stacked rock, the push resolves to the base of the stack

## Object Lifting

The player can lift and carry objects, Zelda-style.

### How It Works

- **Space** near a liftable rock — picks it up (rock floats above player's head)
- **Space** while carrying — drops it in front of the player (based on facing direction)
- Only rocks **lighter than the player** can be lifted (same mass rule as pushing)

### Lift Behavior

- Lifted object follows the player, rendered above the sprite at `liftOffsetY = -20`
- Lifted rocks are removed from the obstacle list while carried
- The lift range check uses **visual bounds** for vertical overlap, allowing stacked rocks to be reached
- After dropping, the player is nudged out if the rock's collision overlaps with them

### Lift Restrictions

- Can't lift a rock that has something stacked on top of it (lift the top one first)
- Can't lift rocks heavier than the player (`rock.mass >= player.mass`)

## Object Stacking

Rocks can be stacked on top of each other by dropping a carried rock onto another.

### Stack Target Cursor

When carrying an object, a **white pulsing cursor** (corner brackets) appears around the rock the player is aiming at. The target is selected based on:

- **Facing direction** — Uses dot product alignment (>0.3 threshold) with the player's facing vector
- **Distance** — Must be within 96px
- **Score** — Closest + most aligned rock wins (`distance * (1.5 - dot)`)
- **Performance** — Target selection runs every 6 frames, not every frame

### How It Works

- Lift a rock with **Space**, walk toward another rock until the cursor appears, press **Space** to stack
- The carried rock **snaps on top** of the targeted rock, offset by `STACK_OFFSET` (19px)
- The stacked rock is centered horizontally on the base rock
- If no target is selected, the rock drops to the ground in front of the player

### Stack Properties

- **Parent/child references** — `rock.stackParent` and `rock.stackChild` track the relationship
- **Depth sorting** — Stacked rocks use their parent's bottom edge for sorting, so they always render **in front** of the base rock
- **Max stack depth** — Currently supports 2 rocks (base + one on top)
- **Unstacking** — Lift the top rock to detach it from the stack

### Stack Interactions

- **Pushing a stack** — The child moves with the base when pushed
- **Stack mass** — Combined mass determines if the stack can be pushed
- **Can't lift base** — A rock with a `stackChild` cannot be lifted; remove the top first

## Fruit Basket (Stage Transition)

The portal has been replaced with a **fruit basket** (`assets/empty-basket.png`) that triggers a ToeJam & Earl-style ascent transition.

### Transition Effect

1. Player presses **E** near the basket
2. Player stops moving and sits inside the basket
3. The basket ascends upward at 3px/frame
4. The camera follows the basket — the current stage scrolls away below
5. After ascending ~1.2x screen height, the new stage loads

### Configuration

The basket is defined in stage configs as a portal:

```js
portals: [
    { x: BLOCK_W / 2 + 80, y: BLOCK_H / 2 - 32, targetStage: 1, label: 'Desert' }
]
```

The basket renders at 101x101px using the `empty-basket.png` sprite, with a label above and `[E]` prompt below.

## Stages

### Stage 1 — Endless Desert
- **Type**: Infinite (blocks generated around player)
- **Ground**: Dark brown (`#5c3317`), no checkerboard
- **Rocks**: 5-12 per block
- **Basket**: To Sand Bank

### Stage 2 — Sand Bank (starting stage)
- **Type**: Finite (3x3 block grid, center walkable)
- **Ground**: Tan checkerboard (`#c9a070` / `#b8875f`)
- **Sand**: Golden (`#d4a55a`), walkable, player sinks
- **Depth**: 3D cube faces at bottom edge
- **Rocks**: 8-16 per block + 80px test rock
- **Basket**: To Endless Desert

## Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `BLOCK_W` | 1280 | Block width in pixels |
| `BLOCK_H` | 720 | Block height in pixels |
| `LAVA_W` | 40 | Barrier strip width |
| `STACK_OFFSET` | 19 | One cube depth layer height |
