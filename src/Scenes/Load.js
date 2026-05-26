/**
 * LoadScene — Preloads all game assets (images, atlases, audio, tilemap)
 * and transitions to the gameplay scene once loading is complete.
 */
class LoadScene extends Phaser.Scene {
    constructor() {
        super("loadScene");
    }

    preload() {
        // Loading text centered on the 1440×600 canvas
        this.add.text(720, 280, "Loading...", {
            fontSize: "24px",
            fill: "#ffffff"
        }).setOrigin(0.5);

        // ---- Tilemap ----
        // The level layout defined in Tiled (JSON export)
        this.load.tilemapTiledJSON(
            "sugarShock-level-1",
            "assets/sugarShock-level-1.tmj"
        );

        // ---- Tileset image ----
        // Loaded as a plain image for tilemap rendering
        this.load.image("tilemap_tiles", "assets/tilemap_packed.png");

        // Same image loaded as a spritesheet so we can create
        // individual sprites for food items and the checkpoint
        this.load.spritesheet("tilemap_sprites", "assets/tilemap_packed.png", {
            frameWidth: 18,
            frameHeight: 18
        });

        // ---- Character atlas ----
        // TexturePacker atlas containing player and enemy frames
        this.load.atlas(
            "platformer_characters",
            "assets/tilemap-characters-packed.png",
            "assets/tilemap-characters-packed.json"
        );

        // ---- Particle textures ----
        // Multi-atlas spanning 5 texture sheets; Phaser infers
        // image filenames from the JSON (kenny-particles-0.png … 4.png)
        this.load.multiatlas(
            "kenny-particles",
            "assets/kenny-particles.json",
            "assets/"
        );

        // ---- Audio ----
        this.load.audio("jump_sound", "assets/phaseJump2.ogg");
        this.load.audio("collect_sound", "assets/powerUp2.ogg");
        this.load.audio("hurt_sound", "assets/pepSound2.ogg");
        this.load.audio("win_sound", "assets/threeTone2.ogg");
    }

    create() {
        // All assets are loaded — switch to the platformer gameplay scene
        this.scene.start("platformerScene");
    }
}
