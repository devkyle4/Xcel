import tokensCss from './tokens.css?raw';

/** Colour tokens parsed from tokens.css, so the test checks the real values. */
const tokens = Object.fromEntries(
  [...tokensCss.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1]!, m[2]!]),
);

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(fg: string, bg: string) {
  const [l1, l2] = [luminance(tokens[fg]!), luminance(tokens[bg]!)].sort((a, b) => b - a);
  return (l1! + 0.05) / (l2! + 0.05);
}

describe('colour tokens', () => {
  it('defines the full palette from SRS 11.5', () => {
    expect(Object.keys(tokens)).toHaveLength(22);
  });

  // [text, background] pairings used for text (WCAG AA: 4.5:1).
  it.each([
    ['blue-950', 'white'],
    ['blue-950', 'off-white'],
    ['blue-950', 'blue-50'],
    ['blue-950', 'green-50'],
    ['blue-700', 'white'],
    ['blue-700', 'blue-50'],
    ['white', 'blue-950'],
    ['white', 'blue-900'],
    ['white', 'blue-700'],
    ['white', 'green-700'],
    ['white', 'green-800'],
    ['white', 'red-700'],
    ['green-900', 'green-100'],
    ['green-800', 'green-50'],
    ['blue-900', 'blue-100'],
    ['red-800', 'red-100'],
    ['red-800', 'white'],
    ['red-800', 'red-50'],
  ])('%s text on %s meets WCAG AA', (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  // Focus rings and icons (WCAG non-text contrast: 3:1).
  it.each([
    ['blue-700', 'white'],
    ['white', 'blue-950'],
    ['white', 'green-700'],
    ['red-600', 'white'],
    ['green-700', 'white'],
  ])('%s outline or icon on %s meets 3:1', (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(3);
  });

  it('confirms the blue-700 focus ring is too faint on the dark navbar (so white is used there)', () => {
    expect(contrast('blue-700', 'blue-950')).toBeLessThan(3);
  });
});
