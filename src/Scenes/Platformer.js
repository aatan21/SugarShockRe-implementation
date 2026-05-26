/**
 * PlatformerScene — Main gameplay scene for Sugar Shock.
 *
 * Handles player movement, enemy patrol, collectibles, hazards,
 * particles, camera, HUD, and win/lose conditions.
 *
 * Structure:
 *   init()          → reset all game state
 *   create()        → delegate to focused setup methods
 *   update()        → delegate to focused per-frame methods
 *   helper methods  → individual systems (physics, particles, etc.)
 */
class PlatformerScene extends Phaser.Scene {
    constructor() {
        super("platformerScene");
    }

    // ------------------------------------------------------------------ init
    /** Reset every piece of game state so scene.restart() works cleanly. */
    init() {
        this.score = 0;
        this.health = 2;
        this.maxJumps = 2;
        this.jumpsLeft = 2;
        this.gameOver = false;
        this.isInvulnerable = false;
    }

    // --------------------------------------------------------------- create
    /** Build the entire level by delegating to focused setup methods. */
    create() {
        this.setupTilemap();
        this.createPlayer();
        this.createEnemies();
        this.spawnCollectibles();
        this.setupCamera();
        this.createHUD();
        this.setupInput();
        this.setupCollisions();
        this.createParticleEmitters();
    }

    // ---------------------------------------------------------------- update
    /** Per-frame logic — short-circuits when the game is over. */
    update() {
        // R-key restart is always available (even on game-over screens)
        if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
            this.scene.restart();
            return;
        }

        if (this.gameOver) return;

        this.handleMovement();
        this.handleJump();
        this.updatePlayerAnimation();
        this.updateWalkingParticles();
        this.updateHUD();
    }

    // ============================================================
    //  TILEMAP
    // ============================================================

    /** Load the Tiled map, create tile layers, and set up collision. */
    setupTilemap() {
        this.tilemap = this.add.tilemap("sugarShock-level-1");
        const tileset = this.tilemap.addTilesetImage(
            "kenny_tilemap_packed",
            "tilemap_tiles"
        );

        // Solid terrain — platforms, ground, walls
        this.groundLayer = this.tilemap.createLayer(
            "Ground-n-Platforms",
            tileset,
            0,
            0
        );
        // Collision is driven by the custom `collides` boolean property
        // set on individual tiles inside Tiled, not by tile index
        this.groundLayer.setCollisionByProperty({ collides: true });

        // Spike tiles — physically block AND instantly kill the player
        this.hazardsLayer = this.tilemap.createLayer("Hazards", tileset, 0, 0);
        this.hazardsLayer.setCollisionByProperty({ collides: true });

        // Prevent the player from leaving the map boundaries
        this.physics.world.setBounds(
            0,
            0,
            this.tilemap.widthInPixels,
            this.tilemap.heightInPixels
        );
    }

    // ============================================================
    //  PLAYER
    // ============================================================

    /** Create the player sprite, configure physics, and register animations. */
    createPlayer() {
        // Spawn at the design-specified world coordinates
        this.player = this.physics.add.sprite(
            50,
            200,
            "platformer_characters",
            "tile_0000.png"
        );

        // Keep the player inside the physics world bounds
        this.player.setCollideWorldBounds(true);

        // Acceleration-based movement: cap speeds so the player
        // can't exceed 300 px/s horizontally or 1000 px/s downward
        this.player.setMaxVelocity(300, 1000);

        // Drag is toggled in handleMovement(): 0 while keys are held,
        // 2000 while no key is held (provides snappy deceleration)
        this.player.setDragX(0);

        // Only create animations once; they persist across scene restarts
        if (!this.anims.exists("walk")) {
            // Walk: alternating between idle and step frames at 15 fps
            this.anims.create({
                key: "walk",
                frames: this.anims.generateFrameNames("platformer_characters", {
                    prefix: "tile_",
                    start: 0,
                    end: 1,
                    suffix: ".png",
                    zeroPad: 4
                }),
                frameRate: 15,
                repeat: -1
            });

            // Idle: single frame, looping
            this.anims.create({
                key: "idle",
                frames: [
                    { key: "platformer_characters", frame: "tile_0000.png" }
                ],
                repeat: -1
            });

            // Jump: single frame, no loop
            this.anims.create({
                key: "jump",
                frames: [
                    { key: "platformer_characters", frame: "tile_0001.png" }
                ],
                repeat: 0
            });
        }
    }

    // ============================================================
    //  ENEMIES
    // ============================================================

    /** Spawn the two patrolling enemies defined in DESIGN.md. */
    createEnemies() {
        this.enemies = this.physics.add.group();

        // Enemy 1: starts at (575, 200), patrols +275 px right
        this.createEnemy(575, 200, 575 + 275, 2500, true);

        // Enemy 2: starts at (1425, 200), patrols −150 px left
        this.createEnemy(1425, 200, 1425 - 150, 2500, false);
    }

    /**
     * Create a single patrolling enemy.
     *
     * Movement is tween-based (not physics velocity), so the enemy
     * glides back and forth at a constant speed.  The sprite flips
     * to face the direction of travel.
     *
     * @param {number} spawnX        - Starting X position
     * @param {number} spawnY        - Starting Y position
     * @param {number} targetX       - X destination for the first half-trip
     * @param {number} duration      - Milliseconds for one half-trip
     * @param {boolean} movesRightFirst - true = enemy walks right first
     */
    createEnemy(spawnX, spawnY, targetX, duration, movesRightFirst) {
        const enemy = this.enemies.create(
            spawnX,
            spawnY,
            "platformer_characters",
            "tile_0012.png"
        );

        // The player should not be able to push the enemy around
        enemy.setImmovable(true);
        enemy.setCollideWorldBounds(true);

        // The enemy sprite in this atlas faces RIGHT by default
        // (opposite of the player sprite).  flipX = true → face left
        if (!movesRightFirst) {
            enemy.flipX = true; // Face left at spawn
        }

        // Tween only the X property — gravity + ground collision handle Y
        this.tweens.add({
            targets: enemy,
            x: targetX,
            duration: duration,
            ease: "Linear",
            yoyo: true,
            repeat: -1,
            // onYoyo fires when the tween reverses (going back to start)
            onYoyo: () => {
                if (movesRightFirst) {
                    enemy.flipX = true; // returning left
                } else {
                    enemy.flipX = false; // returning right
                }
            },
            // onRepeat fires when the tween starts a new cycle
            onRepeat: () => {
                if (movesRightFirst) {
                    enemy.flipX = false; // going right
                } else {
                    enemy.flipX = true; // going left
                }
            }
        });
    }

    // ============================================================
    //  COLLECTIBLES (food items + checkpoint)
    // ============================================================

    /** Read the Objects layer from the tilemap and spawn sprites. */
    spawnCollectibles() {
        const objectLayer = this.tilemap.getObjectLayer("Objects");

        // Static group: food items never move once placed
        this.foodGroup = this.physics.add.staticGroup();

        // Point values keyed by the Tiled object `name` property
        this.foodPoints = {
            donut: 100,
            burger: 200,
            sushi: 500
        };

        objectLayer.objects.forEach((obj) => {
            // Tiled stores gid as 1-based; spritesheet frames are 0-based
            const frameIndex = obj.gid - 1;

            // For tile objects Tiled stores y as the BOTTOM edge,
            // so we shift up by half the height to get the sprite center
            const px = obj.x + obj.width / 2;
            const py = obj.y - obj.height / 2;

            if (obj.name === "checkpoint") {
                // The win-trigger cake — a single static sprite (not in a group)
                this.checkpoint = this.add.sprite(
                    px,
                    py,
                    "tilemap_sprites",
                    frameIndex
                );
                this.physics.add.existing(this.checkpoint, true); // true = static
            } else {
                // Food collectible
                const food = this.foodGroup.create(
                    px,
                    py,
                    "tilemap_sprites",
                    frameIndex
                );
                // Store the food type on the object for scoring later
                food.foodName = obj.name;
            }
        });
    }

    // ============================================================
    //  CAMERA
    // ============================================================

    /** Configure the camera to follow the player with smooth scrolling. */
    setupCamera() {
        const cam = this.cameras.main;
        cam.setBounds(0, 0, this.tilemap.widthInPixels, this.tilemap.heightInPixels);
        cam.startFollow(this.player, false, 0.25, 0.25); // lerp X & Y
        cam.setDeadzone(50, 50);
        cam.setFollowOffset(-100, 0); // look ahead to the right
        cam.setZoom(2);
    }

    // ============================================================
    //  HUD
    // ============================================================

    /** Create the heads-up display text (fixed on screen). */
    createHUD() {
        // Position is in world coords but scrollFactor(0) pins it on screen
        this.hudText = this.add.text(370, 160, "Health: 2 | Score: 0", {
            fontSize: "16px",
            fill: "#ffffff",
            stroke: "#000000",
            strokeThickness: 3
        });
        this.hudText.setScrollFactor(0); // never scroll with the camera
        this.hudText.setDepth(100); // render above all game objects
    }

    // ============================================================
    //  INPUT
    // ============================================================

    /** Set up keyboard controls. */
    setupInput() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.restartKey = this.input.keyboard.addKey("R");
    }

    // ============================================================
    //  COLLISIONS & OVERLAPS
    // ============================================================

    /** Wire up all physics interactions between game objects. */
    setupCollisions() {
        // Player stands on solid ground
        this.physics.add.collider(this.player, this.groundLayer);

        // Player physically collides with spikes (blocked + damage callback)
        this.physics.add.collider(
            this.player,
            this.hazardsLayer,
            this.onSpikeHit,
            null,
            this
        );

        // Player overlaps enemies → damage (no physical push-back)
        this.physics.add.overlap(
            this.player,
            this.enemies,
            this.onEnemyHit,
            null,
            this
        );

        // Player overlaps food → collect
        this.physics.add.overlap(
            this.player,
            this.foodGroup,
            this.onCollect,
            null,
            this
        );

        // Player overlaps checkpoint → win
        this.physics.add.overlap(
            this.player,
            this.checkpoint,
            this.onCheckpoint,
            null,
            this
        );

        // Enemies also stand on the ground (gravity pulls them down)
        this.physics.add.collider(this.enemies, this.groundLayer);
    }

    // ============================================================
    //  PARTICLES
    // ============================================================

    /**
     * Create all three particle emitter types.
     * Requires Phaser 3.60+ particle API.
     */
    createParticleEmitters() {
        // -- Walking dust --
        // Continuous emission at the player's trailing foot while walking
        this.walkEmitter = this.add.particles(0, 0, "kenny-particles", {
            frame: "smoke_03.png",
            scale: { start: 0.02, end: 0.05 },
            lifespan: 200,
            alpha: { start: 1, end: 0 },
            speed: 50,
            maxAliveParticles: 5,
            emitting: false // toggled on/off in updateWalkingParticles
        });

        // -- Jump burst --
        // One-shot burst of stars at the player's feet on jump
        this.jumpEmitter = this.add.particles(0, 0, "kenny-particles", {
            frame: "star_07.png",
            scale: { start: 0.05, end: 0 },
            lifespan: 300,
            speedX: { min: -50, max: 50 },
            speedY: { min: -50, max: 50 },
            gravityY: 100,
            maxAliveParticles: 10,
            emitting: false
        });

        // -- Collectible burst --
        // One-shot explosion at the food item's position on collection
        this.collectEmitter = this.add.particles(0, 0, "kenny-particles", {
            frame: ["star_04.png", "circle_05.png"], // randomly mixed
            scale: { start: 0.05, end: 0 },
            lifespan: 400,
            speed: { min: 50, max: 200 },
            angle: { min: 0, max: 360 },
            gravityY: 300,
            maxAliveParticles: 15,
            emitting: false
        });
    }

    // ============================================================
    //  PER-FRAME: MOVEMENT
    // ============================================================

    /** Read left/right keys and apply acceleration (or zero it). */
    handleMovement() {
        const ACCELERATION = 800;
        const DRAG = 2000;

        if (this.cursors.left.isDown) {
            this.player.setAccelerationX(-ACCELERATION);
            this.player.setDragX(0); // no drag while actively moving
            // Sprite faces left by default — clear any horizontal flip
            this.player.flipX = false;
        } else if (this.cursors.right.isDown) {
            this.player.setAccelerationX(ACCELERATION);
            this.player.setDragX(0); // no drag while actively moving
            // Flip sprite to face right
            this.player.flipX = true;
        } else {
            // No input → zero acceleration, enable drag for deceleration
            this.player.setAccelerationX(0);
            this.player.setDragX(DRAG);
        }
    }

    // ============================================================
    //  PER-FRAME: JUMP
    // ============================================================

    /** Handle double-jump logic using JustDown (press, not hold). */
    handleJump() {
        // Landing resets the jump counter
        if (this.player.body.blocked.down) {
            this.jumpsLeft = this.maxJumps;
        }

        // Only jump on key press (not held), and only if jumps remain
        if (
            Phaser.Input.Keyboard.JustDown(this.cursors.up) &&
            this.jumpsLeft > 0
        ) {
            this.player.setVelocityY(-400);
            this.jumpsLeft--;

            this.sound.play("jump_sound", { volume: 0.5 });
            this.emitJumpParticles();
        }
    }

    // ============================================================
    //  PER-FRAME: ANIMATION
    // ============================================================

    /** Choose the correct animation based on grounded state and input. */
    updatePlayerAnimation() {
        // Airborne overrides walk/idle
        if (!this.player.body.blocked.down) {
            this.player.play("jump", true);
        } else if (
            this.cursors.left.isDown ||
            this.cursors.right.isDown
        ) {
            this.player.play("walk", true);
        } else {
            this.player.play("idle", true);
        }
    }

    // ============================================================
    //  PER-FRAME: WALKING PARTICLES
    // ============================================================

    /** Position and toggle the walking-dust emitter each frame. */
    updateWalkingParticles() {
        const isWalking =
            this.player.body.blocked.down &&
            (this.cursors.left.isDown || this.cursors.right.isDown);

        this.walkEmitter.emitting = isWalking;

        if (isWalking) {
            // Trailing foot offset: behind the direction of travel
            const footOffsetX =
                this.cursors.left.isDown
                    ? this.player.displayWidth / 2 - 10 // trailing right when going left
                    : -(this.player.displayWidth / 2 - 10); // trailing left when going right
            const footOffsetY = this.player.displayHeight / 2 - 5;

            this.walkEmitter.setPosition(
                this.player.x + footOffsetX,
                this.player.y + footOffsetY
            );
        }
    }

    // ============================================================
    //  PER-FRAME: HUD
    // ============================================================

    /** Refresh the HUD text to reflect current health and score. */
    updateHUD() {
        this.hudText.setText(
            "Health: " + this.health + " | Score: " + this.score
        );
    }

    // ============================================================
    //  ONE-SHOT PARTICLE EMITTERS
    // ============================================================

    /** Emit a burst of star particles at the player's feet on jump. */
    emitJumpParticles() {
        const footX = this.player.x;
        const footY = this.player.y + this.player.displayHeight / 2;
        this.jumpEmitter.emitParticleAt(footX, footY, 10);
    }

    /**
     * Emit a burst of mixed particles at the collected item's position.
     * @param {number} x - World X of the collected food
     * @param {number} y - World Y of the collected food
     */
    emitCollectParticles(x, y) {
        this.collectEmitter.emitParticleAt(x, y, 15);
    }

    // ============================================================
    //  COLLISION CALLBACKS
    // ============================================================

    /**
     * Player overlapped an enemy → damage, knockback, invulnerability.
     * This is an overlap (not a collider), so there is no physical push.
     */
    onEnemyHit(player, enemy) {
        if (this.isInvulnerable || this.gameOver) return;

        this.health--;
        this.sound.play("hurt_sound", { volume: 0.5 });
        this.cameras.main.shake(200, 0.001);

        if (this.health <= 0) {
            this.triggerDeath();
        } else {
            this.isInvulnerable = true;
            this.player.setTint(0xff0000); // red tint shows invulnerability

            // Knockback: launch player away from the enemy
            const knockbackDir = player.x < enemy.x ? -1 : 1;
            player.setVelocity(knockbackDir * 300, -300);

            // End invulnerability after 1 second
            this.time.delayedCall(1000, () => {
                if (this.player) {
                    this.player.clearTint();
                }
                this.isInvulnerable = false;
            });
        }
    }

    /**
     * Player collided with a spike tile → instant kill.
     * Spikes use collider (physical block) + callback for death.
     * The player is briefly launched upward before freezing for a
     * visible death animation.
     */
    onSpikeHit(player, spike) {
        if (this.gameOver) return;

        this.health = 0;
        this.gameOver = true; // stop update logic immediately
        this.sound.play("hurt_sound", { volume: 0.5 });
        this.cameras.main.shake(200, 0.002);

        // Brief upward launch before the death freeze
        player.setVelocityY(-400);

        this.time.delayedCall(400, () => {
            player.setTint(0xff0000);
            player.setVelocity(0, 0);
            player.setAcceleration(0, 0);
            this.physics.pause();
            this.showGameOverText("SUGAR CRASH", "#ff0000");
        });
    }

    /**
     * Player overlapped a food item → collect it, add score,
     * play sound, and emit particles.
     */
    onCollect(player, food) {
        const points = this.foodPoints[food.foodName] || 100;
        this.score += points;
        this.sound.play("collect_sound", { volume: 0.5 });
        this.emitCollectParticles(food.x, food.y);
        food.destroy();
    }

    /**
     * Player overlapped the checkpoint (cake) → win the game.
     */
    onCheckpoint(player, checkpoint) {
        if (this.gameOver) return;
        this.triggerWin();
    }

    // ============================================================
    //  WIN / LOSE
    // ============================================================

    /** Handle death from enemy damage (health reached 0). */
    triggerDeath() {
        this.gameOver = true;
        this.player.setTint(0xff0000);
        this.player.setVelocity(0, 0);
        this.player.setAcceleration(0, 0);
        this.physics.pause();
        this.showGameOverText("SUGAR CRASH", "#ff0000");
    }

    /** Handle reaching the checkpoint — the player wins. */
    triggerWin() {
        this.gameOver = true;
        this.sound.play("win_sound", { volume: 0.5 });
        this.player.setVelocityX(0);
        this.player.setAccelerationX(0);
        this.physics.pause();
        this.showGameOverText("SUGAR SHOCK COMPLETE!", "#00ff00");
    }

    /**
     * Display the game-over or victory text centered on screen.
     * @param {string} title - Main message (e.g. "SUGAR CRASH")
     * @param {string} color - CSS color string for the title text
     */
    showGameOverText(title, color) {
        // scrollFactor(0) objects use canvas coordinates directly
        // (same as the HUD text).  Canvas center = (720, 300).
        const centerX = 720;
        const centerY = 300;

        this.add
            .text(centerX, centerY, title + "\nPress R to Restart", {
                fontSize: "16px",
                fill: color,
                stroke: "#000000",
                strokeThickness: 3,
                align: "center"
            })
            .setOrigin(0.5)
            .setScrollFactor(0) // stays put even if camera shifts
            .setDepth(100); // above everything
    }
}
