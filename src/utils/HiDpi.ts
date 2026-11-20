import Phaser from 'phaser';

export const LOGICAL_WIDTH = 400;
export const LOGICAL_HEIGHT = 700;

const rawDpr =
  typeof window !== 'undefined' && typeof window.devicePixelRatio === 'number'
    ? window.devicePixelRatio
    : 2;

export const DPR = Math.min(Math.max(Math.ceil(rawDpr), 2), 3);

export class HiDpiScenePlugin extends Phaser.Plugins.ScenePlugin {
  boot(): void {
    const events = this.systems?.events;
    if (!events) return;
    events.on(Phaser.Scenes.Events.START, this.applyCameraZoom, this);
    events.on(Phaser.Scenes.Events.CREATE, this.applyCameraZoom, this);
  }

  private applyCameraZoom(): void {
    const cam = this.scene?.cameras?.main;
    if (!cam) return;
    cam.setOrigin(0, 0);
    cam.setZoom(DPR);
    cam.setScroll(0, 0);
  }
}

export function installRetinaTextPatch(): void {
  const proto = Phaser.GameObjects.GameObjectFactory.prototype as unknown as {
    __hiDpiPatched?: boolean;
    text: (
      x: number,
      y: number,
      text: string | string[],
      style?: Phaser.Types.GameObjects.Text.TextStyle
    ) => Phaser.GameObjects.Text;
  };

  if (proto.__hiDpiPatched) return;
  proto.__hiDpiPatched = true;

  const originalText = proto.text;
  proto.text = function (
    this: Phaser.GameObjects.GameObjectFactory,
    x: number,
    y: number,
    text: string | string[],
    style?: Phaser.Types.GameObjects.Text.TextStyle
  ): Phaser.GameObjects.Text {
    const mergedStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
      ...style,
      resolution: style?.resolution ?? Math.max(DPR, 2),
    };
    return originalText.call(this, x, y, text, mergedStyle);
  };
}
