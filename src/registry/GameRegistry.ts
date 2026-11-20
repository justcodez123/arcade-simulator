import { GameTier, IapEntitlements } from '../storage';

export type EngineType =
  | 'orbit'
  | 'breaker'
  | 'snake'
  | 'astro'
  | 'stack'
  | 'flap'
  | 'pong'
  | 'hopper'
  | 'reflex'
  | 'lane';

export interface GameManifest {
  index: number;
  id: string;
  title: string;
  subtitle: string;
  category: string;
  tier: GameTier;
  engine: EngineType;
  sceneKey: string;
  accentHex: string;
  accentColor: number;
  controlsHint: string;
  medals: [number, number, number];
  rules: Record<string, number | boolean | string>;
}

const SCENE_MAP: Record<EngineType, string> = {
  orbit: 'OrbitPulseScene',
  breaker: 'NeonBreakerScene',
  snake: 'CyberSnakeScene',
  astro: 'AstroDodgeScene',
  stack: 'PulseStackScene',
  flap: 'FlapDashScene',
  pong: 'CyberPongScene',
  hopper: 'SkyHopperScene',
  reflex: 'ReflexGridScene',
  lane: 'LaneRunnerScene',
};

interface RawGameEntry {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  tier: GameTier;
  engine: EngineType;
  accentHex: string;
  accentColor: number;
  controlsHint: string;
  medals: [number, number, number];
  rules: Record<string, number | boolean | string>;
}

const RAW_GAMES: RawGameEntry[] = [
  // =========================================================================
  // TIER 1: FREE DEFAULT GAMES (#01 - #10) — 1 Flagship per Core Engine
  // =========================================================================
  {
    id: 'orbit-pulse',
    title: 'ORBIT PULSE',
    subtitle: 'Dual-ring orbital dodge & collect',
    category: 'REFLEX',
    tier: 'free',
    engine: 'orbit',
    accentHex: '#38bdf8',
    accentColor: 0x38bdf8,
    controlsHint: 'Tap / SPACE to switch orbit rings',
    medals: [8, 18, 32],
    rules: { rings: 2, baseSpeed: 2.1, hazardSpeed: 1.45, maxHazards: 4 },
  },
  {
    id: 'neon-breaker',
    title: 'NEON BREAKER',
    subtitle: 'Shatter 5x6 synth brick waves',
    category: 'ARCADE',
    tier: 'free',
    engine: 'breaker',
    accentHex: '#a855f7',
    accentColor: 0xa855f7,
    controlsHint: 'Drag or LEFT/RIGHT keys to move paddle',
    medals: [15, 35, 65],
    rules: { pattern: 'classic', ballSpeed: 270, paddleWidth: 76 },
  },
  {
    id: 'cyber-snake',
    title: 'CYBER SNAKE',
    subtitle: 'Retro grid serpent data harvest',
    category: 'RETRO',
    tier: 'free',
    engine: 'snake',
    accentHex: '#10b981',
    accentColor: 0x10b981,
    controlsHint: 'Swipe, D-Pad, or Arrow/WASD keys',
    medals: [8, 18, 30],
    rules: { stepMs: 145, wrapWalls: false, obstacles: false },
  },
  {
    id: 'astro-dodge',
    title: 'ASTRO DODGE',
    subtitle: 'Auto-fire starfighter vs meteor storm',
    category: 'SHMUP',
    tier: 'free',
    engine: 'astro',
    accentHex: '#f59e0b',
    accentColor: 0xf59e0b,
    controlsHint: 'Drag or LEFT/RIGHT keys to steer fighter',
    medals: [12, 28, 50],
    rules: { spreadShot: 1, fireMs: 240, meteorSpeed: 1.0 },
  },
  {
    id: 'pulse-stack',
    title: 'PULSE STACK',
    subtitle: 'Precision one-tap neon tower builder',
    category: 'TIMING',
    tier: 'free',
    engine: 'stack',
    accentHex: '#ec4899',
    accentColor: 0xec4899,
    controlsHint: 'Tap / SPACE to drop & align moving slab',
    medals: [10, 22, 40],
    rules: { startWidth: 180, speedBase: 155, perfectWindow: 5 },
  },
  {
    id: 'neon-flap',
    title: 'NEON FLAP',
    subtitle: 'Tap thruster through laser gates',
    category: 'ACTION',
    tier: 'free',
    engine: 'flap',
    accentHex: '#22d3ee',
    accentColor: 0x22d3ee,
    controlsHint: 'Tap / SPACE / UP to boost thruster',
    medals: [6, 15, 28],
    rules: { gravity: 780, gapSize: 144, gateSpeed: 145, movingGates: false },
  },
  {
    id: 'cyber-pong',
    title: 'CYBER PONG',
    subtitle: 'Neon paddle duel against synth AI',
    category: 'SPORTS',
    tier: 'free',
    engine: 'pong',
    accentHex: '#6366f1',
    accentColor: 0x6366f1,
    controlsHint: 'Drag or LEFT/RIGHT keys to deflect ball',
    medals: [8, 18, 35],
    rules: { aiSkill: 0.65, ballSpeed: 265, paddleWidth: 78, centerBumper: false },
  },
  {
    id: 'sky-hopper',
    title: 'SKY HOPPER',
    subtitle: 'Endless vertical neon platform climb',
    category: 'JUMPER',
    tier: 'free',
    engine: 'hopper',
    accentHex: '#14b8a6',
    accentColor: 0x14b8a6,
    controlsHint: 'Drag or LEFT/RIGHT keys while rising',
    medals: [15, 35, 65],
    rules: { springRatio: 0.16, movingRatio: 0.18, fragileRatio: 0.08 },
  },
  {
    id: 'reflex-matrix',
    title: 'REFLEX MATRIX',
    subtitle: '3x3 cyber target speed reaction',
    category: 'BRAIN',
    tier: 'free',
    engine: 'reflex',
    accentHex: '#f43f5e',
    accentColor: 0xf43f5e,
    controlsHint: 'Tap glowing pads before energy drains',
    medals: [15, 30, 50],
    rules: { gridSize: 3, bombChance: 0.12, lifetimeMs: 1450 },
  },
  {
    id: 'hyper-lane',
    title: 'HYPER LANE',
    subtitle: '3-lane neon cyber highway racer',
    category: 'RACER',
    tier: 'free',
    engine: 'lane',
    accentHex: '#eab308',
    accentColor: 0xeab308,
    controlsHint: 'Tap left/right, swipe, or Arrow keys',
    medals: [15, 32, 60],
    rules: { lanes: 3, scrollSpeed: 250, spawnMs: 740 },
  },

  // =========================================================================
  // TIER 2: $0.99 20-GAME EXPANSION PACK (#11 - #20)
  // =========================================================================
  {
    id: 'tri-orbit-warp',
    title: 'TRI-ORBIT WARP',
    subtitle: '3-ring reactor & reverse-spin pickups',
    category: 'REFLEX',
    tier: 'pack20',
    engine: 'orbit',
    accentHex: '#06b6d4',
    accentColor: 0x06b6d4,
    controlsHint: 'Tap / SPACE to cycle all 3 rings',
    medals: [8, 18, 30],
    rules: { rings: 3, baseSpeed: 2.25, reverseOnCollect: true, maxHazards: 5 },
  },
  {
    id: 'fortress-breaker',
    title: 'FORTRESS BREAKER',
    subtitle: 'Armored brick castle & fast plasma ball',
    category: 'ARCADE',
    tier: 'pack20',
    engine: 'breaker',
    accentHex: '#c084fc',
    accentColor: 0xc084fc,
    controlsHint: 'Drag or LEFT/RIGHT keys to shatter fortress',
    medals: [18, 40, 70],
    rules: { pattern: 'fortress', ballSpeed: 310, paddleWidth: 82 },
  },
  {
    id: 'portal-snake',
    title: 'PORTAL SNAKE',
    subtitle: 'Wrap-around walls & turbo cyber grid',
    category: 'RETRO',
    tier: 'pack20',
    engine: 'snake',
    accentHex: '#34d399',
    accentColor: 0x34d399,
    controlsHint: 'Walls warp to opposite edge — avoid self!',
    medals: [12, 24, 40],
    rules: { stepMs: 120, wrapWalls: true, obstacles: false },
  },
  {
    id: 'twin-blaster',
    title: 'TWIN BLASTER',
    subtitle: 'Dual spread-cannons vs asteroid belt',
    category: 'SHMUP',
    tier: 'pack20',
    engine: 'astro',
    accentHex: '#fb923c',
    accentColor: 0xfb923c,
    controlsHint: 'Dual plasma cannons auto-fire upward',
    medals: [18, 38, 70],
    rules: { spreadShot: 2, fireMs: 220, meteorSpeed: 1.18 },
  },
  {
    id: 'skyline-micro',
    title: 'SKYLINE MICRO',
    subtitle: 'Narrow start blocks & high-speed drops',
    category: 'TIMING',
    tier: 'pack20',
    engine: 'stack',
    accentHex: '#f472b6',
    accentColor: 0xf472b6,
    controlsHint: 'Precision narrow tower stacking',
    medals: [8, 18, 32],
    rules: { startWidth: 136, speedBase: 195, perfectWindow: 5 },
  },
  {
    id: 'moving-laser-run',
    title: 'MOVING LASER RUN',
    subtitle: 'Oscillating plasma barriers in flight',
    category: 'ACTION',
    tier: 'pack20',
    engine: 'flap',
    accentHex: '#38bdf8',
    accentColor: 0x38bdf8,
    controlsHint: 'Tap to dodge vertically moving laser gates',
    medals: [6, 14, 26],
    rules: { gravity: 810, gapSize: 138, gateSpeed: 155, movingGates: true },
  },
  {
    id: 'bumper-pong',
    title: 'BUMPER PONG',
    subtitle: 'Center prism deflector arena duel',
    category: 'SPORTS',
    tier: 'pack20',
    engine: 'pong',
    accentHex: '#818cf8',
    accentColor: 0x818cf8,
    controlsHint: 'Center diamond deflects ball unpredictably',
    medals: [10, 22, 40],
    rules: { aiSkill: 0.74, ballSpeed: 295, paddleWidth: 74, centerBumper: true },
  },
  {
    id: 'spring-climber',
    title: 'SPRING CLIMBER',
    subtitle: 'Super-charged bounce pads & moving ledges',
    category: 'JUMPER',
    tier: 'pack20',
    engine: 'hopper',
    accentHex: '#2dd4bf',
    accentColor: 0x2dd4bf,
    controlsHint: 'Chain cyan spring pads for massive altitude',
    medals: [22, 48, 85],
    rules: { springRatio: 0.35, movingRatio: 0.28, fragileRatio: 0.1 },
  },
  {
    id: 'quad-blitz-4x4',
    title: 'QUAD BLITZ 4x4',
    subtitle: '16-pad reflex grid with bomb decoys',
    category: 'BRAIN',
    tier: 'pack20',
    engine: 'reflex',
    accentHex: '#fb7185',
    accentColor: 0xfb7185,
    controlsHint: 'Tap targets fast — avoid crimson bombs!',
    medals: [18, 35, 60],
    rules: { gridSize: 4, bombChance: 0.2, lifetimeMs: 1250 },
  },
  {
    id: 'quad-highway',
    title: 'QUAD HIGHWAY',
    subtitle: '4-lane turbo synthwave night traffic',
    category: 'RACER',
    tier: 'pack20',
    engine: 'lane',
    accentHex: '#facc15',
    accentColor: 0xfacc15,
    controlsHint: 'Weave across 4 high-speed lanes',
    medals: [18, 38, 70],
    rules: { lanes: 4, scrollSpeed: 290, spawnMs: 640 },
  },

  // =========================================================================
  // TIER 3: $2.99 COMPLETE ALL-ACCESS PASS (#21 - #50) — 30 Master Cartridges
  // =========================================================================
  // --- Orbit Engine Variants (3) ---
  {
    id: 'hyper-orbit-x',
    title: 'HYPER ORBIT X',
    subtitle: 'High-velocity twin ring survival sprint',
    category: 'REFLEX',
    tier: 'full50',
    engine: 'orbit',
    accentHex: '#0ea5e9',
    accentColor: 0x0ea5e9,
    controlsHint: 'Blazing orbital velocity — rapid switches!',
    medals: [10, 22, 38],
    rules: { rings: 2, baseSpeed: 3.1, hazardSpeed: 2.0, maxHazards: 5 },
  },
  {
    id: 'orbit-gauntlet',
    title: 'ORBIT GAUNTLET',
    subtitle: '3-ring swarm with 6 counter-pulses',
    category: 'REFLEX',
    tier: 'full50',
    engine: 'orbit',
    accentHex: '#f43f5e',
    accentColor: 0xf43f5e,
    controlsHint: 'Weave across 3 rings against dense hazards',
    medals: [8, 16, 28],
    rules: { rings: 3, baseSpeed: 2.45, hazardSpeed: 1.75, maxHazards: 6 },
  },
  {
    id: 'quantum-ring',
    title: 'QUANTUM RING',
    subtitle: 'Reverse-spin warp + tight inner core',
    category: 'REFLEX',
    tier: 'full50',
    engine: 'orbit',
    accentHex: '#a78bfa',
    accentColor: 0xa78bfa,
    controlsHint: 'Direction reverses on every cyan orb!',
    medals: [10, 20, 35],
    rules: { rings: 2, baseSpeed: 2.55, reverseOnCollect: true, maxHazards: 5 },
  },

  // --- Breaker Engine Variants (3) ---
  {
    id: 'pyramid-smash',
    title: 'PYRAMID SMASH',
    subtitle: 'Stepped neon pyramid brick formation',
    category: 'ARCADE',
    tier: 'full50',
    engine: 'breaker',
    accentHex: '#d946ef',
    accentColor: 0xd946ef,
    controlsHint: 'Carve through stepped pyramid flanks',
    medals: [15, 35, 65],
    rules: { pattern: 'pyramid', ballSpeed: 295, paddleWidth: 74 },
  },
  {
    id: 'diamond-core-breaker',
    title: 'DIAMOND BREAKER',
    subtitle: 'Precision diamond cluster & laser paddle',
    category: 'ARCADE',
    tier: 'full50',
    engine: 'breaker',
    accentHex: '#38bdf8',
    accentColor: 0x38bdf8,
    controlsHint: 'Narrow paddle vs tight diamond rack',
    medals: [15, 32, 60],
    rules: { pattern: 'diamond', ballSpeed: 325, paddleWidth: 62 },
  },
  {
    id: 'retro-invaders-wall',
    title: 'INVADERS WALL',
    subtitle: 'Checkerboard pixel alien brick siege',
    category: 'ARCADE',
    tier: 'full50',
    engine: 'breaker',
    accentHex: '#10b981',
    accentColor: 0x10b981,
    controlsHint: 'High-speed checkerboard ricochets',
    medals: [20, 42, 75],
    rules: { pattern: 'checker', ballSpeed: 340, paddleWidth: 70 },
  },

  // --- Snake Engine Variants (3) ---
  {
    id: 'maze-viper',
    title: 'MAZE VIPER',
    subtitle: 'Cybernetic pillar obstacles inside grid',
    category: 'RETRO',
    tier: 'full50',
    engine: 'snake',
    accentHex: '#22c55e',
    accentColor: 0x22c55e,
    controlsHint: 'Dodge grid walls AND neon obstacle blocks',
    medals: [8, 16, 28],
    rules: { stepMs: 135, wrapWalls: false, obstacles: true },
  },
  {
    id: 'hyper-serpent',
    title: 'HYPER SERPENT',
    subtitle: 'Lightning-fast 95ms tick reflex snake',
    category: 'RETRO',
    tier: 'full50',
    engine: 'snake',
    accentHex: '#eab308',
    accentColor: 0xeab308,
    controlsHint: 'Extreme speed — plan turns early!',
    medals: [6, 14, 24],
    rules: { stepMs: 95, wrapWalls: false, obstacles: false },
  },
  {
    id: 'quantum-mamba',
    title: 'QUANTUM MAMBA',
    subtitle: 'Warp portals + central hazard pillars',
    category: 'RETRO',
    tier: 'full50',
    engine: 'snake',
    accentHex: '#14b8a6',
    accentColor: 0x14b8a6,
    controlsHint: 'Walls warp, central pillars stay lethal!',
    medals: [10, 22, 36],
    rules: { stepMs: 112, wrapWalls: true, obstacles: true },
  },

  // --- Astro Engine Variants (3) ---
  {
    id: 'triple-nova-shmup',
    title: 'TRIPLE NOVA',
    subtitle: '3-way plasma fan vs dense meteor rain',
    category: 'SHMUP',
    tier: 'full50',
    engine: 'astro',
    accentHex: '#f97316',
    accentColor: 0xf97316,
    controlsHint: 'Triple spread cannon — blast heavy rocks',
    medals: [25, 55, 95],
    rules: { spreadShot: 3, fireMs: 210, meteorSpeed: 1.3 },
  },
  {
    id: 'meteor-blitz',
    title: 'METEOR BLITZ',
    subtitle: 'Rapid-fire interceptor vs Mach-2 rocks',
    category: 'SHMUP',
    tier: 'full50',
    engine: 'astro',
    accentHex: '#ef4444',
    accentColor: 0xef4444,
    controlsHint: 'Ultra-fast meteors — keep dodging!',
    medals: [20, 45, 80],
    rules: { spreadShot: 2, fireMs: 165, meteorSpeed: 1.48 },
  },
  {
    id: 'galax-overdrive',
    title: 'GALAX OVERDRIVE',
    subtitle: 'Heavy boss boulders & star core rush',
    category: 'SHMUP',
    tier: 'full50',
    engine: 'astro',
    accentHex: '#eab308',
    accentColor: 0xeab308,
    controlsHint: 'High-HP golden meteors drop big points',
    medals: [25, 55, 100],
    rules: { spreadShot: 3, fireMs: 185, meteorSpeed: 1.25, heavyRate: 0.6 },
  },

  // --- Stack Engine Variants (3) ---
  {
    id: 'razor-tower',
    title: 'RAZOR TOWER',
    subtitle: 'Ultra-slim 105px slab precision challenge',
    category: 'TIMING',
    tier: 'full50',
    engine: 'stack',
    accentHex: '#f43f5e',
    accentColor: 0xf43f5e,
    controlsHint: 'Tiny starting slab — hit perfect streaks!',
    medals: [8, 16, 28],
    rules: { startWidth: 105, speedBase: 190, perfectWindow: 4 },
  },
  {
    id: 'turbo-monolith',
    title: 'TURBO MONOLITH',
    subtitle: 'High-velocity oscillating neon slabs',
    category: 'TIMING',
    tier: 'full50',
    engine: 'stack',
    accentHex: '#d946ef',
    accentColor: 0xd946ef,
    controlsHint: 'Fast lateral sweep — drop on beat!',
    medals: [10, 22, 38],
    rules: { startWidth: 165, speedBase: 235, perfectWindow: 6 },
  },
  {
    id: 'zen-spire',
    title: 'ZEN SPIRE',
    subtitle: 'Wide forgiving slabs with strict perfects',
    category: 'TIMING',
    tier: 'full50',
    engine: 'stack',
    accentHex: '#a855f7',
    accentColor: 0xa855f7,
    controlsHint: 'Build sky-high mega towers',
    medals: [15, 30, 55],
    rules: { startWidth: 210, speedBase: 145, perfectWindow: 3 },
  },

  // --- Flap Engine Variants (3) ---
  {
    id: 'gravity-flip-flap',
    title: 'ANTIGRAVITY FLAP',
    subtitle: 'Inverted ceiling gravity laser flight',
    category: 'ACTION',
    tier: 'full50',
    engine: 'flap',
    accentHex: '#c084fc',
    accentColor: 0xc084fc,
    controlsHint: 'Gravity pulls UP — tap to dive downward!',
    medals: [6, 14, 24],
    rules: { gravity: -760, gapSize: 148, gateSpeed: 145, reverseGravity: true },
  },
  {
    id: 'cyber-canyon-flap',
    title: 'CYBER CANYON',
    subtitle: 'Tight 118px laser apertures at speed',
    category: 'ACTION',
    tier: 'full50',
    engine: 'flap',
    accentHex: '#f59e0b',
    accentColor: 0xf59e0b,
    controlsHint: 'Thread razor-tight neon laser gaps',
    medals: [5, 12, 22],
    rules: { gravity: 840, gapSize: 118, gateSpeed: 165, movingGates: false },
  },
  {
    id: 'hyper-jetpack',
    title: 'HYPER JETPACK',
    subtitle: 'Mach-speed moving gates & turbo thrust',
    category: 'ACTION',
    tier: 'full50',
    engine: 'flap',
    accentHex: '#ec4899',
    accentColor: 0xec4899,
    controlsHint: 'Fast moving laser gates — stay sharp!',
    medals: [6, 15, 28],
    rules: { gravity: 920, gapSize: 132, gateSpeed: 190, movingGates: true },
  },

  // --- Pong Engine Variants (3) ---
  {
    id: 'double-ball-pong',
    title: 'TWIN BALL PONG',
    subtitle: 'Juggle two live neon balls simultaneously',
    category: 'SPORTS',
    tier: 'full50',
    engine: 'pong',
    accentHex: '#38bdf8',
    accentColor: 0x38bdf8,
    controlsHint: 'Deflect BOTH balls against the AI!',
    medals: [10, 24, 45],
    rules: { aiSkill: 0.7, ballSpeed: 245, paddleWidth: 82, doubleBall: true },
  },
  {
    id: 'grandmaster-pong',
    title: 'AI GRANDMASTER',
    subtitle: 'Pro-level AI reflex & micro paddle',
    category: 'SPORTS',
    tier: 'full50',
    engine: 'pong',
    accentHex: '#f43f5e',
    accentColor: 0xf43f5e,
    controlsHint: 'Tiny paddle vs relentless neon AI',
    medals: [8, 18, 35],
    rules: { aiSkill: 0.92, ballSpeed: 325, paddleWidth: 58, centerBumper: false },
  },
  {
    id: 'pinball-pong',
    title: 'PINBALL ARENA',
    subtitle: 'Center bumper + twin balls madness',
    category: 'SPORTS',
    tier: 'full50',
    engine: 'pong',
    accentHex: '#10b981',
    accentColor: 0x10b981,
    controlsHint: 'Chaotic center bumper + dual balls',
    medals: [12, 28, 50],
    rules: { aiSkill: 0.78, ballSpeed: 270, paddleWidth: 80, centerBumper: true, doubleBall: true },
  },

  // --- Hopper Engine Variants (3) ---
  {
    id: 'fragile-cloud-hop',
    title: 'CRUMBLE SPIRE',
    subtitle: 'One-bounce fragile platforms shatter fast',
    category: 'JUMPER',
    tier: 'full50',
    engine: 'hopper',
    accentHex: '#fb923c',
    accentColor: 0xfb923c,
    controlsHint: 'Orange ledges break right after bounce!',
    medals: [15, 35, 60],
    rules: { springRatio: 0.2, movingRatio: 0.22, fragileRatio: 0.42 },
  },
  {
    id: 'turbo-bounce-hop',
    title: 'TURBO BOUNCE',
    subtitle: 'Moon-spring overdrive & moving steps',
    category: 'JUMPER',
    tier: 'full50',
    engine: 'hopper',
    accentHex: '#38bdf8',
    accentColor: 0x38bdf8,
    controlsHint: 'High-altitude moving neon platforms',
    medals: [25, 55, 95],
    rules: { springRatio: 0.4, movingRatio: 0.45, fragileRatio: 0.1 },
  },
  {
    id: 'void-climber',
    title: 'VOID CLIMBER',
    subtitle: 'Low-gravity precision ascent gauntlet',
    category: 'JUMPER',
    tier: 'full50',
    engine: 'hopper',
    accentHex: '#a855f7',
    accentColor: 0xa855f7,
    controlsHint: 'Master air control between sparse ledges',
    medals: [18, 40, 75],
    rules: { springRatio: 0.18, movingRatio: 0.35, fragileRatio: 0.25, gravity: 780 },
  },

  // --- Reflex Engine Variants (3) ---
  {
    id: 'bomb-squad-grid',
    title: 'BOMB SQUAD 4x4',
    subtitle: 'Minefield reflex grid — 35% bomb traps!',
    category: 'BRAIN',
    tier: 'full50',
    engine: 'reflex',
    accentHex: '#f59e0b',
    accentColor: 0xf59e0b,
    controlsHint: 'Look before tapping — bombs end run!',
    medals: [14, 28, 48],
    rules: { gridSize: 4, bombChance: 0.35, lifetimeMs: 1350 },
  },
  {
    id: 'flash-sniper-3x3',
    title: 'FLASH SNIPER',
    subtitle: 'Sub-second target flashes on 3x3 grid',
    category: 'BRAIN',
    tier: 'full50',
    engine: 'reflex',
    accentHex: '#22d3ee',
    accentColor: 0x22d3ee,
    controlsHint: 'Lightning-fast 900ms target decay!',
    medals: [12, 26, 45],
    rules: { gridSize: 3, bombChance: 0.15, lifetimeMs: 900 },
  },
  {
    id: 'matrix-overdrive-4x4',
    title: 'MATRIX OVERDRIVE',
    subtitle: 'Maximum speed 4x4 cyber endurance',
    category: 'BRAIN',
    tier: 'full50',
    engine: 'reflex',
    accentHex: '#ec4899',
    accentColor: 0xec4899,
    controlsHint: 'Rapid 4x4 arcade reflex marathon',
    medals: [20, 42, 72],
    rules: { gridSize: 4, bombChance: 0.22, lifetimeMs: 950 },
  },

  // --- Lane Engine Variants (3) ---
  {
    id: 'nitro-5-lanes',
    title: 'NITRO 5-LANE',
    subtitle: '5-lane megacity superhighway rush',
    category: 'RACER',
    tier: 'full50',
    engine: 'lane',
    accentHex: '#38bdf8',
    accentColor: 0x38bdf8,
    controlsHint: '5 wide cyber lanes at high speed',
    medals: [20, 42, 78],
    rules: { lanes: 5, scrollSpeed: 310, spawnMs: 560 },
  },
  {
    id: 'tunnel-3-warp',
    title: 'WARP TUNNEL',
    subtitle: 'Blistering 3-lane Mach velocity sprint',
    category: 'RACER',
    tier: 'full50',
    engine: 'lane',
    accentHex: '#f43f5e',
    accentColor: 0xf43f5e,
    controlsHint: 'Tight 3-lane dodge at extreme speed',
    medals: [16, 35, 65],
    rules: { lanes: 3, scrollSpeed: 350, spawnMs: 520 },
  },
  {
    id: 'cyber-grid-5x',
    title: 'CYBER AUTOBAN',
    subtitle: 'Dense 5-lane traffic & energy harvest',
    category: 'RACER',
    tier: 'full50',
    engine: 'lane',
    accentHex: '#10b981',
    accentColor: 0x10b981,
    controlsHint: 'Scoop cyan cells between 5-lane barriers',
    medals: [22, 48, 88],
    rules: { lanes: 5, scrollSpeed: 335, spawnMs: 490 },
  },
];

export const GAME_CATALOG: GameManifest[] = RAW_GAMES.map((raw, idx) => ({
  ...raw,
  index: idx + 1,
  sceneKey: SCENE_MAP[raw.engine],
}));

export function getGameManifest(id: string): GameManifest {
  return GAME_CATALOG.find((item) => item.id === id) ?? GAME_CATALOG[0];
}

export function isGameUnlocked(
  manifest: GameManifest,
  iap: IapEntitlements
): boolean {
  if (manifest.tier === 'free') return true;
  if (manifest.tier === 'pack20') return iap.pack20Owned || iap.complete50Owned;
  return iap.complete50Owned;
}

export function getUnlockedCount(iap: IapEntitlements): number {
  if (iap.complete50Owned) return GAME_CATALOG.length;
  if (iap.pack20Owned) return 20;
  return 10;
}

export function getMedalForScore(
  manifest: GameManifest,
  score: number
): 'NONE' | 'BRONZE' | 'SILVER' | 'GOLD' {
  if (score >= manifest.medals[2]) return 'GOLD';
  if (score >= manifest.medals[1]) return 'SILVER';
  if (score >= manifest.medals[0]) return 'BRONZE';
  return 'NONE';
}
