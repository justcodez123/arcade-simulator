import Phaser from 'phaser';
import { SoundEffects } from '../../audio';
import { GameManifest, getGameManifest } from '../../registry/GameRegistry';
import { StorageManager } from '../../storage';
import { ArcadeHud } from '../../ui/ArcadeHud';

interface Brick {
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
  row: number;
  alive: boolean;
}

interface BreakerInit {
  gameId?: string;
}

export class NeonBreakerScene extends Phaser.Scene {
  private manifest!: GameManifest;
  private sfx!: SoundEffects;
  private hud!: ArcadeHud;
  private graphics!: Phaser.GameObjects.Graphics;
  private promptText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;

  private readonly boundsLeft = 20;
  private readonly boundsRight = 380;
  private readonly boundsTop = 135;
  private readonly boundsBottom = 650;

  private readonly paddleY = 620;
  private paddleWidth = 76;
  private readonly paddleHeight = 12;
  private paddleX = 200;

  private readonly ballRadius = 7;
  private ballX = 200;
  private ballY = 605;
  private ballVx = 0;
  private ballVy = 0;
  private initialSpeed = 270;
  private baseSpeed = 270;
  private pattern = 'classic';

  private ballLaunched = false;
  private isGameOver = false;
  private score = 0;
  private wave = 1;
  private bricks: Brick[] = [];

  private leftKey?: Phaser.Input.Keyboard.Key;
  private rightKey?: Phaser.Input.Keyboard.Key;
  private aKey?: Phaser.Input.Keyboard.Key;
  private dKey?: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: 'NeonBreakerScene' });
  }

  init(data?: BreakerInit): void {
    this.manifest = getGameManifest(data?.gameId ?? 'neon-breaker');
    this.pattern = String(this.manifest.rules.pattern ?? 'classic');
    this.initialSpeed = Number(this.manifest.rules.ballSpeed ?? 270);
    this.paddleWidth = Number(this.manifest.rules.paddleWidth ?? 76);
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

    this.waveText = this.add
      .text(200, 148, 'WAVE 1', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: this.manifest.accentHex,
      })
      .setOrigin(0.5);

    this.promptText = this.add
      .text(200, 440, 'TAP OR PRESS SPACE TO LAUNCH', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#e2e8f0',
      })
      .setOrigin(0.5);

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
        this.setPaddleX(pointer.worldX);
      }
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.worldY < 72 || this.hud.isGameOverVisible() || this.isGameOver) return;
      this.setPaddleX(pointer.worldX);
      if (!this.ballLaunched) {
        this.launchBall();
      }
    });

    this.input.keyboard?.on('keydown-SPACE', () => {
      if (this.hud.isGameOverVisible() || this.isGameOver) return;
      if (!this.ballLaunched) {
        this.launchBall();
      }
    });

    this.resetGame();
  }

  private setPaddleX(targetX: number): void {
    const halfW = this.paddleWidth / 2;
    this.paddleX = Phaser.Math.Clamp(
      targetX,
      this.boundsLeft + halfW + 2,
      this.boundsRight - halfW - 2
    );
  }

  private resetGame(): void {
    this.score = 0;
    this.wave = 1;
    this.baseSpeed = this.initialSpeed;
    this.isGameOver = false;
    this.paddleX = 200;
    this.hud.setScore(0);
    this.waveText.setText('WAVE 1');
    this.spawnBrickWave();
    this.attachBallToPaddle();
  }

  private continueGame(): void {
    this.isGameOver = false;
    this.attachBallToPaddle();
    this.promptText.setText(`REVIVED (WAVE ${this.wave}) — TAP OR SPACE TO LAUNCH`);
  }

  private attachBallToPaddle(): void {
    this.ballLaunched = false;
    this.ballX = this.paddleX;
    this.ballY = this.paddleY - this.paddleHeight / 2 - this.ballRadius - 2;
    this.ballVx = 0;
    this.ballVy = 0;
    this.promptText.setVisible(true);
    this.promptText.setText(`WAVE ${this.wave} — TAP OR SPACE TO LAUNCH`);
  }

  private launchBall(): void {
    this.ballLaunched = true;
    this.promptText.setVisible(false);
    const angle = Phaser.Math.FloatBetween(-Math.PI * 0.68, -Math.PI * 0.32);
    this.ballVx = Math.cos(angle) * this.baseSpeed;
    this.ballVy = Math.sin(angle) * this.baseSpeed;
    this.sfx.playBounce(1.1);
  }

  private shouldPlaceBrick(row: number, col: number): boolean {
    if (this.pattern === 'fortress') {
      return row === 0 || row === 4 || col === 0 || col === 5 || (row === 2 && (col === 2 || col === 3));
    }
    if (this.pattern === 'pyramid') {
      return col >= Math.floor(row / 2) && col <= 5 - Math.floor(row / 2);
    }
    if (this.pattern === 'diamond') {
      return Math.abs(row - 2) + Math.abs(col - 2.5) <= 2.6;
    }
    if (this.pattern === 'checker') {
      return (row + col) % 2 === 0;
    }
    return true;
  }

  private spawnBrickWave(): void {
    const tierColors = [0xf43f5e, 0xf59e0b, 0xa855f7, 0x38bdf8, 0x10b981];
    this.bricks = [];

    const cols = 6;
    const rows = 5;
    const brickWidth = 52;
    const brickHeight = 16;
    const gapX = 6;
    const gapY = 6;
    const totalW = cols * brickWidth + (cols - 1) * gapX;
    const startX = 200 - totalW / 2 + brickWidth / 2;
    const startY = 175;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (!this.shouldPlaceBrick(row, col)) continue;
        this.bricks.push({
          x: startX + col * (brickWidth + gapX),
          y: startY + row * (brickHeight + gapY),
          width: brickWidth,
          height: brickHeight,
          color: tierColors[row % tierColors.length],
          row,
          alive: true,
        });
      }
    }
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.035);

    if (!this.isGameOver && !this.hud.isGameOverVisible()) {
      const moveSpeed = 360;
      if (this.leftKey?.isDown || this.aKey?.isDown) {
        this.setPaddleX(this.paddleX - moveSpeed * dt);
      } else if (this.rightKey?.isDown || this.dKey?.isDown) {
        this.setPaddleX(this.paddleX + moveSpeed * dt);
      }

      if (!this.ballLaunched) {
        this.ballX = this.paddleX;
        this.ballY = this.paddleY - this.paddleHeight / 2 - this.ballRadius - 2;
      } else {
        this.stepBallPhysics(dt);
      }
    }

    this.renderScene();
  }

  private stepBallPhysics(dt: number): void {
    this.ballX += this.ballVx * dt;
    this.ballY += this.ballVy * dt;

    if (this.ballX - this.ballRadius <= this.boundsLeft) {
      this.ballX = this.boundsLeft + this.ballRadius;
      this.ballVx = Math.abs(this.ballVx);
      this.sfx.playBounce(0.85);
    } else if (this.ballX + this.ballRadius >= this.boundsRight) {
      this.ballX = this.boundsRight - this.ballRadius;
      this.ballVx = -Math.abs(this.ballVx);
      this.sfx.playBounce(0.85);
    }

    if (this.ballY - this.ballRadius <= this.boundsTop) {
      this.ballY = this.boundsTop + this.ballRadius;
      this.ballVy = Math.abs(this.ballVy);
      this.sfx.playBounce(0.95);
    }

    const paddleTop = this.paddleY - this.paddleHeight / 2;
    const paddleBottom = this.paddleY + this.paddleHeight / 2;
    const paddleLeft = this.paddleX - this.paddleWidth / 2;
    const paddleRight = this.paddleX + this.paddleWidth / 2;

    if (
      this.ballVy > 0 &&
      this.ballY + this.ballRadius >= paddleTop &&
      this.ballY - this.ballRadius <= paddleBottom &&
      this.ballX + this.ballRadius >= paddleLeft &&
      this.ballX - this.ballRadius <= paddleRight
    ) {
      this.ballY = paddleTop - this.ballRadius;
      const offset = Phaser.Math.Clamp(
        (this.ballX - this.paddleX) / (this.paddleWidth / 2),
        -0.95,
        0.95
      );
      const speed = Math.hypot(this.ballVx, this.ballVy);
      const bounceAngle = -Math.PI / 2 + offset * (Math.PI * 0.34);
      this.ballVx = Math.cos(bounceAngle) * speed;
      this.ballVy = Math.sin(bounceAngle) * speed;
      this.sfx.playBounce(1.0);
    }

    let aliveCount = 0;
    for (const brick of this.bricks) {
      if (!brick.alive) continue;
      aliveCount++;

      const halfW = brick.width / 2;
      const halfH = brick.height / 2;
      const closestX = Phaser.Math.Clamp(this.ballX, brick.x - halfW, brick.x + halfW);
      const closestY = Phaser.Math.Clamp(this.ballY, brick.y - halfH, brick.y + halfH);

      const dx = this.ballX - closestX;
      const dy = this.ballY - closestY;

      if (dx * dx + dy * dy <= this.ballRadius * this.ballRadius) {
        brick.alive = false;
        aliveCount--;

        const overlapLeft = Math.abs(this.ballX - (brick.x - halfW));
        const overlapRight = Math.abs(brick.x + halfW - this.ballX);
        const overlapTop = Math.abs(this.ballY - (brick.y - halfH));
        const overlapBottom = Math.abs(brick.y + halfH - this.ballY);
        const minOverlapX = Math.min(overlapLeft, overlapRight);
        const minOverlapY = Math.min(overlapTop, overlapBottom);

        if (minOverlapX < minOverlapY) {
          this.ballVx = -this.ballVx;
        } else {
          this.ballVy = -this.ballVy;
        }

        this.score += 1;
        this.hud.setScore(this.score);
        this.sfx.playBounce(1.25 + (4 - brick.row) * 0.14);
        break;
      }
    }

    if (aliveCount === 0) {
      this.score += 10;
      this.wave += 1;
      this.baseSpeed = Math.min(this.initialSpeed + (this.wave - 1) * 24, 440);
      this.hud.setScore(this.score);
      this.waveText.setText(`WAVE ${this.wave}`);
      this.sfx.playCollect(this.wave);
      this.spawnBrickWave();
      this.attachBallToPaddle();
      return;
    }

    if (this.ballY - this.ballRadius > this.boundsBottom + 10) {
      this.isGameOver = true;
      this.sfx.playGameOver();
      this.cameras.main.shake(150, 0.01);
      this.hud.showGameOver(this.score);
    }
  }

  private renderScene(): void {
    this.graphics.clear();

    this.graphics.fillStyle(0x0f172a, 0.55);
    this.graphics.fillRect(
      this.boundsLeft,
      this.boundsTop,
      this.boundsRight - this.boundsLeft,
      this.boundsBottom - this.boundsTop
    );
    this.graphics.lineStyle(2, this.manifest.accentColor, 0.55);
    this.graphics.strokeRect(
      this.boundsLeft,
      this.boundsTop,
      this.boundsRight - this.boundsLeft,
      this.boundsBottom - this.boundsTop
    );

    for (const brick of this.bricks) {
      if (!brick.alive) continue;
      this.graphics.fillStyle(brick.color, 0.92);
      this.graphics.fillRoundedRect(
        brick.x - brick.width / 2,
        brick.y - brick.height / 2,
        brick.width,
        brick.height,
        3
      );
      this.graphics.lineStyle(1, 0xffffff, 0.25);
      this.graphics.strokeRoundedRect(
        brick.x - brick.width / 2,
        brick.y - brick.height / 2,
        brick.width,
        brick.height,
        3
      );
    }

    this.graphics.fillStyle(this.manifest.accentColor, 0.35);
    this.graphics.fillRoundedRect(
      this.paddleX - this.paddleWidth / 2 - 3,
      this.paddleY - this.paddleHeight / 2 - 2,
      this.paddleWidth + 6,
      this.paddleHeight + 4,
      6
    );
    this.graphics.fillStyle(0xf8fafc, 1);
    this.graphics.fillRoundedRect(
      this.paddleX - this.paddleWidth / 2,
      this.paddleY - this.paddleHeight / 2,
      this.paddleWidth,
      this.paddleHeight,
      5
    );

    this.graphics.fillStyle(0x38bdf8, 0.35);
    this.graphics.fillCircle(this.ballX, this.ballY, this.ballRadius + 5);
    this.graphics.fillStyle(0xf8fafc, 1);
    this.graphics.fillCircle(this.ballX, this.ballY, this.ballRadius);
  }
}
