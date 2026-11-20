import Phaser from 'phaser';
import { SoundEffects } from '../../audio';
import { GameManifest, getGameManifest } from '../../registry/GameRegistry';
import { StorageManager } from '../../storage';
import { ArcadeHud } from '../../ui/ArcadeHud';

type PlatformKind = 'normal' | 'moving' | 'spring' | 'fragile';

interface Platform {
  x: number;
  worldY: number;
  width: number;
  vx: number;
  kind: PlatformKind;
  broken: boolean;
}

interface HopperInit {
  gameId?: string;
}

export class SkyHopperScene extends Phaser.Scene {
  private manifest!: GameManifest;
  private sfx!: SoundEffects;
  private hud!: ArcadeHud;
  private graphics!: Phaser.GameObjects.Graphics;

  private springRatio = 0.16;
  private movingRatio = 0.18;
  private fragileRatio = 0.08;
  private gravity = 940;

  private playerX = 200;
  private playerWorldY = 540;
  private playerVy = -450;
  private cameraTopY = 0;
  private highestWorldY = 540;

  private platforms: Platform[] = [];
  private highestSpawnedY = 560;
  private score = 0;
  private isGameOver = false;

  private leftKey?: Phaser.Input.Keyboard.Key;
  private rightKey?: Phaser.Input.Keyboard.Key;
  private aKey?: Phaser.Input.Keyboard.Key;
  private dKey?: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: 'SkyHopperScene' });
  }

  init(data?: HopperInit): void {
    this.manifest = getGameManifest(data?.gameId ?? 'sky-hopper');
    this.springRatio = Number(this.manifest.rules.springRatio ?? 0.16);
    this.movingRatio = Number(this.manifest.rules.movingRatio ?? 0.18);
    this.fragileRatio = Number(this.manifest.rules.fragileRatio ?? 0.08);
    this.gravity = Number(this.manifest.rules.gravity ?? 940);
  }

  create(): void {
    const save = StorageManager.load();
    this.sfx = new SoundEffects(save.muted);
    this.hud = new ArcadeHud(this, this.manifest.id, this.sfx, {
      onRestart: () => this.resetGame(),
      onContinue: () => this.continueGame(),
    });

    this.graphics = this.add.graphics();

    this.add
      .text(200, 675, this.manifest.controlsHint, {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '10px',
        color: '#64748b',
      })
      .setOrigin(0.5);

    this.leftKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.rightKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.aKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.dKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.D);

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isGameOver || this.hud.isGameOverVisible()) return;
      if (pointer.isDown || pointer.wasTouch === false) {
        this.playerX = Phaser.Math.Clamp(pointer.worldX, 16, 384);
      }
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.worldY < 72 || this.isGameOver || this.hud.isGameOverVisible()) return;
      this.playerX = Phaser.Math.Clamp(pointer.worldX, 16, 384);
    });

    this.resetGame();
  }

  private resetGame(): void {
    this.playerX = 200;
    this.playerWorldY = 550;
    this.playerVy = -490;
    this.cameraTopY = 0;
    this.highestWorldY = 550;
    this.score = 0;
    this.isGameOver = false;
    this.hud.setScore(0);

    this.platforms = [
      { x: 200, worldY: 600, width: 180, vx: 0, kind: 'normal', broken: false },
    ];
    this.highestSpawnedY = 600;
    this.ensurePlatformsUpTo(this.cameraTopY - 120);
  }

  private continueGame(): void {
    this.isGameOver = false;
    const rescueY = this.cameraTopY + 500;
    this.platforms.push({
      x: 200,
      worldY: rescueY,
      width: 220,
      vx: 0,
      kind: 'spring',
      broken: false,
    });
    this.playerX = 200;
    this.playerWorldY = rescueY - 24;
    this.playerVy = -620;
  }

  private ensurePlatformsUpTo(targetY: number): void {
    while (this.highestSpawnedY > targetY) {
      this.highestSpawnedY -= Phaser.Math.FloatBetween(54, 78);
      const r = Math.random();
      let kind: PlatformKind = 'normal';
      if (r < this.springRatio) {
        kind = 'spring';
      } else if (r < this.springRatio + this.movingRatio) {
        kind = 'moving';
      } else if (r < this.springRatio + this.movingRatio + this.fragileRatio) {
        kind = 'fragile';
      }

      const width = kind === 'spring' ? 76 : Phaser.Math.FloatBetween(64, 86);
      this.platforms.push({
        x: Phaser.Math.FloatBetween(48, 352),
        worldY: this.highestSpawnedY,
        width,
        vx: kind === 'moving' ? (Math.random() > 0.5 ? 85 : -85) : 0,
        kind,
        broken: false,
      });
    }
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.035);

    if (!this.isGameOver && !this.hud.isGameOverVisible()) {
      const steerSpeed = 300;
      if (this.leftKey?.isDown || this.aKey?.isDown) {
        this.playerX -= steerSpeed * dt;
      } else if (this.rightKey?.isDown || this.dKey?.isDown) {
        this.playerX += steerSpeed * dt;
      }

      if (this.playerX < 10) this.playerX = 390;
      if (this.playerX > 390) this.playerX = 10;

      const prevY = this.playerWorldY;
      this.playerVy += this.gravity * dt;
      this.playerWorldY += this.playerVy * dt;

      // Move platforms & check landing while falling
      for (const p of this.platforms) {
        if (p.vx !== 0) {
          p.x += p.vx * dt;
          if (p.x < p.width / 2 + 16 || p.x > 384 - p.width / 2) {
            p.vx = -p.vx;
            p.x = Phaser.Math.Clamp(p.x, p.width / 2 + 16, 384 - p.width / 2);
          }
        }

        if (
          !p.broken &&
          this.playerVy > 0 &&
          prevY + 10 <= p.worldY + 6 &&
          this.playerWorldY + 10 >= p.worldY - 6 &&
          Math.abs(this.playerX - p.x) <= p.width / 2 + 9
        ) {
          if (p.kind === 'spring') {
            this.playerVy = -680;
            this.sfx.playCollect(2);
          } else {
            this.playerVy = -470;
            this.sfx.playBounce(1.1);
          }
          if (p.kind === 'fragile') {
            p.broken = true;
          }
          break;
        }
      }

      // Camera follows upward
      const targetCam = this.playerWorldY - 310;
      if (targetCam < this.cameraTopY) {
        this.cameraTopY = targetCam;
      }

      if (this.playerWorldY < this.highestWorldY) {
        this.highestWorldY = this.playerWorldY;
        const climbed = Math.floor((550 - this.highestWorldY) / 25);
        if (climbed > this.score) {
          this.score = climbed;
          this.hud.setScore(this.score);
        }
      }

      this.ensurePlatformsUpTo(this.cameraTopY - 120);
      this.platforms = this.platforms.filter(
        (p) => p.worldY - this.cameraTopY < 700 && !p.broken
      );

      if (this.playerWorldY - this.cameraTopY > 670) {
        this.isGameOver = true;
        this.sfx.playGameOver();
        this.cameras.main.shake(150, 0.012);
        this.hud.showGameOver(this.score);
      }
    }

    this.renderScene();
  }

  private renderScene(): void {
    this.graphics.clear();

    // Vertical guides
    this.graphics.lineStyle(1, 0x1e293b, 0.35);
    this.graphics.lineBetween(16, 120, 16, 650);
    this.graphics.lineBetween(384, 120, 384, 650);

    for (const p of this.platforms) {
      const sy = p.worldY - this.cameraTopY;
      if (sy < 115 || sy > 655) continue;

      const color =
        p.kind === 'spring'
          ? 0x10b981
          : p.kind === 'fragile'
          ? 0xf59e0b
          : p.kind === 'moving'
          ? 0x38bdf8
          : this.manifest.accentColor;

      this.graphics.fillStyle(color, 0.92);
      this.graphics.fillRoundedRect(p.x - p.width / 2, sy - 5, p.width, 10, 4);
      if (p.kind === 'spring') {
        this.graphics.fillStyle(0xf8fafc, 1);
        this.graphics.fillRect(p.x - 12, sy - 8, 24, 3);
      }
    }

    const playerScreenY = this.playerWorldY - this.cameraTopY;
    if (playerScreenY >= 100 && playerScreenY <= 680) {
      this.graphics.fillStyle(this.manifest.accentColor, 0.35);
      this.graphics.fillCircle(this.playerX, playerScreenY, 15);
      this.graphics.fillStyle(0xf8fafc, 1);
      this.graphics.fillCircle(this.playerX, playerScreenY, 10);
    }
  }
}
