export type GameId = string;

export type GameTier = 'free' | 'pack20' | 'full50';

export type ConsoleTheme =
  | 'cyber-blue'
  | 'neo-gold'
  | 'matrix-emerald'
  | 'synth-pink';

export interface PerGameStats {
  highScore: number;
  lastScore: number;
  gamesPlayed: number;
}

export interface IapEntitlements {
  pack20Owned: boolean;
  complete50Owned: boolean;
  continueTokens: number;
  activeTheme: ConsoleTheme;
  crtScanlinesEnabled: boolean;
}

export interface PlayerProgression {
  xp: number;
  favorites: string[];
  achievements: string[];
  lastLoginDate: string;
  streakDays: number;
  dailyChallengeCompletedDate: string;
  revivesUsed: number;
}

export interface ArcadeSaveData {
  muted: boolean;
  totalGamesPlayed: number;
  totalArcadeScore: number;
  lastPlayedGameId: string;
  games: Record<string, PerGameStats>;
  iap: IapEntitlements;
  progression: PlayerProgression;
}

interface LegacyIapShape {
  proPassOwned?: boolean;
  crtPackOwned?: boolean;
  pack20Owned?: boolean;
  complete50Owned?: boolean;
  continueTokens?: number;
  activeTheme?: string;
  crtScanlinesEnabled?: boolean;
}

interface LegacyOrbitPulseSave {
  highScore?: number;
  lastScore?: number;
  gamesPlayed?: number;
  muted?: boolean;
}

const STORAGE_KEY = 'pocket_arcade_hub_save_v1';
const LEGACY_ORBIT_STORAGE_KEY = 'orbit_pulse_save_v1';

const ALL_THEMES: ConsoleTheme[] = [
  'cyber-blue',
  'neo-gold',
  'matrix-emerald',
  'synth-pink',
];

const RANK_TITLES = [
  'ROOKIE',
  'CHALLENGER',
  'VECTOR KID',
  'SYNTH ACE',
  'PIXEL KNIGHT',
  'NEON MASTER',
  'GRID PHANTOM',
  'ARCADE PRO',
  'OVERDRIVE',
  'CYBER LEGEND',
];

function createDefaultIap(): IapEntitlements {
  return {
    pack20Owned: false,
    complete50Owned: false,
    continueTokens: 3,
    activeTheme: 'cyber-blue',
    crtScanlinesEnabled: false,
  };
}

function createDefaultProgression(): PlayerProgression {
  return {
    xp: 0,
    favorites: [],
    achievements: [],
    lastLoginDate: '',
    streakDays: 0,
    dailyChallengeCompletedDate: '',
    revivesUsed: 0,
  };
}

function createDefaultSave(): ArcadeSaveData {
  return {
    muted: false,
    totalGamesPlayed: 0,
    totalArcadeScore: 0,
    lastPlayedGameId: 'orbit-pulse',
    games: {},
    iap: createDefaultIap(),
    progression: createDefaultProgression(),
  };
}

function isValidTheme(value: unknown): value is ConsoleTheme {
  return typeof value === 'string' && ALL_THEMES.includes(value as ConsoleTheme);
}

export function getThemePalette(theme: ConsoleTheme): {
  accentHex: string;
  accentColor: number;
  label: string;
} {
  switch (theme) {
    case 'neo-gold':
      return { accentHex: '#f59e0b', accentColor: 0xf59e0b, label: 'NEO GOLD' };
    case 'matrix-emerald':
      return { accentHex: '#10b981', accentColor: 0x10b981, label: 'MATRIX EMERALD' };
    case 'synth-pink':
      return { accentHex: '#ec4899', accentColor: 0xec4899, label: 'SYNTHWAVE PINK' };
    case 'cyber-blue':
    default:
      return { accentHex: '#38bdf8', accentColor: 0x38bdf8, label: 'CYBER BLUE' };
  }
}

export class StorageManager {
  static getTodayKey(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private static getYesterdayKey(): string {
    const dt = new Date();
    dt.setDate(dt.getDate() - 1);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  static load(): ArcadeSaveData {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return this.migrateLegacyIfPresent();
      }

      const parsed = JSON.parse(raw) as Partial<ArcadeSaveData>;
      const defaults = createDefaultSave();
      const games: Record<string, PerGameStats> = {};

      if (parsed.games && typeof parsed.games === 'object') {
        for (const [id, entry] of Object.entries(parsed.games)) {
          if (entry && typeof entry === 'object') {
            games[id] = {
              highScore: typeof entry.highScore === 'number' ? entry.highScore : 0,
              lastScore: typeof entry.lastScore === 'number' ? entry.lastScore : 0,
              gamesPlayed: typeof entry.gamesPlayed === 'number' ? entry.gamesPlayed : 0,
            };
          }
        }
      }

      const defaultIap = createDefaultIap();
      const parsedIap = parsed.iap as LegacyIapShape | undefined;
      const iap: IapEntitlements =
        parsedIap && typeof parsedIap === 'object'
          ? {
              pack20Owned: Boolean(
                parsedIap.pack20Owned || parsedIap.crtPackOwned || parsedIap.complete50Owned || parsedIap.proPassOwned
              ),
              complete50Owned: Boolean(parsedIap.complete50Owned || parsedIap.proPassOwned),
              continueTokens:
                typeof parsedIap.continueTokens === 'number'
                  ? Math.max(0, Math.floor(parsedIap.continueTokens))
                  : defaultIap.continueTokens,
              activeTheme: isValidTheme(parsedIap.activeTheme)
                ? parsedIap.activeTheme
                : defaultIap.activeTheme,
              crtScanlinesEnabled:
                typeof parsedIap.crtScanlinesEnabled === 'boolean'
                  ? parsedIap.crtScanlinesEnabled
                  : defaultIap.crtScanlinesEnabled,
            }
          : defaultIap;

      const defaultProg = createDefaultProgression();
      const parsedProg = parsed.progression;
      const progression: PlayerProgression =
        parsedProg && typeof parsedProg === 'object'
          ? {
              xp: typeof parsedProg.xp === 'number' ? Math.max(0, Math.floor(parsedProg.xp)) : 0,
              favorites: Array.isArray(parsedProg.favorites)
                ? parsedProg.favorites.filter((x): x is string => typeof x === 'string')
                : [],
              achievements: Array.isArray(parsedProg.achievements)
                ? parsedProg.achievements.filter((x): x is string => typeof x === 'string')
                : [],
              lastLoginDate:
                typeof parsedProg.lastLoginDate === 'string' ? parsedProg.lastLoginDate : '',
              streakDays:
                typeof parsedProg.streakDays === 'number'
                  ? Math.max(0, Math.floor(parsedProg.streakDays))
                  : 0,
              dailyChallengeCompletedDate:
                typeof parsedProg.dailyChallengeCompletedDate === 'string'
                  ? parsedProg.dailyChallengeCompletedDate
                  : '',
              revivesUsed:
                typeof parsedProg.revivesUsed === 'number'
                  ? Math.max(0, Math.floor(parsedProg.revivesUsed))
                  : 0,
            }
          : defaultProg;

      return {
        muted: typeof parsed.muted === 'boolean' ? parsed.muted : defaults.muted,
        totalGamesPlayed:
          typeof parsed.totalGamesPlayed === 'number' ? parsed.totalGamesPlayed : 0,
        totalArcadeScore:
          typeof parsed.totalArcadeScore === 'number' ? parsed.totalArcadeScore : 0,
        lastPlayedGameId:
          typeof parsed.lastPlayedGameId === 'string'
            ? parsed.lastPlayedGameId
            : defaults.lastPlayedGameId,
        games,
        iap,
        progression,
      };
    } catch {
      return createDefaultSave();
    }
  }

  private static migrateLegacyIfPresent(): ArcadeSaveData {
    const fresh = createDefaultSave();
    try {
      const legacyRaw = window.localStorage.getItem(LEGACY_ORBIT_STORAGE_KEY);
      if (!legacyRaw) {
        return fresh;
      }
      const legacy = JSON.parse(legacyRaw) as LegacyOrbitPulseSave;
      const highScore = typeof legacy.highScore === 'number' ? legacy.highScore : 0;
      const lastScore = typeof legacy.lastScore === 'number' ? legacy.lastScore : 0;
      const gamesPlayed = typeof legacy.gamesPlayed === 'number' ? legacy.gamesPlayed : 0;
      const muted = typeof legacy.muted === 'boolean' ? legacy.muted : false;

      fresh.muted = muted;
      fresh.totalGamesPlayed = gamesPlayed;
      fresh.totalArcadeScore = highScore;
      fresh.games['orbit-pulse'] = {
        highScore,
        lastScore,
        gamesPlayed,
      };
      this.save(fresh);
      return fresh;
    } catch {
      return fresh;
    }
  }

  static save(data: ArcadeSaveData): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignore storage quota errors
    }
  }

  static getGameStats(gameId: string): PerGameStats {
    const data = this.load();
    return data.games[gameId]
      ? { ...data.games[gameId] }
      : { highScore: 0, lastScore: 0, gamesPlayed: 0 };
  }

  static getIap(): IapEntitlements {
    return { ...this.load().iap };
  }

  static getProgression(): PlayerProgression {
    const p = this.load().progression;
    return {
      ...p,
      favorites: [...p.favorites],
      achievements: [...p.achievements],
    };
  }

  static updateIap(patch: Partial<IapEntitlements>): ArcadeSaveData {
    const current = this.load();
    const updated: ArcadeSaveData = {
      ...current,
      iap: {
        ...current.iap,
        ...patch,
      },
    };
    this.save(updated);
    return updated;
  }

  static consumeContinueToken(): boolean {
    const current = this.load();
    if (current.iap.continueTokens <= 0) {
      return false;
    }
    const updated: ArcadeSaveData = {
      ...current,
      iap: {
        ...current.iap,
        continueTokens: current.iap.continueTokens - 1,
      },
      progression: {
        ...current.progression,
        revivesUsed: current.progression.revivesUsed + 1,
      },
    };
    this.save(updated);
    return true;
  }

  static incrementRevivesUsed(): void {
    const current = this.load();
    current.progression.revivesUsed += 1;
    this.save(current);
  }

  static addContinueTokens(count: number): ArcadeSaveData {
    const current = this.load();
    const addAmount = Math.max(0, Math.floor(count));
    const updated: ArcadeSaveData = {
      ...current,
      iap: {
        ...current.iap,
        continueTokens: current.iap.continueTokens + addAmount,
      },
    };
    this.save(updated);
    return updated;
  }

  static recordGameRun(gameId: string, score: number): ArcadeSaveData {
    const current = this.load();
    const prev = current.games[gameId] ?? { highScore: 0, lastScore: 0, gamesPlayed: 0 };
    const cleanScore = Math.max(0, Math.floor(score));

    const updated: ArcadeSaveData = {
      ...current,
      totalGamesPlayed: current.totalGamesPlayed + 1,
      totalArcadeScore: current.totalArcadeScore + cleanScore,
      lastPlayedGameId: gameId,
      games: {
        ...current.games,
        [gameId]: {
          highScore: Math.max(prev.highScore, cleanScore),
          lastScore: cleanScore,
          gamesPlayed: prev.gamesPlayed + 1,
        },
      },
    };

    this.save(updated);
    return updated;
  }

  static setMuted(muted: boolean): ArcadeSaveData {
    const current = this.load();
    const updated: ArcadeSaveData = {
      ...current,
      muted,
    };
    this.save(updated);
    return updated;
  }

  static checkDailyLoginStreak(): {
    isNewDay: boolean;
    streakDays: number;
    rewardTokens: number;
  } {
    const current = this.load();
    const today = this.getTodayKey();
    if (current.progression.lastLoginDate === today) {
      return {
        isNewDay: false,
        streakDays: Math.max(1, current.progression.streakDays),
        rewardTokens: 0,
      };
    }

    const yesterday = this.getYesterdayKey();
    const nextStreak =
      current.progression.lastLoginDate === yesterday
        ? current.progression.streakDays + 1
        : 1;
    const rewardTokens = nextStreak % 5 === 0 ? 2 : 1;

    current.progression.lastLoginDate = today;
    current.progression.streakDays = nextStreak;
    current.iap.continueTokens += rewardTokens;
    this.save(current);

    return {
      isNewDay: true,
      streakDays: nextStreak,
      rewardTokens,
    };
  }

  static toggleFavorite(gameId: string): boolean {
    const current = this.load();
    const idx = current.progression.favorites.indexOf(gameId);
    let isFav: boolean;
    if (idx >= 0) {
      current.progression.favorites.splice(idx, 1);
      isFav = false;
    } else {
      current.progression.favorites.push(gameId);
      isFav = true;
    }
    this.save(current);
    return isFav;
  }

  static addXp(amount: number): ArcadeSaveData {
    const current = this.load();
    current.progression.xp += Math.max(0, Math.floor(amount));
    this.save(current);
    return current;
  }

  static unlockAchievement(
    achievementId: string,
    rewardXp: number,
    rewardTokens: number
  ): boolean {
    const current = this.load();
    if (current.progression.achievements.includes(achievementId)) {
      return false;
    }
    current.progression.achievements.push(achievementId);
    current.progression.xp += Math.max(0, Math.floor(rewardXp));
    current.iap.continueTokens += Math.max(0, Math.floor(rewardTokens));
    this.save(current);
    return true;
  }

  static markDailyChallengeComplete(): boolean {
    const current = this.load();
    const today = this.getTodayKey();
    if (current.progression.dailyChallengeCompletedDate === today) {
      return false;
    }
    current.progression.dailyChallengeCompletedDate = today;
    current.progression.xp += 200;
    current.iap.continueTokens += 2;
    this.save(current);
    return true;
  }

  static getLevelInfo(xp: number): {
    level: number;
    rank: string;
    currentLevelXp: number;
    nextLevelXp: number;
    progress: number;
  } {
    const xpPerLevel = 250;
    const level = Math.floor(xp / xpPerLevel) + 1;
    const currentLevelXp = xp % xpPerLevel;
    const rank = RANK_TITLES[Math.min(level - 1, RANK_TITLES.length - 1)];
    return {
      level,
      rank,
      currentLevelXp,
      nextLevelXp: xpPerLevel,
      progress: currentLevelXp / xpPerLevel,
    };
  }

  static resetAll(): ArcadeSaveData {
    const fresh = createDefaultSave();
    this.save(fresh);
    return fresh;
  }
}
