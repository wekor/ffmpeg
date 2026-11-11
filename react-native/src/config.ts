// Derived from FFmpegKit's React Native wrapper (FFmpegKitNext 9.0.2), LGPL-3.0.
import { argumentsToString, parseArguments } from './arguments';
import { init } from './init';
import { native } from './native';
import {
  AbstractSession,
  FFmpegSession,
  FFprobeSession,
  MediaInformationSession,
  getSession,
  type Session,
  toSession,
  toSessions,
} from './session';
import {
  beginShutdown,
  deleteSession,
  deleteSessions,
  globalCallbacks,
  setGlobalCallback,
  settings,
} from './state';
import {
  type FFmpegSessionCompleteCallback,
  type FFprobeSessionCompleteCallback,
  type LogCallback,
  type LogRedirectionStrategy,
  type MediaInformationSessionCompleteCallback,
  SessionState,
  type Signal,
  type StatisticsCallback,
} from './types';
import { VERSION } from './version';

const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;

const requireBoolean = (value: unknown) => {
  if (typeof value !== 'boolean')
    throw Object.assign(
      new Error('Native shutdown API returned a non-boolean response.'),
      { code: 'INVALID_RESPONSE' }
    );
  return value;
};

/** Global configuration, session history and Android helpers. Most methods initialise the library first. */
// biome-ignore lint/complexity/noStaticOnlyClass: the public API since FFmpegKit 4.
export class FFmpegKitConfig {
  /**
   * Subscribes to native events and enables redirection, once; every other method does this when needed.
   * `printLoadConfirmation` logs the library version natively on the first call.
   */
  static async init(printLoadConfirmation = true): Promise<void> {
    await init(printLoadConfirmation);
  }

  /**
   * Shuts native down for good, waiting up to `waitTimeout` ms for running sessions: 0 polls, negative waits
   * indefinitely. Drops JS callbacks at once; does not await callback promises. Resolves whether shutdown completed.
   */
  static async shutdown(waitTimeout: number): Promise<boolean> {
    if (
      !Number.isInteger(waitTimeout) ||
      waitTimeout < INT32_MIN ||
      waitTimeout > INT32_MAX
    )
      throw new RangeError(
        'waitTimeout must be a signed 32-bit integer in milliseconds.'
      );
    beginShutdown();
    await init();
    return requireBoolean(await native.shutdown(waitTimeout));
  }

  /** Whether shutdown started; it may not have completed. */
  static async isShutdown(): Promise<boolean> {
    await init();
    const shutdown = requireBoolean(await native.isShutdown());
    if (shutdown) beginShutdown();
    return shutdown;
  }

  /** Releases native resources; recommended, not required, before the app terminates. */
  static uninit(): Promise<void> {
    return native.uninit();
  }

  /** Routes FFmpeg's logs and statistics to the callbacks. Enabled by `init`. */
  static async enableRedirection(): Promise<void> {
    await init();
    return native.enableRedirection();
  }

  /** Stops routing logs and statistics to the callbacks; FFmpeg prints them natively instead. */
  static async disableRedirection(): Promise<void> {
    await init();
    return native.disableRedirection();
  }

  /** Sets the fontconfig configuration directory for the `subtitles` and `drawtext` filters. */
  static async setFontconfigConfigurationPath(path: string): Promise<void> {
    await init();
    return native.setFontconfigConfigurationPath(path);
  }

  /** Registers a font directory, with optional font name aliases (`{ alias: 'Font Name' }`). */
  static async setFontDirectory(
    path: string,
    mapping?: Record<string, string>
  ): Promise<void> {
    await init();
    return native.setFontDirectory(path, mapping ?? null);
  }

  /** Registers font directories, with optional font name aliases. */
  static async setFontDirectoryList(
    fontDirectoryList: string[],
    mapping?: Record<string, string>
  ): Promise<void> {
    await init();
    return native.setFontDirectoryList(fontDirectoryList, mapping ?? null);
  }

  /**
   * Creates a named pipe for FFmpeg to read from or write to; `null` if Android could not create it.
   * @deprecated Named pipes are deprecated; use the input/output buffers and streams.
   */
  static async registerNewFFmpegPipe(): Promise<string | null> {
    await init();
    // The spec says `string`; Android resolves null when creating the pipe fails.
    return native.registerNewFFmpegPipe();
  }

  /**
   * Closes and deletes a named pipe.
   * @deprecated Named pipes are deprecated; use the input/output buffers and streams.
   */
  static async closeFFmpegPipe(ffmpegPipePath: string): Promise<void> {
    await init();
    return native.closeFFmpegPipe(ffmpegPipePath);
  }

  static async getFFmpegVersion(): Promise<string> {
    await init();
    return native.getFFmpegVersion();
  }

  /** The version of this library. */
  static getVersion(): Promise<string> {
    return Promise.resolve(VERSION);
  }

  /**
   * Always `false`; there are no LTS builds anymore.
   * @deprecated LTS builds no longer exist.
   */
  static isLTSBuild(): Promise<boolean> {
    return Promise.resolve(false);
  }

  /** The native build date, `yyyyMMdd`. */
  static async getBuildDate(): Promise<string> {
    await init();
    return native.getBuildDate();
  }

  /** Sets an environment variable of the native process. */
  static async setEnvironmentVariable(
    name: string,
    value: string
  ): Promise<void> {
    await init();
    return native.setEnvironmentVariable(name, value);
  }

  /** Makes FFmpeg ignore `signal`; call before running a session. */
  static async ignoreSignal(signal: Signal): Promise<void> {
    await init();
    return native.ignoreSignal(signal);
  }

  /** Runs an FFmpeg session and resolves once it ended. */
  static async ffmpegExecute(session: FFmpegSession): Promise<void> {
    await init();
    return native.ffmpegSessionExecute(session.getSessionId());
  }

  /** Runs an FFprobe session and resolves once it ended. */
  static async ffprobeExecute(session: FFprobeSession): Promise<void> {
    await init();
    return native.ffprobeSessionExecute(session.getSessionId());
  }

  /** Runs a media information session and resolves once it ended and its output was parsed. */
  static async getMediaInformationExecute(
    session: MediaInformationSession,
    waitTimeout?: number
  ): Promise<void> {
    await init();
    return native.mediaInformationSessionExecute(
      session.getSessionId(),
      waitTimeout ?? null
    );
  }

  /** Starts an FFmpeg session; its complete callback reports the end. */
  static async asyncFFmpegExecute(session: FFmpegSession): Promise<void> {
    await init();
    return native.asyncFFmpegSessionExecute(session.getSessionId());
  }

  /** Starts an FFprobe session; its complete callback reports the end. */
  static async asyncFFprobeExecute(session: FFprobeSession): Promise<void> {
    await init();
    return native.asyncFFprobeSessionExecute(session.getSessionId());
  }

  /** Starts a media information session; its complete callback reports the end. */
  static async asyncGetMediaInformationExecute(
    session: MediaInformationSession,
    waitTimeout?: number
  ): Promise<void> {
    await init();
    return native.asyncMediaInformationSessionExecute(
      session.getSessionId(),
      waitTimeout ?? null
    );
  }

  /** Sets the callback that receives the logs of every session; `undefined` removes it. */
  static enableLogCallback(logCallback: LogCallback | undefined): void {
    setGlobalCallback('log', logCallback);
  }

  /** Sets the callback that receives the statistics of every FFmpeg session; `undefined` removes it. */
  static enableStatisticsCallback(
    statisticsCallback: StatisticsCallback | undefined
  ): void {
    setGlobalCallback('statistics', statisticsCallback);
  }

  /** Sets the callback that runs when any FFmpeg session ends; `undefined` removes it. */
  static enableFFmpegSessionCompleteCallback(
    completeCallback: FFmpegSessionCompleteCallback | undefined
  ): void {
    setGlobalCallback('ffmpegComplete', completeCallback);
  }

  static getFFmpegSessionCompleteCallback():
    | FFmpegSessionCompleteCallback
    | undefined {
    return globalCallbacks.ffmpegComplete;
  }

  /** Sets the callback that runs when any FFprobe session ends; `undefined` removes it. */
  static enableFFprobeSessionCompleteCallback(
    completeCallback: FFprobeSessionCompleteCallback | undefined
  ): void {
    setGlobalCallback('ffprobeComplete', completeCallback);
  }

  static getFFprobeSessionCompleteCallback():
    | FFprobeSessionCompleteCallback
    | undefined {
    return globalCallbacks.ffprobeComplete;
  }

  /** Sets the callback that runs when any media information session ends; `undefined` removes it. */
  static enableMediaInformationSessionCompleteCallback(
    completeCallback: MediaInformationSessionCompleteCallback | undefined
  ): void {
    setGlobalCallback('mediaInformationComplete', completeCallback);
  }

  static getMediaInformationSessionCompleteCallback():
    | MediaInformationSessionCompleteCallback
    | undefined {
    return globalCallbacks.mediaInformationComplete;
  }

  /** The active log level, one of the `Level` values; `undefined` until initialised. */
  static getLogLevel(): number | undefined {
    return settings.logLevel;
  }

  /** Sets the log level, one of the `Level` values; logs above it are neither printed nor sent to callbacks. */
  static async setLogLevel(level: number): Promise<void> {
    await init();
    settings.logLevel = level;
    return native.setLogLevel(level);
  }

  /**
   * Converts a SAF `content:` uri into a url FFmpeg can read. `reusable` keeps the url valid for several sessions;
   * release it with `unregisterSafProtocolUrl`. Android only; rejects with `unsupported` on iOS.
   */
  static getSafParameterForRead(
    uriString: string,
    reusable?: boolean
  ): Promise<string> {
    return FFmpegKitConfig.getSafParameter(uriString, 'r', reusable);
  }

  /** Converts a SAF `content:` uri into a url FFmpeg can write. Android only; rejects with `unsupported` on iOS. */
  static getSafParameterForWrite(
    uriString: string,
    reusable?: boolean
  ): Promise<string> {
    return FFmpegKitConfig.getSafParameter(uriString, 'w', reusable);
  }

  /**
   * Converts a SAF `content:` uri into a url FFmpeg can open with `openMode` (`r`, `w`, `rw`...). Without `reusable`
   * the url works for one session. Android only; rejects with `unsupported` on iOS.
   */
  static async getSafParameter(
    uriString: string,
    openMode: string,
    reusable?: boolean
  ): Promise<string> {
    await init();
    return native.getSafParameter(uriString, openMode, reusable ?? false);
  }

  /** Releases a reusable SAF url. Android only; rejects with `unsupported` on iOS. */
  static async unregisterSafProtocolUrl(safUrl: string): Promise<void> {
    await init();
    return native.unregisterSafProtocolUrl(safUrl);
  }

  /** Camera ids for the `android_camera` input device. Android only; rejects with `unsupported` on iOS. */
  static async getSupportedCameraIds(): Promise<string[]> {
    await init();
    return native.getSupportedCameraIds();
  }

  static async getSessionHistorySize(): Promise<number> {
    await init();
    return native.getSessionHistorySize();
  }

  /** Sets how many sessions native keeps; older ones are deleted. */
  static async setSessionHistorySize(
    sessionHistorySize: number
  ): Promise<void> {
    await init();
    return native.setSessionHistorySize(sessionHistorySize);
  }

  /** A session from the history; rejects with `SESSION_NOT_FOUND` if it is not there. */
  static async getSession(sessionId: number): Promise<Session> {
    await init();
    // JS callers may pass nothing; FFmpegKit has always resolved `undefined` then.
    if (sessionId === undefined) return undefined as unknown as Session;
    return getSession(sessionId);
  }

  /** The most recently created session; `undefined` if there is none. */
  static async getLastSession(): Promise<Session | undefined> {
    await init();
    return toSession(await native.getLastSession());
  }

  /** The most recently completed session; `undefined` if there is none. */
  static async getLastCompletedSession(): Promise<Session | undefined> {
    await init();
    return toSession(await native.getLastCompletedSession());
  }

  /** All sessions in the history. */
  static async getSessions(): Promise<Session[]> {
    await init();
    return toSessions(await native.getSessions(), AbstractSession);
  }

  /** Clears the session history and the callbacks of those sessions. */
  static async clearSessions(): Promise<void> {
    await init();
    await native.clearSessions();
    deleteSessions();
  }

  /** Deletes a session from the history, with its callbacks. */
  static async deleteSession(sessionId: number): Promise<void> {
    await init();
    // JS callers may pass nothing.
    if (sessionId === undefined) return;
    await native.deleteSession(sessionId);
    deleteSession(sessionId);
  }

  static async getFFmpegSessions(): Promise<FFmpegSession[]> {
    await init();
    return toSessions(await native.getFFmpegSessions(), FFmpegSession);
  }

  static async getFFprobeSessions(): Promise<FFprobeSession[]> {
    await init();
    return toSessions(await native.getFFprobeSessions(), FFprobeSession);
  }

  static async getMediaInformationSessions(): Promise<
    MediaInformationSession[]
  > {
    await init();
    return toSessions(
      await native.getMediaInformationSessions(),
      MediaInformationSession
    );
  }

  static async getSessionsByState(state: SessionState): Promise<Session[]> {
    await init();
    return toSessions(await native.getSessionsByState(state), AbstractSession);
  }

  /** The strategy for sessions created without one. */
  static getLogRedirectionStrategy(): LogRedirectionStrategy {
    return settings.logRedirectionStrategy;
  }

  /** Sets the strategy for sessions created without one. */
  static setLogRedirectionStrategy(
    logRedirectionStrategy: LogRedirectionStrategy
  ): void {
    settings.logRedirectionStrategy = logRedirectionStrategy;
  }

  /** How many logs and statistics of a session are still on their way to JS. */
  static async messagesInTransmit(sessionId: number): Promise<number> {
    await init();
    return native.messagesInTransmit(sessionId);
  }

  /** The state's name, such as `RUNNING`; empty for unknown states. */
  static sessionStateToString(state: SessionState): string {
    return SessionState[state] ?? '';
  }

  /** Splits a command into arguments; quotes group an argument and are removed. */
  static parseArguments(command: string): string[] {
    return parseArguments(command);
  }

  /** Joins arguments with spaces, without quoting; for display only. */
  static argumentsToString(commandArguments: readonly string[]): string {
    return argumentsToString(commandArguments);
  }

  /** Sends logs from native to JS; on by default. */
  static async enableLogs(): Promise<void> {
    await init();
    return native.enableLogs();
  }

  /** Stops sending logs from native to JS; they can still be read from the sessions. */
  static async disableLogs(): Promise<void> {
    await init();
    return native.disableLogs();
  }

  /** Sends statistics from native to JS; on by default. */
  static async enableStatistics(): Promise<void> {
    await init();
    return native.enableStatistics();
  }

  /** Stops sending statistics from native to JS. */
  static async disableStatistics(): Promise<void> {
    await init();
    return native.disableStatistics();
  }

  /** `android` or `ios`. */
  static async getPlatform(): Promise<string> {
    await init();
    return native.getPlatform();
  }

  /**
   * Copies a file into a named pipe in the background; resolves with the native result code.
   * @deprecated Named pipes are deprecated; use the input/output buffers and streams.
   */
  static async writeToPipe(
    inputPath: string,
    pipePath: string
  ): Promise<number> {
    await init();
    return native.writeToPipe(inputPath, pipePath);
  }

  /**
   * Lets the user pick a document to read; resolves with its uri, `null` if the picker returned none. Android
   * only; rejects with `unsupported` on iOS.
   */
  static async selectDocumentForRead(
    type?: string,
    extraTypes?: string[]
  ): Promise<string | null> {
    await init();
    return native.selectDocument(false, null, type ?? null, extraTypes ?? null);
  }

  /**
   * Lets the user pick where to write a document; resolves with its uri, `null` if the picker returned none.
   * Android only; rejects with `unsupported` on iOS.
   */
  static async selectDocumentForWrite(
    title?: string,
    type?: string,
    extraTypes?: string[]
  ): Promise<string | null> {
    await init();
    return native.selectDocument(
      true,
      title ?? null,
      type ?? null,
      extraTypes ?? null
    );
  }
}
