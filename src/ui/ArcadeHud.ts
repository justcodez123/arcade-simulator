import Phaser from 'phaser';
import { SoundEffects } from '../audio';
import {
  GameManifest,
  getGameManifest,
  getMedalForScore,
} from '../registry/GameRegistry';
import { StorageManager } from '../storage';
import { EngagementManager } from '../systems/EngagementManager';
import { createGlassButton, drawGlassCard } from './UiTheme';

export interface ArcadeHudOptions {
  onRestart?: () => void;
  onContinue?: () => void;
}

export class ArcadeHud {
  private readonly scene: Phaser.Scene;
  private readonly gameId: string;
  private readonly sfx: SoundEffects;
  private readonly manifest: GameManifest;
  private readonly onRestart?: () => void;
  private readonly onContinue?: () => void;

  private bestText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private gameOverElements: Phaser.GameObjects.GameObject[] = [];
  private gameOverVisible = false;

  constructor(
    scene: Phaser.Scene,
    gameId: string,
    sfx: SoundEffects,
    options?: ArcadeHudOptions
  ) {
    this.scene = scene;
    this.gameId = gameId;
    this.sfx = sfx;
    this.manifest = getGameManifest(gameId);
    this.onRestart = options?.onRestart;
    this.onContinue = options?.onContinue;

    this.createTopBar();
    this.bindEscapeKey();

    if (StorageManager.getIap().crtScanlinesEnabled) {
      this.renderCrtOverlay();
    }
  }

  private renderCrtOverlay(): void {
    const g = this.scene.add.graphics().setDepth(150);
    g.lineStyle(1, 0x000000, 0.2);
    for (let y = 0; y < 700; y += 4) {
      g.lineBetween(0, y, 400, y);
    }
  }

  private createTopBar(): void {
    const stats = StorageManager.getGameStats(this.gameId);

    // Top console bezel background (y: 0..68)
    const barG = this.scene.add.graphics().setDepth(100);
    barG.fillStyle(0x090e1c, 0.94);
    barG.fillRect(0, 0, 400, 68);
    barG.lineStyle(1.5, this.manifest.accentColor, 0.45);
    barG.lineBetween(0, 68, 400, 68);

    // Top-left HUB pill button
    createGlassButton(this.scene, 48, 34, 66, 30, '← HUB', {
      bgColor: 0x131d33,
      hoverBgColor: 0x1e293b,
      textColor: '#e2e8f0',
      fontSize: '11.5px',
      radius: 10,
      borderColor: 0x334155,
      borderAlpha: 0.65,
      depth: 102,
      onClick: () => {
        this.sfx.playBack();
        this.scene.scene.start('ArcadeHubScene');
      },
    });

    // Top-center game title & personal best
    this.scene.add
      .text(200, 23, this.manifest.title, {
        fontSize: '13.5px',
        fontStyle: 'bold',
        color: this.manifest.accentHex,
      })
      .setOrigin(0.5)
      .setLetterSpacing(1.2)
      .setDepth(102);

    this.bestText = this.scene.add
      .text(200, 44, `BEST: ${stats.highScore}`, {
        fontSize: '11.5px',
        color: '#94a3b8',
      })
      .setOrigin(0.5)
      .setDepth(102);

    // Top-right SFX toggle pill button
    const sfxBtn = createGlassButton(
      this.scene,
      352,
      34,
      64,
      30,
      this.getSfxLabel(),
      {
        bgColor: 0x131d33,
        hoverBgColor: 0x1e293b,
        textColor: '#e2e8f0',
        fontSize: '11px',
        radius: 10,
        borderColor: 0x334155,
        borderAlpha: 0.65,
        depth: 102,
        onClick: () => {
          const nextMuted = !this.sfx.isMuted();
          this.sfx.setMuted(nextMuted);
          StorageManager.setMuted(nextMuted);
          sfxBtn.setLabel(this.getSfxLabel());
          if (!nextMuted) {
            this.sfx.playMenuSelect();
            this.sfx.syncBgmState();
          }
        },
      }
    );

    // Live Score counter
    this.scoreText = this.scene.add
      .text(200, 102, '0', {
        fontSize: '40px',
        fontStyle: 'bold',
        color: '#f8fafc',
      })
      .setOrigin(0.5)
      .setDepth(90);
  }

  private bindEscapeKey(): void {
    this.scene.input.keyboard?.on('keydown-ESC', () => {
      this.sfx.playBack();
      this.scene.scene.start('ArcadeHubScene');
    });
  }

  private getSfxLabel(): string {
    return this.sfx.isMuted() ? 'SFX: OFF' : 'SFX: ON';
  }

  public setScore(score: number): void {
    this.scoreText.setText(String(score));
  }

  public isGameOverVisible(): boolean {
    return this.gameOverVisible;
  }

  public hideGameOver(): void {
    for (const el of this.gameOverElements) {
      el.destroy();
    }
    this.gameOverElements = [];
    this.gameOverVisible = false;
  }

  public showGameOver(finalScore: number): void {
    if (this.gameOverVisible) return;
    this.gameOverVisible = true;

    const iap = StorageManager.getIap();
    const cleanScore = Math.max(0, Math.floor(finalScore));
    const effectiveScore = iap.complete50Owned ? cleanScore * 2 : cleanScore;

    const prevBest = StorageManager.getGameStats(this.gameId).highScore;
    const saved = StorageManager.recordGameRun(this.gameId, effectiveScore);
    const updatedStats = saved.games[this.gameId];
    const isNewBest = effectiveScore > prevBest && effectiveScore > 0;

    const evalResult = EngagementManager.evaluateAfterRun(this.gameId, effectiveScore);
    const medal = getMedalForScore(this.manifest, effectiveScore);
    const updatedIap = StorageManager.getIap();

    this.sfx.playVoiceGameOver(isNewBest);
    this.bestText.setText(`BEST: ${updatedStats.highScore}`);

    // Dimmed blocking backdrop
    const backdrop = this.scene.add
      .rectangle(200, 350, 400, 700, 0x020617, 0.82)
      .setDepth(120)
      .setInteractive();
    backdrop.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData
      ) => {
        event.stopPropagation();
      }
    );

    const hasUnlockBanner =
      evalResult.dailyCompletedNow || evalResult.newlyUnlocked.length > 0;
    const hasContinueSlot = Boolean(this.onContinue);
    const cardHeight = (hasContinueSlot ? 344 : 292) + (hasUnlockBanner ? 34 : 0);
    const cardCenterY = 355;

    const cardG = this.scene.add.graphics().setDepth(121);
    drawGlassCard(cardG, 200, cardCenterY, 328, cardHeight, 20, {
      fillColor: 0x0e1526,
      fillAlpha: 0.98,
      borderColor: this.manifest.accentColor,
      borderAlpha: 0.85,
      borderWidth: 2,
    });

    const topY = cardCenterY - cardHeight / 2;

    const title = this.scene.add
      .text(200, topY + 28, 'GAME OVER', {
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#f43f5e',
      })
      .setOrigin(0.5)
      .setDepth(122);

    const scoreString = iap.complete50Owned
      ? `SCORE: ${effectiveScore} (PRO 2x!)`
      : `SCORE: ${cleanScore}`;

    const scoreLabel = this.scene.add
      .text(200, topY + 66, scoreString, {
        fontSize: iap.complete50Owned ? '18px' : '21px',
        fontStyle: 'bold',
        color: iap.complete50Owned ? '#f59e0b' : '#f8fafc',
      })
      .setOrigin(0.5)
      .setDepth(122);

    const medalIcon =
      medal === 'GOLD'
        ? '🥇 GOLD'
        : medal === 'SILVER'
        ? '🥈 SILVER'
        : medal === 'BRONZE'
        ? '🥉 BRONZE'
        : 'NO MEDAL';

    const bestLabel = this.scene.add
      .text(
        200,
        topY + 95,
        `${isNewBest ? `NEW BEST: ${updatedStats.highScore}!` : `BEST: ${updatedStats.highScore}`}  •  ${medalIcon}  •  +${evalResult.xpGained} XP`,
        {
          fontSize: '11.5px',
          fontStyle: isNewBest ? 'bold' : 'normal',
          color: isNewBest ? this.manifest.accentHex : '#94a3b8',
        }
      )
      .setOrigin(0.5)
      .setDepth(122);

    this.gameOverElements = [backdrop, cardG, title, scoreLabel, bestLabel];

    let nextBtnY = topY + 144;

    if (hasUnlockBanner) {
      const unlockMsg = evalResult.dailyCompletedNow
        ? '🏆 DAILY CHALLENGE COMPLETE! (+2 ★, +200 XP)'
        : `🏆 UNLOCKED: ${evalResult.newlyUnlocked[0].title}!`;
      cardG.fillStyle(0xf59e0b, 0.16);
      cardG.fillRoundedRect(54, topY + 111, 292, 26, 10);
      cardG.lineStyle(1, 0xf59e0b, 0.65);
      cardG.strokeRoundedRect(54, topY + 111, 292, 26, 10);

      const bannerTxt = this.scene.add
        .text(200, topY + 124, unlockMsg, {
          fontSize: '10.5px',
          fontStyle: 'bold',
          color: '#fbbf24',
        })
        .setOrigin(0.5)
        .setDepth(122);
      this.gameOverElements.push(bannerTxt);
      nextBtnY += 34;
    }

    if (this.onContinue) {
      const canContinue = updatedIap.continueTokens > 0;
      const continueColor = canContinue ? 0x10b981 : 0xf59e0b;
      const continueText = canContinue
        ? `★ CONTINUE (1 TOKEN • ${updatedIap.continueTokens} LEFT)`
        : '🛒 GET TOKENS IN SHOP';

      const contBtn = createGlassButton(this.scene, 200, nextBtnY, 268, 40, continueText, {
        bgColor: continueColor,
        hoverBgColor: continueColor,
        textColor: '#060913',
        fontSize: '11.5px',
        radius: 14,
        borderColor: 0xffffff,
        borderAlpha: 0.25,
        depth: 122,
        onClick: () => {
          if (canContinue) {
            if (StorageManager.consumeContinueToken()) {
              this.sfx.playRevive();
              this.hideGameOver();
              this.onContinue?.();
            }
          } else {
            this.sfx.playMenuSelect();
            this.scene.scene.start('ArcadeShopScene');
          }
        },
      });
      this.gameOverElements.push(contBtn.graphics, contBtn.text, contBtn.zone);
      nextBtnY += 50;
    }

    const retryBtn = createGlassButton(this.scene, 200, nextBtnY, 268, 40, 'RETRY', {
      bgColor: this.manifest.accentColor,
      hoverBgColor: this.manifest.accentColor,
      textColor: '#060913',
      fontSize: '14px',
      radius: 14,
      borderColor: 0xffffff,
      borderAlpha: 0.25,
      depth: 122,
      onClick: () => {
        this.sfx.playMenuSelect();
        this.hideGameOver();
        if (this.onRestart) {
          this.onRestart();
        } else {
          this.scene.scene.restart({ gameId: this.gameId });
        }
      },
    });
    this.gameOverElements.push(retryBtn.graphics, retryBtn.text, retryBtn.zone);

    nextBtnY += 48;

    const hubBtn = createGlassButton(this.scene, 200, nextBtnY, 268, 38, '← SELECT GAME', {
      bgColor: 0x131d33,
      hoverBgColor: 0x1e293b,
      textColor: '#e2e8f0',
      fontSize: '13px',
      radius: 14,
      borderColor: 0x334155,
      borderAlpha: 0.75,
      depth: 122,
      onClick: () => {
        this.sfx.playBack();
        this.scene.scene.start('ArcadeHubScene');
      },
    });
    this.gameOverElements.push(hubBtn.graphics, hubBtn.text, hubBtn.zone);
  }
}
