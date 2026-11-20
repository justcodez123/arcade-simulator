import Phaser from 'phaser';
import { ArcadeHubScene } from './scenes/ArcadeHubScene';
import { ArcadeShopScene } from './scenes/ArcadeShopScene';
import { ArcadeTrophiesScene } from './scenes/ArcadeTrophiesScene';
import { AstroDodgeScene } from './scenes/games/AstroDodgeScene';
import { CyberPongScene } from './scenes/games/CyberPongScene';
import { CyberSnakeScene } from './scenes/games/CyberSnakeScene';
import { FlapDashScene } from './scenes/games/FlapDashScene';
import { LaneRunnerScene } from './scenes/games/LaneRunnerScene';
import { NeonBreakerScene } from './scenes/games/NeonBreakerScene';
import { OrbitPulseScene } from './scenes/games/OrbitPulseScene';
import { PulseStackScene } from './scenes/games/PulseStackScene';
import { ReflexGridScene } from './scenes/games/ReflexGridScene';
import { SkyHopperScene } from './scenes/games/SkyHopperScene';
import {
  DPR,
  HiDpiScenePlugin,
  installRetinaTextPatch,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
} from './utils/HiDpi';

installRetinaTextPatch();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: LOGICAL_WIDTH * DPR,
  height: LOGICAL_HEIGHT * DPR,
  backgroundColor: '#060913',
  render: {
    antialias: true,
    antialiasGL: true,
    pixelArt: false,
    roundPixels: false,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  plugins: {
    scene: [
      {
        key: 'HiDpiScenePlugin',
        plugin: HiDpiScenePlugin,
        mapping: 'hiDpi',
        start: true,
      },
    ],
  },
  scene: [
    ArcadeHubScene,
    ArcadeShopScene,
    ArcadeTrophiesScene,
    OrbitPulseScene,
    NeonBreakerScene,
    CyberSnakeScene,
    AstroDodgeScene,
    PulseStackScene,
    FlapDashScene,
    CyberPongScene,
    SkyHopperScene,
    ReflexGridScene,
    LaneRunnerScene,
  ],
  audio: {
    noAudio: true, // Uses hybrid procedural Web Audio SFX + bundled offline Gemini audio
  },
  banner: false,
};

window.addEventListener('DOMContentLoaded', () => {
  new Phaser.Game(config);
});
