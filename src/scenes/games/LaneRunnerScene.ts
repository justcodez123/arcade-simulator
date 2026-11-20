import Phaser from 'phaser';
import { SoundEffects } from '../../audio';
import { GameManifest, getGameManifest } from '../../registry/GameRegistry';
import { StorageManager } from '../../storage';
import { ArcadeHud } from '../../ui/ArcadeHud';

interface LaneItem {
  lane: number;
  y: number;
  kind: 'barrier' | 'energy';
  scored: boolean;
}

interface LaneInit {
  gameId?: string;
}

export class LaneRunnerScene extends Phaser.Scene {
  private manifest!: GameManifest;
  private sfx!: SoundEffects;
  private hud!: ArcadeHud;
  private graphics!: Phaser.GameObjects.Graphics;

  private readonly roadLeft = 40;
  private readonly roadWidth = 320;
  private readonly roadTop = 135;
  private readonly roadBottom = 640;
  private readonly playerY = 582;

  private lanes = 3;
  private baseScrollSpeed = 250;
  private baseSpawnMs = 740;

  private currentLane = 1;
  private visualX = 200;
  private items: LaneItem[] = [];
  private spawnTimer = 0;
  private stripeOffset = 0;
  private elapsedSec = 0;
  private score = 0;
  private isGameOver = false;

  private swipeStartX = 0;
  private isSwiping = false;

  constructor() {
    super({ key: 'LaneRunnerScene' });
  }

  init(data?: LaneInit): void {
    this.manifest = getGameManifest(data?.gameId ?? 'hyper-lane');
    this.lanes = Number(this.manifest.rules.lanes ?? 3);
    this.baseScrollSpeed = Number(this.manifest.rules.scrollSpeed ?? 250);
    this.baseSpawnMs = Number(this.manifest.rules.spawnMs ?? 740);
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

    this.input.keyboard?.on('keydown-LEFT', () => this.shiftLane(-1));
    this.input.keyboard?.on('keydown-A', () => this.shiftLane(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.shiftLane(1));
    this.input.keyboard?.on('keydown-D', () => this.shiftLane(1));

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.worldY < 72 || this.hud.isGameOverVisible() || this.isGameOver) return;
      this.swipeStartX = pointer.worldX;
      this.isSwiping = true;
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.isSwiping || this.hud.isGameOverVisible() || this.isGameOver) return;
      this.isSwiping = false;
      const dx = pointer.worldX - this.swipeStartX;
      if (Math.abs(dx) >= 24) {
        this.shiftLane(dx > 0 ? 1 : -1);
      } else {
        this.shiftLane(pointer.worldX < this.visualX ? -1 : 1);
      }
    });

    this.resetGame();
  }

  private getLaneCenterX(lane: number): number {
    const laneW = this.roadWidth / this.lanes;
    return this.roadLeft + lane * laneW + laneW / 2;
  }

  private shiftLane(deltaLane: number): void {
    if (this.hud.isGameOverVisible() || this.isGameOver) return;
    const next = Phaser.Math.Clamp(this.currentLane + deltaLane, 0, this.lanes - 1);
    if (next !== this.currentLane) {
      this.currentLane = next;
      this.sfx.playSwitch(deltaLane > 0);
    }
  }

  private resetGame(): void {
    this.currentLane = Math.floor(this.lanes / 2);
    this.visualX = this.getLaneCenterX(this.currentLane);
    this.items = [];
    this.spawnTimer = 250;
    this.elapsedSec = 0;
    this.score = 0;
    this.isGameOver = false;
    this.hud.setScore(0);
  }

  private continueGame(): void {
    this.isGameOver = false;
    this.items = this.items.filter((it) => it.y < 320);
  }

  private spawnWave(): void {
    const safeLane = Math.floor(Math.random() * this.lanes);
    const barrierCount = Phaser.Math.Between(1, Math.max(1, this.lanes - 1));
    const usedLanes = new Set<number>([safeLane]);

    for (let i = 0; i < barrierCount; i++) {
      const candidate = Math.floor(Math.random() * this.lanes);
      if (!usedLanes.has(candidate)) {
        usedLanes.add(candidate);
        this.items.push({
          lane: candidate,
          y: this.roadTop - 16,
          kind: 'barrier',
          scored: false,
        });
      }
    }

    if (Math.random() < 0.48) {
      this.items.push({
        lane: safeLane,
        y: this.roadTop - 16,
        kind: 'energy',
        scored: false,
      });
    }
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.035);

    const targetX = this.getLaneCenterX(this.currentLane);
    this.visualX = Phaser.Math.Linear(this.visualX, targetX, Math.min(1, dt * 18));

    if (!this.isGameOver && !this.hud.isGameOverVisible()) {
      this.elapsedSec += dt;
      const speed = Math.min(470, this.baseScrollSpeed + this.elapsedSec * 4.5);
      this.stripeOffset = (this.stripeOffset + speed * dt) % 40;

      const interval = Math.max(360, this.baseSpawnMs - this.elapsedSec * 5);
      this.spawnTimer += delta;
      if (this.spawnTimer >= interval) {
        this.spawnTimer = 0;
        this.spawnWave();
      }

      for (let i = this.items.length - 1; i >= 0; i--) {
        const it = this.items[i];
        it.y += speed * dt;

        const ix = this.getLaneCenterX(it.lane);
        const dist = Phaser.Math.Distance.Between(this.visualX, this.playerY, ix, it.y);

        if (it.kind === 'energy' && dist < 24) {
          this.score += 2;
          this.hud.setScore(this.score);
          this.sfx.playCollect(2);
          this.items.splice(i, 1);
          continue;
        }

        if (it.kind === 'barrier' && dist < 22) {
          this.isGameOver = true;
          this.sfx.playGameOver();
          this.cameras.main.shake(150, 0.012);
          this.hud.showGameOver(this.score);
          return;
        }

        if (it.kind === 'barrier' && !it.scored && it.y > this.playerY + 18) {
          it.scored = true;
          this.score += 1;
          this.hud.setScore(this.score);
        }

        if (it.y > this.roadBottom + 20) {
          this.items.splice(i, 1);
        }
      }
    }

    this.renderScene();
  }

  private renderScene(): void {
    this.graphics.clear();

    // Road background
    this.graphics.fillStyle(0x0f172a, 0.85);
    this.graphics.fillRect(
      this.roadLeft,
      this.roadTop,
      this.roadWidth,
      this.roadBottom - this.roadTop
    );

    // Dashed lane dividers
    const laneW = this.roadWidth / this.lanes;
    this.graphics.lineStyle(2, 0x334155, 0.65);
    for (let l = 1; l < this.lanes; l++) {
      const lx = this.roadLeft + l * laneW;
      for (let y = this.roadTop - 40 + this.stripeOffset; y < this.roadBottom; y += 40) {
        const y1 = Math.max(this.roadTop, y);
        const y2 = Math.min(this.roadBottom, y + 20);
        if (y2 > y1) {
          this.graphics.lineBetween(lx, y1, lx, y2);
        }
      }
    }

    // Highway neon edges
    this.graphics.lineStyle(2, this.manifest.accentColor, 0.7);
    this.graphics.strokeRect(
      this.roadLeft,
      this.roadTop,
      this.roadWidth,
      this.roadBottom - this.roadTop
    );

    // Items
    const blockW = Math.min(46, laneW - 14);
    for (const it of this.items) {
      const ix = this.getLaneCenterX(it.lane);
      if (it.kind === 'barrier') {
        this.graphics.fillStyle(0xf43f5e, 0.92);
        this.graphics.fillRoundedRect(ix - blockW / 2, it.y - 12, blockW, 24, 5);
        this.graphics.lineStyle(1, 0xffffff, 0.3);
        this.graphics.strokeRoundedRect(ix - blockW / 2, it.y - 12, blockW, 24, 5);
      } else {
        this.graphics.fillStyle(0x22d3ee, 0.3);
        this.graphics.fillCircle(ix, it.y, 14);
        this.graphics.fillStyle(0xa5f3fc, 1);
        this.graphics.fillCircle(ix, it.y, 7);
      }
    }

    // Player cyber racer
    this.graphics.fillStyle(this.manifest.accentColor, 0.35);
    this.graphics.fillCircle(this.visualX, this.playerY, 18);
    this.graphics.fillStyle(this.manifest.accentColor, 1);
    this.graphics.fillTriangle(
      this.visualX,
      this.playerY - 18,
      this.visualX - 14,
      this.playerY + 14,
      this.visualX + 14,
      this.playerY + 14
    );
    this.graphics.fillStyle(0xf8fafc, 1);
    this.graphics.fillTriangle(
      this.visualX,
      this.playerY - 11,
      this.visualX - 6,
      this.playerY + 9,
      this.visualX + 6,
      this.playerY + 9
    );
  }
}
