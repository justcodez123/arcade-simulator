import Phaser from 'phaser';
import { SoundEffects } from '../audio';
import { IAP_PRODUCTS, IapManager, IapProduct } from '../iap/IapManager';
import { getUnlockedCount } from '../registry/GameRegistry';
import { ConsoleTheme, getThemePalette, StorageManager } from '../storage';
import {
  createGlassButton,
  drawAmbientBackdrop,
  drawGlassCard,
} from '../ui/UiTheme';

interface ShopInitData {
  toast?: string;
}

export class ArcadeShopScene extends Phaser.Scene {
  private sfx!: SoundEffects;
  private toastText!: Phaser.GameObjects.Text;
  private initialToast = '';

  constructor() {
    super({ key: 'ArcadeShopScene' });
  }

  init(data?: ShopInitData): void {
    this.initialToast = data?.toast ?? '';
  }

  create(): void {
    const save = StorageManager.load();
    this.sfx = new SoundEffects(save.muted);
    const theme = getThemePalette(save.iap.activeTheme);

    drawAmbientBackdrop(this, theme.accentColor);
    this.createHeader(theme.accentHex, theme.accentColor);
    this.createProductCards();
    this.createCustomizationPanel(theme.accentColor);
    this.createFooter();

    if (save.iap.crtScanlinesEnabled) {
      this.renderCrtOverlay();
    }

    this.input.keyboard?.on('keydown-ESC', () => {
      this.sfx.playBack();
      this.scene.start('ArcadeHubScene');
    });
  }

  private createHeader(accentHex: string, accentColor: number): void {
    const iap = StorageManager.getIap();
    const unlockedCount = getUnlockedCount(iap);

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
      .text(222, 28, 'ARCADE PRO SHOP', {
        fontSize: '18px',
        fontStyle: 'bold',
        color: accentHex,
      })
      .setOrigin(0.5)
      .setLetterSpacing(1.2);

    const pillG = this.add.graphics();
    drawGlassCard(pillG, 200, 72, 368, 30, 10, {
      fillColor: 0x0d1526,
      borderColor: accentColor,
      borderAlpha: 0.45,
    });

    const tierLabel = iap.complete50Owned
      ? 'PRO ALL-50 (2x)'
      : iap.pack20Owned
      ? '20-PACK'
      : 'FREE TIER';

    this.add
      .text(
        200,
        72,
        `UNLOCKED: ${unlockedCount}/50   •   ★ ${iap.continueTokens}   •   ${tierLabel}`,
        {
          fontSize: '10.5px',
          fontStyle: 'bold',
          color: '#f8fafc',
        }
      )
      .setOrigin(0.5);
  }

  private createProductCards(): void {
    const startY = 156;
    const stepY = 108;

    IAP_PRODUCTS.forEach((product, idx) => {
      this.createProductCard(product, startY + idx * stepY);
    });
  }

  private createProductCard(product: IapProduct, centerY: number): void {
    const owned = IapManager.isOwned(product.id);

    const cardG = this.add.graphics();
    drawGlassCard(cardG, 200, centerY, 368, 96, 16, {
      fillColor: 0x0e1526,
      borderColor: owned ? product.accentColor : 0x334155,
      borderAlpha: owned ? 0.85 : 0.45,
      borderWidth: owned ? 1.5 : 1,
    });

    cardG.fillStyle(product.accentColor, 0.95);
    cardG.fillRoundedRect(23, centerY - 32, 4, 64, 2);

    const typeLabel =
      product.type === 'non_consumable' ? 'ONE-TIME UNLOCK' : 'CONSUMABLE PACK';
    this.add.text(38, centerY - 33, product.title, {
      fontSize: '13.5px',
      fontStyle: 'bold',
      color: '#f8fafc',
    });

    this.add.text(38, centerY - 13, typeLabel, {
      fontSize: '10px',
      fontStyle: 'bold',
      color: product.accentHex,
    });

    this.add.text(38, centerY + 6, product.subtitle, {
      fontSize: '10.5px',
      color: '#94a3b8',
      wordWrap: { width: 222 },
    });

    createGlassButton(
      this,
      324,
      centerY,
      94,
      34,
      owned ? 'OWNED ✓' : `BUY ${product.priceDisplay}`,
      {
        bgColor: owned ? 0x1e293b : product.accentColor,
        hoverBgColor: owned ? 0x1e293b : product.accentColor,
        textColor: owned ? '#94a3b8' : '#060913',
        fontSize: '11px',
        radius: 14,
        borderColor: owned ? 0x334155 : 0xffffff,
        borderAlpha: owned ? 0.5 : 0.25,
        enabled: !owned,
        onClick: async () => {
          const result = await IapManager.purchase(product.id);
          if (result.success) {
            this.sfx.playPurchaseSuccess();
          } else {
            this.sfx.playBack();
          }
          this.scene.restart({ toast: result.message });
        },
      }
    );
  }

  private createCustomizationPanel(accentColor: number): void {
    const iap = StorageManager.getIap();
    const themeInfo = getThemePalette(iap.activeTheme);
    const hasCrt = iap.pack20Owned || iap.complete50Owned;

    this.add.text(18, 442, 'PRO PERKS & VISUAL CUSTOMIZATION', {
      fontSize: '10.5px',
      fontStyle: 'bold',
      color: '#94a3b8',
    });

    const themeStatus = iap.complete50Owned
      ? `THEME: ${themeInfo.label}  (TAP TO CYCLE)`
      : `THEME: ${themeInfo.label}  🔒 REQUIRES $2.99 PASS`;

    createGlassButton(this, 200, 486, 368, 42, themeStatus, {
      bgColor: 0x0e1526,
      hoverBgColor: 0x162038,
      textColor: iap.complete50Owned ? '#f8fafc' : '#64748b',
      fontSize: '11.5px',
      radius: 14,
      borderColor: accentColor,
      borderAlpha: iap.complete50Owned ? 0.7 : 0.25,
      onClick: () => {
        if (!iap.complete50Owned) {
          this.sfx.playBack();
          this.setToast('Unlock COMPLETE 50-GAME PASS ($2.99) to switch themes!');
          return;
        }
        const order: ConsoleTheme[] = [
          'cyber-blue',
          'neo-gold',
          'matrix-emerald',
          'synth-pink',
        ];
        const next = order[(order.indexOf(iap.activeTheme) + 1) % order.length];
        StorageManager.updateIap({ activeTheme: next });
        this.sfx.playMenuSelect();
        this.scene.restart({ toast: `Theme changed to ${getThemePalette(next).label}!` });
      },
    });

    const crtStatus = hasCrt
      ? `CRT SCANLINES: ${iap.crtScanlinesEnabled ? 'ON' : 'OFF'}  (TAP TO TOGGLE)`
      : 'CRT SCANLINES: OFF  🔒 REQUIRES $0.99 PACK OR PASS';

    createGlassButton(this, 200, 538, 368, 42, crtStatus, {
      bgColor: 0x0e1526,
      hoverBgColor: 0x162038,
      textColor: hasCrt ? '#f8fafc' : '#64748b',
      fontSize: '11.5px',
      radius: 14,
      borderColor: 0xa855f7,
      borderAlpha: hasCrt ? 0.7 : 0.25,
      onClick: () => {
        if (!hasCrt) {
          this.sfx.playBack();
          this.setToast('Unlock 20-GAME EXPANSION ($0.99) or Complete Pass for CRT FX!');
          return;
        }
        const next = !iap.crtScanlinesEnabled;
        StorageManager.updateIap({ crtScanlinesEnabled: next });
        this.sfx.playMenuSelect();
        this.scene.restart({ toast: `CRT Scanlines ${next ? 'ENABLED' : 'DISABLED'}.` });
      },
    });
  }

  private createFooter(): void {
    createGlassButton(this, 200, 606, 260, 38, 'RESTORE PURCHASES', {
      bgColor: 0x131d33,
      hoverBgColor: 0x1e293b,
      textColor: '#e2e8f0',
      fontSize: '12px',
      radius: 14,
      borderColor: 0x334155,
      borderAlpha: 0.75,
      onClick: async () => {
        const res = await IapManager.restorePurchases();
        if (res.restoredCount > 0) {
          this.sfx.playPurchaseSuccess();
        } else {
          this.sfx.playMenuSelect();
        }
        this.scene.restart({ toast: res.message });
      },
    });

    this.toastText = this.add
      .text(
        200,
        654,
        this.initialToast ||
          'Free: 10 Games • $0.99: 20 Games • $2.99: All 50 Games',
        {
          fontSize: '10.5px',
          fontStyle: 'bold',
          color: this.initialToast ? '#38bdf8' : '#64748b',
          align: 'center',
          wordWrap: { width: 360 },
        }
      )
      .setOrigin(0.5);
  }

  private setToast(msg: string): void {
    this.toastText.setText(msg);
    this.toastText.setColor('#f59e0b');
  }

  private renderCrtOverlay(): void {
    const g = this.add.graphics().setDepth(150);
    g.lineStyle(1, 0x000000, 0.2);
    for (let y = 0; y < 700; y += 4) {
      g.lineBetween(0, y, 400, y);
    }
  }
}
