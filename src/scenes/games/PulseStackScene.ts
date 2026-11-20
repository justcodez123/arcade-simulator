import Phaser from 'phaser';
import { SoundEffects } from '../../audio';
import { GameManifest, getGameManifest } from '../../registry/GameRegistry';
import { StorageManager } from '../../storage';
import { ArcadeHud } from '../../ui/ArcadeHud';

interface StackedSlab {
  x: number;
  worldY: number;
  w: number;
  color: number;
}

interface FallingPiece {
  x: number;
  screenY: number;
  w: number;
  vy: number;
  alpha: number;
  color: number;
}

interface StackInit {
  gameId?: string;
}

export class PulseStackScene extends Phaser.Scene {
  private manifest!: GameManifest;
  private sfx!: SoundEffects;
  private hud!: ArcadeHud;
  private graphics!: Phaser.GameObjects.Graphics;
  private feedbackText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;

  private readonly slabHeight = 22;
  private readonly slabStep = 24;
  private readonly palette = [
    0xec4899,
    0xd946ef,
    0xa855f7,
    0x6366f1,
    0x38bdf8,
    0x14b8a6,
    0x10b981,
    0xf59e0b,
  ];

  private startWidth = 180;
  private speedBase = 155;
  private perfectWindow = 5;

  private stack: StackedSlab[] = [];
  private activeSlab!: {
    x: number;
    worldY: number;
    w: number;
    dir: number;
    speed: number;
    color: number;
  };
  private fallingPieces: FallingPiece[] = [];

  private targetViewOffsetY = 0;
  private viewOffsetY = 0;
  private score = 0;
  private perfectStreak = 0;
  private isGameOver = false;

  constructor() {
    super({ key: 'PulseStackScene' });
  }

  init(data?: StackInit): void {
    this.manifest = getGameManifest(data?.gameId ?? 'pulse-stack');
    this.startWidth = Number(this.manifest.rules.startWidth ?? 180);
    this.speedBase = Number(this.manifest.rules.speedBase ?? 155);
    this.perfectWindow = Number(this.manifest.rules.perfectWindow ?? 5);
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

    this.feedbackText = this.add
      .text(200, 165, '', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#f9a8d4',
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(30);

    this.promptText = this.add
      .text(200, 642, 'TAP OR SPACE TO DROP SLAB', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '13px',
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
      if (pointer.worldY < 72 || this.hud.isGameOverVisible() || this.isGameOver) {
        return;
      }
      this.dropActiveSlab();
    });

    this.input.keyboard?.on('keydown-SPACE', () => {
      if (this.hud.isGameOverVisible() || this.isGameOver) return;
      this.dropActiveSlab();
    });

    this.input.keyboard?.on('keydown-UP', () => {
      if (this.hud.isGameOverVisible() || this.isGameOver) return;
      this.dropActiveSlab();
    });

    this.resetGame();
  }

  private resetGame(): void {
    this.score = 0;
    this.perfectStreak = 0;
    this.targetViewOffsetY = 0;
    this.viewOffsetY = 0;
    this.isGameOver = false;
    this.fallingPieces = [];

    this.stack = [
      {
        x: 200,
        worldY: 590,
        w: this.startWidth,
        color: this.manifest.accentColor,
      },
    ];

    this.hud.setScore(0);
    this.promptText.setText('TAP OR SPACE TO DROP SLAB');
    this.promptText.setVisible(true);
    this.spawnNextSlab();
  }

  private continueGame(): void {
    this.isGameOver = false;
    this.promptText.setText('REVIVED — TAP OR SPACE TO DROP SLAB');
    this.promptText.setVisible(true);
    this.spawnNextSlab();
  }

  private spawnNextSlab(): void {
    const level = this.stack.length;
    const prev = this.stack[level - 1];
    const worldY = prev.worldY - this.slabStep;
    const speed = Math.min(this.speedBase + level * 6.5, 360);
    const startFromLeft = level % 2 === 1;
    const halfW = prev.w / 2;

    this.activeSlab = {
      x: startFromLeft ? 28 + halfW : 372 - halfW,
      worldY,
      w: prev.w,
      dir: startFromLeft ? 1 : -1,
      speed,
      color: this.palette[level % this.palette.length],
    };

    if (worldY + this.targetViewOffsetY < 320) {
      this.targetViewOffsetY += this.slabStep;
    }
  }

  private showFeedback(message: string, colorHex: string): void {
    this.feedbackText.setText(message);
    this.feedbackText.setColor(colorHex);
    this.feedbackText.setY(175);
    this.feedbackText.setAlpha(1);

    this.tweens.killTweensOf(this.feedbackText);
    this.tweens.add({
      targets: this.feedbackText,
      y: 148,
      alpha: 0,
      duration: 650,
      ease: 'Cubic.easeOut',
    });
  }

  private dropActiveSlab(): void {
    const prev = this.stack[this.stack.length - 1];
    const active = this.activeSlab;
    const deltaX = active.x - prev.x;

    const activeLeft = active.x - active.w / 2;
    const activeRight = active.x + active.w / 2;
    const prevLeft = prev.x - prev.w / 2;
    const prevRight = prev.x + prev.w / 2;

    const overlapLeft = Math.max(activeLeft, prevLeft);
    const overlapRight = Math.min(activeRight, prevRight);
    const overlapWidth = overlapRight - overlapLeft;

    if (overlapWidth <= 0) {
      this.fallingPieces.push({
        x: active.x,
        screenY: active.worldY + this.viewOffsetY,
        w: active.w,
        vy: 80,
        alpha: 1,
        color: active.color,
      });
      this.triggerGameOver();
      return;
    }

    if (Math.abs(deltaX) <= this.perfectWindow) {
      this.perfectStreak += 1;
      const bonusW = Math.min(this.startWidth, prev.w + 4);
      this.stack.push({
        x: prev.x,
        worldY: active.worldY,
        w: bonusW,
        color: active.color,
      });
      this.score += 2;
      this.hud.setScore(this.score);
      this.sfx.playStackDrop(true);
      this.showFeedback(
        this.perfectStreak > 1 ? `PERFECT x${this.perfectStreak}! +2` : 'PERFECT! +2',
        '#38bdf8'
      );
    } else {
      this.perfectStreak = 0;
      const placedX = (overlapLeft + overlapRight) / 2;
      this.stack.push({
        x: placedX,
        worldY: active.worldY,
        w: overlapWidth,
        color: active.color,
      });

      const cutWidth = active.w - overlapWidth;
      const cutX =
        deltaX > 0 ? overlapRight + cutWidth / 2 : overlapLeft - cutWidth / 2;
      this.fallingPieces.push({
        x: cutX,
        screenY: active.worldY + this.viewOffsetY,
        w: cutWidth,
        vy: 50,
        alpha: 0.95,
        color: active.color,
      });

      this.score += 1;
      this.hud.setScore(this.score);
      this.sfx.playStackDrop(false);
    }

    this.promptText.setVisible(false);
    this.spawnNextSlab();
  }

  private triggerGameOver(): void {
    this.isGameOver = true;
    this.sfx.playGameOver();
    this.cameras.main.shake(150, 0.012);
    this.hud.showGameOver(this.score);
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.04);

    this.viewOffsetY = Phaser.Math.Linear(
      this.viewOffsetY,
      this.targetViewOffsetY,
      Math.min(1, dt * 10)
    );

    for (let i = this.fallingPieces.length - 1; i >= 0; i--) {
      const piece = this.fallingPieces[i];
      piece.vy += 520 * dt;
      piece.screenY += piece.vy * dt;
      piece.alpha -= 1.2 * dt;
      if (piece.alpha <= 0 || piece.screenY > 720) {
        this.fallingPieces.splice(i, 1);
      }
    }

    if (!this.isGameOver && !this.hud.isGameOverVisible()) {
      const halfW = this.activeSlab.w / 2;
      const minX = 24 + halfW;
      const maxX = 376 - halfW;

      this.activeSlab.x += this.activeSlab.dir * this.activeSlab.speed * dt;
      if (this.activeSlab.x >= maxX) {
        this.activeSlab.x = maxX;
        this.activeSlab.dir = -1;
      } else if (this.activeSlab.x <= minX) {
        this.activeSlab.x = minX;
        this.activeSlab.dir = 1;
      }
    }

    this.renderScene();
  }

  private renderScene(): void {
    this.graphics.clear();

    this.graphics.lineStyle(1, 0x1e293b, 0.35);
    this.graphics.lineBetween(24, 130, 24, 625);
    this.graphics.lineBetween(376, 130, 376, 625);

    for (const slab of this.stack) {
      const sy = slab.worldY + this.viewOffsetY;
      if (sy > 640 || sy < 90) continue;

      this.graphics.fillStyle(slab.color, 0.92);
      this.graphics.fillRoundedRect(
        slab.x - slab.w / 2,
        sy - this.slabHeight / 2,
        slab.w,
        this.slabHeight,
        4
      );
      this.graphics.lineStyle(1, 0xffffff, 0.22);
      this.graphics.strokeRoundedRect(
        slab.x - slab.w / 2,
        sy - this.slabHeight / 2,
        slab.w,
        this.slabHeight,
        4
      );
    }

    if (!this.isGameOver) {
      const sy = this.activeSlab.worldY + this.viewOffsetY;
      this.graphics.fillStyle(this.activeSlab.color, 0.35);
      this.graphics.fillRoundedRect(
        this.activeSlab.x - this.activeSlab.w / 2 - 3,
        sy - this.slabHeight / 2 - 3,
        this.activeSlab.w + 6,
        this.slabHeight + 6,
        6
      );
      this.graphics.fillStyle(this.activeSlab.color, 1);
      this.graphics.fillRoundedRect(
        this.activeSlab.x - this.activeSlab.w / 2,
        sy - this.slabHeight / 2,
        this.activeSlab.w,
        this.slabHeight,
        4
      );
    }

    for (const piece of this.fallingPieces) {
      this.graphics.fillStyle(piece.color, Math.max(0, piece.alpha));
      this.graphics.fillRoundedRect(
        piece.x - piece.w / 2,
        piece.screenY - this.slabHeight / 2,
        piece.w,
        this.slabHeight,
        3
      );
    }
  }
}
