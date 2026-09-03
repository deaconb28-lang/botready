/**
 * Structured lines on stdout. Railway collects them, and one JSON object per
 * line is greppable in an incident in a way a formatted string is not.
 */

type Fields = Record<string, unknown>;

function emit(level: 'info' | 'warn' | 'error', message: string, fields?: Fields): void {
  const line = JSON.stringify({
    at: new Date().toISOString(),
    level,
    message,
    ...(fields ?? {}),
  });
  if (level === 'error') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

export const log = {
  info: (message: string, fields?: Fields) => emit('info', message, fields),
  warn: (message: string, fields?: Fields) => emit('warn', message, fields),
  error: (message: string, fields?: Fields) => emit('error', message, fields),
};
