# AGENTS.md — Sugar Shock Re-implementation

## Project Overview

2D side-scrolling platformer built with **Phaser 3** (bundled locally at `lib/phaser.js`). A single-level game where the player navigates left-to-right, collects food items, avoids enemies and spike hazards, and reaches a cake checkpoint to win.

**Current state**: Assets and design doc are in place. Source files referenced by `index.html` do **not yet exist** and need to be created:
- `src/Scenes/Load.js` — Phaser Scene for preloading assets
- `src/Scenes/Platformer.js` — Main gameplay scene
- `src/main.js` — Phaser game config and scene registration

Scripts are loaded via `<script>` tags in `index.html` (no bundler, no module system, no `package.json`).

## Running the Game

Serve the project root with any static HTTP server (required for asset loading). No build step.

```bash
# Python
python -m http.server 8000

# Node (npx)
npx http-server -p 8000
```

Open `http://localhost:8000` in a browser. No test suite, linter, or CI exists.

## Architecture

Single-page app with no module bundler. All code is plain JS loaded globally via `<script>` tags in `index.html`:

1. `lib/phaser.js` — Phaser 3 runtime (bundled, don't modify)
2. `src/Scenes/Load.js` — `LoadScene` class (extends `Phaser.Scene`): preloads all assets
3. `src/Scenes/Platformer.js` — `PlatformerScene` class (extends `Phaser.Scene`): all gameplay logic
4. `src/main.js` — Creates `Phaser.Game` with config, registers scenes

### Phaser Config (from DESIGN.md)

- **Renderer**: Canvas (not WebGL)
- **Canvas size**: 1440 × 600
- **Pixel art mode**: Enabled (nearest-neighbor, `roundPixels: true`)
- **Zoom**: 2.0× (effective viewport: 720 × 300 world pixels)
- **Physics**: Arcade physics, gravity 1500 px/s²
- **Background color**: `#87CEEB`

## Asset Loading Reference

All assets are in the `assets/` directory. Load them in `LoadScene`:

| Phaser load method | Key | Path | Notes |
|---|---|---|---|
| `load.tilemapTiledJSON()` | `"sugarShock-level-1"` | `"assets/sugarShock-level-1.tmj"` | Tiled JSON format |
| `load.image()` | `"kenny_tilemap_packed"` | `"assets/tilemap_packed.png"` | Tileset image (also used as spritesheet for food/checkpoint objects) |
| `load.atlas()` | `"platformer_characters"` | `"assets/tilemap-characters-packed.png"` | Atlas with JSON `"assets/tilemap-characters-packed.json"` |
| `load.multiatlas()` | `"kenny-particles"` | `"assets/kenny-particles.json"` | Multi-atlas; Phaser infers image paths from JSON (5 sheets: `kenny-particles-0.png` through `kenny-particles-4.png`) |
| `load.audio()` | `"jump_sound"` | `"assets/phaseJump2.ogg"` | |
| `load.audio()` | `"collect_sound"` | `"assets/powerUp2.ogg"` | |
| `load.audio()` | `"hurt_sound"` | `"assets/pepSound2.ogg"` | |
| `load.audio()` | `"win_sound"` | `"assets/threeTone2.ogg"` | |

## Key Design Decisions & Gotchas

### Collision is property-based, not index-based
Tiles with a custom boolean property `collides: true` are solid. Do NOT use tile index ranges to determine collision. Read the `collides` property from tileset data when creating collision bodies.

### Object gids are 1-based
In the Tiled `.tmj` file, objects store `gid` (global ID) which is **1-based**. When spawning food/checkpoint sprites from the tilemap image as a spritesheet, convert: `frameIndex = gid - 1`.

### Same image, two purposes
`tilemap_packed.png` serves as both the tileset image (for `addTilesetImage`) and the spritesheet frame source for food items and the checkpoint. When creating object sprites, use the same image key with `{frame: frameIndex}` syntax on a spritesheet, not the tileset.

### Enemy movement is tween-based, not physics-based
Enemies patrol via `this.tweens.add()` with yoyo repeat — they do NOT use Arcade physics velocity. They collide with `Ground-n-Platforms` (so they don't fall) but their horizontal movement is entirely tween-driven.

### Player-enemy interaction is overlap, not collision
Enemies and the player do NOT physically push each other. Use `this.physics.add.overlap()` (not `collide()`) for the damage trigger. The knockback is applied manually via velocity in the callback.

### Spikes use collide, not overlap
Unlike enemies, spike tiles use `this.physics.add.collider()` — they physically stop the player AND trigger death in the same callback.

### Double jump resets on ground contact
`jumpsLeft` resets to `maxJumps` (2) only when `body.blocked.down` is true. Check this in `update()` before processing jump input.

### Player faces left by default
The sprite's natural orientation is left-facing. Right-facing is achieved by `setFlip(true, false)`, left by `resetFlip()`. Do not use negative `scaleX`.

### World bounds must be set explicitly
Set physics world bounds to match the tilemap dimensions (2160 × 360). The player must not leave the map.

### Scene restart for game reset
Pressing R calls `this.scene.restart()`, which re-runs `init()` and `create()`. All state (score, health, jumpsLeft, gameOver) should be initialized in `init()`, not at class level.

## Level Data Summary

- **Tile size**: 18 × 18 px
- **Map**: 120 × 20 tiles (2160 × 360 px world space)
- **Tileset**: `kenny_tilemap_packed`, 16 columns, 112 tiles, no margin/spacing
- **Layers**:
  - `Ground-n-Platforms` — solid terrain, `collides: true` property
  - `Hazards` — spike tiles, `collides: true`, instant-kill on contact
  - `Objects` — point objects: `donut` (100pts), `burger` (200pts), `sushi` (500pts), `checkpoint` (win trigger)

## Game State Variables

Initialized in `init()`:

| Variable | Default | Purpose |
|---|---|---|
| `score` | 0 | Points from collected food |
| `health` | 2 | Current health |
| `maxJumps` | 2 | Max jumps before landing |
| `jumpsLeft` | 2 | Remaining jumps |
| `gameOver` | false | True on win or death |

## DESIGN.md is the authoritative spec

`DESIGN.md` contains exhaustive implementation details — physics values, animation frames, particle emitter configs, camera settings, enemy patrol coordinates, knockback vectors, HUD formatting, and more. **Consult it before implementing any game feature.** This AGENTS.md only summarizes the non-obvious pitfalls; DESIGN.md has the full parameter tables.
