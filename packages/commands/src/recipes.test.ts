import { describe, expect, it } from 'vitest';
import { recipeFromLink, recipeTitle, recipeToLink } from './recipes';

describe('recipes in a link', () => {
  it('are readable by hand: ";" between lines and "+" for spaces; without the comments', () => {
    const recipe = '# My room\ndojo.cubes 20\n\n# What is seen\nshow.wireframe on\n';
    expect(recipeToLink(recipe)).toBe('dojo.cubes+20;show.wireframe+on');
  });

  it('go and come back without losing anything (a real "+", quotes, accents)', () => {
    const recipe = 'dojo.name "one + one"\nhelp física';
    const link = `#recipe=${recipeToLink(recipe)}`;
    expect(link).not.toMatch(/\s/);
    expect(recipeFromLink(link)).toBe(recipe);
  });

  it('a fragment that is not a recipe gives null; a broken escape breaks nothing', () => {
    expect(recipeFromLink('#something-else')).toBeNull();
    expect(recipeFromLink('')).toBeNull();
    expect(recipeFromLink('#recipe=dojo.cubes+%E0;show.axes+on')).toBe('dojo.cubes %E0\nshow.axes on');
  });

  it("a recipe's title: its first comment, if it comes before the first command", () => {
    expect(recipeTitle('\n# Cube rain\n# A comment.\ndojo.cubes 100')).toBe('Cube rain');
    expect(recipeTitle('dojo.cubes 100\n# not a title, after a command')).toBeNull();
    expect(recipeTitle('#\ndojo.cubes 100')).toBeNull();
  });
});
