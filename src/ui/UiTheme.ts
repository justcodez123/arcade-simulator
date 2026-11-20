import Phaser from 'phaser';

export interface GlassCardOptions {
  fillColor?: number;
  fillAlpha?: number;
  borderColor?: number;
  borderAlpha?: number;
  borderWidth?: number;
  topHighlight?: boolean;
}

export interface GlassButtonOptions {
  bgColor: number;
  bgAlpha?: number;
  hoverBgColor?: number;
  textColor: string;
  fontSize?: string;
  radius?: number;
  borderColor?: number;
  borderAlpha?: number;
  depth?: number;
  enabled?: boolean;
  onClick?: () => void;
}

export interface GlassButtonHandle {
  graphics: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
  setLabel: (label: string) => void;
}

export function drawAmbientBackdrop(
  scene: Phaser.Scene,
  accentColor: number
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(0x060913, 1);
  g.fillRect(0, 0, 400, 700);

  // Soft top-left & bottom-right ambient neon glows
  g.fillStyle(accentColor, 0.08);
  g.fillEllipse(75, 70, 290, 220);
  g.fillStyle(accentColor, 0.04);
  g.fillEllipse(340, 620, 280, 240);

  // Razor-thin micro grid lines
  g.lineStyle(0.6, 0x1e293b, 0.28);
  for (let x = 0; x <= 400; x += 32) {
    g.lineBetween(x, 0, x, 700);
  }
  for (let y = 0; y <= 700; y += 32) {
    g.lineBetween(0, y, 400, y);
  }

  return g;
}

export function drawGlassCard(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  w: number,
  h: number,
  radius: number,
  opts?: GlassCardOptions
): void {
  const left = cx - w / 2;
  const top = cy - h / 2;
  const fillColor = opts?.fillColor ?? 0x0e1526;
  const fillAlpha = opts?.fillAlpha ?? 0.92;
  const borderColor = opts?.borderColor ?? 0x334155;
  const borderAlpha = opts?.borderAlpha ?? 0.45;
  const borderWidth = opts?.borderWidth ?? 1;

  g.fillStyle(fillColor, fillAlpha);
  g.fillRoundedRect(left, top, w, h, radius);

  g.lineStyle(borderWidth, borderColor, borderAlpha);
  g.strokeRoundedRect(left, top, w, h, radius);

  if (opts?.topHighlight !== false) {
    g.lineStyle(0.8, 0xffffff, 0.08);
    g.lineBetween(left + radius, top + 0.8, left + w - radius, top + 0.8);
  }
}

export function createGlassButton(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  w: number,
  h: number,
  label: string,
  opts: GlassButtonOptions
): GlassButtonHandle {
  const radius = opts.radius ?? Math.min(10, h / 2);
  const depth = opts.depth ?? 10;
  const enabled = opts.enabled ?? true;
  const bgAlpha = opts.bgAlpha ?? 1;
  const borderColor = opts.borderColor ?? 0xffffff;
  const borderAlpha = opts.borderAlpha ?? 0.16;

  const graphics = scene.add.graphics().setDepth(depth);
  const drawBtn = (color: number, bAlpha: number): void => {
    graphics.clear();
    graphics.fillStyle(color, bgAlpha);
    graphics.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, radius);
    graphics.lineStyle(1, borderColor, bAlpha);
    graphics.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, radius);
  };

  drawBtn(opts.bgColor, borderAlpha);

  const text = scene.add
    .text(cx, cy, label, {
      fontSize: opts.fontSize ?? '11px',
      fontStyle: 'bold',
      color: opts.textColor,
    })
    .setOrigin(0.5)
    .setDepth(depth + 1);

  const zone = scene.add
    .zone(cx, cy, w, h)
    .setDepth(depth + 2)
    .setInteractive({ useHandCursor: enabled });

  if (enabled) {
    zone.on('pointerover', () => {
      drawBtn(opts.hoverBgColor ?? opts.bgColor, Math.min(1, borderAlpha + 0.25));
    });
    zone.on('pointerout', () => {
      drawBtn(opts.bgColor, borderAlpha);
    });
    zone.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event: Phaser.Types.Input.EventData
      ) => {
        event.stopPropagation();
        opts.onClick?.();
      }
    );
  }

  return {
    graphics,
    text,
    zone,
    setLabel: (next: string) => text.setText(next),
  };
}
