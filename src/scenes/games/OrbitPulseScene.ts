import Phaser from 'phaser';
import { SoundEffects } from '../../audio';
import { GameManifest, getGameManifest } from '../../registry/GameRegistry';
import { StorageManager } from '../../storage';
import { ArcadeHud } from '../../ui/ArcadeHud';

interface HazardPulse {
  angle: number;
  speed: number;
  ringIndex: number;
  radius: number;
}

interface OrbitSceneInit {
  gameId?: string;
}

export class OrbitPulseScene extends Phaser.Scene {
  private manifest!: GameManifest;
  private sfx!: SoundEffects;
  private hud!: ArcadeHud;

  private readonly centerX = 200;
  private readonly centerY = 370;

  private ringRadii: number[] = [130, 78];
  private activeRingIndex = 0;
  private baseSpeed = 2.1;
  private hazardBaseSpeed = 1.45;
  private maxHazards = 4;
  private reverseOnCollect = false;

  private isPlaying = false;
  private isGameOver = false;
  private spinDirection = 1;

  private playerAngle = -Math.PI / 2;
  private playerAngularSpeed = 2.1;
  private currentOrbitRadius = 130;

  private orbAngle = Math.PI / 2;
  private orbRingIndex = 0;

  private hazards: HazardPulse[] = [];
  private score = 0;

  private graphics!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;
  private subStatusText!: Phaser.GameObjects.Text;

  private trailPoints: Array<{ x: number; y: number; alpha: number }> = [];

  constructor() {
    super({ key: 'OrbitPulseScene' });
  }

  init(data?: OrbitSceneInit): void {
    this.manifest = getGameManifest(data?.gameId ?? 'orbit-pulse');
    const rings = Number(this.manifest.rules.rings ?? 2);
    this.ringRadii = rings >= 3 ? [136, 94, 52] : [130, 78];
    this.baseSpeed = Number(this.manifest.rules.baseSpeed ?? 2.1);
    this.hazardBaseSpeed = Number(this.manifest.rules.hazardSpeed ?? 1.45);
    this.maxHazards = Number(this.manifest.rules.maxHazards ?? 4);
    this.reverseOnCollect = Boolean(this.manifest.rules.reverseOnCollect ?? false);
  }

  create(): void {
    const saveData = StorageManager.load();
    this.sfx = new SoundEffects(saveData.muted);
    this.hud = new ArcadeHud(this, this.manifest.id, this.sfx, {
      onRestart: () => {
        this.resetRoundState();
      },
      onContinue: () => {
        this.continueRound();
      },
    });

    this.graphics = this.add.graphics();

    this.statusText = this.add
      .text(this.centerX, 575, 'TAP OR SPACE TO START', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: this.manifest.accentHex,
      })
      .setOrigin(0.5);

    this.subStatusText = this.add
      .text(this.centerX, 605, this.manifest.controlsHint, {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '11px',
        color: '#94a3b8',
      })
      .setOrigin(0.5);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.worldY < 72 || this.hud.isGameOverVisible()) {
        return;
      }
      this.handlePrimaryAction();
    });

    this.input.keyboard?.on('keydown-SPACE', () => {
      if (this.hud.isGameOverVisible()) return;
      this.handlePrimaryAction();
    });

    this.input.keyboard?.on('keydown-UP', () => {
      if (this.hud.isGameOverVisible()) return;
      this.handlePrimaryAction();
    });

    this.resetRoundState();
  }

  private handlePrimaryAction(): void {
    if (this.isGameOver) return;

    if (!this.isPlaying) {
      this.isPlaying = true;
      this.statusText.setText(
        this.ringRadii.length > 2 ? 'TAP TO CYCLE 3 RINGS' : 'TAP TO SWITCH ORBIT'
      );
      this.subStatusText.setText(this.manifest.subtitle);
      this.sfx.playSwitch(this.activeRingIndex > 0);
      return;
    }

    this.activeRingIndex = (this.activeRingIndex + 1) % this.ringRadii.length;
    this.sfx.playSwitch(this.activeRingIndex > 0);
  }

  private resetRoundState(): void {
    this.isPlaying = false;
    this.isGameOver = false;
    this.score = 0;
    this.spinDirection = 1;
    this.activeRingIndex = 0;
    this.currentOrbitRadius = this.ringRadii[0];
    this.playerAngle = -Math.PI / 2;
    this.playerAngularSpeed = this.baseSpeed;
    this.trailPoints = [];

    this.orbAngle = Math.PI / 2;
    this.orbRingIndex = 0;

    this.hazards = [
      {
        angle: Math.PI,
        speed: -this.hazardBaseSpeed,
        ringIndex: 0,
        radius: 9,
      },
    ];

    this.hud.setScore(0);
    this.statusText.setText('TAP OR SPACE TO START');
    this.subStatusText.setText(this.manifest.controlsHint);
  }

  private continueRound(): void {
    this.isGameOver = false;
    this.isPlaying = false;
    this.trailPoints = [];
    this.hazards.forEach((hazard, idx) => {
      hazard.angle = Phaser.Math.Angle.Wrap(this.playerAngle + Math.PI + idx * 0.45);
    });
    this.statusText.setText('REVIVED — TAP OR SPACE TO RESUME');
    this.subStatusText.setText(`Continuing run at score ${this.score}`);
  }

  private spawnOrb(): void {
    const offset = Phaser.Math.FloatBetween(Math.PI * 0.55, Math.PI * 1.45);
    this.orbAngle = Phaser.Math.Angle.Wrap(this.playerAngle + offset);
    this.orbRingIndex = Math.floor(Math.random() * this.ringRadii.length);
  }

  private updateDifficulty(): void {
    this.playerAngularSpeed = Math.min(this.baseSpeed + this.score * 0.035, 3.8);

    const desiredHazards = Math.min(1 + Math.floor(this.score / 4), this.maxHazards);
    while (this.hazards.length < desiredHazards) {
      const spawnAngle = Phaser.Math.Angle.Wrap(this.playerAngle + Math.PI);
      const ringIndex = this.hazards.length % this.ringRadii.length;
      const baseSpeed =
        (this.hazardBaseSpeed + this.hazards.length * 0.2) *
        (this.hazards.length % 2 === 0 ? -1 : 1);
      this.hazards.push({
        angle: spawnAngle,
        speed: baseSpeed,
        ringIndex,
        radius: 9,
      });
    }
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;

    const targetRadius = this.ringRadii[this.activeRingIndex];
    this.currentOrbitRadius = Phaser.Math.Linear(
      this.currentOrbitRadius,
      targetRadius,
      Math.min(1, dt * 18)
    );

    if (this.isPlaying) {
      const speedMultiplier = 1 + this.activeRingIndex * 0.16;
      this.playerAngle = Phaser.Math.Angle.Wrap(
        this.playerAngle +
          this.spinDirection * this.playerAngularSpeed * speedMultiplier * dt
      );

      const playerX = this.centerX + Math.cos(this.playerAngle) * this.currentOrbitRadius;
      const playerY = this.centerY + Math.sin(this.playerAngle) * this.currentOrbitRadius;

      this.trailPoints.unshift({ x: playerX, y: playerY, alpha: 0.7 });
      if (this.trailPoints.length > 16) {
        this.trailPoints.pop();
      }

      const orbRadius = this.ringRadii[this.orbRingIndex];
      const orbX = this.centerX + Math.cos(this.orbAngle) * orbRadius;
      const orbY = this.centerY + Math.sin(this.orbAngle) * orbRadius;

      const distToOrb = Phaser.Math.Distance.Between(playerX, playerY, orbX, orbY);
      if (distToOrb < 20) {
        this.score += 1;
        this.hud.setScore(this.score);
        this.sfx.playCollect(this.score);
        if (this.reverseOnCollect) {
          this.spinDirection *= -1;
        }
        this.spawnOrb();
        this.updateDifficulty();
      }

      for (const hazard of this.hazards) {
        hazard.angle = Phaser.Math.Angle.Wrap(hazard.angle + hazard.speed * dt);
        const hRadius = this.ringRadii[hazard.ringIndex];
        const hx = this.centerX + Math.cos(hazard.angle) * hRadius;
        const hy = this.centerY + Math.sin(hazard.angle) * hRadius;

        const distToHazard = Phaser.Math.Distance.Between(playerX, playerY, hx, hy);
        if (distToHazard < 16) {
          this.triggerGameOver();
          break;
        }
      }
    }

    for (let i = 0; i < this.trailPoints.length; i++) {
      this.trailPoints[i].alpha *= 0.88;
    }

    this.renderScene();
  }

  private triggerGameOver(): void {
    this.isPlaying = false;
    this.isGameOver = true;
    this.sfx.playGameOver();
    this.cameras.main.shake(160, 0.012);
    this.hud.showGameOver(this.score);
  }

  private renderScene(): void {
    this.graphics.clear();

    this.graphics.fillStyle(0x1e293b, 0.6);
    this.graphics.fillCircle(this.centerX, this.centerY, 22);

    this.graphics.lineStyle(2, 0x1e293b, 1);
    for (const r of this.ringRadii) {
      this.graphics.strokeCircle(this.centerX, this.centerY, r);
    }

    const activeTrackRadius = this.ringRadii[this.activeRingIndex];
    this.graphics.lineStyle(2.5, this.manifest.accentColor, 0.45);
    this.graphics.strokeCircle(this.centerX, this.centerY, activeTrackRadius);

    for (const pt of this.trailPoints) {
      this.graphics.fillStyle(this.manifest.accentColor, pt.alpha * 0.45);
      this.graphics.fillCircle(pt.x, pt.y, 6);
    }

    const orbTrackRadius = this.ringRadii[this.orbRingIndex];
    const orbX = this.centerX + Math.cos(this.orbAngle) * orbTrackRadius;
    const orbY = this.centerY + Math.sin(this.orbAngle) * orbTrackRadius;

    this.graphics.fillStyle(0x22d3ee, 0.25);
    this.graphics.fillCircle(orbX, orbY, 14);
    this.graphics.fillStyle(0xa5f3fc, 1);
    this.graphics.fillCircle(orbX, orbY, 7);

    for (const hazard of this.hazards) {
      const hRadius = this.ringRadii[hazard.ringIndex];
      const hx = this.centerX + Math.cos(hazard.angle) * hRadius;
      const hy = this.centerY + Math.sin(hazard.angle) * hRadius;

      this.graphics.fillStyle(0xf43f5e, 0.28);
      this.graphics.fillCircle(hx, hy, hazard.radius + 6);
      this.graphics.fillStyle(0xf43f5e, 1);
      this.graphics.fillCircle(hx, hy, hazard.radius);
    }

    const playerX = this.centerX + Math.cos(this.playerAngle) * this.currentOrbitRadius;
    const playerY = this.centerY + Math.sin(this.playerAngle) * this.currentOrbitRadius;

    this.graphics.fillStyle(this.manifest.accentColor, 0.3);
    this.graphics.fillCircle(playerX, playerY, 15);
    this.graphics.fillStyle(0xf8fafc, 1);
    this.graphics.fillCircle(playerX, playerY, 9);
  }
}
