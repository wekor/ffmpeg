/*
 * Copyright (c) 2021-2022, 2026 Taner Sener
 * Kotlin port for @wekor/react-native-ffmpeg (React Native New Architecture), 2026.
 *
 * This file is part of FFmpegKitNext.
 *
 * FFmpegKitNext is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * FFmpegKitNext is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General License for more details.
 *
 * You should have received a copy of the GNU Lesser General License
 * along with FFmpegKitNext. If not, see <http://www.gnu.org/licenses/>.
 */

package com.wekor.reactnativeffmpeg

import android.net.Uri
import android.util.Base64
import android.util.Log
import com.arthenica.ffmpegkit.AbiDetect
import com.arthenica.ffmpegkit.AbstractSession
import com.arthenica.ffmpegkit.FFmpegKit
import com.arthenica.ffmpegkit.FFmpegKitConfig
import com.arthenica.ffmpegkit.FFmpegKitInputBuffer
import com.arthenica.ffmpegkit.FFmpegKitOutputBuffer
import com.arthenica.ffmpegkit.FFmpegKitStreamInput
import com.arthenica.ffmpegkit.FFmpegKitStreamOutput
import com.arthenica.ffmpegkit.FFmpegSession
import com.arthenica.ffmpegkit.FFmpegSessionCompleteCallback
import com.arthenica.ffmpegkit.FFprobeKit
import com.arthenica.ffmpegkit.FFprobeSession
import com.arthenica.ffmpegkit.FFprobeSessionCompleteCallback
import com.arthenica.ffmpegkit.Level
import com.arthenica.ffmpegkit.LogCallback
import com.arthenica.ffmpegkit.LogRedirectionStrategy
import com.arthenica.ffmpegkit.MediaInformationJsonParser
import com.arthenica.ffmpegkit.MediaInformationSession
import com.arthenica.ffmpegkit.MediaInformationSessionCompleteCallback
import com.arthenica.ffmpegkit.Packages
import com.arthenica.ffmpegkit.Session
import com.arthenica.ffmpegkit.SessionDeleteListener
import com.arthenica.ffmpegkit.Signal
import com.arthenica.ffmpegkit.Statistics
import com.arthenica.ffmpegkit.StatisticsCallback
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread
import org.json.JSONException
import com.arthenica.ffmpegkit.Log as FFmpegKitLog

/** The tag of this library's logcat lines. */
internal const val LIBRARY_NAME = "react-native-ffmpeg"

private const val PLATFORM_NAME = "android"

/** Executions, stream reads and writes and pipe copies share this many threads. */
private const val ASYNC_CONCURRENCY_LIMIT = 10

private const val WRONG_SESSION_TYPE = "A session is found but it does not have the correct type."

/**
 * The spec's surface, and only the React Native boundary: it reads JS arguments, calls FFmpegKit and turns its
 * sessions, logs and statistics into what JS reads. Sessions live in FFmpegKit and are addressed by id.
 */
@ReactModule(name = ReactNativeFFmpegModule.NAME)
class ReactNativeFFmpegModule(reactContext: ReactApplicationContext) : NativeReactNativeFFmpegSpec(reactContext) {

  private val executor: ExecutorService = Executors.newFixedThreadPool(ASYNC_CONCURRENCY_LIMIT)
  private val documentPicker = DocumentPicker(reactContext)

  @Volatile private var logsEnabled = false
  @Volatile private var statisticsEnabled = false
  @Volatile private var invalidated = false

  // Sessions JS may still address after `shutdown` cleared FFmpegKit's history. Public history (`getSession`,
  // `getSessions`, ...) still reads FFmpegKit's.
  private val shutdownSessions = ConcurrentHashMap<Long, Session>()
  @Volatile private var retainShutdownSessions = false

  // Buffers and streams JS created, by their `ffkit...:` url.
  private val inputBuffers = ConcurrentHashMap<String, FFmpegKitInputBuffer>()
  private val outputBuffers = ConcurrentHashMap<String, FFmpegKitOutputBuffer>()
  private val streamInputs = ConcurrentHashMap<String, FFmpegKitStreamInput>()
  private val streamOutputs = ConcurrentHashMap<String, FFmpegKitStreamOutput>()

  // FFmpegKit holds its delete listeners weakly; this field keeps ours alive.
  private val sessionDeleteListener =
    object : SessionDeleteListener {
      override fun sessionDeleted(sessionId: Long) {
        if (!invalidated) emitOnSessionDeleted(sessionEvent(sessionId))
      }
    }

  init {
    FFmpegKitConfig.addSessionDeleteListener(sessionDeleteListener)
  }

  override fun invalidate() {
    invalidated = true
    FFmpegKitConfig.removeSessionDeleteListener(sessionDeleteListener)
    documentPicker.close()
    shutdownSessions.clear()
    // Running work finishes; its promises go nowhere.
    executor.shutdown()
    super.invalidate()
  }

  // Events, from FFmpegKit's callback threads

  private fun emitComplete(session: Session) {
    if (!invalidated) emitOnComplete(sessionEvent(session.getSessionId()))
  }

  private fun emitLogIfEnabled(log: FFmpegKitLog) {
    if (logsEnabled && !invalidated) emitOnLog(log.toWritableMap())
  }

  private fun emitStatisticsIfEnabled(statistics: Statistics) {
    if (statisticsEnabled && !invalidated) emitOnStatistics(statistics.toWritableMap())
  }

  // Sessions

  private fun findSession(sessionId: Long): Session? = FFmpegKitConfig.getSession(sessionId) ?: shutdownSessions[sessionId]

  private fun <T : Session> retainForShutdown(session: T): T {
    if (retainShutdownSessions || FFmpegKitConfig.isShutdown()) shutdownSessions[session.getSessionId()] = session
    return session
  }

  private inline fun withSession(sessionId: Double, promise: Promise, use: (Session) -> Unit) {
    val session = findSession(sessionId.toLong())
    if (session == null) promise.reject("SESSION_NOT_FOUND", "Session not found.") else use(session)
  }

  private inline fun <reified T : Session> withSessionOf(
    sessionId: Double,
    promise: Promise,
    wrongTypeCode: String,
    use: (T) -> Unit,
  ) = withSession(sessionId, promise) { session ->
    if (session is T) use(session) else promise.reject(wrongTypeCode, WRONG_SESSION_TYPE)
  }

  /** A wait for messages still in transmit: JS's when it is a non-negative number, else FFmpegKit's default. */
  private fun timeoutOf(waitTimeout: Double?): Int =
    if (waitTimeout != null && waitTimeout.toInt() >= 0) {
      waitTimeout.toInt()
    } else {
      AbstractSession.DEFAULT_TIMEOUT_FOR_ASYNCHRONOUS_MESSAGES_IN_TRANSMIT
    }

  /**
   * Runs [task] on the module's threads. A task that throws, or a pool `uninit` already shut down, rejects with
   * [errorCode], so the promise always settles.
   */
  private fun runAsync(promise: Promise, errorCode: String, task: () -> Unit) {
    try {
      executor.execute {
        try {
          task()
        } catch (e: Exception) {
          promise.reject(errorCode, e.message, e)
        }
      }
    } catch (e: RejectedExecutionException) {
      promise.reject(errorCode, "The module's executor is shut down.", e)
    }
  }

  /** Resolves with what [block] returns, or rejects with [errorCode] when it throws. */
  private inline fun settle(promise: Promise, errorCode: String, block: () -> Any?) {
    val value =
      try {
        block()
      } catch (e: Exception) {
        promise.reject(errorCode, e.message, e)
        return
      }
    promise.resolve(value)
  }

  // AbstractSession

  override fun abstractSessionGetEndTime(sessionId: Double, promise: Promise) =
    withSession(sessionId, promise) { promise.resolve(it.getEndTime()?.time?.toDouble()) }

  override fun abstractSessionGetDuration(sessionId: Double, promise: Promise) =
    withSession(sessionId, promise) { promise.resolve(it.getDuration().toDouble()) }

  override fun abstractSessionGetAllLogs(sessionId: Double, waitTimeout: Double?, promise: Promise) =
    withSession(sessionId, promise) { promise.resolve(it.getAllLogs(timeoutOf(waitTimeout)).toLogArray()) }

  override fun abstractSessionGetLogs(sessionId: Double, promise: Promise) =
    withSession(sessionId, promise) { promise.resolve(it.getLogs().toLogArray()) }

  override fun abstractSessionGetAllLogsAsString(sessionId: Double, waitTimeout: Double?, promise: Promise) =
    withSession(sessionId, promise) { promise.resolve(it.getAllLogsAsString(timeoutOf(waitTimeout))) }

  override fun abstractSessionGetState(sessionId: Double, promise: Promise) =
    withSession(sessionId, promise) { promise.resolve(it.getState().ordinal.toDouble()) }

  override fun abstractSessionGetReturnCode(sessionId: Double, promise: Promise) =
    withSession(sessionId, promise) { promise.resolve(it.getReturnCode()?.value?.toDouble()) }

  override fun abstractSessionGetFailStackTrace(sessionId: Double, promise: Promise) =
    withSession(sessionId, promise) { promise.resolve(it.getFailStackTrace()) }

  override fun thereAreAsynchronousMessagesInTransmit(sessionId: Double, promise: Promise) =
    withSession(sessionId, promise) { promise.resolve(it.thereAreAsynchronousMessagesInTransmit()) }

  // ArchDetect

  override fun getArch(promise: Promise) = promise.resolve(AbiDetect.getAbi())

  // Creating sessions. Their callbacks feed the events; FFmpegKit prints none of their logs.

  override fun ffmpegSession(commandArguments: ReadableArray, promise: Promise) {
    val session =
      FFmpegSession.create(
        commandArguments.strings().toTypedArray(),
        FFmpegSessionCompleteCallback { emitComplete(it) },
        LogCallback { emitLogIfEnabled(it) },
        StatisticsCallback { emitStatisticsIfEnabled(it) },
        LogRedirectionStrategy.NEVER_PRINT_LOGS,
      )
    promise.resolve(retainForShutdown(session).toWritableMap())
  }

  override fun ffmpegSessionGetAllStatistics(sessionId: Double, waitTimeout: Double?, promise: Promise) =
    withSessionOf<FFmpegSession>(sessionId, promise, NOT_FFMPEG_SESSION) {
      promise.resolve(it.getAllStatistics(timeoutOf(waitTimeout)).toStatisticsArray())
    }

  override fun ffmpegSessionGetStatistics(sessionId: Double, promise: Promise) =
    withSessionOf<FFmpegSession>(sessionId, promise, NOT_FFMPEG_SESSION) {
      promise.resolve(it.getStatistics().toStatisticsArray())
    }

  override fun ffprobeSession(commandArguments: ReadableArray, promise: Promise) {
    val session =
      FFprobeSession.create(
        commandArguments.strings().toTypedArray(),
        FFprobeSessionCompleteCallback { emitComplete(it) },
        LogCallback { emitLogIfEnabled(it) },
        LogRedirectionStrategy.NEVER_PRINT_LOGS,
      )
    promise.resolve(retainForShutdown(session).toWritableMap())
  }

  override fun mediaInformationSession(commandArguments: ReadableArray, promise: Promise) {
    val session =
      MediaInformationSession.create(
        commandArguments.strings().toTypedArray(),
        MediaInformationSessionCompleteCallback { emitComplete(it) },
        LogCallback { emitLogIfEnabled(it) },
      )
    promise.resolve(retainForShutdown(session).toWritableMap())
  }

  override fun mediaInformationJsonParserFrom(ffprobeJsonOutput: String, promise: Promise) {
    try {
      promise.resolve(MediaInformationJsonParser.fromWithError(ffprobeJsonOutput).toWritableMap())
    } catch (e: JSONException) {
      Log.i(LIBRARY_NAME, "Parsing MediaInformation failed.", e)
      promise.resolve(null)
    }
  }

  override fun mediaInformationJsonParserFromWithError(ffprobeJsonOutput: String, promise: Promise) {
    try {
      promise.resolve(MediaInformationJsonParser.fromWithError(ffprobeJsonOutput).toWritableMap())
    } catch (e: JSONException) {
      Log.i(LIBRARY_NAME, "Parsing MediaInformation failed.", e)
      promise.reject("PARSE_FAILED", "Parsing MediaInformation failed with JSON error.")
    }
  }

  // Redirection, logs and statistics

  override fun enableRedirection(promise: Promise) {
    logsEnabled = true
    statisticsEnabled = true
    FFmpegKitConfig.enableRedirection()
    promise.resolve(null)
  }

  override fun disableRedirection(promise: Promise) {
    FFmpegKitConfig.disableRedirection()
    promise.resolve(null)
  }

  override fun enableLogs(promise: Promise) {
    logsEnabled = true
    promise.resolve(null)
  }

  override fun disableLogs(promise: Promise) {
    logsEnabled = false
    promise.resolve(null)
  }

  override fun enableStatistics(promise: Promise) {
    statisticsEnabled = true
    promise.resolve(null)
  }

  override fun disableStatistics(promise: Promise) {
    statisticsEnabled = false
    promise.resolve(null)
  }

  // Fonts

  override fun setFontconfigConfigurationPath(path: String, promise: Promise) {
    FFmpegKitConfig.setFontconfigConfigurationPath(path)
    promise.resolve(null)
  }

  override fun setFontDirectory(fontDirectoryPath: String, fontNameMap: ReadableMap?, promise: Promise) {
    FFmpegKitConfig.setFontDirectory(reactApplicationContext, fontDirectoryPath, fontNameMap.fontNameMapping())
    promise.resolve(null)
  }

  override fun setFontDirectoryList(fontDirectoryList: ReadableArray, fontNameMap: ReadableMap?, promise: Promise) {
    FFmpegKitConfig.setFontDirectoryList(
      reactApplicationContext,
      fontDirectoryList.strings(),
      fontNameMap.fontNameMapping(),
    )
    promise.resolve(null)
  }

  // Named pipes

  @Suppress("DEPRECATION")
  override fun registerNewFFmpegPipe(promise: Promise) =
    promise.resolve(FFmpegKitConfig.registerNewFFmpegPipe(reactApplicationContext))

  @Suppress("DEPRECATION")
  override fun closeFFmpegPipe(ffmpegPipePath: String, promise: Promise) {
    FFmpegKitConfig.closeFFmpegPipe(ffmpegPipePath)
    promise.resolve(null)
  }

  override fun writeToPipe(inputPath: String, namedPipePath: String, promise: Promise) =
    runAsync(promise, "Copy failed") { copyToNamedPipe(inputPath, namedPipePath, promise) }

  // Version, build and environment

  override fun getFFmpegVersion(promise: Promise) = promise.resolve(FFmpegKitConfig.getFFmpegVersion())

  override fun getBuildDate(promise: Promise) = promise.resolve(FFmpegKitConfig.getBuildDate())

  override fun setEnvironmentVariable(variableName: String, variableValue: String, promise: Promise) {
    FFmpegKitConfig.setEnvironmentVariable(variableName, variableValue)
    promise.resolve(null)
  }

  override fun ignoreSignal(signalValue: Double, promise: Promise) {
    val signal = Signal.entries.firstOrNull { it.value == signalValue.toInt() }
    if (signal == null) {
      promise.reject("INVALID_SIGNAL", "Signal value not supported.")
    } else {
      FFmpegKitConfig.ignoreSignal(signal)
      promise.resolve(null)
    }
  }

  override fun getPlatform(promise: Promise) = promise.resolve(PLATFORM_NAME)

  override fun getPackageName(promise: Promise) = promise.resolve(Packages.getPackageName())

  override fun getExternalLibraries(promise: Promise) = promise.resolve(Packages.getExternalLibraries().toStringArray())

  // Executing. The sync variants resolve when the session ends; the async ones once FFmpegKit queued it.

  override fun ffmpegSessionExecute(sessionId: Double, promise: Promise) =
    withSessionOf<FFmpegSession>(sessionId, promise, NOT_FFMPEG_SESSION) { session ->
      runAsync(promise, EXECUTE_FAILED) {
        FFmpegKitConfig.ffmpegExecute(session)
        promise.resolve(null)
      }
    }

  override fun ffprobeSessionExecute(sessionId: Double, promise: Promise) =
    withSessionOf<FFprobeSession>(sessionId, promise, NOT_FFPROBE_SESSION) { session ->
      runAsync(promise, EXECUTE_FAILED) {
        FFmpegKitConfig.ffprobeExecute(session)
        promise.resolve(null)
      }
    }

  override fun mediaInformationSessionExecute(sessionId: Double, waitTimeout: Double?, promise: Promise) =
    withSessionOf<MediaInformationSession>(sessionId, promise, NOT_MEDIA_INFORMATION_SESSION) { session ->
      val timeout = timeoutOf(waitTimeout)
      runAsync(promise, EXECUTE_FAILED) {
        FFmpegKitConfig.getMediaInformationExecute(session, timeout)
        promise.resolve(null)
      }
    }

  override fun asyncFFmpegSessionExecute(sessionId: Double, promise: Promise) =
    withSessionOf<FFmpegSession>(sessionId, promise, NOT_FFMPEG_SESSION) {
      FFmpegKitConfig.asyncFFmpegExecute(it)
      promise.resolve(null)
    }

  override fun asyncFFprobeSessionExecute(sessionId: Double, promise: Promise) =
    withSessionOf<FFprobeSession>(sessionId, promise, NOT_FFPROBE_SESSION) {
      FFmpegKitConfig.asyncFFprobeExecute(it)
      promise.resolve(null)
    }

  override fun asyncMediaInformationSessionExecute(sessionId: Double, waitTimeout: Double?, promise: Promise) =
    withSessionOf<MediaInformationSession>(sessionId, promise, NOT_MEDIA_INFORMATION_SESSION) {
      FFmpegKitConfig.asyncGetMediaInformationExecute(it, timeoutOf(waitTimeout))
      promise.resolve(null)
    }

  override fun cancel(promise: Promise) {
    FFmpegKit.cancel()
    promise.resolve(null)
  }

  override fun cancelSession(sessionId: Double, promise: Promise) {
    FFmpegKit.cancel(sessionId.toLong())
    promise.resolve(null)
  }

  // Configuration

  override fun getLogLevel(promise: Promise) = promise.resolve(FFmpegKitConfig.getLogLevel().value.toDouble())

  override fun setLogLevel(level: Double, promise: Promise) {
    FFmpegKitConfig.setLogLevel(Level.from(level.toInt()))
    promise.resolve(null)
  }

  override fun getSessionHistorySize(promise: Promise) =
    promise.resolve(FFmpegKitConfig.getSessionHistorySize().toDouble())

  override fun setSessionHistorySize(sessionHistorySize: Double, promise: Promise) {
    FFmpegKitConfig.setSessionHistorySize(sessionHistorySize.toInt())
    promise.resolve(null)
  }

  override fun getLogRedirectionStrategy(promise: Promise) =
    promise.resolve(FFmpegKitConfig.getLogRedirectionStrategy().code.toDouble())

  override fun setLogRedirectionStrategy(logRedirectionStrategy: Double, promise: Promise) {
    FFmpegKitConfig.setLogRedirectionStrategy(logRedirectionStrategyOf(logRedirectionStrategy.toInt()))
    promise.resolve(null)
  }

  override fun messagesInTransmit(sessionId: Double, promise: Promise) =
    promise.resolve(FFmpegKitConfig.messagesInTransmit(sessionId.toLong()).toDouble())

  override fun printLoadConfirmation(version: String, promise: Promise) {
    if (loadConfirmationPrinted.compareAndSet(false, true)) {
      val packageName = Packages.getPackageName()
      val packagePart = if (packageName.isEmpty()) "" else "$packageName-"
      val versionPart = version.ifEmpty { "unknown" }
      Log.d(LIBRARY_NAME, "Loaded $LIBRARY_NAME-$packagePart$PLATFORM_NAME-${AbiDetect.getAbi()}-$versionPart.")
    }
    promise.resolve(null)
  }

  // Session history

  override fun getSession(sessionId: Double, promise: Promise) {
    val session = FFmpegKitConfig.getSession(sessionId.toLong())
    if (session == null) {
      promise.reject("SESSION_NOT_FOUND", "Session not found.")
    } else {
      promise.resolve(session.toWritableMap())
    }
  }

  override fun getLastSession(promise: Promise) = promise.resolve(FFmpegKitConfig.getLastSession()?.toWritableMap())

  override fun getLastCompletedSession(promise: Promise) =
    promise.resolve(FFmpegKitConfig.getLastCompletedSession()?.toWritableMap())

  override fun getSessions(promise: Promise) = promise.resolve(FFmpegKitConfig.getSessions().toSessionArray())

  override fun getSessionsByState(sessionState: Double, promise: Promise) =
    promise.resolve(FFmpegKitConfig.getSessionsByState(sessionStateOf(sessionState.toInt())).toSessionArray())

  override fun getFFmpegSessions(promise: Promise) = promise.resolve(FFmpegKit.listSessions().toSessionArray())

  override fun getFFprobeSessions(promise: Promise) = promise.resolve(FFprobeKit.listFFprobeSessions().toSessionArray())

  override fun getMediaInformationSessions(promise: Promise) =
    promise.resolve(FFprobeKit.listMediaInformationSessions().toSessionArray())

  override fun getMediaInformation(sessionId: Double, promise: Promise) =
    withSessionOf<MediaInformationSession>(sessionId, promise, NOT_MEDIA_INFORMATION_SESSION) {
      promise.resolve(it.getMediaInformation()?.toWritableMap())
    }

  override fun clearSessions(promise: Promise) {
    FFmpegKitConfig.clearSessions()
    shutdownSessions.clear()
    promise.resolve(null)
  }

  override fun deleteSession(sessionId: Double, promise: Promise) {
    FFmpegKitConfig.deleteSession(sessionId.toLong())
    shutdownSessions.remove(sessionId.toLong())
    promise.resolve(null)
  }

  // Storage Access Framework and cameras

  override fun selectDocument(
    writable: Boolean,
    title: String?,
    type: String?,
    extraTypes: ReadableArray?,
    promise: Promise,
  ) = documentPicker.select(writable, title, type, extraTypes?.strings()?.toTypedArray(), promise)

  override fun getSafParameter(uriString: String, openMode: String, reusable: Boolean, promise: Promise) {
    val safParameter =
      try {
        FFmpegKitConfig.getSafParameter(reactApplicationContext, Uri.parse(uriString), openMode, reusable)
      } catch (e: Exception) {
        Log.w(LIBRARY_NAME, "Cannot getSafParameter using parameters uriString: $uriString, openMode: $openMode.", e)
        promise.reject("GET_SAF_PARAMETER_FAILED", e.message, e)
        return
      }
    Log.d(
      LIBRARY_NAME,
      "getSafParameter using parameters uriString: $uriString, openMode: $openMode, reusable: $reusable " +
        "completed with saf parameter: $safParameter.",
    )
    promise.resolve(safParameter)
  }

  override fun unregisterSafProtocolUrl(safUrl: String, promise: Promise) {
    FFmpegKitConfig.unregisterSafProtocolUrl(safUrl)
    Log.d(LIBRARY_NAME, "unregisterSafProtocolUrl using parameter safUrl: $safUrl completed.")
    promise.resolve(null)
  }

  override fun getSupportedCameraIds(promise: Promise) =
    promise.resolve(FFmpegKitConfig.getSupportedCameraIds(reactApplicationContext).toStringArray())

  // In-memory input

  override fun inputBufferFromByteArray(base64Data: String, extension: String?, promise: Promise) {
    val bytes =
      try {
        Base64.decode(base64Data, Base64.NO_WRAP)
      } catch (e: IllegalArgumentException) {
        promise.reject("INVALID_DATA", "Invalid input buffer data.", e)
        return
      }
    settle(promise, "INPUT_BUFFER_CREATE_FAILED") {
      val inputBuffer = FFmpegKitInputBuffer.fromByteArray(bytes, extension)
      inputBuffer.getUrl().also { inputBuffers[it] = inputBuffer }
    }
  }

  override fun inputBufferClose(url: String, promise: Promise) {
    inputBuffers.remove(url)?.close()
    promise.resolve(null)
  }

  // In-memory output

  override fun outputBufferCreate(extension: String?, initialCapacity: Double?, maxCapacity: Double?, promise: Promise) =
    settle(promise, "OUTPUT_BUFFER_CREATE_FAILED") {
      val outputBuffer =
        if (initialCapacity != null && maxCapacity != null) {
          FFmpegKitOutputBuffer.create(extension, initialCapacity.toLong(), maxCapacity.toLong())
        } else {
          FFmpegKitOutputBuffer.create(extension)
        }
      outputBuffer.getUrl().also { outputBuffers[it] = outputBuffer }
    }

  override fun outputBufferGetSize(url: String, promise: Promise) {
    val outputBuffer = outputBuffers[url] ?: return promise.reject("NOT_FOUND", "Output buffer not found.")
    promise.resolve(outputBuffer.getSize().toDouble())
  }

  override fun outputBufferToByteArray(url: String, promise: Promise) {
    val outputBuffer = outputBuffers[url] ?: return promise.reject("NOT_FOUND", "Output buffer not found.")
    settle(promise, "OUTPUT_BUFFER_READ_FAILED") { Base64.encodeToString(outputBuffer.toByteArray(), Base64.NO_WRAP) }
  }

  override fun outputBufferClose(url: String, promise: Promise) {
    outputBuffers.remove(url)?.close()
    promise.resolve(null)
  }

  // Streaming input

  override fun streamInputCreate(extension: String?, capacity: Double?, promise: Promise) =
    settle(promise, "STREAM_INPUT_CREATE_FAILED") {
      val streamInput =
        if (capacity != null) {
          FFmpegKitStreamInput.create(extension, capacity.toLong())
        } else {
          FFmpegKitStreamInput.create(extension)
        }
      streamInput.getUrl().also { streamInputs[it] = streamInput }
    }

  override fun streamInputWrite(url: String, base64Data: String, timeoutMs: Double?, promise: Promise) {
    val streamInput = streamInputs[url] ?: return promise.reject("NOT_FOUND", "Stream input not found.")
    val bytes =
      try {
        Base64.decode(base64Data, Base64.NO_WRAP)
      } catch (e: IllegalArgumentException) {
        promise.reject("INVALID_ARGUMENTS", "Invalid stream input arguments.", e)
        return
      }
    // Blocks while the stream is full.
    runAsync(promise, "STREAM_INPUT_WRITE_FAILED") {
      val written = if (timeoutMs != null) streamInput.write(bytes, timeoutMs.toInt()) else streamInput.write(bytes)
      promise.resolve(written.toDouble())
    }
  }

  override fun streamInputCloseInput(url: String, promise: Promise) {
    streamInputs[url]?.closeInput()
    promise.resolve(null)
  }

  override fun streamInputClose(url: String, promise: Promise) {
    streamInputs.remove(url)?.close()
    promise.resolve(null)
  }

  // Streaming output

  override fun streamOutputCreate(extension: String?, capacity: Double?, promise: Promise) =
    settle(promise, "STREAM_OUTPUT_CREATE_FAILED") {
      val streamOutput =
        if (capacity != null) {
          FFmpegKitStreamOutput.create(extension, capacity.toLong())
        } else {
          FFmpegKitStreamOutput.create(extension)
        }
      streamOutput.getUrl().also { streamOutputs[it] = streamOutput }
    }

  override fun streamOutputRead(url: String, maxBytes: Double, timeoutMs: Double?, promise: Promise) {
    val streamOutput = streamOutputs[url] ?: return promise.reject("NOT_FOUND", "Stream output not found.")
    // Blocks until FFmpeg wrote something or the output ended.
    runAsync(promise, "STREAM_OUTPUT_READ_FAILED") {
      val data =
        if (timeoutMs != null) {
          streamOutput.read(maxBytes.toInt(), timeoutMs.toInt())
        } else {
          streamOutput.read(maxBytes.toInt())
        }
      promise.resolve(data?.let { Base64.encodeToString(it, Base64.NO_WRAP) } ?: "")
    }
  }

  override fun streamOutputClose(url: String, promise: Promise) {
    streamOutputs.remove(url)?.close()
    promise.resolve(null)
  }

  // Lifecycle

  override fun shutdown(waitTimeout: Double, promise: Promise) {
    if (
      !waitTimeout.isFinite() ||
        waitTimeout != Math.rint(waitTimeout) ||
        waitTimeout < Int.MIN_VALUE.toDouble() ||
        waitTimeout > Int.MAX_VALUE.toDouble()
    ) {
      promise.reject("INVALID_ARGUMENTS", "waitTimeout must be a signed 32-bit integer in milliseconds.")
      return
    }
    retainShutdownSessions = true
    for (session in FFmpegKitConfig.getSessions()) shutdownSessions[session.getSessionId()] = session

    // Executions and stream IO may hold every pool thread, so the wait never queues there.
    try {
      thread(name = "$LIBRARY_NAME-shutdown") {
        try {
          promise.resolve(FFmpegKitConfig.shutdown(waitTimeout.toInt()))
        } catch (e: Exception) {
          promise.reject("SHUTDOWN_FAILED", e.message, e)
        }
      }
    } catch (e: Exception) {
      promise.reject("SHUTDOWN_FAILED", e.message, e)
    }
  }

  override fun isShutdown(promise: Promise) = promise.resolve(FFmpegKitConfig.isShutdown())

  override fun uninit(promise: Promise) {
    shutdownSessions.clear()
    executor.shutdown()
    promise.resolve(null)
  }

  companion object {
    const val NAME = NativeReactNativeFFmpegSpec.NAME

    private const val NOT_FFMPEG_SESSION = "NOT_FFMPEG_SESSION"
    private const val NOT_FFPROBE_SESSION = "NOT_FFPROBE_SESSION"
    private const val NOT_MEDIA_INFORMATION_SESSION = "NOT_MEDIA_INFORMATION_SESSION"
    private const val EXECUTE_FAILED = "EXECUTE_FAILED"

    /** Once per process, like FFmpegKit's own load message. */
    private val loadConfirmationPrinted = AtomicBoolean(false)
  }
}
