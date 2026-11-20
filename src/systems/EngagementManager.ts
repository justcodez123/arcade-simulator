import {
  GAME_CATALOG,
  GameManifest,
  getGameManifest,
  getMedalForScore,
} from '../registry/GameRegistry';
import { StorageManager } from '../storage';

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  rewardXp: number;
  rewardTokens: number;
  icon: string;
}

export interface DailyChallengeInfo {
  game: GameManifest;
  targetScore: number;
  completed: boolean;
  rewardTokens: number;
  rewardXp: number;
}

export interface RunEvaluationResult {
  xpGained: number;
  dailyCompletedNow: boolean;
  newlyUnlocked: AchievementDef[];
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first-run',
    title: 'Arcade Debut',
    description: 'Complete your first game run',
    rewardXp: 30,
    rewardTokens: 1,
    icon: '🕹️',
  },
  {
    id: 'explorer-5',
    title: 'Cartridge Hopper',
    description: 'Play 5 different games',
    rewardXp: 75,
    rewardTokens: 1,
    icon: '🎮',
  },
  {
    id: 'explorer-10',
    title: 'Console Regular',
    description: 'Play 10 different games',
    rewardXp: 150,
    rewardTokens: 2,
    icon: '👾',
  },
  {
    id: 'bronze-hunter',
    title: 'Bronze Collector',
    description: 'Earn Bronze medal or higher on 3 games',
    rewardXp: 60,
    rewardTokens: 1,
    icon: '🥉',
  },
  {
    id: 'gold-ace',
    title: 'Golden Ace',
    description: 'Earn a Gold medal in any game',
    rewardXp: 120,
    rewardTokens: 2,
    icon: '🥇',
  },
  {
    id: 'score-25',
    title: 'Hot Streak',
    description: 'Score 25+ in a single run',
    rewardXp: 80,
    rewardTokens: 1,
    icon: '🔥',
  },
  {
    id: 'score-50',
    title: 'High Roller',
    description: 'Score 50+ in a single run',
    rewardXp: 150,
    rewardTokens: 2,
    icon: '⚡',
  },
  {
    id: 'veteran-15',
    title: 'Arcade Veteran',
    description: 'Complete 15 total arcade runs',
    rewardXp: 100,
    rewardTokens: 2,
    icon: '🏅',
  },
  {
    id: 'second-wind',
    title: 'Second Wind',
    description: 'Use a Continue Token to revive',
    rewardXp: 50,
    rewardTokens: 1,
    icon: '★',
  },
  {
    id: 'daily-hero',
    title: 'Daily Champion',
    description: 'Complete a Daily Featured Challenge',
    rewardXp: 150,
    rewardTokens: 2,
    icon: '📅',
  },
  {
    id: 'collector-pack',
    title: 'Expansion Owner',
    description: 'Unlock 20-Game Pack or Complete Pass',
    rewardXp: 200,
    rewardTokens: 2,
    icon: '💎',
  },
  {
    id: 'all-access-vip',
    title: 'Pocket Legend',
    description: 'Unlock Complete 50-Game Access',
    rewardXp: 500,
    rewardTokens: 3,
    icon: '👑',
  },
];

function hashDateKey(dateKey: string): number {
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export class EngagementManager {
  static getDailyChallenge(): DailyChallengeInfo {
    const today = StorageManager.getTodayKey();
    const prog = StorageManager.getProgression();
    const freeGames = GAME_CATALOG.filter((g) => g.tier === 'free');
    const chosen = freeGames[hashDateKey(today) % freeGames.length];

    return {
      game: chosen,
      targetScore: chosen.medals[0],
      completed: prog.dailyChallengeCompletedDate === today,
      rewardTokens: 2,
      rewardXp: 200,
    };
  }

  static evaluateShopAchievements(): AchievementDef[] {
    const save = StorageManager.load();
    const unlocked: AchievementDef[] = [];

    const checkAndGrant = (id: string, condition: boolean): void => {
      if (!condition) return;
      const def = ACHIEVEMENTS.find((a) => a.id === id);
      if (!def) return;
      if (StorageManager.unlockAchievement(def.id, def.rewardXp, def.rewardTokens)) {
        unlocked.push(def);
      }
    };

    checkAndGrant('collector-pack', save.iap.pack20Owned || save.iap.complete50Owned);
    checkAndGrant('all-access-vip', save.iap.complete50Owned);

    return unlocked;
  }

  static evaluateAfterRun(gameId: string, score: number): RunEvaluationResult {
    const xpGained = Math.min(250, 15 + Math.max(0, Math.floor(score)) * 4);
    StorageManager.addXp(xpGained);

    let dailyCompletedNow = false;
    const daily = this.getDailyChallenge();
    if (!daily.completed && gameId === daily.game.id && score >= daily.targetScore) {
      dailyCompletedNow = StorageManager.markDailyChallengeComplete();
    }

    const save = StorageManager.load();
    const distinctPlayed = Object.values(save.games).filter((s) => s.gamesPlayed > 0).length;

    let bronzeOrBetterCount = 0;
    let hasGold = false;
    for (const [id, stats] of Object.entries(save.games)) {
      if (stats.highScore <= 0) continue;
      const manifest = getGameManifest(id);
      const medal = getMedalForScore(manifest, stats.highScore);
      if (medal !== 'NONE') bronzeOrBetterCount++;
      if (medal === 'GOLD') hasGold = true;
    }

    const newlyUnlocked: AchievementDef[] = [];
    const checkAndGrant = (id: string, condition: boolean): void => {
      if (!condition) return;
      const def = ACHIEVEMENTS.find((a) => a.id === id);
      if (!def) return;
      if (StorageManager.unlockAchievement(def.id, def.rewardXp, def.rewardTokens)) {
        newlyUnlocked.push(def);
      }
    };

    checkAndGrant('first-run', save.totalGamesPlayed >= 1);
    checkAndGrant('explorer-5', distinctPlayed >= 5);
    checkAndGrant('explorer-10', distinctPlayed >= 10);
    checkAndGrant('bronze-hunter', bronzeOrBetterCount >= 3);
    checkAndGrant('gold-ace', hasGold);
    checkAndGrant('score-25', score >= 25);
    checkAndGrant('score-50', score >= 50);
    checkAndGrant('veteran-15', save.totalGamesPlayed >= 15);
    checkAndGrant('second-wind', save.progression.revivesUsed >= 1);
    checkAndGrant(
      'daily-hero',
      save.progression.dailyChallengeCompletedDate === StorageManager.getTodayKey()
    );
    checkAndGrant('collector-pack', save.iap.pack20Owned || save.iap.complete50Owned);
    checkAndGrant('all-access-vip', save.iap.complete50Owned);

    return {
      xpGained,
      dailyCompletedNow,
      newlyUnlocked,
    };
  }
}
