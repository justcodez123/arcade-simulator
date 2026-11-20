import Phaser from 'phaser';
import { SoundEffects } from '../../audio';
import { GameManifest, getGameManifest } from '../../registry/GameRegistry';
import { StorageManager } from '../../storage';
import { ArcadeHud } from '../../ui/ArcadeHud';

interface GridPoint {
  x: number;
  y: number;
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

interface SnakeInit {
  gameId?: string;
}

export class CyberSnakeScene extends Phaser.Scene {
  private manifest!: GameManifest;
  private sfx!: SoundEffects;
  private hud!: ArcadeHud;
  private graphics!: Phaser.GameObjects.Graphics;
  private promptText!: Phaser.GameObjects.Text;

  private readonly cols = 16;
  private readonly rows = 18;
  private readonly cellSize = 20;
  private readonly boardX = 40;
  private readonly boardY = 140;

  private baseStepMs = 145;
  private wrapWalls = false;
  private hasObstacles = false;

  private snake: GridPoint[] = [];
  private obstacles: GridPoint[] = [];
  private food: GridPoint = { x: 11, y: 9 };
  private currentDir: Direction = 'RIGHT';
  private dirQueue: Direction[] = [];

  private score = 0;
  private stepTimer = 0;
  private stepIntervalMs = 145;
  private isPlaying = false;
  private isGameOver = false;

  private swipeStartX = 0;
  private swipeStartY = 0;
  private isSwiping = false;

  constructor() {
    super({ key: 'CyberSnakeScene' });
  }

  init(data?: SnakeInit): void {
    this.manifest = getGameManifest(data?.gameId ?? 'cyber-snake');
    this.baseStepMs = Number(this.manifest.rules.stepMs ?? 145);
    this.wrapWalls = Boolean(this.manifest.rules.wrapWalls ?? false);
    this.hasObstacles = Boolean(this.manifest.rules.obstacles ?? false);
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

    this.promptText = this.add
      .text(200, 320, 'SWIPE, D-PAD OR ARROWS TO START', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: this.manifest.accentHex,
        backgroundColor: '#0b0f19',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.createVirtualDPad();
    this.bindInputs();
    this.resetGame();
  }

  private createVirtualDPad(): void {
    const buttons: Array<{ label: string; dir: Direction; x: number; y: number }> = [
      { label: '▲', dir: 'UP', x: 200, y: 548 },
      { label: '▼', dir: 'DOWN', x: 200, y: 628 },
      { label: '◀', dir: 'LEFT', x: 132, y: 588 },
      { label: '▶', dir: 'RIGHT', x: 268, y: 588 },
    ];

    for (const btn of buttons) {
      const bg = this.add
        .rectangle(btn.x, btn.y, 58, 40, 0x131a2a, 0.96)
        .setInteractive({ useHandCursor: true });
      bg.setStrokeStyle(1.5, this.manifest.accentColor, 0.65);

      this.add
        .text(btn.x, btn.y, btn.label, {
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '18px',
          fontStyle: 'bold',
          color: this.manifest.accentHex,
        })
        .setOrigin(0.5);

      bg.on(
        'pointerdown',
        (
          _pointer: Phaser.Input.Pointer,
          _localX: number,
          _localY: number,
          event: Phaser.Types.Input.EventData
        ) => {
          event.stopPropagation();
          bg.setFillStyle(this.manifest.accentColor, 0.35);
          this.queueDirection(btn.dir);
        }
      );

      bg.on('pointerup', () => bg.setFillStyle(0x131a2a, 0.96));
      bg.on('pointerout', () => bg.setFillStyle(0x131a2a, 0.96));
    }

    this.add
      .text(200, 675, this.manifest.controlsHint, {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '10px',
        color: '#64748b',
      })
      .setOrigin(0.5);
  }

  private bindInputs(): void {
    const bindings: Array<[string, Direction]> = [
      ['UP', 'UP'],
      ['W', 'UP'],
      ['DOWN', 'DOWN'],
      ['S', 'DOWN'],
      ['LEFT', 'LEFT'],
      ['A', 'LEFT'],
      ['RIGHT', 'RIGHT'],
      ['D', 'RIGHT'],
    ];

    bindings.forEach(([key, dir]) => {
      this.input.keyboard?.on(`keydown-${key}`, () => {
        if (this.hud.isGameOverVisible() || this.isGameOver) return;
        this.queueDirection(dir);
      });
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.worldY < 72 || pointer.worldY > 515 || this.hud.isGameOverVisible() || this.isGameOver) {
        return;
      }
      this.swipeStartX = pointer.worldX;
      this.swipeStartY = pointer.worldY;
      this.isSwiping = true;
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.isSwiping) return;
      this.isSwiping = false;

      const dx = pointer.worldX - this.swipeStartX;
      const dy = pointer.worldY - this.swipeStartY;
      if (Math.hypot(dx, dy) < 20) {
        if (!this.isPlaying && !this.isGameOver) {
          this.startPlaying();
        }
        return;
      }

      if (Math.abs(dx) > Math.abs(dy)) {
        this.queueDirection(dx > 0 ? 'RIGHT' : 'LEFT');
      } else {
        this.queueDirection(dy > 0 ? 'DOWN' : 'UP');
      }
    });
  }

  private startPlaying(): void {
    this.isPlaying = true;
    this.promptText.setVisible(false);
  }

  private queueDirection(dir: Direction): void {
    if (this.isGameOver || this.hud.isGameOverVisible()) return;
    if (!this.isPlaying) {
      this.startPlaying();
    }

    const lastScheduled =
      this.dirQueue.length > 0 ? this.dirQueue[this.dirQueue.length - 1] : this.currentDir;

    if (dir === lastScheduled || this.isOpposite(dir, lastScheduled)) {
      return;
    }

    if (this.dirQueue.length < 2) {
      this.dirQueue.push(dir);
    }
  }

  private isOpposite(a: Direction, b: Direction): boolean {
    return (
      (a === 'UP' && b === 'DOWN') ||
      (a === 'DOWN' && b === 'UP') ||
      (a === 'LEFT' && b === 'RIGHT') ||
      (a === 'RIGHT' && b === 'LEFT')
    );
  }

  private resetGame(): void {
    this.snake = [
      { x: 6, y: 9 },
      { x: 5, y: 9 },
      { x: 4, y: 9 },
    ];
    this.obstacles = this.hasObstacles
      ? [
          { x: 4, y: 4 },
          { x: 11, y: 4 },
          { x: 4, y: 13 },
          { x: 11, y: 13 },
          { x: 8, y: 5 },
          { x: 8, y: 12 },
        ]
      : [];
    this.currentDir = 'RIGHT';
    this.dirQueue = [];
    this.score = 0;
    this.stepTimer = 0;
    this.stepIntervalMs = this.baseStepMs;
    this.isPlaying = false;
    this.isGameOver = false;
    this.hud.setScore(0);
    this.promptText.setText('SWIPE, D-PAD OR ARROWS TO START');
    this.promptText.setVisible(true);
    this.spawnFood();
  }

  private continueGame(): void {
    const keepLength = Math.max(3, Math.min(this.snake.length, 8));
    this.snake = [];
    for (let i = 0; i < keepLength; i++) {
      this.snake.push({ x: Math.max(0, 6 - i), y: 9 });
    }
    this.currentDir = 'RIGHT';
    this.dirQueue = [];
    this.stepTimer = 0;
    this.isPlaying = false;
    this.isGameOver = false;
    this.promptText.setText('REVIVED — SWIPE OR D-PAD TO RESUME');
    this.promptText.setVisible(true);
    if (this.snake.some((seg) => seg.x === this.food.x && seg.y === this.food.y)) {
      this.spawnFood();
    }
  }

  private spawnFood(): void {
    const occupied = new Set([
      ...this.snake.map((s) => `${s.x},${s.y}`),
      ...this.obstacles.map((o) => `${o.x},${o.y}`),
    ]);
    const freeCells: GridPoint[] = [];

    for (let x = 0; x < this.cols; x++) {
      for (let y = 0; y < this.rows; y++) {
        if (!occupied.has(`${x},${y}`)) {
          freeCells.push({ x, y });
        }
      }
    }

    if (freeCells.length > 0) {
      this.food = freeCells[Math.floor(Math.random() * freeCells.length)];
    }
  }

  update(_time: number, delta: number): void {
    if (this.isPlaying && !this.isGameOver && !this.hud.isGameOverVisible()) {
      this.stepTimer += delta;
      if (this.stepTimer >= this.stepIntervalMs) {
        this.stepTimer -= this.stepIntervalMs;
        this.stepSnake();
      }
    }

    this.renderScene();
  }

  private stepSnake(): void {
    if (this.dirQueue.length > 0) {
      this.currentDir = this.dirQueue.shift()!;
    }

    const head = this.snake[0];
    let nextX = head.x;
    let nextY = head.y;

    switch (this.currentDir) {
      case 'UP':
        nextY -= 1;
        break;
      case 'DOWN':
        nextY += 1;
        break;
      case 'LEFT':
        nextX -= 1;
        break;
      case 'RIGHT':
        nextX += 1;
        break;
    }

    if (this.wrapWalls) {
      nextX = (nextX + this.cols) % this.cols;
      nextY = (nextY + this.rows) % this.rows;
    } else if (nextX < 0 || nextX >= this.cols || nextY < 0 || nextY >= this.rows) {
      this.triggerGameOver();
      return;
    }

    if (this.obstacles.some((o) => o.x === nextX && o.y === nextY)) {
      this.triggerGameOver();
      return;
    }

    const ateFood = nextX === this.food.x && nextY === this.food.y;
    const bodyToCheck = ateFood ? this.snake : this.snake.slice(0, -1);

    if (bodyToCheck.some((seg) => seg.x === nextX && seg.y === nextY)) {
      this.triggerGameOver();
      return;
    }

    this.snake.unshift({ x: nextX, y: nextY });

    if (ateFood) {
      this.score += 1;
      this.hud.setScore(this.score);
      this.sfx.playCollect(this.score);
      this.stepIntervalMs = Math.max(62, this.baseStepMs - this.score * 2);
      this.spawnFood();
    } else {
      this.snake.pop();
    }
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

    const boardW = this.cols * this.cellSize;
    const boardH = this.rows * this.cellSize;

    this.graphics.fillStyle(0x0f172a, 0.85);
    this.graphics.fillRect(this.boardX, this.boardY, boardW, boardH);

    this.graphics.lineStyle(1, 0x1e293b, 0.45);
    for (let c = 1; c < this.cols; c++) {
      const lx = this.boardX + c * this.cellSize;
      this.graphics.lineBetween(lx, this.boardY, lx, this.boardY + boardH);
    }
    for (let r = 1; r < this.rows; r++) {
      const ly = this.boardY + r * this.cellSize;
      this.graphics.lineBetween(this.boardX, ly, this.boardX + boardW, ly);
    }

    this.graphics.lineStyle(2, this.manifest.accentColor, this.wrapWalls ? 0.35 : 0.7);
    this.graphics.strokeRect(this.boardX, this.boardY, boardW, boardH);

    // Obstacles
    for (const obs of this.obstacles) {
      const ox = this.boardX + obs.x * this.cellSize + 2;
      const oy = this.boardY + obs.y * this.cellSize + 2;
      this.graphics.fillStyle(0xf43f5e, 0.78);
      this.graphics.fillRoundedRect(ox, oy, this.cellSize - 4, this.cellSize - 4, 3);
    }

    // Food data node
    const fx = this.boardX + this.food.x * this.cellSize + this.cellSize / 2;
    const fy = this.boardY + this.food.y * this.cellSize + this.cellSize / 2;
    this.graphics.fillStyle(0xf43f5e, 0.28);
    this.graphics.fillCircle(fx, fy, 11);
    this.graphics.fillStyle(0xfb7185, 1);
    this.graphics.fillCircle(fx, fy, 6);

    // Snake segments
    this.snake.forEach((seg, idx) => {
      const sx = this.boardX + seg.x * this.cellSize + 2;
      const sy = this.boardY + seg.y * this.cellSize + 2;
      const size = this.cellSize - 4;
      const isHead = idx === 0;

      this.graphics.fillStyle(
        isHead ? 0xf8fafc : this.manifest.accentColor,
        isHead ? 1 : 0.9
      );
      this.graphics.fillRoundedRect(sx, sy, size, size, isHead ? 5 : 4);
    });
  }
}
