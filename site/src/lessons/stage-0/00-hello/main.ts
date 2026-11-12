// The code runs in a separate box (an iframe): it can write to the console below and draw in the
// box, but it cannot touch the rest of the page.
for (let i = 1; i <= 1; i++) console.log(`hello ${i}`);

document.body.innerHTML = '<p style="padding: 1rem">The code wrote this ✨</p>';
