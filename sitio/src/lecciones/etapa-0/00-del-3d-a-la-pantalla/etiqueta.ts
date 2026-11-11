import * as THREE from 'three';

/**
 * Un letrero en el espacio que siempre mira a la cámara (un "sprite"). El texto se dibuja en un
 * <canvas> 2D común, y ese dibujo se usa como imagen (una TEXTURA) pegada a un cuadrado.
 */
export function etiqueta(texto: string, color: string, x: number, y: number, z: number) {
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = 64;
  const g = lienzo.getContext('2d')!;
  g.font = 'italic 46px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.fillText(texto, 32, 30);
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace; // los colores de un canvas están en sRGB
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textura }));
  sprite.position.set(x, y, z);
  sprite.scale.setScalar(0.4); // 40 cm de lado
  return sprite;
}
