import { deadlineText } from './deadline';

describe('deadlineText', () => {
  const today = '2026-10-08';
  it.each([
    [{ availability: 'open', closesOn: '2026-12-31' }, 'Application deadline: 31 December 2026'],
    [{ availability: 'closed', closesOn: '2026-01-31' }, 'Closed on 31 January 2026'],
    [{ availability: 'closed', closesOn: '2027-01-06' }, 'No longer accepting applications'],
    [{ availability: 'closed', closesOn: null }, 'No longer accepting applications'],
    [{ availability: 'unknown', closesOn: null }, null],
  ] as const)('%o -> %s', (s, text) => {
    expect(deadlineText(s, today)).toBe(text);
  });
});
