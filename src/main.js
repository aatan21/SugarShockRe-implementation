/**
 * main.js — Phaser game configuration and scene registration.
 *
 * This file creates the Phaser.Game instance with all display,
 * physics, and scene settings described in DESIGN.md.
 */

// Game configuration object
const config = {
    // Use the Canvas renderer (not WebGL) per DESIGN.md
    type: Phaser.CANVAS,

    // Canvas dimensions — at 2× zoom the effective viewport
    // shows 720 × 300 world pixels
    width: 1440,
    height: 600,

    // Sky-blue background
    backgroundColor: "#87CEEB",

    // Mount the game canvas inside the #phaser-game div
    parent: "phaser-game",

    // Pixel-art mode: nearest-neighbor scaling, no anti-aliasing,
    // and round pixel positions to avoid sub-pixel blurring
    pixelArt: true,
    roundPixels: true,

    // Arcade physics with downward gravity
    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: 1500 },
            debug: false
        }
    },

    // Register scenes in order — Phaser runs them sequentially
    // (LoadScene first, then PlatformerScene)
    scene: [LoadScene, PlatformerScene]
};

// Create the game instance (starts automatically)
const game = new Phaser.Game(config);
