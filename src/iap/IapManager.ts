import { StorageManager } from '../storage';
import { EngagementManager } from '../systems/EngagementManager';

export type IapProductId =
  | 'pack_20_games'
  | 'complete_50_pass'
  | 'continue_tokens_10';

export interface IapProduct {
  id: IapProductId;
  skuAndroid: string;
  skuIos: string;
  title: string;
  subtitle: string;
  priceDisplay: string;
  type: 'non_consumable' | 'consumable';
  accentHex: string;
  accentColor: number;
}

export interface NativeCapacitorBillingBridge {
  purchaseProduct: (sku: string) => Promise<{ purchased: boolean }>;
  restoreProducts: () => Promise<{ ownedSkus: string[] }>;
}

const RECEIPT_BACKUP_KEY = 'pocket_arcade_receipts_v1';

export const IAP_PRODUCTS: IapProduct[] = [
  {
    id: 'pack_20_games',
    skuAndroid: 'com.minimalist.pocketarcade.pack_20',
    skuIos: 'com.minimalist.pocketarcade.pack_20',
    title: '20-GAME EXPANSION PACK',
    subtitle: 'Unlocks Games #11–#20 (20 Total) • CRT Scanlines • +3 Tokens',
    priceDisplay: '$0.99',
    type: 'non_consumable',
    accentHex: '#a855f7',
    accentColor: 0xa855f7,
  },
  {
    id: 'complete_50_pass',
    skuAndroid: 'com.minimalist.pocketarcade.complete_50',
    skuIos: 'com.minimalist.pocketarcade.complete_50',
    title: 'COMPLETE 50-GAME PASS',
    subtitle: 'All 50 Games Unlocked • 2x Score • Pro Themes • +10 Tokens',
    priceDisplay: '$2.99',
    type: 'non_consumable',
    accentHex: '#f59e0b',
    accentColor: 0xf59e0b,
  },
  {
    id: 'continue_tokens_10',
    skuAndroid: 'com.minimalist.pocketarcade.tokens_10',
    skuIos: 'com.minimalist.pocketarcade.tokens_10',
    title: '10x CONTINUE TOKENS',
    subtitle: 'Instant second-chance revives across all 50 games',
    priceDisplay: '$0.99',
    type: 'consumable',
    accentHex: '#10b981',
    accentColor: 0x10b981,
  },
];

function getNativeBillingBridge(): NativeCapacitorBillingBridge | undefined {
  return (window as unknown as { CapacitorBilling?: NativeCapacitorBillingBridge })
    .CapacitorBilling;
}

function getStoredReceipts(): string[] {
  try {
    const raw = window.localStorage.getItem(RECEIPT_BACKUP_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function saveReceipt(sku: string): void {
  try {
    const existing = new Set(getStoredReceipts());
    existing.add(sku);
    window.localStorage.setItem(RECEIPT_BACKUP_KEY, JSON.stringify([...existing]));
  } catch {
    // Ignore storage quota errors
  }
}

export class IapManager {
  static isOwned(productId: IapProductId): boolean {
    const iap = StorageManager.getIap();
    if (productId === 'pack_20_games') {
      return iap.pack20Owned || iap.complete50Owned;
    }
    if (productId === 'complete_50_pass') {
      return iap.complete50Owned;
    }
    return false;
  }

  private static grantEntitlement(productId: IapProductId): void {
    const current = StorageManager.getIap();

    if (productId === 'pack_20_games') {
      StorageManager.updateIap({
        pack20Owned: true,
        crtScanlinesEnabled: true,
        continueTokens: current.continueTokens + (current.pack20Owned ? 0 : 3),
      });
      saveReceipt('com.minimalist.pocketarcade.pack_20');
      EngagementManager.evaluateShopAchievements();
      return;
    }

    if (productId === 'complete_50_pass') {
      StorageManager.updateIap({
        pack20Owned: true,
        complete50Owned: true,
        crtScanlinesEnabled: true,
        activeTheme: current.activeTheme === 'cyber-blue' ? 'neo-gold' : current.activeTheme,
        continueTokens: current.continueTokens + (current.complete50Owned ? 0 : 10),
      });
      saveReceipt('com.minimalist.pocketarcade.complete_50');
      EngagementManager.evaluateShopAchievements();
      return;
    }

    if (productId === 'continue_tokens_10') {
      StorageManager.addContinueTokens(10);
    }
  }

  static async purchase(
    productId: IapProductId
  ): Promise<{ success: boolean; message: string }> {
    const product = IAP_PRODUCTS.find((p) => p.id === productId);
    if (!product) {
      return { success: false, message: 'Product not found.' };
    }

    if (product.type === 'non_consumable' && this.isOwned(productId)) {
      return { success: true, message: `${product.title} is already owned.` };
    }

    const bridge = getNativeBillingBridge();
    if (bridge) {
      try {
        const res = await bridge.purchaseProduct(product.skuAndroid);
        if (!res.purchased) {
          return { success: false, message: 'Store purchase cancelled.' };
        }
        this.grantEntitlement(productId);
        return {
          success: true,
          message: `Purchased ${product.title} via Store Billing!`,
        };
      } catch {
        return { success: false, message: 'Native store billing error.' };
      }
    }

    // Offline / Sandbox store transaction fallback
    this.grantEntitlement(productId);
    const note =
      productId === 'continue_tokens_10'
        ? '+10 Continue Tokens added (Sandbox IAP)!'
        : `${product.title} unlocked (Sandbox IAP)!`;
    return { success: true, message: note };
  }

  static async restorePurchases(): Promise<{
    restoredCount: number;
    message: string;
  }> {
    const bridge = getNativeBillingBridge();
    let ownedSkus: string[] = [];

    if (bridge) {
      try {
        const res = await bridge.restoreProducts();
        ownedSkus = res.ownedSkus ?? [];
      } catch {
        return { restoredCount: 0, message: 'Failed to contact store for restore.' };
      }
    } else {
      ownedSkus = getStoredReceipts();
    }

    let restoredCount = 0;

    if (
      ownedSkus.includes('com.minimalist.pocketarcade.pack_20') ||
      ownedSkus.includes('com.minimalist.pocketarcade.crt_pack')
    ) {
      this.grantEntitlement('pack_20_games');
      restoredCount++;
    }

    if (
      ownedSkus.includes('com.minimalist.pocketarcade.complete_50') ||
      ownedSkus.includes('com.minimalist.pocketarcade.pro_pass')
    ) {
      this.grantEntitlement('complete_50_pass');
      restoredCount++;
    }

    if (restoredCount === 0) {
      return {
        restoredCount: 0,
        message: 'No previous non-consumable purchases found.',
      };
    }

    return {
      restoredCount,
      message: `Restored ${restoredCount} purchase(s) cleanly!`,
    };
  }
}
