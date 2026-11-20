import Phaser from 'phaser';
import { SoundEffects } from '../audio';
import {
  GAME_CATALOG,
  getMedalForScore,
  getUnlockedCount,
} from '../registry/GameRegistry';
import { getThemePalette, StorageManager } from '../storage';
import { ACHIEVEMENTS } from '../systems/EngagementManager';
import {
  createGlassButton,
  drawAmbientBackdrop,
  drawGlassCard,
} from '../ui/UiTheme';

interface TrophiesInit {
  page?: number;
}

export class ArcadeTrophiesScene extends Phaser.Scene {
  private sfx!: SoundEffects;
  private page = 0;
  private readonly perPage = 6;

  constructor() {
    super({ key: 'ArcadeTrophiesScene' });
  }

  init(data?: TrophiesInit): void {
    this.page = data?.page ?? 0;
  }

  create(): void {
    const save = StorageManager.load();
    this.sfx = new SoundEffects(save.muted);
    const theme = getThemePalette(save.iap.activeTheme);
    const levelInfo = StorageManager.getLevelInfo(save.progression.xp);

    drawAmbientBackdrop(this, theme.accentColor);

    createGlassButton(this, 48, 28, 66, 30, '← HUB', {
      bgColor: 0x131d33,
      hoverBgColor: 0x1e293b,
      textColor: '#e2e8f0',
      fontSize: '11.5px',
      radius: 10,
      borderColor: 0x334155,
      borderAlpha: 0.65,
      onClick: () => {
        this.sfx.playBack();
        this.scene.start('ArcadeHubScene');
      },
    });

    this.add
      .text(218, 28, 'TROPHY CABINET', {
        fontSize: '18px',
        fontStyle: 'bold',
        color: theme.accentHex,
      })
      .setOrigin(0.5)
      .setLetterSpacing(1.2);

    // Player stats summary card
    const summaryG = this.add.graphics();
    drawGlassCard(summaryG, 200, 102, 368, 76, 16, {
      fillColor: 0x0e1526,
      borderColor: theme.accentColor,
      borderAlpha: 0.5,
    });

    this.add.text(32, 74, `LVL ${levelInfo.level} • ${levelInfo.rank}`, {
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#f8fafc',
    });

    this.add
      .text(368, 74, `${save.progression.xp} XP`, {
        fontSize: '12px',
        fontStyle: 'bold',
        color: theme.accentHex,
      })
      .setOrigin(1, 0);

    summaryG.fillStyle(0x1e293b, 1);
    summaryG.fillRoundedRect(32, 98, 336, 8, 4);
    summaryG.fillStyle(theme.accentColor, 1);
    summaryG.fillRoundedRect(32, 98, Math.max(8, 336 * levelInfo.progress), 8, 4);

    let medalsTotal = 0;
    for (const m of GAME_CATALOG) {
      const s = save.games[m.id]?.highScore ?? 0;
      if (getMedalForScore(m, s) !== 'NONE') medalsTotal++;
    }

    const unlockedGames = getUnlockedCount(save.iap);
    this.add
      .text(
        200,
        122,
        `TROPHIES: ${save.progression.achievements.length}/${ACHIEVEMENTS.length}   •   MEDALS: ${medalsTotal}/50   •   GAMES: ${unlockedGames}/50   •   🔥 ${Math.max(1, save.progression.streakDays)}d`,
        {
          fontSize: '10px',
          fontStyle: 'bold',
          color: '#94a3b8',
        }
      )
      .setOrigin(0.5);

    // Paginated achievements list
    const totalPages = Math.ceil(ACHIEVEMENTS.length / this.perPage);
    this.page = Phaser.Math.Clamp(this.page, 0, totalPages - 1);
    const slice = ACHIEVEMENTS.slice(
      this.page * this.perPage,
      (this.page + 1) * this.perPage
    );

    const startY = 192;
    const stepY = 72;
    const listG = this.add.graphics();

    slice.forEach((ach, idx) => {
      const cy = startY + idx * stepY;
      const unlocked = save.progression.achievements.includes(ach.id);

      drawGlassCard(listG, 200, cy, 368, 62, 14, {
        fillColor: 0x0e1526,
        borderColor: unlocked ? 0xf59e0b : 0x334155,
        borderAlpha: unlocked ? 0.8 : 0.4,
        borderWidth: unlocked ? 1.5 : 1,
      });

      this.add
        .text(36, cy, ach.icon, {
          fontSize: '20px',
        })
        .setOrigin(0.5)
        .setAlpha(unlocked ? 1 : 0.4);

      this.add.text(62, cy - 18, ach.title, {
        fontSize: '13px',
        fontStyle: 'bold',
        color: unlocked ? '#fbbf24' : '#cbd5e1',
      });

      this.add.text(62, cy + 3, ach.description, {
        fontSize: '10.5px',
        color: '#94a3b8',
      });

      const badgeText = unlocked
        ? 'UNLOCKED ✓'
        : `+${ach.rewardXp} XP\n+${ach.rewardTokens} ★`;

      this.add
        .text(368, cy, badgeText, {
          fontSize: '10px',
          fontStyle: 'bold',
          color: unlocked ? '#10b981' : '#64748b',
          align: 'right',
        })
        .setOrigin(1, 0.5);
    });

    // Pagination footer
    createGlassButton(this, 68, 645, 92, 32, '◀ PREV', {
      bgColor: 0x131d33,
      hoverBgColor: 0x1e293b,
      textColor: this.page > 0 ? '#f8fafc' : '#475569',
      fontSize: '11.5px',
      radius: 16,
      borderColor: 0x334155,
      borderAlpha: this.page > 0 ? 0.65 : 0.25,
      enabled: this.page > 0,
      onClick: () => {
        this.sfx.playMenuSelect();
        this.scene.restart({ page: this.page - 1 });
      },
    });

    this.add
      .text(200, 645, `PAGE ${this.page + 1} / ${totalPages}`, {
        fontSize: '11.5px',
        fontStyle: 'bold',
        color: '#94a3b8',
      })
      .setOrigin(0.5);

    createGlassButton(this, 332, 645, 92, 32, 'NEXT ▶', {
      bgColor: 0x131d33,
      hoverBgColor: 0x1e293b,
      textColor: this.page < totalPages - 1 ? '#f8fafc' : '#475569',
      fontSize: '11.5px',
      radius: 16,
      borderColor: 0x334155,
      borderAlpha: this.page < totalPages - 1 ? 0.65 : 0.25,
      enabled: this.page < totalPages - 1,
      onClick: () => {
        this.sfx.playMenuSelect();
        this.scene.restart({ page: this.page + 1 });
      },
    });

    if (save.iap.crtScanlinesEnabled) {
      const crt = this.add.graphics().setDepth(150);
      crt.lineStyle(1, 0x000000, 0.2);
      for (let y = 0; y < 700; y += 4) crt.lineBetween(0, y, 400, y);
    }

    this.input.keyboard?.on('keydown-ESC', () => {
      this.sfx.playBack();
      this.scene.start('ArcadeHubScene');
    });
  }
}
