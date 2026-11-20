import Phaser from 'phaser';
import { SoundEffects } from '../../audio';
import { GameManifest, getGameManifest } from '../../registry/GameRegistry';
import { StorageManager } from '../../storage';
import { ArcadeHud } from '../../ui/ArcadeHud';

interface Star {
  x: number;
  y: number;
  speed: number;
  size: number;
}

interface PlasmaBolt {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Meteor {
  x: number;
  y: number;
  vy: number;
  vx: number;
  radius: number;
  hp: number;
  maxHp: number;
  color: number;
}

interface StarCore {
  x: number;
  y: number;
  vy: number;
}

interface BurstEffect {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  color: number;
}

interface AstroInit {
  gameId?: string;
}

export class AstroDodgeScene extends Phaser.Scene {
  private manifest!: GameManifest;
  private sfx!: SoundEffects;
  private hud!: ArcadeHud;
  private graphics!: Phaser.GameObjects.Graphics;

  private readonly shipY = 600;
  private shipX = 200;

  private spreadShot = 1;
  private fireIntervalMs = 240;
  private meteorSpeedMult = 1.0;
  private heavyRate = 0.25;

  private stars: Star[] = [];
  private bolts: PlasmaBolt[] = [];
  private meteors: Meteor[] = [];
  private cores: StarCore[] = [];
  private bursts: BurstEffect[] = [];

  private fireTimer = 0;
  private meteorSpawnTimer = 0;
  private coreSpawnTimer = 0;
  private elapsedSeconds = 0;
  private score = 0;
  private isGameOver = false;

  private leftKey?: Phaser.Input.Keyboard.Key;
  private rightKey?: Phaser.Input.Keyboard.Key;
  private aKey?: Phaser.Input.Keyboard.Key;
  private dKey?: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: 'AstroDodgeScene' });
  }

  init(data?: AstroInit): void {
    this.manifest = getGameManifest(data?.gameId ?? 'astro-dodge');
    this.spreadShot = Number(this.manifest.rules.spreadShot ?? 1);
    this.fireIntervalMs = Number(this.manifest.rules.fireMs ?? 240);
    this.meteorSpeedMult = Number(this.manifest.rules.meteorSpeed ?? 1.0);
    this.heavyRate = Number(this.manifest.rules.heavyRate ?? 0.25);
  }

  create(): void {
    const saveData = StorageManager.load();
    this.sfx = new SoundEffects(saveData.muted);
    this.hud = new ArcadeHud(this, this.manifest.id, this.sfx, {
      onRestart: () => {
        this.resetGame();
      },
      onContinue: () => {
        this.continueGame();
      },
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
        this.setShipX(pointer.worldX);
      }
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.worldY < 72 || this.isGameOver || this.hud.isGameOverVisible()) return;
      this.setShipX(pointer.worldX);
    });

    this.initStars();
    this.resetGame();
  }

  private initStars(): void {
    this.stars = [];
    for (let i = 0; i < 42; i++) {
      this.stars.push({
        x: Phaser.Math.FloatBetween(8, 392),
        y: Phaser.Math.FloatBetween(72, 692),
        speed: Phaser.Math.FloatBetween(35, 110),
        size: Phaser.Math.FloatBetween(1, 2.2),
      });
    }
  }

  private setShipX(targetX: number): void {
    this.shipX = Phaser.Math.Clamp(targetX, 28, 372);
  }

  private resetGame(): void {
    this.shipX = 200;
    this.bolts = [];
    this.meteors = [];
    this.cores = [];
    this.bursts = [];
    this.fireTimer = 120;
    this.meteorSpawnTimer = 300;
    this.coreSpawnTimer = 2800;
    this.elapsedSeconds = 0;
    this.score = 0;
    this.isGameOver = false;
    this.hud.setScore(0);
  }

  private continueGame(): void {
    this.isGameOver = false;
    this.meteors = [];
    this.meteorSpawnTimer = 0;
    this.shipX = 200;
  }

  private fireWeapons(): void {
    if (this.spreadShot >= 3) {
      this.bolts.push({ x: this.shipX, y: this.shipY - 18, vx: 0, vy: -520 });
      this.bolts.push({ x: this.shipX - 8, y: this.shipY - 12, vx: -85, vy: -510 });
      this.bolts.push({ x: this.shipX + 8, y: this.shipY - 12, vx: 85, vy: -510 });
    } else if (this.spreadShot === 2) {
      this.bolts.push({ x: this.shipX - 8, y: this.shipY - 14, vx: 0, vy: -520 });
      this.bolts.push({ x: this.shipX + 8, y: this.shipY - 14, vx: 0, vy: -520 });
    } else {
      this.bolts.push({ x: this.shipX, y: this.shipY - 18, vx: 0, vy: -520 });
    }
    this.sfx.playLaser();
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.04);

    for (const star of this.stars) {
      star.y += star.speed * dt;
      if (star.y > 700) {
        star.y = 70;
        star.x = Phaser.Math.FloatBetween(8, 392);
      }
    }

    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.radius += 60 * dt;
      b.alpha -= 2.8 * dt;
      if (b.alpha <= 0) {
        this.bursts.splice(i, 1);
      }
    }

    if (!this.isGameOver && !this.hud.isGameOverVisible()) {
      this.elapsedSeconds += dt;

      const steerSpeed = 300;
      if (this.leftKey?.isDown || this.aKey?.isDown) {
        this.setShipX(this.shipX - steerSpeed * dt);
      } else if (this.rightKey?.isDown || this.dKey?.isDown) {
        this.setShipX(this.shipX + steerSpeed * dt);
      }

      this.fireTimer += delta;
      if (this.fireTimer >= this.fireIntervalMs) {
        this.fireTimer -= this.fireIntervalMs;
        this.fireWeapons();
      }

      const spawnInterval = Math.max(290, (740 - this.elapsedSeconds * 10) / this.meteorSpeedMult);
      this.meteorSpawnTimer += delta;
      if (this.meteorSpawnTimer >= spawnInterval) {
        this.meteorSpawnTimer -= spawnInterval;
        this.spawnMeteor();
      }

      this.coreSpawnTimer += delta;
      if (this.coreSpawnTimer >= 4200) {
        this.coreSpawnTimer = 0;
        this.cores.push({
          x: Phaser.Math.FloatBetween(36, 364),
          y: 115,
          vy: 135,
        });
      }

      this.updateEntities(dt);
    }

    this.renderScene();
  }

  private spawnMeteor(): void {
    const isHeavy = Math.random() < Math.min(0.65, this.heavyRate + this.elapsedSeconds * 0.008);
    const radius = isHeavy
      ? Phaser.Math.FloatBetween(18, 22)
      : Phaser.Math.FloatBetween(12, 16);
    const speedBoost = Math.min(115, this.elapsedSeconds * 2.4);

    this.meteors.push({
      x: Phaser.Math.FloatBetween(28, 372),
      y: 115,
      vy: (Phaser.Math.FloatBetween(115, 175) + speedBoost) * this.meteorSpeedMult,
      vx: Phaser.Math.FloatBetween(-28, 28),
      radius,
      hp: isHeavy ? 2 : 1,
      maxHp: isHeavy ? 2 : 1,
      color: isHeavy ? 0xf59e0b : 0xf43f5e,
    });
  }

  private updateEntities(dt: number): void {
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const bolt = this.bolts[i];
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      if (bolt.y < 75 || bolt.x < 0 || bolt.x > 400) {
        this.bolts.splice(i, 1);
      }
    }

    for (let i = this.cores.length - 1; i >= 0; i--) {
      const core = this.cores[i];
      core.y += core.vy * dt;

      if (Phaser.Math.Distance.Between(this.shipX, this.shipY, core.x, core.y) < 24) {
        this.score += 3;
        this.hud.setScore(this.score);
        this.sfx.playCollect(3);
        this.bursts.push({
          x: core.x,
          y: core.y,
          radius: 8,
          alpha: 0.9,
          color: 0x38bdf8,
        });
        this.cores.splice(i, 1);
        continue;
      }

      if (core.y > 675) {
        this.cores.splice(i, 1);
      }
    }

    for (let mIdx = this.meteors.length - 1; mIdx >= 0; mIdx--) {
      const meteor = this.meteors[mIdx];
      meteor.x += meteor.vx * dt;
      meteor.y += meteor.vy * dt;

      if (meteor.x < meteor.radius + 12 || meteor.x > 388 - meteor.radius) {
        meteor.vx = -meteor.vx;
        meteor.x = Phaser.Math.Clamp(meteor.x, meteor.radius + 12, 388 - meteor.radius);
      }

      let destroyed = false;
      for (let bIdx = this.bolts.length - 1; bIdx >= 0; bIdx--) {
        const bolt = this.bolts[bIdx];
        if (
          Phaser.Math.Distance.Between(bolt.x, bolt.y, meteor.x, meteor.y) <=
          meteor.radius + 6
        ) {
          this.bolts.splice(bIdx, 1);
          meteor.hp -= 1;

          if (meteor.hp <= 0) {
            this.score += meteor.maxHp;
            this.hud.setScore(this.score);
            this.sfx.playExplosion();
            this.bursts.push({
              x: meteor.x,
              y: meteor.y,
              radius: meteor.radius * 0.6,
              alpha: 1,
              color: meteor.color,
            });
            this.meteors.splice(mIdx, 1);
            destroyed = true;
            break;
          } else {
            this.sfx.playBounce(0.75);
          }
        }
      }

      if (destroyed) continue;

      if (
        Phaser.Math.Distance.Between(this.shipX, this.shipY, meteor.x, meteor.y) <
        meteor.radius + 11
      ) {
        this.triggerGameOver();
        return;
      }

      if (meteor.y > 675) {
        this.meteors.splice(mIdx, 1);
      }
    }
  }

  private triggerGameOver(): void {
    this.isGameOver = true;
    this.sfx.playGameOver();
    this.cameras.main.shake(170, 0.015);
    this.bursts.push({
      x: this.shipX,
      y: this.shipY,
      radius: 12,
      alpha: 1,
      color: 0xf43f5e,
    });
    this.hud.showGameOver(this.score);
  }

  private renderScene(): void {
    this.graphics.clear();

    for (const star of this.stars) {
      this.graphics.fillStyle(0x94a3b8, 0.45);
      this.graphics.fillCircle(star.x, star.y, star.size);
    }

    for (const b of this.bursts) {
      this.graphics.lineStyle(2, b.color, Math.max(0, b.alpha));
      this.graphics.strokeCircle(b.x, b.y, b.radius);
    }

    for (const core of this.cores) {
      this.graphics.fillStyle(0x38bdf8, 0.25);
      this.graphics.fillCircle(core.x, core.y, 13);
      this.graphics.fillStyle(0xa5f3fc, 1);
      this.graphics.fillCircle(core.x, core.y, 6);
    }

    for (const bolt of this.bolts) {
      this.graphics.fillStyle(0x38bdf8, 0.4);
      this.graphics.fillRect(bolt.x - 3, bolt.y - 8, 6, 16);
      this.graphics.fillStyle(0xf8fafc, 1);
      this.graphics.fillRect(bolt.x - 1.5, bolt.y - 7, 3, 14);
    }

    for (const m of this.meteors) {
      this.graphics.fillStyle(m.color, 0.24);
      this.graphics.fillCircle(m.x, m.y, m.radius + 5);
      this.graphics.fillStyle(m.color, m.hp === 1 && m.maxHp === 2 ? 0.65 : 1);
      this.graphics.fillCircle(m.x, m.y, m.radius);
      this.graphics.lineStyle(1.5, 0xf8fafc, 0.25);
      this.graphics.strokeCircle(m.x, m.y, m.radius * 0.65);
    }

    if (!this.isGameOver) {
      this.graphics.fillStyle(this.manifest.accentColor, 0.35);
      this.graphics.fillCircle(this.shipX, this.shipY + 12, 8);
      this.graphics.fillStyle(this.manifest.accentColor, 1);
      this.graphics.fillTriangle(
        this.shipX,
        this.shipY - 16,
        this.shipX - 13,
        this.shipY + 12,
        this.shipX + 13,
        this.shipY + 12
      );
      this.graphics.fillStyle(0xf8fafc, 1);
      this.graphics.fillTriangle(
        this.shipX,
        this.shipY - 10,
        this.shipX - 5,
        this.shipY + 8,
        this.shipX + 5,
        this.shipY + 8
      );
    }
  }
}
