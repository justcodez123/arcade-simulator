import Phaser from 'phaser';
import { SoundEffects } from '../audio';
import {
  EngineType,
  GAME_CATALOG,
  GameManifest,
  getMedalForScore,
  getUnlockedCount,
  isGameUnlocked,
} from '../registry/GameRegistry';
import { ArcadeSaveData, getThemePalette, StorageManager } from '../storage';
import { EngagementManager } from '../systems/EngagementManager';
import {
  createGlassButton,
  drawAmbientBackdrop,
  drawGlassCard,
} from '../ui/UiTheme';

type HubFilter = 'all' | 'free' | 'pack20' | 'full50' | 'favs';

interface HubInitData {
  filter?: HubFilter;
  page?: number;
  toast?: string;
}

export class ArcadeHubScene extends Phaser.Scene {
  private saveData!: ArcadeSaveData;
  private sfx!: SoundEffects;

  private activeFilter: HubFilter = 'all';
  private currentPage = 0;
  private readonly perPage = 4;
  private toastMessage = '';

  constructor() {
    super({ key: 'ArcadeHubScene' });
  }

  init(data?: HubInitData): void {
    this.activeFilter = data?.filter ?? 'all';
    this.currentPage = data?.page ?? 0;
    this.toastMessage = data?.toast ?? '';
  }

  create(): void {
    const streakCheck = StorageManager.checkDailyLoginStreak();
    if (streakCheck.isNewDay && !this.toastMessage) {
      this.toastMessage = `🔥 DAY ${streakCheck.streakDays} LOGIN STREAK! +${streakCheck.rewardTokens} CONTINUE TOKEN`;
    }

    this.saveData = StorageManager.load();
    this.sfx = new SoundEffects(this.saveData.muted);
    const theme = getThemePalette(this.saveData.iap.activeTheme);

    drawAmbientBackdrop(this, theme.accentColor);
    this.createHeader(theme.accentHex, theme.accentColor);
    this.createFilterTabs(theme.accentColor);
    this.createCartridgeList();
    this.createPaginationAndFooter(theme.accentHex, theme.accentColor);

    if (this.saveData.iap.crtScanlinesEnabled) {
      this.renderCrtOverlay();
    }

    this.input.once('pointerdown', () => {
      this.sfx.syncBgmState();
      this.sfx.playVoiceWelcome();
    });
  }

  private createHeader(accentHex: string, accentColor: number): void {
    const iap = this.saveData.iap;
    const levelInfo = StorageManager.getLevelInfo(this.saveData.progression.xp);
    const unlockedCount = getUnlockedCount(iap);

    // Clean Header Title ONLY (no subtitle)
    this.add
      .text(18, 26, 'POCKET ARCADE', {
        fontSize: '20px',
        fontStyle: 'bold',
        color: accentHex,
      })
      .setOrigin(0, 0.5)
      .setLetterSpacing(1.2);

    // Trophy pill button
    createGlassButton(this, 227, 26, 34, 30, '🏆', {
      bgColor: 0x131d33,
      hoverBgColor: 0x1e293b,
      textColor: '#fbbf24',
      fontSize: '13px',
      radius: 10,
      borderColor: 0x334155,
      borderAlpha: 0.65,
      onClick: () => {
        this.sfx.playMenuSelect();
        this.scene.start('ArcadeTrophiesScene');
      },
    });

    // Shop pill button
    createGlassButton(this, 284, 26, 68, 30, '🛒 SHOP', {
      bgColor: accentColor,
      hoverBgColor: accentColor,
      textColor: '#060913',
      fontSize: '10.5px',
      radius: 10,
      borderColor: 0xffffff,
      borderAlpha: 0.3,
      onClick: () => {
        this.sfx.playMenuSelect();
        this.scene.start('ArcadeShopScene');
      },
    });

    // SFX toggle pill button
    const sfxBtn = createGlassButton(this, 354, 26, 60, 30, this.getSfxLabel(), {
      bgColor: 0x131d33,
      hoverBgColor: 0x1e293b,
      textColor: '#e2e8f0',
      fontSize: '10.5px',
      radius: 10,
      borderColor: 0x334155,
      borderAlpha: 0.65,
      onClick: () => {
        const nextMuted = !this.sfx.isMuted();
        this.sfx.setMuted(nextMuted);
        this.saveData = StorageManager.setMuted(nextMuted);
        sfxBtn.setLabel(this.getSfxLabel());
        if (!nextMuted) {
          this.sfx.playMenuSelect();
          this.sfx.syncBgmState();
        }
      },
    });

    // Player XP & Status Glass Bar (y: 66)
    const statusG = this.add.graphics();
    drawGlassCard(statusG, 200, 66, 368, 30, 10, {
      fillColor: 0x0d1526,
      fillAlpha: 0.92,
      borderColor: accentColor,
      borderAlpha: 0.4,
    });

    // Mini XP pill bar
    statusG.fillStyle(0x1e293b, 1);
    statusG.fillRoundedRect(138, 63, 70, 6, 3);
    statusG.fillStyle(accentColor, 1);
    statusG.fillRoundedRect(138, 63, Math.max(6, 70 * levelInfo.progress), 6, 3);

    this.add
      .text(26, 66, `LVL ${levelInfo.level} ${levelInfo.rank}`, {
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#f8fafc',
      })
      .setOrigin(0, 0.5);

    this.add
      .text(
        374,
        66,
        `🔥${Math.max(1, this.saveData.progression.streakDays)}d • ★${iap.continueTokens} • ${unlockedCount}/50`,
        {
          fontSize: '10px',
          fontStyle: 'bold',
          color: '#cbd5e1',
        }
      )
      .setOrigin(1, 0.5);
  }

  private createFilterTabs(accentColor: number): void {
    const tabs: Array<{ key: HubFilter; label: string; x: number; w: number }> = [
      { key: 'all', label: 'ALL 50', x: 52, w: 66 },
      { key: 'free', label: 'FREE 10', x: 124, w: 68 },
      { key: 'pack20', label: '20-PACK', x: 198, w: 70 },
      { key: 'full50', label: '50-PRO', x: 273, w: 68 },
      { key: 'favs', label: 'FAVS ★', x: 347, w: 68 },
    ];

    for (const tab of tabs) {
      const active = this.activeFilter === tab.key;
      createGlassButton(this, tab.x, 106, tab.w, 28, tab.label, {
        bgColor: active ? accentColor : 0x0e1526,
        hoverBgColor: active ? accentColor : 0x162038,
        textColor: active ? '#060913' : '#94a3b8',
        fontSize: '10px',
        radius: 14,
        borderColor: active ? 0xffffff : 0x334155,
        borderAlpha: active ? 0.35 : 0.45,
        onClick: () => {
          if (this.activeFilter === tab.key) return;
          this.sfx.playMenuSelect();
          this.scene.restart({ filter: tab.key, page: 0 });
        },
      });
    }
  }

  private getFilteredCatalog(): GameManifest[] {
    const favs = new Set(this.saveData.progression.favorites);
    if (this.activeFilter === 'free') {
      return GAME_CATALOG.filter((g) => g.tier === 'free');
    }
    if (this.activeFilter === 'pack20') {
      return GAME_CATALOG.filter((g) => g.tier === 'pack20');
    }
    if (this.activeFilter === 'full50') {
      return GAME_CATALOG.filter((g) => g.tier === 'full50');
    }
    if (this.activeFilter === 'favs') {
      return GAME_CATALOG.filter((g) => favs.has(g.id));
    }
    return GAME_CATALOG;
  }

  private createCartridgeList(): void {
    const filtered = this.getFilteredCatalog();
    const totalPages = Math.max(1, Math.ceil(filtered.length / this.perPage));
    this.currentPage = Phaser.Math.Clamp(this.currentPage, 0, totalPages - 1);

    if (filtered.length === 0) {
      this.add
        .text(200, 336, 'NO FAVORITE GAMES YET\nTap ☆ on any cartridge to star it!', {
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#64748b',
          align: 'center',
        })
        .setOrigin(0.5);
      return;
    }

    const pageItems = filtered.slice(
      this.currentPage * this.perPage,
      (this.currentPage + 1) * this.perPage
    );

    const startCenterY = 176;
    const stepY = 104;

    pageItems.forEach((manifest, idx) => {
      this.createCartridgeCard(manifest, startCenterY + idx * stepY);
    });
  }

  private createCartridgeCard(manifest: GameManifest, cardY: number): void {
    const stats = this.saveData.games[manifest.id] ?? {
      highScore: 0,
      lastScore: 0,
      gamesPlayed: 0,
    };
    const unlocked = isGameUnlocked(manifest, this.saveData.iap);
    const isFav = this.saveData.progression.favorites.includes(manifest.id);
    const medal = getMedalForScore(manifest, stats.highScore);
    const medalBadge =
      medal === 'GOLD'
        ? ' 🥇'
        : medal === 'SILVER'
        ? ' 🥈'
        : medal === 'BRONZE'
        ? ' 🥉'
        : '';

    const cardG = this.add.graphics();
    const drawCard = (hovered: boolean): void => {
      cardG.clear();
      drawGlassCard(cardG, 200, cardY, 368, 94, 16, {
        fillColor: hovered ? 0x141e36 : 0x0e1526,
        fillAlpha: unlocked ? 0.94 : 0.72,
        borderColor: hovered ? manifest.accentColor : 0x334155,
        borderAlpha: hovered ? 0.85 : 0.45,
        borderWidth: hovered ? 1.5 : 1,
      });

      // Left glowing accent indicator pill
      cardG.fillStyle(manifest.accentColor, unlocked ? 0.95 : 0.4);
      cardG.fillRoundedRect(23, cardY - 31, 4, 62, 2);

      // Rounded icon tile
      cardG.fillStyle(0x070b16, 0.92);
      cardG.fillRoundedRect(36, cardY - 25, 50, 50, 12);
      cardG.lineStyle(1, manifest.accentColor, unlocked ? 0.4 : 0.18);
      cardG.strokeRoundedRect(36, cardY - 25, 50, 50, 12);
    };

    drawCard(false);

    const cardZone = this.add
      .zone(200, cardY, 368, 94)
      .setInteractive({ useHandCursor: true });

    cardZone.on('pointerover', () => drawCard(true));
    cardZone.on('pointerout', () => drawCard(false));
    cardZone.on('pointerdown', () => {
      if (unlocked) {
        this.launchGame(manifest);
      } else {
        this.sfx.playBack();
        const reqLabel =
          manifest.tier === 'pack20'
            ? 'Unlock with 20-GAME EXPANSION ($0.99) or Complete Pass!'
            : 'Unlock with COMPLETE 50-GAME PASS ($2.99)!';
        this.scene.start('ArcadeShopScene', { toast: reqLabel });
      }
    });

    this.drawEngineIcon(
      manifest.engine,
      61,
      cardY,
      manifest.accentColor,
      unlocked ? 1 : 0.45
    );

    const numStr = String(manifest.index).padStart(2, '0');
    this.add.text(98, cardY - 30, `#${numStr} ${manifest.title}`, {
      fontSize: '13.5px',
      fontStyle: 'bold',
      color: unlocked ? '#f8fafc' : '#94a3b8',
    });

    this.add.text(98, cardY - 10, `${manifest.category}${medalBadge}`, {
      fontSize: '10px',
      fontStyle: 'bold',
      color: manifest.accentHex,
    });

    this.add.text(98, cardY + 8, manifest.subtitle, {
      fontSize: '10.5px',
      color: '#94a3b8',
      wordWrap: { width: 190 },
    });

    // Favorite toggle star
    const favBtn = this.add
      .text(306, cardY - 22, isFav ? '★' : '☆', {
        fontSize: '16px',
        color: isFav ? '#fbbf24' : '#64748b',
      })
      .setOrigin(0.5)
      .setDepth(5)
      .setInteractive({ useHandCursor: true });

    favBtn.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event: Phaser.Types.Input.EventData
      ) => {
        event.stopPropagation();
        const added = StorageManager.toggleFavorite(manifest.id);
        this.sfx.playSwitch(added);
        this.scene.restart({
          filter: this.activeFilter,
          page: this.currentPage,
        });
      }
    );

    // Best readout
    this.add
      .text(372, cardY - 22, `BEST:${stats.highScore}`, {
        fontSize: '10.5px',
        fontStyle: 'bold',
        color: '#cbd5e1',
      })
      .setOrigin(1, 0.5);

    // Rounded Action Pill
    const pillColor = unlocked ? manifest.accentColor : 0x1e293b;
    const pillLabel = unlocked
      ? 'PLAY ▶'
      : manifest.tier === 'pack20'
      ? '🔒 $0.99'
      : '🔒 $2.99';

    const pillG = this.add.graphics();
    pillG.fillStyle(pillColor, 0.96);
    pillG.fillRoundedRect(300, cardY + 1, 72, 28, 14);
    pillG.lineStyle(1, unlocked ? 0xffffff : 0x475569, unlocked ? 0.25 : 0.8);
    pillG.strokeRoundedRect(300, cardY + 1, 72, 28, 14);

    this.add
      .text(336, cardY + 15, pillLabel, {
        fontSize: '11px',
        fontStyle: 'bold',
        color: unlocked ? '#060913' : '#cbd5e1',
      })
      .setOrigin(0.5);
  }

  private drawEngineIcon(
    engine: EngineType,
    cx: number,
    cy: number,
    accentColor: number,
    alpha: number
  ): void {
    const g = this.add.graphics().setAlpha(alpha);

    switch (engine) {
      case 'orbit': {
        g.lineStyle(1.6, accentColor, 0.85);
        g.strokeCircle(cx, cy, 16);
        g.strokeCircle(cx, cy, 9);
        g.fillStyle(0xf8fafc, 1);
        g.fillCircle(cx + 16, cy, 3.2);
        g.fillStyle(0xf43f5e, 1);
        g.fillCircle(cx - 9, cy, 3.2);
        break;
      }
      case 'breaker': {
        g.fillStyle(accentColor, 0.9);
        for (let r = 0; r < 2; r++) {
          for (let c = 0; c < 3; c++) {
            g.fillRoundedRect(cx - 15 + c * 11, cy - 14 + r * 7, 8, 4, 1);
          }
        }
        g.fillStyle(0xf8fafc, 1);
        g.fillCircle(cx + 2, cy + 4, 3);
        g.fillStyle(accentColor, 1);
        g.fillRoundedRect(cx - 11, cy + 12, 22, 4, 2);
        break;
      }
      case 'snake': {
        g.fillStyle(accentColor, 1);
        g.fillRoundedRect(cx - 13, cy + 4, 7, 7, 2);
        g.fillRoundedRect(cx - 4, cy + 4, 7, 7, 2);
        g.fillRoundedRect(cx - 4, cy - 5, 7, 7, 2);
        g.fillStyle(0xf8fafc, 1);
        g.fillRoundedRect(cx + 5, cy - 5, 7, 7, 2);
        g.fillStyle(0xf43f5e, 1);
        g.fillCircle(cx + 10, cy - 12, 3.2);
        break;
      }
      case 'astro': {
        g.fillStyle(accentColor, 1);
        g.fillTriangle(cx, cy - 14, cx - 10, cy + 11, cx + 10, cy + 11);
        g.fillStyle(0x38bdf8, 1);
        g.fillRect(cx - 1.5, cy - 19, 3, 5);
        g.fillStyle(0xf43f5e, 0.9);
        g.fillCircle(cx + 11, cy - 9, 3.5);
        break;
      }
      case 'stack': {
        g.fillStyle(accentColor, 0.55);
        g.fillRoundedRect(cx - 15, cy + 8, 30, 5, 2);
        g.fillStyle(accentColor, 0.8);
        g.fillRoundedRect(cx - 11, cy + 1, 22, 5, 2);
        g.fillStyle(accentColor, 1);
        g.fillRoundedRect(cx - 7, cy - 6, 14, 5, 2);
        g.fillStyle(0xf8fafc, 1);
        g.fillRoundedRect(cx - 3, cy - 13, 13, 5, 2);
        break;
      }
      case 'flap': {
        g.fillStyle(0xf43f5e, 0.9);
        g.fillRoundedRect(cx + 5, cy - 17, 6, 12, 2);
        g.fillRoundedRect(cx + 5, cy + 5, 6, 12, 2);
        g.fillStyle(accentColor, 1);
        g.fillCircle(cx - 7, cy, 6);
        g.fillStyle(0xf8fafc, 1);
        g.fillTriangle(cx, cy, cx - 8, cy - 4, cx - 8, cy + 4);
        break;
      }
      case 'pong': {
        g.fillStyle(0xf43f5e, 1);
        g.fillRoundedRect(cx - 10, cy - 15, 20, 4, 2);
        g.fillStyle(accentColor, 1);
        g.fillRoundedRect(cx - 10, cy + 11, 20, 4, 2);
        g.fillStyle(0xf8fafc, 1);
        g.fillCircle(cx + 4, cy - 2, 3.5);
        break;
      }
      case 'hopper': {
        g.fillStyle(accentColor, 0.9);
        g.fillRoundedRect(cx - 15, cy + 10, 16, 4, 2);
        g.fillStyle(0x10b981, 1);
        g.fillRoundedRect(cx - 1, cy - 2, 16, 4, 2);
        g.fillStyle(0xf8fafc, 1);
        g.fillCircle(cx + 6, cy - 10, 4.5);
        break;
      }
      case 'reflex': {
        g.fillStyle(0x1e293b, 1);
        for (let r = 0; r < 2; r++) {
          for (let c = 0; c < 2; c++) {
            g.fillRoundedRect(cx - 13 + c * 14, cy - 13 + r * 14, 11, 11, 3);
          }
        }
        g.fillStyle(accentColor, 1);
        g.fillRoundedRect(cx + 1, cy - 13, 11, 11, 3);
        g.fillStyle(0xf43f5e, 1);
        g.fillRoundedRect(cx - 13, cy + 1, 11, 11, 3);
        break;
      }
      case 'lane': {
        g.lineStyle(1.5, accentColor, 0.7);
        g.lineBetween(cx - 13, cy - 16, cx - 13, cy + 16);
        g.lineBetween(cx + 13, cy - 16, cx + 13, cy + 16);
        g.fillStyle(0xf43f5e, 1);
        g.fillRoundedRect(cx - 9, cy - 12, 8, 6, 2);
        g.fillStyle(accentColor, 1);
        g.fillTriangle(cx + 4, cy + 2, cx - 1, cy + 14, cx + 9, cy + 14);
        break;
      }
    }
  }

  private createPaginationAndFooter(accentHex: string, accentColor: number): void {
    const filtered = this.getFilteredCatalog();
    const totalPages = Math.max(1, Math.ceil(filtered.length / this.perPage));

    createGlassButton(this, 68, 566, 86, 30, '◀ PREV', {
      bgColor: 0x131d33,
      hoverBgColor: 0x1e293b,
      textColor: this.currentPage > 0 ? '#f8fafc' : '#475569',
      fontSize: '11px',
      radius: 15,
      borderColor: 0x334155,
      borderAlpha: this.currentPage > 0 ? 0.65 : 0.25,
      enabled: this.currentPage > 0,
      onClick: () => this.goToPage(this.currentPage - 1),
    });

    this.add
      .text(200, 566, `PAGE ${this.currentPage + 1} / ${totalPages}  (${filtered.length})`, {
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#94a3b8',
      })
      .setOrigin(0.5);

    createGlassButton(this, 332, 566, 86, 30, 'NEXT ▶', {
      bgColor: 0x131d33,
      hoverBgColor: 0x1e293b,
      textColor: this.currentPage < totalPages - 1 ? '#f8fafc' : '#475569',
      fontSize: '11px',
      radius: 15,
      borderColor: 0x334155,
      borderAlpha: this.currentPage < totalPages - 1 ? 0.65 : 0.25,
      enabled: this.currentPage < totalPages - 1,
      onClick: () => this.goToPage(this.currentPage + 1),
    });

    // Keyboard page switching & mouse wheel support
    this.input.keyboard?.on('keydown-LEFT', () => {
      if (this.currentPage > 0) this.goToPage(this.currentPage - 1);
    });
    this.input.keyboard?.on('keydown-RIGHT', () => {
      if (this.currentPage < totalPages - 1) this.goToPage(this.currentPage + 1);
    });
    this.input.on(
      'wheel',
      (
        _pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _dx: number,
        dy: number
      ) => {
        if (dy > 20 && this.currentPage < totalPages - 1) {
          this.goToPage(this.currentPage + 1);
        } else if (dy < -20 && this.currentPage > 0) {
          this.goToPage(this.currentPage - 1);
        }
      }
    );

    // Bottom Dock Footer: Daily Challenge + Surprise Roulette (replaces old pricing footer)
    const daily = EngagementManager.getDailyChallenge();
    const dailyLabel = daily.completed
      ? `✅ DAILY CLEAR: ${daily.game.title}`
      : `⚡ DAILY: ${daily.game.title} (GOAL ${daily.targetScore})`;

    createGlassButton(this, 152, 636, 268, 42, dailyLabel, {
      bgColor: 0x0e1526,
      hoverBgColor: 0x162038,
      textColor: daily.completed ? '#34d399' : '#fbbf24',
      fontSize: '10.5px',
      radius: 14,
      borderColor: daily.completed ? 0x10b981 : 0xf59e0b,
      borderAlpha: 0.75,
      onClick: () => this.launchGame(daily.game),
    });

    createGlassButton(this, 339, 636, 90, 42, '🎲 SURPRISE', {
      bgColor: accentColor,
      hoverBgColor: accentColor,
      textColor: '#060913',
      fontSize: '10.5px',
      radius: 14,
      borderColor: 0xffffff,
      borderAlpha: 0.3,
      onClick: () => {
        const unlocked = GAME_CATALOG.filter((m) =>
          isGameUnlocked(m, this.saveData.iap)
        );
        const chosen = unlocked[Math.floor(Math.random() * unlocked.length)];
        if (chosen) {
          this.launchGame(chosen);
        }
      },
    });

    // Optional login streak banner (fades cleanly after a few seconds)
    if (this.toastMessage) {
      const toastG = this.add.graphics().setDepth(90);
      drawGlassCard(toastG, 200, 678, 360, 24, 12, {
        fillColor: 0x0f172a,
        fillAlpha: 0.96,
        borderColor: accentColor,
        borderAlpha: 0.7,
        topHighlight: false,
      });
      const toastTxt = this.add
        .text(200, 678, this.toastMessage, {
          fontSize: '9.5px',
          fontStyle: 'bold',
          color: accentHex,
        })
        .setOrigin(0.5)
        .setDepth(91);

      this.time.delayedCall(3800, () => {
        this.tweens.add({
          targets: [toastG, toastTxt],
          alpha: 0,
          duration: 450,
          onComplete: () => {
            toastG.destroy();
            toastTxt.destroy();
          },
        });
      });
    }
  }

  private goToPage(page: number): void {
    this.sfx.playMenuSelect();
    this.scene.restart({ filter: this.activeFilter, page });
  }

  private getSfxLabel(): string {
    return this.sfx.isMuted() ? 'SFX: OFF' : 'SFX: ON';
  }

  private launchGame(manifest: GameManifest): void {
    this.sfx.syncBgmState();
    this.sfx.playVoiceWelcome();
    this.sfx.playMenuSelect();
    this.scene.start(manifest.sceneKey, { gameId: manifest.id });
  }

  private renderCrtOverlay(): void {
    const g = this.add.graphics().setDepth(150);
    g.lineStyle(1, 0x000000, 0.2);
    for (let y = 0; y < 700; y += 4) {
      g.lineBetween(0, y, 400, y);
    }
  }
}
