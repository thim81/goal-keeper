import { describe, expect, it } from 'vitest';
import { getOpponentSuggestions } from './opponent-suggestions';

describe('getOpponentSuggestions', () => {
  it('ranks exact, full-prefix, word-prefix, and substring matches', () => {
    const opponents = ['Royal Antwerp', 'Antwerp United', 'United FC', 'The Royal Club'];

    expect(getOpponentSuggestions(opponents, 'royal')).toEqual(['Royal Antwerp', 'The Royal Club']);
    expect(getOpponentSuggestions(opponents, 'ant')).toEqual(['Antwerp United', 'Royal Antwerp']);
  });

  it('deduplicates case-insensitively and preserves the recent display value', () => {
    const opponents = ['Royal Antwerp', 'FC United', 'royal antwerp', 'FC UNITED'];

    expect(getOpponentSuggestions(opponents, 'roy')).toEqual(['Royal Antwerp']);
    expect(getOpponentSuggestions(opponents, 'fc')).toEqual(['FC United']);
  });

  it('supports spaces in the query and does not suggest for empty input', () => {
    const opponents = ['Sporting Club Brugge', 'Club Brugge'];

    expect(getOpponentSuggestions(opponents, 'sporting c')).toEqual(['Sporting Club Brugge']);
    expect(getOpponentSuggestions(opponents, 's')).toEqual(['Sporting Club Brugge']);
    expect(getOpponentSuggestions(opponents, '  ')).toEqual([]);
  });

  it('limits results to eight suggestions by default', () => {
    const opponents = Array.from({ length: 10 }, (_, index) => `United ${index}`);

    expect(getOpponentSuggestions(opponents, 'united')).toHaveLength(8);
  });
});
