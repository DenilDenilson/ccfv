import { describe, expect, it } from 'vitest';
import { parseImdbId } from '@/lib/tmdb';

describe('parseImdbId', () => {
  it('extracts an IMDb title id from supported URLs', () => {
    expect(parseImdbId('https://www.imdb.com/title/tt0156887/')).toBe('tt0156887');
    expect(parseImdbId('https://m.imdb.com/title/tt0156887/?ref_=fn_all_ttl_1')).toBe('tt0156887');
    expect(parseImdbId('https://www.imdb.com/es/title/tt0211443/')).toBe('tt0211443');
    expect(parseImdbId('https://www.imdb.com/de-DE/title/tt0211443/')).toBe('tt0211443');
  });

  it('accepts a direct id and rejects untrusted URLs', () => {
    expect(parseImdbId('tt0156887')).toBe('tt0156887');
    expect(parseImdbId('https://imdb.com/name/nm0000001/')).toBeNull();
    expect(parseImdbId('https://imdb.com.evil.example/title/tt0156887')).toBeNull();
    expect(parseImdbId('http://www.imdb.com/title/tt0156887')).toBeNull();
  });

  it('normalizes direct ids and rejects near-miss title paths', () => {
    expect(parseImdbId('  TT0211443  ')).toBe('tt0211443');
    expect(parseImdbId('https://www.imdb.com/es/name/nm0000001/')).toBeNull();
    expect(parseImdbId('https://www.imdb.com/esp/title/tt0211443/')).toBeNull();
  });
});
