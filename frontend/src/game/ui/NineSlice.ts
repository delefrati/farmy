import Phaser from 'phaser';

export interface NineSliceConfig {
  scene: Phaser.Scene;
  /** Texture key of the source panel art. */
  key: string;
  /** Center position of the panel. */
  x: number;
  y: number;
  /** Final panel size. */
  width: number;
  height: number;
  /** Fixed corner inset in SOURCE pixels. Right/top/bottom default to `left`. */
  left: number;
  right?: number;
  top?: number;
  bottom?: number;
}

/**
 * Build a manual nine-slice panel as a Container of nine cropped Images.
 *
 * Phaser's built-in GameObjects.NineSlice does not slice correctly under the
 * Canvas renderer (it smears the whole texture across the quad). We instead crop
 * the source texture into nine sub-frames and scale only the edges/center while
 * leaving the four corners at their native size, which renders correctly as plain
 * drawImage blits. The container origin is its center, matching `this.add.image`.
 */
export function createNineSlice(config: NineSliceConfig): Phaser.GameObjects.Container {
  const { scene, key, x, y, width, height } = config;
  const left = config.left;
  const right = config.right ?? left;
  const top = config.top ?? left;
  const bottom = config.bottom ?? left;

  const tex = scene.textures.get(key);
  const source = tex.getSourceImage() as { width: number; height: number };
  const sw = source.width;
  const sh = source.height;

  // Source-space sizes of the stretchable middle band.
  const srcMidW = Math.max(1, sw - left - right);
  const srcMidH = Math.max(1, sh - top - bottom);

  // Lazily register the nine sub-frames once per texture (survives scene
  // restarts because the texture and its frames persist in the cache).
  const frame = (name: string, fx: number, fy: number, fw: number, fh: number): string => {
    const full = `${key}__ns_${name}`;
    if (!tex.has(full)) {
      tex.add(full, 0, fx, fy, fw, fh);
    }
    return full;
  };

  // Destination sizes of the stretchable middle band.
  const dstMidW = Math.max(0, width - left - right);
  const dstMidH = Math.max(0, height - top - bottom);

  // Local coordinates (container centered => top-left at -w/2, -h/2).
  const x0 = -width / 2;
  const y0 = -height / 2;
  const xMid = x0 + left;
  const xRight = x0 + width - right;
  const yMid = y0 + top;
  const yBottom = y0 + height - bottom;

  const pieces: Phaser.GameObjects.Image[] = [];
  const place = (frameName: string, px: number, py: number, dw: number, dh: number): void => {
    const img = scene.add.image(px, py, key, frameName).setOrigin(0, 0);
    img.setDisplaySize(dw, dh);
    pieces.push(img);
  };

  // Corners — native size, never stretched.
  place(frame('tl', 0, 0, left, top), x0, y0, left, top);
  place(frame('tr', sw - right, 0, right, top), xRight, y0, right, top);
  place(frame('bl', 0, sh - bottom, left, bottom), x0, yBottom, left, bottom);
  place(frame('br', sw - right, sh - bottom, right, bottom), xRight, yBottom, right, bottom);
  // Edges — stretched along a single axis.
  place(frame('tm', left, 0, srcMidW, top), xMid, y0, dstMidW, top);
  place(frame('bm', left, sh - bottom, srcMidW, bottom), xMid, yBottom, dstMidW, bottom);
  place(frame('ml', 0, top, left, srcMidH), x0, yMid, left, dstMidH);
  place(frame('mr', sw - right, top, right, srcMidH), xRight, yMid, right, dstMidH);
  // Center — stretched on both axes.
  place(frame('mm', left, top, srcMidW, srcMidH), xMid, yMid, dstMidW, dstMidH);

  return scene.add.container(x, y, pieces);
}
