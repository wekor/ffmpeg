import {
  type CodegenTypes,
  type TurboModule,
  TurboModuleRegistry,
} from 'react-native';

/** A line FFmpeg or FFprobe printed while a session ran. */
export type LogEvent = {
  sessionId: CodegenTypes.Double;
  level: CodegenTypes.Int32;
  message: string;
};

/** Progress of a running FFmpeg session. */
export type StatisticsEvent = {
  sessionId: CodegenTypes.Double;
  videoFrameNumber: CodegenTypes.Int32;
  videoFps: CodegenTypes.Double;
  videoQuality: CodegenTypes.Double;
  size: CodegenTypes.Double;
  time: CodegenTypes.Double;
  bitrate: CodegenTypes.Double;
  speed: CodegenTypes.Double;
};

/** Names a session; JS reads the rest with `getSession`. */
export type SessionEvent = {
  sessionId: CodegenTypes.Double;
};

/**
 * The native boundary. Sessions live in native code and are addressed by id; JS wraps them in classes
 * (`src/session.ts`). Session-shaped values cross as plain objects whose keys are listed in `src/native.ts`.
 * Bytes cross as base64 strings, since codegen has no ArrayBuffer before React Native 0.87.
 */
export interface Spec extends TurboModule {
  // Events.
  readonly onLog: CodegenTypes.EventEmitter<LogEvent>;
  readonly onStatistics: CodegenTypes.EventEmitter<StatisticsEvent>;
  /** A session ended; its complete callback runs in JS. */
  readonly onComplete: CodegenTypes.EventEmitter<SessionEvent>;
  /** Native dropped a session from its history. */
  readonly onSessionDeleted: CodegenTypes.EventEmitter<SessionEvent>;

  // AbstractSession.
  abstractSessionGetEndTime(
    sessionId: CodegenTypes.Double
  ): Promise<CodegenTypes.Double | null>;
  abstractSessionGetDuration(
    sessionId: CodegenTypes.Double
  ): Promise<CodegenTypes.Double>;
  abstractSessionGetAllLogs(
    sessionId: CodegenTypes.Double,
    waitTimeout: CodegenTypes.Double | null
  ): Promise<CodegenTypes.UnsafeObject[]>;
  abstractSessionGetLogs(
    sessionId: CodegenTypes.Double
  ): Promise<CodegenTypes.UnsafeObject[]>;
  abstractSessionGetAllLogsAsString(
    sessionId: CodegenTypes.Double,
    waitTimeout: CodegenTypes.Double | null
  ): Promise<string>;
  abstractSessionGetState(
    sessionId: CodegenTypes.Double
  ): Promise<CodegenTypes.Double>;
  abstractSessionGetReturnCode(
    sessionId: CodegenTypes.Double
  ): Promise<CodegenTypes.Double | null>;
  abstractSessionGetFailStackTrace(
    sessionId: CodegenTypes.Double
  ): Promise<string | null>;
  thereAreAsynchronousMessagesInTransmit(
    sessionId: CodegenTypes.Double
  ): Promise<boolean>;

  // ArchDetect.
  getArch(): Promise<string>;

  // Creating sessions.
  ffmpegSession(commandArguments: string[]): Promise<CodegenTypes.UnsafeObject>;
  ffmpegSessionGetAllStatistics(
    sessionId: CodegenTypes.Double,
    waitTimeout: CodegenTypes.Double | null
  ): Promise<CodegenTypes.UnsafeObject[]>;
  ffmpegSessionGetStatistics(
    sessionId: CodegenTypes.Double
  ): Promise<CodegenTypes.UnsafeObject[]>;
  ffprobeSession(
    commandArguments: string[]
  ): Promise<CodegenTypes.UnsafeObject>;
  mediaInformationSession(
    commandArguments: string[]
  ): Promise<CodegenTypes.UnsafeObject>;
  mediaInformationJsonParserFrom(
    ffprobeJsonOutput: string
  ): Promise<CodegenTypes.UnsafeObject | null>;
  mediaInformationJsonParserFromWithError(
    ffprobeJsonOutput: string
  ): Promise<CodegenTypes.UnsafeObject>;

  // Redirection, logs and statistics.
  enableRedirection(): Promise<void>;
  disableRedirection(): Promise<void>;
  enableLogs(): Promise<void>;
  disableLogs(): Promise<void>;
  enableStatistics(): Promise<void>;
  disableStatistics(): Promise<void>;

  // Fonts.
  setFontconfigConfigurationPath(path: string): Promise<void>;
  setFontDirectory(
    fontDirectoryPath: string,
    fontNameMap: CodegenTypes.UnsafeObject | null
  ): Promise<void>;
  setFontDirectoryList(
    fontDirectoryList: string[],
    fontNameMap: CodegenTypes.UnsafeObject | null
  ): Promise<void>;

  // Named pipes; deprecated in favour of buffers and streams.
  registerNewFFmpegPipe(): Promise<string | null>;
  closeFFmpegPipe(ffmpegPipePath: string): Promise<void>;
  writeToPipe(
    inputPath: string,
    namedPipePath: string
  ): Promise<CodegenTypes.Double>;

  // Version, build and environment.
  getFFmpegVersion(): Promise<string>;
  getBuildDate(): Promise<string>;
  setEnvironmentVariable(
    variableName: string,
    variableValue: string
  ): Promise<void>;
  ignoreSignal(signalValue: CodegenTypes.Double): Promise<void>;
  getPlatform(): Promise<string>;
  getPackageName(): Promise<string>;
  getExternalLibraries(): Promise<string[]>;

  // Executing. The async variants resolve once started; `onComplete` reports the end.
  ffmpegSessionExecute(sessionId: CodegenTypes.Double): Promise<void>;
  ffprobeSessionExecute(sessionId: CodegenTypes.Double): Promise<void>;
  mediaInformationSessionExecute(
    sessionId: CodegenTypes.Double,
    waitTimeout: CodegenTypes.Double | null
  ): Promise<void>;
  asyncFFmpegSessionExecute(sessionId: CodegenTypes.Double): Promise<void>;
  asyncFFprobeSessionExecute(sessionId: CodegenTypes.Double): Promise<void>;
  asyncMediaInformationSessionExecute(
    sessionId: CodegenTypes.Double,
    waitTimeout: CodegenTypes.Double | null
  ): Promise<void>;
  cancel(): Promise<void>;
  cancelSession(sessionId: CodegenTypes.Double): Promise<void>;

  // Configuration.
  getLogLevel(): Promise<CodegenTypes.Double>;
  setLogLevel(level: CodegenTypes.Double): Promise<void>;
  getSessionHistorySize(): Promise<CodegenTypes.Double>;
  setSessionHistorySize(sessionHistorySize: CodegenTypes.Double): Promise<void>;
  getLogRedirectionStrategy(): Promise<CodegenTypes.Double>;
  setLogRedirectionStrategy(
    logRedirectionStrategy: CodegenTypes.Double
  ): Promise<void>;
  messagesInTransmit(
    sessionId: CodegenTypes.Double
  ): Promise<CodegenTypes.Double>;
  /** Logs the wrapper version once, so it shows in device logs. */
  printLoadConfirmation(version: string): Promise<void>;

  // Session history.
  getSession(
    sessionId: CodegenTypes.Double
  ): Promise<CodegenTypes.UnsafeObject | null>;
  getLastSession(): Promise<CodegenTypes.UnsafeObject | null>;
  getLastCompletedSession(): Promise<CodegenTypes.UnsafeObject | null>;
  getSessions(): Promise<CodegenTypes.UnsafeObject[]>;
  getSessionsByState(
    sessionState: CodegenTypes.Double
  ): Promise<CodegenTypes.UnsafeObject[]>;
  getFFmpegSessions(): Promise<CodegenTypes.UnsafeObject[]>;
  getFFprobeSessions(): Promise<CodegenTypes.UnsafeObject[]>;
  getMediaInformationSessions(): Promise<CodegenTypes.UnsafeObject[]>;
  getMediaInformation(
    sessionId: CodegenTypes.Double
  ): Promise<CodegenTypes.UnsafeObject | null>;
  clearSessions(): Promise<void>;
  deleteSession(sessionId: CodegenTypes.Double): Promise<void>;

  // Android only; iOS rejects with `unsupported`.
  selectDocument(
    writable: boolean,
    title: string | null,
    type: string | null,
    extraTypes: string[] | null
  ): Promise<string | null>;
  getSafParameter(
    uriString: string,
    openMode: string,
    reusable: boolean
  ): Promise<string>;
  unregisterSafProtocolUrl(safUrl: string): Promise<void>;
  getSupportedCameraIds(): Promise<string[]>;

  // In-memory input, `ffkit-inbuf:` URLs.
  inputBufferFromByteArray(
    base64Data: string,
    extension: string | null
  ): Promise<string>;
  inputBufferClose(url: string): Promise<void>;

  // In-memory output, `ffkit-outbuf:` URLs.
  outputBufferCreate(
    extension: string | null,
    initialCapacity: CodegenTypes.Double | null,
    maxCapacity: CodegenTypes.Double | null
  ): Promise<string>;
  outputBufferGetSize(url: string): Promise<CodegenTypes.Double>;
  outputBufferToByteArray(url: string): Promise<string>;
  outputBufferClose(url: string): Promise<void>;

  // Streaming input, `ffkit-stream-in:` URLs.
  streamInputCreate(
    extension: string | null,
    capacity: CodegenTypes.Double | null
  ): Promise<string>;
  streamInputWrite(
    url: string,
    base64Data: string,
    timeoutMs: CodegenTypes.Double | null
  ): Promise<CodegenTypes.Double>;
  streamInputCloseInput(url: string): Promise<void>;
  streamInputClose(url: string): Promise<void>;

  // Streaming output, `ffkit-stream-out:` URLs.
  streamOutputCreate(
    extension: string | null,
    capacity: CodegenTypes.Double | null
  ): Promise<string>;
  /** Resolves with base64 bytes, an empty string at end of stream. */
  streamOutputRead(
    url: string,
    maxBytes: CodegenTypes.Double,
    timeoutMs: CodegenTypes.Double | null
  ): Promise<string>;
  streamOutputClose(url: string): Promise<void>;

  // Lifecycle.
  shutdown(waitTimeout: CodegenTypes.Double): Promise<boolean>;
  isShutdown(): Promise<boolean>;
  uninit(): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('ReactNativeFFmpeg');
