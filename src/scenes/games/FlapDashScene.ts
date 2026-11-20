import Phaser from 'phaser';
import { SoundEffects } from '../../audio';
import { GameManifest, getGameManifest } from '../../registry/GameRegistry';
import { StorageManager } from '../../storage';
import { ArcadeHud } from '../../ui/ArcadeHud';

interface LaserGate {
  x: number;
  gapY: number;
  gapSize: number;
  width: number;
  vy: number;
  scored: boolean;
  hasBonus: boolean;
  bonusCollected: boolean;
}

interface FlapInit {
  gameId?: string;
}

export class FlapDashScene extends Phaser.Scene {
  private manifest!: GameManifest;
  private sfx!: SoundEffects;
  private hud!: ArcadeHud;
  private graphics!: Phaser.GameObjects.Graphics;
  private promptText!: Phaser.GameObjects.Text;

  private readonly minY = 132;
  private readonly maxY = 648;
  private readonly playerX = 105;
  private readonly playerRadius = 11;

  private gravity = 780;
  private gapSize = 144;
  private gateSpeed = 145;
  private movingGates = false;
  private reverseGravity = false;

  private playerY = 390;
  private playerVy = 0;
  private gates: LaserGate[] = [];
  private spawnTimer = 0;
  private score = 0;
  private isPlaying = false;
  private isGameOver = false;

  constructor() {
    super({ key: 'FlapDashScene' });
  }

  init(data?: FlapInit): void {
    this.manifest = getGameManifest(data?.gameId ?? 'neon-flap');
    this.gravity = Number(this.manifest.rules.gravity ?? 780);
    this.gapSize = Number(this.manifest.rules.gapSize ?? 144);
    this.gateSpeed = Number(this.manifest.rules.gateSpeed ?? 145);
    this.movingGates = Boolean(this.manifest.rules.movingGates ?? false);
    this.reverseGravity = Boolean(this.manifest.rules.reverseGravity ?? false);
  }

  create(): void {
    const save = StorageManager.load();
    this.sfx = new SoundEffects(save.muted);
    this.hud = new ArcadeHud(this, this.manifest.id, this.sfx, {
      onRestart: () => this.resetGame(),
      onContinue: () => this.continueGame(),
    });

    this.graphics = this.add.graphics();

    this.promptText = this.add
      .text(200, 460, 'TAP OR SPACE TO BOOST', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: this.manifest.accentHex,
      })
      .setOrigin(0.5);

    this.add
      .text(200, 675, this.manifest.controlsHint, {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '10px',
        color: '#64748b',
      })
      .setOrigin(0.5);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.worldY < 72 || this.hud.isGameOverVisible() || this.isGameOver) return;
      this.flap();
    });

    this.input.keyboard?.on('keydown-SPACE', () => {
      if (this.hud.isGameOverVisible() || this.isGameOver) return;
      this.flap();
    });

    this.input.keyboard?.on('keydown-UP', () => {
      if (this.hud.isGameOverVisible() || this.isGameOver) return;
      this.flap();
    });

    this.resetGame();
  }

  private resetGame(): void {
    this.playerY = 390;
    this.playerVy = 0;
    this.gates = [];
    this.spawnTimer = 1100;
    this.score = 0;
    this.isPlaying = false;
    this.isGameOver = false;
    this.hud.setScore(0);
    this.promptText.setText(
      this.reverseGravity ? 'INVERTED GRAVITY — TAP TO DIVE' : 'TAP OR SPACE TO BOOST'
    );
    this.promptText.setVisible(true);
  }

  private continueGame(): void {
    this.isGameOver = false;
    this.isPlaying = false;
    this.playerY = 390;
    this.playerVy = 0;
    this.gates = this.gates.filter((g) => g.x > 250);
    this.promptText.setText('REVIVED — TAP OR SPACE TO BOOST');
    this.promptText.setVisible(true);
  }

  private flap(): void {
    if (!this.isPlaying) {
      this.isPlaying = true;
      this.promptText.setVisible(false);
    }
    this.playerVy = this.reverseGravity ? 295 : -295;
    this.sfx.playSwitch(true);
  }

  private spawnGate(): void {
    const margin = 68 + this.gapSize / 2;
    const gapY = Phaser.Math.FloatBetween(this.minY + margin, this.maxY - margin);
    this.gates.push({
      x: 425,
      gapY,
      gapSize: this.gapSize,
      width: 34,
      vy: this.movingGates ? (Math.random() > 0.5 ? 58 : -58) : 0,
      scored: false,
      hasBonus: Math.random() < 0.35,
      bonusCollected: false,
    });
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.035);

    if (this.isPlaying && !this.isGameOver && !this.hud.isGameOverVisible()) {
      this.playerVy += this.gravity * dt;
      this.playerY += this.playerVy * dt;

      if (
        this.playerY - this.playerRadius <= this.minY ||
        this.playerY + this.playerRadius >= this.maxY
      ) {
        this.triggerGameOver();
        return;
      }

      this.spawnTimer += delta;
      if (this.spawnTimer >= 1650) {
        this.spawnTimer = 0;
        this.spawnGate();
      }

      for (let i = this.gates.length - 1; i >= 0; i--) {
        const g = this.gates[i];
        g.x -= this.gateSpeed * dt;

        if (g.vy !== 0) {
          g.gapY += g.vy * dt;
          const minCenter = this.minY + 55 + g.gapSize / 2;
          const maxCenter = this.maxY - 55 - g.gapSize / 2;
          if (g.gapY < minCenter || g.gapY > maxCenter) {
            g.vy = -g.vy;
            g.gapY = Phaser.Math.Clamp(g.gapY, minCenter, maxCenter);
          }
        }

        if (!g.scored && g.x + g.width / 2 < this.playerX) {
          g.scored = true;
          this.score += 1;
          this.hud.setScore(this.score);
          this.sfx.playBounce(1.3);
        }

        if (
          g.hasBonus &&
          !g.bonusCollected &&
          Phaser.Math.Distance.Between(this.playerX, this.playerY, g.x, g.gapY) < 22
        ) {
          g.bonusCollected = true;
          this.score += 2;
          this.hud.setScore(this.score);
          this.sfx.playCollect(2);
        }

        // Collision check with top and bottom gate bars
        const halfW = g.width / 2;
        if (
          this.playerX + this.playerRadius > g.x - halfW &&
          this.playerX - this.playerRadius < g.x + halfW
        ) {
          const gapTop = g.gapY - g.gapSize / 2;
          const gapBottom = g.gapY + g.gapSize / 2;
          if (
            this.playerY - this.playerRadius < gapTop ||
            this.playerY + this.playerRadius > gapBottom
          ) {
            this.triggerGameOver();
            return;
          }
        }

        if (g.x < -50) {
          this.gates.splice(i, 1);
        }
      }
    }

    this.renderScene();
  }

  private triggerGameOver(): void {
    this.isPlaying = false;
    this.isGameOver = true;
    this.sfx.playGameOver();
    this.cameras.main.shake(150, 0.012);
    this.hud.showGameOver(this.score);
  }

  private renderScene(): void {
    this.graphics.clear();

    // Arena frame
    this.graphics.fillStyle(0x0f172a, 0.55);
    this.graphics.fillRect(14, this.minY, 372, this.maxY - this.minY);
    this.graphics.lineStyle(2, this.manifest.accentColor, 0.45);
    this.graphics.strokeRect(14, this.minY, 372, this.maxY - this.minY);

    // Gates
    for (const g of this.gates) {
      const gapTop = g.gapY - g.gapSize / 2;
      const gapBottom = g.gapY + g.gapSize / 2;
      const xLeft = g.x - g.width / 2;

      this.graphics.fillStyle(0xf43f5e, 0.88);
      this.graphics.fillRoundedRect(xLeft, this.minY, g.width, gapTop - this.minY, 4);
      this.graphics.fillRoundedRect(xLeft, gapBottom, g.width, this.maxY - gapBottom, 4);

      if (g.hasBonus && !g.bonusCollected) {
        this.graphics.fillStyle(0x22d3ee, 0.3);
        this.graphics.fillCircle(g.x, g.gapY, 13);
        this.graphics.fillStyle(0xa5f3fc, 1);
        this.graphics.fillCircle(g.x, g.gapY, 6);
      }
    }

    // Player thruster craft
    this.graphics.fillStyle(this.manifest.accentColor, 0.35);
    this.graphics.fillCircle(this.playerX, this.playerY, this.playerRadius + 5);
    this.graphics.fillStyle(0xf8fafc, 1);
    this.graphics.fillCircle(this.playerX, this.playerY, this.playerRadius);
    this.graphics.fillStyle(this.manifest.accentColor, 1);
    this.graphics.fillTriangle(
      this.playerX + 12,
      this.playerY,
      this.playerX - 6,
      this.playerY - 6,
      this.playerX - 6,
      this.playerY + 6
    );
  }
}
