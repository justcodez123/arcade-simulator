import Phaser from 'phaser';
import { SoundEffects } from '../../audio';
import { GameManifest, getGameManifest } from '../../registry/GameRegistry';
import { StorageManager } from '../../storage';
import { ArcadeHud } from '../../ui/ArcadeHud';

interface PadCell {
  row: number;
  col: number;
  state: 'idle' | 'target' | 'bomb';
  ttlMs: number;
}

interface ReflexInit {
  gameId?: string;
}

export class ReflexGridScene extends Phaser.Scene {
  private manifest!: GameManifest;
  private sfx!: SoundEffects;
  private hud!: ArcadeHud;
  private graphics!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;

  private gridSize = 3;
  private bombChance = 0.12;
  private lifetimeMs = 1450;

  private readonly boardX = 40;
  private readonly boardY = 185;
  private readonly boardSize = 320;

  private cells: PadCell[] = [];
  private energyMs = 15000;
  private readonly maxEnergyMs = 15000;
  private spawnTimer = 0;
  private combo = 0;
  private score = 0;
  private isPlaying = false;
  private isGameOver = false;

  constructor() {
    super({ key: 'ReflexGridScene' });
  }

  init(data?: ReflexInit): void {
    this.manifest = getGameManifest(data?.gameId ?? 'reflex-matrix');
    this.gridSize = Number(this.manifest.rules.gridSize ?? 3);
    this.bombChance = Number(this.manifest.rules.bombChance ?? 0.12);
    this.lifetimeMs = Number(this.manifest.rules.lifetimeMs ?? 1450);
  }

  create(): void {
    const save = StorageManager.load();
    this.sfx = new SoundEffects(save.muted);
    this.hud = new ArcadeHud(this, this.manifest.id, this.sfx, {
      onRestart: () => this.resetGame(),
      onContinue: () => this.continueGame(),
    });

    this.graphics = this.add.graphics();

    this.statusText = this.add
      .text(200, 545, 'TAP GLOWING TARGETS TO START', {
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
      if (pointer.worldY < 72 || this.hud.isGameOverVisible() || this.isGameOver) return;
      this.handleTap(pointer.worldX, pointer.worldY);
    });

    this.resetGame();
  }

  private resetGame(): void {
    this.cells = [];
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        this.cells.push({ row: r, col: c, state: 'idle', ttlMs: 0 });
      }
    }
    this.energyMs = this.maxEnergyMs;
    this.spawnTimer = 0;
    this.combo = 0;
    this.score = 0;
    this.isPlaying = false;
    this.isGameOver = false;
    this.hud.setScore(0);
    this.statusText.setText('TAP A LIT PAD TO START');
    this.spawnTarget(true);
  }

  private continueGame(): void {
    this.isGameOver = false;
    this.isPlaying = true;
    this.energyMs = 10500;
    for (const c of this.cells) {
      if (c.state === 'bomb') {
        c.state = 'idle';
        c.ttlMs = 0;
      }
    }
    this.spawnTarget(true);
    this.statusText.setText('REVIVED — KEEP TAPPING!');
  }

  private spawnTarget(guaranteeSafe = false): void {
    const idleCells = this.cells.filter((c) => c.state === 'idle');
    if (idleCells.length === 0) return;
    const chosen = idleCells[Math.floor(Math.random() * idleCells.length)];
    const isBomb = !guaranteeSafe && Math.random() < this.bombChance;
    chosen.state = isBomb ? 'bomb' : 'target';
    chosen.ttlMs = this.lifetimeMs;
  }

  private handleTap(px: number, py: number): void {
    if (
      px < this.boardX ||
      px > this.boardX + this.boardSize ||
      py < this.boardY ||
      py > this.boardY + this.boardSize
    ) {
      return;
    }

    const cellSize = this.boardSize / this.gridSize;
    const col = Math.floor((px - this.boardX) / cellSize);
    const row = Math.floor((py - this.boardY) / cellSize);
    const cell = this.cells.find((c) => c.row === row && c.col === col);
    if (!cell) return;

    if (!this.isPlaying) {
      this.isPlaying = true;
      this.statusText.setText('HIT TARGETS • AVOID CRIMSON BOMBS');
    }

    if (cell.state === 'target') {
      cell.state = 'idle';
      cell.ttlMs = 0;
      this.combo += 1;
      const bonus = this.combo % 5 === 0 ? 2 : 1;
      this.score += bonus;
      this.energyMs = Math.min(this.maxEnergyMs, this.energyMs + 550);
      this.hud.setScore(this.score);
      this.sfx.playCollect(Math.min(this.combo, 8));
      this.spawnTarget(true);
      if (Math.random() < 0.45) {
        this.spawnTarget(false);
      }
    } else if (cell.state === 'bomb') {
      this.triggerGameOver('HIT A BOMB!');
    } else {
      this.combo = 0;
      this.energyMs = Math.max(0, this.energyMs - 900);
      this.sfx.playBounce(0.6);
    }
  }

  private triggerGameOver(reason: string): void {
    this.isPlaying = false;
    this.isGameOver = true;
    this.statusText.setText(reason);
    this.sfx.playGameOver();
    this.cameras.main.shake(150, 0.012);
    this.hud.showGameOver(this.score);
  }

  update(_time: number, delta: number): void {
    if (this.isPlaying && !this.isGameOver && !this.hud.isGameOverVisible()) {
      this.energyMs -= delta;
      if (this.energyMs <= 0) {
        this.energyMs = 0;
        this.triggerGameOver('ENERGY DEPLETED!');
        return;
      }

      for (const cell of this.cells) {
        if (cell.state !== 'idle') {
          cell.ttlMs -= delta;
          if (cell.ttlMs <= 0) {
            cell.state = 'idle';
            cell.ttlMs = 0;
          }
        }
      }

      const activeTargets = this.cells.filter((c) => c.state === 'target').length;
      this.spawnTimer += delta;
      if (activeTargets === 0 || this.spawnTimer >= 580) {
        this.spawnTimer = 0;
        this.spawnTarget(activeTargets === 0);
      }
    }

    this.renderScene();
  }

  private renderScene(): void {
    this.graphics.clear();

    // Energy bar (y: 145)
    const energyRatio = Phaser.Math.Clamp(this.energyMs / this.maxEnergyMs, 0, 1);
    this.graphics.fillStyle(0x1e293b, 0.9);
    this.graphics.fillRoundedRect(40, 148, 320, 14, 6);
    this.graphics.fillStyle(
      energyRatio < 0.28 ? 0xf43f5e : this.manifest.accentColor,
      1
    );
    this.graphics.fillRoundedRect(40, 148, Math.max(8, 320 * energyRatio), 14, 6);

    // Grid cells
    const cellSize = this.boardSize / this.gridSize;
    const pad = 6;
    for (const cell of this.cells) {
      const cx = this.boardX + cell.col * cellSize + pad;
      const cy = this.boardY + cell.row * cellSize + pad;
      const size = cellSize - pad * 2;

      if (cell.state === 'target') {
        this.graphics.fillStyle(this.manifest.accentColor, 0.95);
        this.graphics.fillRoundedRect(cx, cy, size, size, 10);
        this.graphics.lineStyle(2, 0xf8fafc, 0.6);
        this.graphics.strokeRoundedRect(cx, cy, size, size, 10);
      } else if (cell.state === 'bomb') {
        this.graphics.fillStyle(0xf43f5e, 0.9);
        this.graphics.fillRoundedRect(cx, cy, size, size, 10);
        this.graphics.lineStyle(3, 0xf8fafc, 0.9);
        this.graphics.lineBetween(cx + 14, cy + 14, cx + size - 14, cy + size - 14);
        this.graphics.lineBetween(cx + size - 14, cy + 14, cx + 14, cy + size - 14);
      } else {
        this.graphics.fillStyle(0x131a2a, 0.95);
        this.graphics.fillRoundedRect(cx, cy, size, size, 10);
        this.graphics.lineStyle(1.5, 0x1e293b, 1);
        this.graphics.strokeRoundedRect(cx, cy, size, size, 10);
      }
    }
  }
}
