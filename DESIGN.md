# DESIGN.md — Sugar Shock Game Design Document

## Game Summary

**Genre**: 2D side-scrolling platformer
**Perspective**: Side view, horizontally scrolling camera
**Objective**: Navigate from left to right across a single level, collecting food items for score, avoiding enemies and hazards, and reaching the pink cake at the end of the level to win.
**Art style**: Pixel art, rendered with nearest-neighbor scaling at 2× zoom
**Control scheme**: Keyboard only — arrow keys for movement, Up arrow for jump, R key to restart

---

## World & Level Structure

### Level format

The level is defined in a Tiled map editor file (`sugarShock-level-1.tmj`, JSON format, Tiled version 1.12.1).

- **Tile size**: 18 × 18 pixels
- **Map dimensions**: 120 tiles wide × 20 tiles tall (2160 × 360 pixels in world space)
- **Orientation**: Orthogonal
- **Render order**: Right-down
- **Tileset**: A single tileset named `kenny_tilemap_packed` referencing the image `tilemap_packed.png` (288 × 126 pixels, 16 columns, 112 total tiles, no margin, no spacing)

### Tileset collision property

Tiles that should be solid have a custom boolean property named `collides` set to `true`. Collision is determined by reading this property — not by tile index or layer. The tiles with `collides: true` span the following tile IDs (0-based): 0–7, 10–12, 16–23, 26–39, 44–55, 59–79, 93–95, 106, 109–111. Any tile not in this list does not collide.

### Map layers

| Layer name | Type | Purpose |
|---|---|---|
| `Ground-n-Platforms` | Tile layer | Solid terrain — platforms, ground, walls. Uses collision-by-property. |
| `Hazards` | Tile layer | Spike tiles that kill the player instantly on contact. Also uses `collides: true` property — these physically block the player in addition to triggering death. |
| `Objects` | Object layer | Point objects representing collectible food items and the level-end checkpoint. |

### Object layer definitions

Objects in the `Objects` layer are placed as rectangle objects (18 × 18) with a `name` property identifying their type:

| Object name | Purpose | Spritesheet frame index (0-based) |
|---|---|---|
| `donut` | Common collectible (100 pts) | 14 |
| `burger` | Uncommon collectible (200 pts) | 92 |
| `sushi` | Rare collectible (500 pts) | 87 |
| `checkpoint` | Level-end goal — touching it triggers win | 4 |

Object sprites use the same `tilemap_packed.png` image as a **spritesheet** (18 × 18 frame size), not as the tileset image. The frame indices above are 0-based spritesheet frame numbers. Note: in the Tiled `.tmj` file, objects store a `gid` (global ID) which is 1-based (frame index + 1). When spawning objects, convert gid → frame index by subtracting 1.

### Level layout (conceptual)

The level is a left-to-right traversal with:
- A starting ground platform on the far left where the player spawns
- Several floating platform sections with gaps between them (requiring jumping)
- A pit of spike hazards on the ground in a gap between platforms
- Collectible items placed above platforms and in arcs along jump paths
- Two patrolling enemies on mid-level platforms
- A pink cake checkpoint at the far right end of the level on the ground

---

## Player Character

### Spawn position
World coordinates: (50, 200)

### Sprite
Atlas `platformer_characters`, frame `tile_0000.png` (idle), `tile_0001.png` (walk/jump variant).

### Animations

| Animation key | Frames | Frame rate | Loop |
|---|---|---|---|
| `walk` | `tile_0000.png` → `tile_0001.png` | 15 fps | Yes |
| `idle` | `tile_0000.png` (single frame) | — | Yes |
| `jump` | `tile_0001.png` (single frame) | — | No |

Animation selection:
- **Walking left or right** → play `walk` (looping)
- **Standing still** → play `idle` (looping)
- **Airborne (not touching ground)** → play `jump` (overrides walk/idle when not grounded)

### Movement physics

| Parameter | Value | Notes |
|---|---|---|
| Horizontal acceleration | 800 px/s² | Applied each frame while left/right is held |
| Maximum horizontal speed | 300 px/s | Hard cap on X velocity |
| Maximum vertical speed | 1000 px/s (downward) | Hard cap on Y velocity |
| Horizontal drag | 2000 px/s² | Applied each frame when no directional input, decelerates to stop |
| Gravity | 1500 px/s² | Downward, applied continuously |
| World bounds collision | Enabled | Player cannot leave the physics world bounds |

**Movement model**: Acceleration-based, not velocity-based. Holding a direction applies constant acceleration. Releasing applies drag to decelerate. This produces a "snappy" feel with quick starts and stops.

### Jumping

| Parameter | Value |
|---|---|
| Jump velocity | −400 px/s (upward) |
| Maximum jumps | 2 (double jump) |
| Jump input | Arrow Up key, on-press only (not held) |

**Double jump rules**:
- When the player is on the ground (`body.blocked.down`), `jumpsLeft` resets to `maxJumps` (2).
- Each press of the jump key consumes one jump from `jumpsLeft`.
- The player may jump once from the ground and once more in mid-air.
- The second (mid-air) jump uses the same velocity as the first — there is no reduced air-jump force.

### Facing direction

- **Facing left** (default): sprite is not flipped (`resetFlip()`)
- **Facing right**: sprite is horizontally flipped (`setFlip(true, false)`)
- The sprite's natural orientation faces left; right-facing is achieved by mirroring.

### Health

| Parameter | Value |
|---|---|
| Starting health | 2 |
| Maximum health | 2 (implicit, not enforced separately) |

When health reaches 0, the player dies (see Win/Lose Conditions).

---

## Enemies

### Sprite
Atlas `platformer_characters`, frame `tile_0012.png`.

### Enemy placement (per level)

| Enemy | Spawn X | Spawn Y | Patrol distance | Patrol direction (initial) |
|---|---|---|---|---|
| Enemy 1 | 575 | 200 | +275 px (right) | Right first |
| Enemy 2 | 1425 | 200 | −150 px (left) | Left first |

### Patrol behavior

Enemies move back and forth along the X axis using a linear tween (not physics-based velocity):

- **Duration**: 2500 ms per half-trip (one-way)
- **Easing**: Linear (constant speed)
- **Pattern**: Yoyo — moves to target X, then reverses back to start X, forever
- **Sprite flipping**: The sprite flips to face the direction of travel. The flip direction depends on which half of the yoyo cycle the enemy is in, and which direction the enemy initially moves. Specifically:
  - Enemy 1 (moves right first): `onYoyo` (returning left) → flipX = true; `onRepeat` (going right) → flipX = false
  - Enemy 2 (moves left first): `onYoyo` (returning right) → flipX = false; `onRepeat` (going left) → flipX = true

### Collision with world

Enemies collide with the `Ground-n-Platforms` layer so they don't fall through the floor. They do **not** collide with the `Hazards` layer.

### Interaction with player

Enemy-player contact is an **overlap** (not a physical collision) — the player and enemy do not physically push each other apart. Instead, the overlap triggers damage (see Damage & Knockback).

---

## Collectibles (Food Items)

### Types and scoring

| Item | Object name | Points | Rarity | Spritesheet frame |
|---|---|---|---|---|
| Donut | `donut` | 100 | Common | 14 |
| Burger | `burger` | 200 | Uncommon | 92 |
| Sushi | `sushi` | 500 | Rare | 87 |

### Behavior

- Food items are **static bodies** (they do not move).
- They use **overlap** collision with the player — no physical blocking.
- On collection: the food object is destroyed, score is increased, a particle burst and sound play.
- Each food item can only be collected once.

---

## Hazards (Spikes)

### Layer
`Hazards` tile layer.

### Behavior

Spike tiles use **physical collision** (not overlap) with the player. This means:
1. The player is physically stopped by the spike tile (normal collision response).
2. The collision callback fires, which immediately sets health to 0 and triggers death.

Result: touching any spike tile is an **instant kill** regardless of current health.

---

## Damage & Knockback

### Enemy contact damage

When the player overlaps an enemy:

1. Player loses 1 health point.
2. A hurt sound plays.
3. Camera shakes (200 ms duration, intensity 0.001).
4. If health reaches 0 → death.
5. If health > 0 → the player enters a brief invulnerability state:
   - **Invulnerability duration**: 1000 ms (1 second)
   - **Visual indicator**: Player sprite is tinted red (`0xff0000`)
   - **Knockback**: Player is launched upward (velocity Y = −300 px/s) and horizontally away from the enemy (velocity X = ±300 px/s, direction based on relative position: if player is left of enemy, knockback goes left; if right, goes right)
   - **After 1 second**: Red tint clears, invulnerability ends

### Spike damage

1. Health is set to 0 (instant kill, bypassing invulnerability).
2. A hurt sound plays.
3. Camera shakes (200 ms duration, intensity 0.002 — stronger than enemy hit).
4. Player is launched upward (velocity Y = −400 px/s).
5. Death is triggered.

---

## Win/Lose Conditions

### Win

The player overlaps the `checkpoint` object (pink cake). On win:
- `gameOver` flag is set to `true`.
- A win sound plays.
- The player's horizontal velocity and acceleration are zeroed.
- Walking particle VFX stops.
- Physics is paused (all bodies freeze).
- Text "SUGAR SHOCK COMPLETE!" is displayed in green (#00ff00) with the subtitle "Press R to Restart".
- The `update()` loop short-circuits — no further game logic runs.

### Lose (death)

Triggered when health reaches 0 (from either spikes or enemy damage). On lose:
- `gameOver` flag is set to `true`.
- Player sprite is tinted red (`0xff0000`).
- Player's velocity and acceleration are zeroed.
- Physics is paused.
- Text "SUGAR CRASH" is displayed in red (#ff0000) with the subtitle "Press R to Restart".

### Restart

At any time (including during game-over), pressing the **R** key restarts the current scene, which re-runs `init()` and `create()` from scratch, resetting all state.

---

## Camera

| Property | Value |
|---|---|
| Background color | `#87CEEB` (sky blue) |
| Bounds | (0, 0) to (mapWidth, mapHeight) in pixels |
| Follow target | Player sprite |
| Follow lerp | 0.25 X, 0.25 Y (smooth follow, not instant) |
| Deadzone | 50 × 50 pixels (player can move within this rectangle without camera movement) |
| Zoom | 2.0× |
| Follow offset | −100 X, 0 Y (camera center is offset 100 px left of player, showing more of the level ahead) |
| Physics world bounds | Same as camera bounds — player cannot leave the map |

---

## Heads-Up Display (HUD)

A single text line displayed at the top of the screen:

- **Content**: `Health: {n} | Score: {n}`
- **Position**: (370, 160) in screen coordinates
- **Scroll factor**: 0 (fixed on screen, does not move with camera)
- **Render depth**: 100 (above all other game objects)
- **Style**: 16px font, white fill (#ffffff), black stroke (#000000), stroke thickness 3

---

## Visual Effects (Particles)

All particle effects use the `kenny-particles` multi-atlas (5 texture sheets: `kenny-particles-0.png` through `kenny-particles-4.png`, each 2048 × 2048 px, with frame definition file `kenny-particles.json`).

### 1. Walking dust

Emitted behind the player's feet while walking on the ground.

| Property | Value |
|---|---|
| Texture | `smoke_03.png` |
| Scale | Start 0.02, end 0.05 |
| Max alive particles | 5 |
| Lifespan | 200 ms |
| Alpha | Start 1, end 0 (fade out) |
| Speed | 50 px/s horizontal (direction matches walking direction) |
| Emission mode | Continuous while walking on ground; stops when idle, airborne, or game over |
| Position offset | At player's trailing foot: X = ±(displayWidth/2 − 10) in walking direction, Y = displayHeight/2 − 5 |

### 2. Jump burst

Emitted as a one-shot burst at the player's feet when jumping.

| Property | Value |
|---|---|
| Texture | `star_07.png` |
| Scale | Start 0.05, end 0 (shrink to nothing) |
| Max alive particles | 10 |
| Lifespan | 300 ms |
| Speed | Random between −50 and 50 px/s (both axes) |
| Gravity Y | 100 px/s² (particles arc downward slightly) |
| Emission mode | One-shot burst (`emitParticleAt`) at player's foot position (player.x, player.y + displayHeight/2), 1 particle count per jump |

### 3. Collectible burst

Emitted as a one-shot burst at the food item's position when collected.

| Property | Value |
|---|---|
| Texture | `star_04.png` and `circle_05.png` (randomly mixed) |
| Scale | Start 0.05, end 0 (shrink to nothing) |
| Speed | Random between 50 and 200 px/s (outward explosion) |
| Lifespan | 400 ms |
| Gravity Y | 300 px/s² (particles arc downward) |
| Emission mode | One-shot burst (`emitParticleAt`), 15 particles per collection |

---

## Audio

| Sound key | File | Trigger | Volume |
|---|---|---|---|
| `jump_sound` | `phaseJump2.ogg` | Each time the player jumps (including double jump) | 0.5 |
| `collect_sound` | `powerUp2.ogg` | Each time a food item is collected | 0.5 |
| `hurt_sound` | `pepSound2.ogg` | Taking damage from enemy or spike | 0.5 |
| `win_sound` | `threeTone2.ogg` | Reaching the checkpoint (win condition) | 0.5 |

---

## Input Mapping

| Input | Action |
|---|---|
| Left arrow (held) | Move left |
| Right arrow (held) | Move right |
| Up arrow (press) | Jump / double jump |
| R key (press) | Restart the level |

**Jump is press-only** (checked via `JustDown`), not held — holding the key does not continuously jump. Movement left/right is checked via `isDown` (continuous while held).

---

## Game State Summary

| Variable | Starting value | Purpose |
|---|---|---|
| `score` | 0 | Total points from collected food |
| `health` | 2 | Current player health |
| `maxJumps` | 2 | Maximum jumps before needing to land |
| `jumpsLeft` | 2 | Remaining jumps (resets on landing) |
| `gameOver` | false | Whether the game has ended (win or lose) |

---

## Asset Inventory

### Images

| File | Format | Dimensions | Usage |
|---|---|---|---|
| `tilemap_packed.png` | PNG | 288 × 126 | Tileset image for both tilemap rendering and object spritesheets (18×18 frame size, 16 columns, 112 tiles) |
| `tilemap-characters-packed.png` | PNG | 122 × 119 | Sprite atlas for player and enemy characters |

### Atlas definitions

| File | Associated image | Usage |
|---|---|---|
| `tilemap-characters-packed.json` | `tilemap-characters-packed.png` | TexturePacker atlas defining character sprite frames (trimmed, variable-size frames) |
| `kenny-particles.json` | `kenny-particles-0.png` through `kenny-particles-4.png` | Multi-atlas defining particle texture frames (512×512 each, untrimmed) |

### Level data

| File | Format | Source |
|---|---|---|
| `sugarShock-level-1.tmj` | Tiled JSON (v1.10 map format) | Level layout with tile layers and object layer |
| `sugarShock-level-1.tmx` | Tiled XML | Same level in XML format (alternate export, not used by the game at runtime) |

### Audio

| File | Format | Duration (approx.) |
|---|---|---|
| `phaseJump2.ogg` | OGG Vorbis | Short blip |
| `powerUp2.ogg` | OGG Vorbis | Short ascending tone |
| `pepSound2.ogg` | OGG Vorbis | Short hit/blip |
| `threeTone2.ogg` | OGG Vorbis | Short three-note melody |

### Project files (Tiled editor)

| File | Purpose |
|---|---|
| `Sugar Shock.tiled-project` | Tiled project file |
| `Sugar Shock.tiled-session` | Tiled editor session state |

---

## Screen & Rendering

| Property | Value |
|---|---|
| Game canvas size | 1440 × 600 pixels |
| Effective viewport | 720 × 300 world pixels (at 2× zoom) |
| Pixel art mode | Enabled (nearest-neighbor scaling, no anti-aliasing) |
| Renderer | Canvas (not WebGL) |
