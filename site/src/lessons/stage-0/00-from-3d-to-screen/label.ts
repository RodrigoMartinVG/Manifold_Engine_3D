import * as THREE from 'three';

/**
 * A sign in space that always faces the camera (a "sprite"). The text is drawn on a plain 2D
 * <canvas>, and that drawing is used as an image (a TEXTURE) stuck on a square.
 */
export function label(text: string, color: string, x: number, y: number, z: number) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d')!;
  g.font = 'italic 46px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.fillText(text, 32, 30);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; // a canvas's colors are in sRGB
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
  sprite.position.set(x, y, z);
  sprite.scale.setScalar(0.4); // 40 cm on each side
  return sprite;
}
