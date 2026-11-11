/*
 * Copyright (c) 2021, 2026 Taner Sener
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
import com.facebook.react.bridge.Promise
import java.io.IOException

/**
 * Copies [inputPath] into the named pipe at [namedPipePath] with `cat`, blocking until the reader closes the pipe,
 * and resolves with `cat`'s exit code. Named pipes are deprecated in favour of buffers and streams.
 */
internal fun copyToNamedPipe(inputPath: String, namedPipePath: String, promise: Promise) {
  try {
    Log.d(LIBRARY_NAME, "Starting copy $inputPath to pipe $namedPipePath operation.")
    val startTime = System.currentTimeMillis()

    val process = Runtime.getRuntime().exec(arrayOf("sh", "-c", "cat $inputPath > $namedPipePath"))
    val rc = process.waitFor()

    val seconds = (System.currentTimeMillis() - startTime) / 1000
    Log.d(LIBRARY_NAME, "Copying $inputPath to pipe $namedPipePath operation completed with rc $rc in $seconds seconds.")
    promise.resolve(rc.toDouble())
  } catch (e: IOException) {
    failed(inputPath, namedPipePath, e, promise)
  } catch (e: InterruptedException) {
    Thread.currentThread().interrupt()
    failed(inputPath, namedPipePath, e, promise)
  }
}

private fun failed(inputPath: String, namedPipePath: String, e: Exception, promise: Promise) {
  val message = "Copy $inputPath to pipe $namedPipePath failed with error."
  Log.e(LIBRARY_NAME, message, e)
  promise.reject("Copy failed", message, e)
}
