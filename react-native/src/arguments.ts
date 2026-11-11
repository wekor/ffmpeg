// Derived from FFmpegKit's React Native wrapper (FFmpegKitNext 9.0.2), LGPL-3.0.

/**
 * Splits a command into arguments at spaces. Single or double quotes group an argument and are removed; a quote
 * preceded by a backslash, or of the other kind inside quotes, is kept as is.
 */
export const parseArguments = (command: string): string[] => {
  const args: string[] = [];
  let current = '';
  let quote: "'" | '"' | undefined;
  for (let i = 0; i < command.length; i++) {
    const char = command.charAt(i);
    const escaped = i > 0 && command.charAt(i - 1) === '\\';
    if (char === ' ' && quote === undefined) {
      if (current.length > 0) {
        args.push(current);
        current = '';
      }
    } else if (
      (char === "'" || char === '"') &&
      !escaped &&
      (quote === undefined || quote === char)
    ) {
      quote = quote === undefined ? char : undefined;
    } else {
      current += char;
    }
  }
  if (current.length > 0) args.push(current);
  return args;
};

/** Joins arguments with spaces, without quoting; for display only. */
export const argumentsToString = (
  commandArguments: readonly string[]
): string =>
  // JS callers may pass nothing; FFmpegKit has always printed it.
  commandArguments === undefined ? 'undefined' : commandArguments.join(' ');
