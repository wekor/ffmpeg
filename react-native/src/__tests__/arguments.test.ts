import { describe, expect, test } from 'bun:test';
import { argumentsToString, parseArguments } from '../arguments';

describe('parseArguments', () => {
  test('splits at spaces, ignoring repeated ones', () => {
    expect(parseArguments('  -i  in.mp4 -c:v libx264 out.mp4 ')).toEqual([
      '-i',
      'in.mp4',
      '-c:v',
      'libx264',
      'out.mp4',
    ]);
  });

  test('quotes group an argument and are removed', () => {
    expect(parseArguments(`-i "my file.mp4" -vf 'scale=1:2' x`)).toEqual([
      '-i',
      'my file.mp4',
      '-vf',
      'scale=1:2',
      'x',
    ]);
  });

  test('keeps the other quote inside quotes', () => {
    expect(parseArguments(`-metadata "title=It's" 'a "b"'`)).toEqual([
      '-metadata',
      "title=It's",
      'a "b"',
    ]);
  });

  test('keeps escaped quotes and their backslash', () => {
    expect(parseArguments('a\\"b c')).toEqual(['a\\"b', 'c']);
  });

  test('drops empty quoted arguments', () => {
    expect(parseArguments(`a "" b`)).toEqual(['a', 'b']);
    expect(parseArguments('')).toEqual([]);
  });
});

describe('argumentsToString', () => {
  test('joins with spaces', () => {
    expect(argumentsToString(['-i', 'a b', 'c'])).toBe('-i a b c');
    expect(argumentsToString([])).toBe('');
  });
});
