// Derived from FFmpegKit's React Native wrapper (FFmpegKitNext 9.0.2), LGPL-3.0.
import type { CodegenTypes } from 'react-native';
import { parseArguments } from './arguments';
import { init, logOf, setCompleteHandler, statisticsOf } from './init';
import type { Log } from './log';
import { MediaInformation } from './media-information';
import {
  asMediaProperties,
  asNativeLogs,
  asNativeSession,
  asNativeStatistics,
  dateOf,
  type NativeSession,
  native,
  SESSION_TYPE,
} from './native';
import { ReturnCode } from './return-code';
import {
  globalCallbacks,
  notify,
  sessionCallbacks,
  setSessionCallback,
  settings,
} from './state';
import type { Statistics } from './statistics';
import {
  type FFmpegSessionCompleteCallback,
  type FFprobeSessionCompleteCallback,
  type LogCallback,
  LogRedirectionStrategy,
  type MediaInformationSessionCompleteCallback,
  type SessionState,
  type StatisticsCallback,
} from './types';

/** An FFmpeg, FFprobe or media information session. Sessions live in native code; this object addresses one. */
export interface Session {
  /** The log callback given when the session was created. */
  getLogCallback(): LogCallback | undefined;
  getSessionId(): number;
  getCreateTime(): Date;
  /** When execution started; `undefined` on sessions created before they ran. */
  getStartTime(): Date | undefined;
  /** When execution ended; `undefined` until it has. */
  getEndTime(): Promise<Date | undefined>;
  /** Execution time in milliseconds; 0 until it has ended. */
  getDuration(): Promise<number>;
  getArguments(): string[];
  getCommand(): string;
  /**
   * All logs, after waiting up to `waitTimeout` ms (native default when omitted) for those still in transit.
   */
  getAllLogs(waitTimeout?: number): Promise<Log[]>;
  /** The logs received so far, without waiting. */
  getLogs(): Promise<Log[]>;
  /** All logs as one string; waits like `getAllLogs`. */
  getAllLogsAsString(waitTimeout?: number): Promise<string>;
  /** The logs received so far as one string. */
  getLogsAsString(): Promise<string>;
  /** All logs as one string; same as `getAllLogsAsString()`. */
  getOutput(): Promise<string>;
  getState(): Promise<SessionState>;
  /** `undefined` until the session has ended. */
  getReturnCode(): Promise<ReturnCode | undefined>;
  /** The native stack trace if execution failed, else `null`. */
  getFailStackTrace(): Promise<string | null>;
  getLogRedirectionStrategy(): LogRedirectionStrategy;
  /** Whether logs or statistics of this session are still on their way to JS. */
  thereAreAsynchronousMessagesInTransmit(): Promise<boolean>;
  isFFmpeg(): boolean;
  isFFprobe(): boolean;
  isMediaInformation(): boolean;
  cancel(): Promise<void>;
}

type SessionFields = {
  sessionId: number;
  createTime: Date;
  startTime: Date | undefined;
  command: string;
  arguments: string[];
  /** `undefined` for sessions created before a reload; the global strategy applies to them. */
  logRedirectionStrategy: LogRedirectionStrategy | undefined;
};

const fieldsOf = (
  session: NativeSession,
  args: string[],
  logRedirectionStrategy: LogRedirectionStrategy | undefined
): SessionFields => ({
  sessionId: session.sessionId,
  createTime: new Date(session.createTime),
  startTime: dateOf(session.startTime),
  command: session.command,
  arguments: args,
  logRedirectionStrategy,
});

/** What sessions share. Create sessions with the `create` methods of the subclasses or the kits. */
export abstract class AbstractSession implements Session {
  /** How long `getAllLogs` and similar wait by default, in milliseconds. */
  static readonly DEFAULT_TIMEOUT_FOR_ASYNCHRONOUS_MESSAGES_IN_TRANSMIT: number =
    5000;

  readonly #sessionId: number;
  readonly #createTime: Date;
  readonly #startTime: Date | undefined;
  readonly #command: string;
  readonly #arguments: string[];
  readonly #logRedirectionStrategy: LogRedirectionStrategy | undefined;

  /** @internal Sessions come from the `create` methods. */
  constructor(fields: SessionFields) {
    this.#sessionId = fields.sessionId;
    this.#createTime = fields.createTime;
    this.#startTime = fields.startTime;
    this.#command = fields.command;
    this.#arguments = fields.arguments;
    this.#logRedirectionStrategy = fields.logRedirectionStrategy;
  }

  /** Creates an FFmpeg session in native code, without running it. */
  static async createFFmpegSession(
    argumentsArray: string[],
    logRedirectionStrategy?: LogRedirectionStrategy
  ): Promise<FFmpegSession> {
    await init();
    const strategy = logRedirectionStrategy ?? settings.logRedirectionStrategy;
    const session = asNativeSession(await native.ffmpegSession(argumentsArray));
    sessionCallbacks.logRedirectionStrategy.set(session.sessionId, strategy);
    return new FFmpegSession(fieldsOf(session, argumentsArray, strategy));
  }

  /** Wraps an FFmpeg session native sent. */
  static createFFmpegSessionFromMap(sessionMap: NativeSession): FFmpegSession {
    return new FFmpegSession(
      fieldsOf(
        sessionMap,
        parseArguments(sessionMap.command),
        sessionCallbacks.logRedirectionStrategy.get(sessionMap.sessionId)
      )
    );
  }

  /** Creates an FFprobe session in native code, without running it. */
  static async createFFprobeSession(
    argumentsArray: string[],
    logRedirectionStrategy?: LogRedirectionStrategy
  ): Promise<FFprobeSession> {
    await init();
    const strategy = logRedirectionStrategy ?? settings.logRedirectionStrategy;
    const session = asNativeSession(
      await native.ffprobeSession(argumentsArray)
    );
    sessionCallbacks.logRedirectionStrategy.set(session.sessionId, strategy);
    return new FFprobeSession(fieldsOf(session, argumentsArray, strategy));
  }

  /** Wraps an FFprobe session native sent. */
  static createFFprobeSessionFromMap(
    sessionMap: NativeSession
  ): FFprobeSession {
    return new FFprobeSession(
      fieldsOf(
        sessionMap,
        parseArguments(sessionMap.command),
        sessionCallbacks.logRedirectionStrategy.get(sessionMap.sessionId)
      )
    );
  }

  /** Creates a media information session in native code, without running it. Its logs are never printed. */
  static async createMediaInformationSession(
    argumentsArray: string[]
  ): Promise<MediaInformationSession> {
    await init();
    const strategy = LogRedirectionStrategy.NEVER_PRINT_LOGS;
    const session = asNativeSession(
      await native.mediaInformationSession(argumentsArray)
    );
    sessionCallbacks.logRedirectionStrategy.set(session.sessionId, strategy);
    return new MediaInformationSession(
      fieldsOf(session, argumentsArray, strategy)
    );
  }

  /** Wraps a media information session native sent, with its media information if parsed. */
  static createMediaInformationSessionFromMap(
    sessionMap: NativeSession
  ): MediaInformationSession {
    const session = new MediaInformationSession(
      fieldsOf(
        sessionMap,
        parseArguments(sessionMap.command),
        LogRedirectionStrategy.NEVER_PRINT_LOGS
      )
    );
    if (sessionMap.mediaInformation != null)
      session.setMediaInformation(
        new MediaInformation(sessionMap.mediaInformation)
      );
    return session;
  }

  getLogCallback(): LogCallback | undefined {
    return sessionCallbacks.log.get(this.#sessionId);
  }

  getSessionId(): number {
    return this.#sessionId;
  }

  getCreateTime(): Date {
    return this.#createTime;
  }

  getStartTime(): Date | undefined {
    return this.#startTime;
  }

  async getEndTime(): Promise<Date | undefined> {
    return dateOf(await native.abstractSessionGetEndTime(this.#sessionId));
  }

  getDuration(): Promise<number> {
    return native.abstractSessionGetDuration(this.#sessionId);
  }

  getArguments(): string[] {
    return this.#arguments;
  }

  getCommand(): string {
    return this.#command;
  }

  async getAllLogs(waitTimeout?: number): Promise<Log[]> {
    const logs = await native.abstractSessionGetAllLogs(
      this.#sessionId,
      waitTimeout ?? null
    );
    return asNativeLogs(logs).map(logOf);
  }

  async getLogs(): Promise<Log[]> {
    const logs = await native.abstractSessionGetLogs(this.#sessionId);
    return asNativeLogs(logs).map(logOf);
  }

  getAllLogsAsString(waitTimeout?: number): Promise<string> {
    return native.abstractSessionGetAllLogsAsString(
      this.#sessionId,
      waitTimeout ?? null
    );
  }

  async getLogsAsString(): Promise<string> {
    const logs = await this.getLogs();
    return logs.map((log) => log.getMessage()).join('');
  }

  getOutput(): Promise<string> {
    return this.getAllLogsAsString();
  }

  async getState(): Promise<SessionState> {
    return (await native.abstractSessionGetState(
      this.#sessionId
    )) as SessionState;
  }

  async getReturnCode(): Promise<ReturnCode | undefined> {
    const value = await native.abstractSessionGetReturnCode(this.#sessionId);
    return value == null ? undefined : new ReturnCode(value);
  }

  getFailStackTrace(): Promise<string | null> {
    return native.abstractSessionGetFailStackTrace(this.#sessionId);
  }

  getLogRedirectionStrategy(): LogRedirectionStrategy {
    return this.#logRedirectionStrategy ?? settings.logRedirectionStrategy;
  }

  thereAreAsynchronousMessagesInTransmit(): Promise<boolean> {
    return native.thereAreAsynchronousMessagesInTransmit(this.#sessionId);
  }

  isFFmpeg(): boolean {
    return false;
  }

  isFFprobe(): boolean {
    return false;
  }

  isMediaInformation(): boolean {
    return false;
  }

  cancel(): Promise<void> {
    return native.cancelSession(this.#sessionId);
  }
}

/** An FFmpeg command. */
export class FFmpegSession extends AbstractSession {
  /** Creates an FFmpeg session in native code with the given callbacks, without running it. */
  static async create(
    argumentsArray: string[],
    completeCallback?: FFmpegSessionCompleteCallback,
    logCallback?: LogCallback,
    statisticsCallback?: StatisticsCallback,
    logRedirectionStrategy?: LogRedirectionStrategy
  ): Promise<FFmpegSession> {
    const session = await AbstractSession.createFFmpegSession(
      argumentsArray,
      logRedirectionStrategy
    );
    const sessionId = session.getSessionId();
    setSessionCallback(
      sessionCallbacks.ffmpegComplete,
      sessionId,
      completeCallback
    );
    setSessionCallback(sessionCallbacks.log, sessionId, logCallback);
    setSessionCallback(
      sessionCallbacks.statistics,
      sessionId,
      statisticsCallback
    );
    return session;
  }

  getStatisticsCallback(): StatisticsCallback | undefined {
    return sessionCallbacks.statistics.get(this.getSessionId());
  }

  getCompleteCallback(): FFmpegSessionCompleteCallback | undefined {
    return sessionCallbacks.ffmpegComplete.get(this.getSessionId());
  }

  /** All statistics, after waiting up to `waitTimeout` ms (native default when omitted) for those in transit. */
  async getAllStatistics(waitTimeout?: number): Promise<Statistics[]> {
    await init();
    const statistics = await native.ffmpegSessionGetAllStatistics(
      this.getSessionId(),
      waitTimeout ?? null
    );
    return asNativeStatistics(statistics).map(statisticsOf);
  }

  /** The statistics received so far, without waiting. */
  async getStatistics(): Promise<Statistics[]> {
    await init();
    const statistics = await native.ffmpegSessionGetStatistics(
      this.getSessionId()
    );
    return asNativeStatistics(statistics).map(statisticsOf);
  }

  async getLastReceivedStatistics(): Promise<Statistics | undefined> {
    return (await this.getStatistics()).at(-1);
  }

  override isFFmpeg(): boolean {
    return true;
  }
}

/** An FFprobe command. */
export class FFprobeSession extends AbstractSession {
  /** Creates an FFprobe session in native code with the given callbacks, without running it. */
  static async create(
    argumentsArray: string[],
    completeCallback?: FFprobeSessionCompleteCallback,
    logCallback?: LogCallback,
    logRedirectionStrategy?: LogRedirectionStrategy
  ): Promise<FFprobeSession> {
    const session = await AbstractSession.createFFprobeSession(
      argumentsArray,
      logRedirectionStrategy
    );
    const sessionId = session.getSessionId();
    setSessionCallback(
      sessionCallbacks.ffprobeComplete,
      sessionId,
      completeCallback
    );
    setSessionCallback(sessionCallbacks.log, sessionId, logCallback);
    return session;
  }

  getCompleteCallback(): FFprobeSessionCompleteCallback | undefined {
    return sessionCallbacks.ffprobeComplete.get(this.getSessionId());
  }

  override isFFprobe(): boolean {
    return true;
  }
}

/** An FFprobe command whose JSON output is parsed into a `MediaInformation`. */
export class MediaInformationSession extends AbstractSession {
  #mediaInformation: MediaInformation | undefined;

  /** Creates a media information session in native code with the given callbacks, without running it. */
  static async create(
    argumentsArray: string[],
    completeCallback?: MediaInformationSessionCompleteCallback,
    logCallback?: LogCallback
  ): Promise<MediaInformationSession> {
    const session =
      await AbstractSession.createMediaInformationSession(argumentsArray);
    const sessionId = session.getSessionId();
    setSessionCallback(
      sessionCallbacks.mediaInformationComplete,
      sessionId,
      completeCallback
    );
    setSessionCallback(sessionCallbacks.log, sessionId, logCallback);
    return session;
  }

  /**
   * The extracted media information; `undefined` while unavailable, if the command failed or its output could not
   * be parsed.
   */
  getMediaInformation(): MediaInformation | undefined {
    return this.#mediaInformation;
  }

  setMediaInformation(mediaInformation: MediaInformation | undefined): void {
    this.#mediaInformation = mediaInformation;
  }

  getCompleteCallback(): MediaInformationSessionCompleteCallback | undefined {
    return sessionCallbacks.mediaInformationComplete.get(this.getSessionId());
  }

  override isMediaInformation(): boolean {
    return true;
  }
}

type AnySession = FFmpegSession | FFprobeSession | MediaInformationSession;

/** Wraps a session native sent in the class of its type; `undefined` for none. */
export const toSession = (
  value: CodegenTypes.UnsafeObject | null | undefined
): AnySession | undefined => {
  if (value == null) return undefined;
  const session = asNativeSession(value);
  switch (session.type) {
    case SESSION_TYPE.ffprobe:
      return AbstractSession.createFFprobeSessionFromMap(session);
    case SESSION_TYPE.mediaInformation:
      return AbstractSession.createMediaInformationSessionFromMap(session);
    default:
      return AbstractSession.createFFmpegSessionFromMap(session);
  }
};

/** Looks up a session in the native history; rejects with `SESSION_NOT_FOUND` if it is not there. */
export const getSession = async (sessionId: number): Promise<AnySession> => {
  const session = toSession(await native.getSession(sessionId));
  if (session === undefined)
    throw Object.assign(new Error('Session not found.'), {
      code: 'SESSION_NOT_FOUND',
    });
  return session;
};

/** Wraps the sessions native sent, keeping those of `type`. */
export const toSessions = <T extends AbstractSession>(
  values: CodegenTypes.UnsafeObject[],
  type: abstract new (...args: never[]) => T
): T[] =>
  values
    .map((value): AbstractSession | undefined => toSession(value))
    .filter(
      (session: AbstractSession | undefined): session is T =>
        session instanceof type
    );

/** Attaches the media information native parsed, if any. */
export const loadMediaInformation = async (
  session: MediaInformationSession
) => {
  const properties = await native.getMediaInformation(session.getSessionId());
  if (properties != null)
    session.setMediaInformation(
      new MediaInformation(asMediaProperties(properties))
    );
};

/** Runs the complete callbacks of a session that ended: its own, then the global one for its type. */
const onComplete = async (sessionId: number) => {
  if (settings.shutdown) return;
  let session: AnySession;
  try {
    // Rejects with SESSION_NOT_FOUND once the session left the history.
    session = await getSession(sessionId);
  } catch (error) {
    if (!settings.shutdown)
      console.error('[ffmpeg] looking up a completed session failed', error);
    return;
  }
  if (settings.shutdown) return;
  if (session instanceof FFmpegSession) {
    notify(session.getCompleteCallback(), session, 'session complete');
    if (!settings.shutdown)
      notify(globalCallbacks.ffmpegComplete, session, 'global complete');
  } else if (session instanceof FFprobeSession) {
    notify(session.getCompleteCallback(), session, 'session complete');
    if (!settings.shutdown)
      notify(globalCallbacks.ffprobeComplete, session, 'global complete');
  } else {
    notify(session.getCompleteCallback(), session, 'session complete');
    if (!settings.shutdown)
      notify(
        globalCallbacks.mediaInformationComplete,
        session,
        'global complete'
      );
  }
};

setCompleteHandler((sessionId) => void onComplete(sessionId));
