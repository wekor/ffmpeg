import { beforeEach, expect, mock, test } from 'bun:test';

type Handler = (event: never) => void;
const handlers: Record<string, Handler> = {};
const calls: string[] = [];

const subscribe = (name: string) => (handler: Handler) => {
  handlers[name] = handler;
  return { remove: () => {} };
};

const nativeSession = {
  sessionId: 7,
  createTime: 1,
  startTime: 0,
  command: '-i "a b" out.mp4',
  type: 1,
};

const native = new Proxy(
  {
    onLog: subscribe('onLog'),
    onStatistics: subscribe('onStatistics'),
    onComplete: subscribe('onComplete'),
    onSessionDeleted: subscribe('onSessionDeleted'),
    getLogLevel: async () => 32,
    ffmpegSession: async () => nativeSession,
    getSession: async (sessionId: number) => {
      if (sessionId !== nativeSession.sessionId)
        throw Object.assign(new Error('Session not found.'), {
          code: 'SESSION_NOT_FOUND',
        });
      return nativeSession;
    },
    getLastSession: async () => null,
  } as Record<string, unknown>,
  {
    get: (target, name: string) =>
      target[name] ??
      (async () => {
        calls.push(name);
      }),
  }
);

mock.module('../NativeReactNativeFFmpeg', () => ({ default: native }));

const { FFmpegKitConfig, FFmpegSession, LogRedirectionStrategy, Level } =
  await import('../index');

const emit = (name: string, event: object) =>
  (handlers[name] as (event: object) => void)(event);

beforeEach(() => {
  calls.length = 0;
});

test('initialises once', async () => {
  await Promise.all([FFmpegKitConfig.init(), FFmpegKitConfig.init()]);
  await FFmpegKitConfig.init();
  expect(calls.filter((name) => name === 'enableRedirection')).toHaveLength(1);
  expect(FFmpegKitConfig.getLogLevel()).toBe(32);
});

test('routes logs, statistics and completion to the session', async () => {
  const logs: string[] = [];
  const times: number[] = [];
  const completed: number[] = [];
  const session = await FFmpegSession.create(
    ['-i', 'a b', 'out.mp4'],
    (done) => completed.push(done.getSessionId()),
    (log) => logs.push(log.getMessage()),
    (statistics) => times.push(statistics.getTime()),
    LogRedirectionStrategy.NEVER_PRINT_LOGS
  );
  emit('onLog', { sessionId: 7, level: Level.AV_LOG_INFO, message: 'hi' });
  emit('onLog', { sessionId: 7, level: Level.AV_LOG_DEBUG, message: 'no' });
  emit('onStatistics', {
    sessionId: 7,
    videoFrameNumber: 1,
    videoFps: 0,
    videoQuality: 0,
    size: 0,
    time: 40,
    bitrate: 0,
    speed: 1,
  });
  emit('onComplete', { sessionId: 7 });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(logs).toEqual(['hi']);
  expect(times).toEqual([40]);
  expect(completed).toEqual([7]);
  expect(session.getArguments()).toEqual(['-i', 'a b', 'out.mp4']);
  expect(session.getLogRedirectionStrategy()).toBe(
    LogRedirectionStrategy.NEVER_PRINT_LOGS
  );

  emit('onSessionDeleted', { sessionId: 7 });
  expect(session.getLogCallback()).toBeUndefined();
});

test('isLTSBuild resolves false without native', async () => {
  expect(await FFmpegKitConfig.isLTSBuild()).toBe(false);
  expect(await FFmpegKitConfig.getVersion()).toBe('9.0.0');
  expect(calls).not.toContain('isLTSBuild');
});

test('ignores completion of a session no longer in the history', async () => {
  const errors: unknown[] = [];
  const error = console.error;
  console.error = (...args: unknown[]) => errors.push(args);
  try {
    emit('onComplete', { sessionId: 8 });
    await new Promise((resolve) => setTimeout(resolve, 0));
  } finally {
    console.error = error;
  }
  expect(errors).toHaveLength(1);
  expect(await FFmpegKitConfig.getLastSession()).toBeUndefined();
});
