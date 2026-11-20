import Phaser from 'phaser';
import { SoundEffects } from '../../audio';
import { GameManifest, getGameManifest } from '../../registry/GameRegistry';
import { StorageManager } from '../../storage';
import { ArcadeHud } from '../../ui/ArcadeHud';

interface PongBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface PongInit {
  gameId?: string;
}

export class CyberPongScene extends Phaser.Scene {
  private manifest!: GameManifest;
  private sfx!: SoundEffects;
  private hud!: ArcadeHud;
  private graphics!: Phaser.GameObjects.Graphics;
  private promptText!: Phaser.GameObjects.Text;

  private readonly boundsLeft = 20;
  private readonly boundsRight = 380;
  private readonly boundsTop = 140;
  private readonly boundsBottom = 640;

  private readonly playerY = 616;
  private readonly aiY = 164;
  private readonly paddleHeight = 12;
  private readonly ballRadius = 7;

  private paddleWidth = 78;
  private aiSkill = 0.65;
  private baseBallSpeed = 265;
  private centerBumper = false;
  private doubleBall = false;

  private playerX = 200;
  private aiX = 200;
  private balls: PongBall[] = [];
  private isLaunched = false;
  private isGameOver = false;
  private score = 0;

  private leftKey?: Phaser.Input.Keyboard.Key;
  private rightKey?: Phaser.Input.Keyboard.Key;
  private aKey?: Phaser.Input.Keyboard.Key;
  private dKey?: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: 'CyberPongScene' });
  }

  init(data?: PongInit): void {
    this.manifest = getGameManifest(data?.gameId ?? 'cyber-pong');
    this.paddleWidth = Number(this.manifest.rules.paddleWidth ?? 78);
    this.aiSkill = Number(this.manifest.rules.aiSkill ?? 0.65);
    this.baseBallSpeed = Number(this.manifest.rules.ballSpeed ?? 265);
    this.centerBumper = Boolean(this.manifest.rules.centerBumper ?? false);
    this.doubleBall = Boolean(this.manifest.rules.doubleBall ?? false);
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
      .text(200, 445, 'TAP OR SPACE TO SERVE', {
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

    this.leftKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.rightKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.aKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.dKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.D);

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isGameOver || this.hud.isGameOverVisible()) return;
      if (pointer.isDown || pointer.wasTouch === false) {
        this.setPlayerX(pointer.worldX);
      }
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.worldY < 72 || this.hud.isGameOverVisible() || this.isGameOver) return;
      this.setPlayerX(pointer.worldX);
      if (!this.isLaunched) {
        this.launchBalls();
      }
    });

    this.input.keyboard?.on('keydown-SPACE', () => {
      if (this.hud.isGameOverVisible() || this.isGameOver) return;
      if (!this.isLaunched) {
        this.launchBalls();
      }
    });

    this.resetGame();
  }

  private setPlayerX(targetX: number): void {
    const halfW = this.paddleWidth / 2;
    this.playerX = Phaser.Math.Clamp(
      targetX,
      this.boundsLeft + halfW + 2,
      this.boundsRight - halfW - 2
    );
  }

  private spawnServeBalls(): void {
    this.isLaunched = false;
    this.balls = [{ x: 200, y: 390, vx: 0, vy: 0 }];
    if (this.doubleBall) {
      this.balls.push({ x: 200, y: 340, vx: 0, vy: 0 });
    }
    this.promptText.setVisible(true);
  }

  private launchBalls(): void {
    this.isLaunched = true;
    this.promptText.setVisible(false);
    this.balls.forEach((b, idx) => {
      const dirY = idx % 2 === 0 ? 1 : -1;
      const angle = Phaser.Math.FloatBetween(-0.55, 0.55);
      b.vx = Math.sin(angle) * this.baseBallSpeed;
      b.vy = Math.cos(angle) * this.baseBallSpeed * dirY;
    });
    this.sfx.playBounce(1.1);
  }

  private resetGame(): void {
    this.score = 0;
    this.playerX = 200;
    this.aiX = 200;
    this.isGameOver = false;
    this.hud.setScore(0);
    this.promptText.setText('TAP OR SPACE TO SERVE');
    this.spawnServeBalls();
  }

  private continueGame(): void {
    this.isGameOver = false;
    this.promptText.setText('REVIVED — TAP OR SPACE TO SERVE');
    this.spawnServeBalls();
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.035);

    if (!this.isGameOver && !this.hud.isGameOverVisible()) {
      const moveSpeed = 360;
      if (this.leftKey?.isDown || this.aKey?.isDown) {
        this.setPlayerX(this.playerX - moveSpeed * dt);
      } else if (this.rightKey?.isDown || this.dKey?.isDown) {
        this.setPlayerX(this.playerX + moveSpeed * dt);
      }

      if (this.isLaunched) {
        this.updateAi(dt);
        this.updateBalls(dt);
      }
    }

    this.renderScene();
  }

  private updateAi(dt: number): void {
    let targetBall = this.balls[0];
    let bestY = Infinity;
    for (const b of this.balls) {
      if (b.vy < 0 && b.y < bestY) {
        bestY = b.y;
        targetBall = b;
      }
    }

    const targetX = targetBall ? targetBall.x : 200;
    const aiMaxSpeed = 165 + this.aiSkill * 240;
    const diff = targetX - this.aiX;
    if (Math.abs(diff) > 3) {
      this.aiX += Phaser.Math.Clamp(diff, -aiMaxSpeed * dt, aiMaxSpeed * dt);
    }
    this.aiX = Phaser.Math.Clamp(this.aiX, this.boundsLeft + 38, this.boundsRight - 38);
  }

  private updateBalls(dt: number): void {
    for (const b of this.balls) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.x - this.ballRadius <= this.boundsLeft) {
        b.x = this.boundsLeft + this.ballRadius;
        b.vx = Math.abs(b.vx);
        this.sfx.playBounce(0.85);
      } else if (b.x + this.ballRadius >= this.boundsRight) {
        b.x = this.boundsRight - this.ballRadius;
        b.vx = -Math.abs(b.vx);
        this.sfx.playBounce(0.85);
      }

      // Optional center bumper
      if (this.centerBumper) {
        const dist = Phaser.Math.Distance.Between(b.x, b.y, 200, 390);
        if (dist < 22 + this.ballRadius) {
          const nx = (b.x - 200) / (dist || 1);
          const ny = (b.y - 390) / (dist || 1);
          const speed = Math.hypot(b.vx, b.vy);
          b.x = 200 + nx * (23 + this.ballRadius);
          b.y = 390 + ny * (23 + this.ballRadius);
          b.vx = nx * speed;
          b.vy = ny * speed;
          this.sfx.playBounce(1.4);
        }
      }

      // Player paddle collision
      const halfP = this.paddleWidth / 2;
      if (
        b.vy > 0 &&
        b.y + this.ballRadius >= this.playerY - this.paddleHeight / 2 &&
        b.y - this.ballRadius <= this.playerY + this.paddleHeight / 2 &&
        b.x + this.ballRadius >= this.playerX - halfP &&
        b.x - this.ballRadius <= this.playerX + halfP
      ) {
        b.y = this.playerY - this.paddleHeight / 2 - this.ballRadius;
        const offset = Phaser.Math.Clamp((b.x - this.playerX) / halfP, -0.9, 0.9);
        const speed = Math.min(460, Math.hypot(b.vx, b.vy) * 1.03);
        const angle = -Math.PI / 2 + offset * (Math.PI * 0.34);
        b.vx = Math.cos(angle) * speed;
        b.vy = Math.sin(angle) * speed;
        this.score += 1;
        this.hud.setScore(this.score);
        this.sfx.playBounce(1.1);
      }

      // AI paddle collision
      const halfAi = 36;
      if (
        b.vy < 0 &&
        b.y - this.ballRadius <= this.aiY + this.paddleHeight / 2 &&
        b.y + this.ballRadius >= this.aiY - this.paddleHeight / 2 &&
        b.x + this.ballRadius >= this.aiX - halfAi &&
        b.x - this.ballRadius <= this.aiX + halfAi
      ) {
        b.y = this.aiY + this.paddleHeight / 2 + this.ballRadius;
        const offset = Phaser.Math.Clamp((b.x - this.aiX) / halfAi, -0.85, 0.85);
        const speed = Math.hypot(b.vx, b.vy);
        const angle = Math.PI / 2 - offset * (Math.PI * 0.32);
        b.vx = Math.cos(angle) * speed;
        b.vy = Math.sin(angle) * speed;
        this.sfx.playBounce(0.95);
      }

      // Scored past AI!
      if (b.y < this.boundsTop) {
        this.score += 5;
        this.hud.setScore(this.score);
        this.sfx.playCollect(3);
        b.x = 200;
        b.y = 390;
        const angle = Phaser.Math.FloatBetween(-0.5, 0.5);
        b.vx = Math.sin(angle) * this.baseBallSpeed;
        b.vy = Math.cos(angle) * this.baseBallSpeed;
      }

      // Missed by player
      if (b.y > this.boundsBottom + 10) {
        this.isGameOver = true;
        this.sfx.playGameOver();
        this.cameras.main.shake(150, 0.012);
        this.hud.showGameOver(this.score);
        return;
      }
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
    this.graphics.lineStyle(2, this.manifest.accentColor, 0.5);
    this.graphics.strokeRect(
      this.boundsLeft,
      this.boundsTop,
      this.boundsRight - this.boundsLeft,
      this.boundsBottom - this.boundsTop
    );

    // Center court dashed line
    this.graphics.lineStyle(1.5, 0x334155, 0.6);
    for (let x = 28; x < 372; x += 18) {
      this.graphics.lineBetween(x, 390, x + 10, 390);
    }

    if (this.centerBumper) {
      this.graphics.fillStyle(0xf59e0b, 0.25);
      this.graphics.fillCircle(200, 390, 26);
      this.graphics.fillStyle(0xfbbf24, 1);
      this.graphics.fillCircle(200, 390, 18);
    }

    // AI paddle
    this.graphics.fillStyle(0xf43f5e, 1);
    this.graphics.fillRoundedRect(
      this.aiX - 36,
      this.aiY - this.paddleHeight / 2,
      72,
      this.paddleHeight,
      5
    );

    // Player paddle
    this.graphics.fillStyle(this.manifest.accentColor, 0.35);
    this.graphics.fillRoundedRect(
      this.playerX - this.paddleWidth / 2 - 3,
      this.playerY - this.paddleHeight / 2 - 2,
      this.paddleWidth + 6,
      this.paddleHeight + 4,
      6
    );
    this.graphics.fillStyle(0xf8fafc, 1);
    this.graphics.fillRoundedRect(
      this.playerX - this.paddleWidth / 2,
      this.playerY - this.paddleHeight / 2,
      this.paddleWidth,
      this.paddleHeight,
      5
    );

    // Balls
    for (const b of this.balls) {
      this.graphics.fillStyle(this.manifest.accentColor, 0.35);
      this.graphics.fillCircle(b.x, b.y, this.ballRadius + 5);
      this.graphics.fillStyle(0xf8fafc, 1);
      this.graphics.fillCircle(b.x, b.y, this.ballRadius);
    }
  }
}
