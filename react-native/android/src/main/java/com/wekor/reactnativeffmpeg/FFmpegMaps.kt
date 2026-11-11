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

import android.util.Log
import com.arthenica.ffmpegkit.FFmpegSession
import com.arthenica.ffmpegkit.FFprobeSession
import com.arthenica.ffmpegkit.LogRedirectionStrategy
import com.arthenica.ffmpegkit.MediaInformation
import com.arthenica.ffmpegkit.MediaInformationSession
import com.arthenica.ffmpegkit.Session
import com.arthenica.ffmpegkit.SessionState
import com.arthenica.ffmpegkit.Statistics
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import org.json.JSONArray
import org.json.JSONObject
import com.arthenica.ffmpegkit.Log as FFmpegKitLog

// The keys JS reads (`src/native.ts`); they match FFmpegKitNext's.

private const val KEY_SESSION_ID = "sessionId"
private const val KEY_SESSION_CREATE_TIME = "createTime"
private const val KEY_SESSION_START_TIME = "startTime"
private const val KEY_SESSION_COMMAND = "command"
private const val KEY_SESSION_TYPE = "type"
private const val KEY_SESSION_MEDIA_INFORMATION = "mediaInformation"

private const val KEY_LOG_LEVEL = "level"
private const val KEY_LOG_MESSAGE = "message"

private const val KEY_STATISTICS_VIDEO_FRAME_NUMBER = "videoFrameNumber"
private const val KEY_STATISTICS_VIDEO_FPS = "videoFps"
private const val KEY_STATISTICS_VIDEO_QUALITY = "videoQuality"
private const val KEY_STATISTICS_SIZE = "size"
private const val KEY_STATISTICS_TIME = "time"
private const val KEY_STATISTICS_BITRATE = "bitrate"
private const val KEY_STATISTICS_SPEED = "speed"

private const val SESSION_TYPE_FFMPEG = 1.0
private const val SESSION_TYPE_FFPROBE = 2.0
private const val SESSION_TYPE_MEDIA_INFORMATION = 3.0

// Native values to what JS reads

/** `{sessionId, createTime, startTime, command, type}`, plus `mediaInformation` once a media information session has it. */
internal fun Session.toWritableMap(): WritableMap {
  val map = Arguments.createMap()
  map.putDouble(KEY_SESSION_ID, getSessionId().toDouble())
  map.putDouble(KEY_SESSION_CREATE_TIME, getCreateTime().time.toDouble())
  map.putDouble(KEY_SESSION_START_TIME, (getStartTime()?.time ?: 0L).toDouble())
  map.putString(KEY_SESSION_COMMAND, getCommand())
  when (val session = this) {
    is FFmpegSession -> map.putDouble(KEY_SESSION_TYPE, SESSION_TYPE_FFMPEG)
    is FFprobeSession -> map.putDouble(KEY_SESSION_TYPE, SESSION_TYPE_FFPROBE)
    is MediaInformationSession -> {
      session.getMediaInformation()?.let { map.putMap(KEY_SESSION_MEDIA_INFORMATION, it.toWritableMap()) }
      map.putDouble(KEY_SESSION_TYPE, SESSION_TYPE_MEDIA_INFORMATION)
    }
  }
  return map
}

/** The `onComplete` and `onSessionDeleted` payload. */
internal fun sessionEvent(sessionId: Long): WritableMap {
  val map = Arguments.createMap()
  map.putDouble(KEY_SESSION_ID, sessionId.toDouble())
  return map
}

/** `{sessionId, level, message}`, the `onLog` payload and the entries of a session's logs. */
internal fun FFmpegKitLog.toWritableMap(): WritableMap {
  val map = Arguments.createMap()
  map.putDouble(KEY_SESSION_ID, sessionId.toDouble())
  map.putInt(KEY_LOG_LEVEL, level.value)
  map.putString(KEY_LOG_MESSAGE, message)
  return map
}

/** The `onStatistics` payload and the entries of a session's statistics. */
internal fun Statistics.toWritableMap(): WritableMap {
  val map = Arguments.createMap()
  map.putDouble(KEY_SESSION_ID, sessionId.toDouble())
  map.putInt(KEY_STATISTICS_VIDEO_FRAME_NUMBER, videoFrameNumber)
  map.putDouble(KEY_STATISTICS_VIDEO_FPS, videoFps.toDouble())
  map.putDouble(KEY_STATISTICS_VIDEO_QUALITY, videoQuality.toDouble())
  map.putDouble(KEY_STATISTICS_SIZE, size.toDouble())
  map.putDouble(KEY_STATISTICS_TIME, time)
  map.putDouble(KEY_STATISTICS_BITRATE, bitrate)
  map.putDouble(KEY_STATISTICS_SPEED, speed)
  return map
}

/** FFprobe's whole JSON output, as parsed. */
internal fun MediaInformation.toWritableMap(): WritableMap = getAllProperties()?.toWritableMap() ?: Arguments.createMap()

internal fun Iterable<Session>.toSessionArray(): WritableArray =
  Arguments.createArray().also { array -> forEach { array.pushMap(it.toWritableMap()) } }

internal fun Iterable<FFmpegKitLog>.toLogArray(): WritableArray =
  Arguments.createArray().also { array -> forEach { array.pushMap(it.toWritableMap()) } }

internal fun Iterable<Statistics>.toStatisticsArray(): WritableArray =
  Arguments.createArray().also { array -> forEach { array.pushMap(it.toWritableMap()) } }

internal fun Iterable<String>.toStringArray(): WritableArray =
  Arguments.createArray().also { array -> forEach(array::pushString) }

private fun JSONObject.toWritableMap(): WritableMap {
  val map = Arguments.createMap()
  for (key in keys()) {
    when (val value = opt(key)) {
      null -> Unit
      is JSONArray -> map.putArray(key, value.toWritableArray())
      is JSONObject -> map.putMap(key, value.toWritableMap())
      is String -> map.putString(key, value)
      is Int -> map.putInt(key, value)
      is Number -> map.putDouble(key, value.toDouble())
      is Boolean -> map.putBoolean(key, value)
      else -> Log.i(LIBRARY_NAME, "Cannot map json key $key using value $value:${value.javaClass}")
    }
  }
  return map
}

private fun JSONArray.toWritableArray(): WritableArray {
  val array = Arguments.createArray()
  for (index in 0..<length()) {
    when (val value = opt(index)) {
      null -> Unit
      is JSONArray -> array.pushArray(value.toWritableArray())
      is JSONObject -> array.pushMap(value.toWritableMap())
      is String -> array.pushString(value)
      is Int -> array.pushInt(value)
      is Number -> array.pushDouble(value.toDouble())
      is Boolean -> array.pushBoolean(value)
      else -> Log.i(LIBRARY_NAME, "Cannot map json value $value:${value.javaClass}")
    }
  }
  return array
}

// Arguments from JS

/** The array's strings; entries of any other type are skipped. */
internal fun ReadableArray.strings(): List<String> =
  (0..<size()).mapNotNull { if (getType(it) == ReadableType.String) getString(it) else null }

/** A font name map's string entries; empty when JS passed none. */
internal fun ReadableMap?.fontNameMapping(): Map<String?, String?> {
  val mapping = HashMap<String?, String?>()
  if (this == null) return mapping
  val iterator = keySetIterator()
  while (iterator.hasNextKey()) {
    val key = iterator.nextKey()
    if (getType(key) == ReadableType.String) mapping[key] = getString(key)
  }
  return mapping
}

// Enums, by the values FFmpegKit's JS constants use

internal val LogRedirectionStrategy.code: Int
  get() =
    when (this) {
      LogRedirectionStrategy.ALWAYS_PRINT_LOGS -> 0
      LogRedirectionStrategy.PRINT_LOGS_WHEN_NO_CALLBACKS_DEFINED -> 1
      LogRedirectionStrategy.PRINT_LOGS_WHEN_GLOBAL_CALLBACK_NOT_DEFINED -> 2
      LogRedirectionStrategy.PRINT_LOGS_WHEN_SESSION_CALLBACK_NOT_DEFINED -> 3
      LogRedirectionStrategy.NEVER_PRINT_LOGS -> 4
    }

internal fun logRedirectionStrategyOf(code: Int): LogRedirectionStrategy =
  when (code) {
    0 -> LogRedirectionStrategy.ALWAYS_PRINT_LOGS
    1 -> LogRedirectionStrategy.PRINT_LOGS_WHEN_NO_CALLBACKS_DEFINED
    2 -> LogRedirectionStrategy.PRINT_LOGS_WHEN_GLOBAL_CALLBACK_NOT_DEFINED
    3 -> LogRedirectionStrategy.PRINT_LOGS_WHEN_SESSION_CALLBACK_NOT_DEFINED
    else -> LogRedirectionStrategy.NEVER_PRINT_LOGS
  }

internal fun sessionStateOf(code: Int): SessionState =
  when (code) {
    0 -> SessionState.CREATED
    1 -> SessionState.RUNNING
    2 -> SessionState.FAILED
    else -> SessionState.COMPLETED
  }
