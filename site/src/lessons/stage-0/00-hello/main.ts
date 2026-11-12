// El código corre en un recuadro aparte (un iframe): puede escribir en la consola de abajo
// y dibujar en el recuadro, pero no puede tocar el resto de la página.
for (let i = 1; i <= 1; i++) console.log(`hola ${i}`);

document.body.innerHTML = '<p style="padding: 1rem">Esto lo escribió el código ✨</p>';
