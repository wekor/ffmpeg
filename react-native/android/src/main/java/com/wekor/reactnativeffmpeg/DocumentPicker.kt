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

import android.app.Activity
import android.content.Intent
import android.util.Log
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import java.util.concurrent.ConcurrentHashMap

/**
 * Picks a document with the Storage Access Framework and resolves with its `content:` uri. Each pick listens for
 * its own activity result; [close] drops the listeners of picks still open.
 */
internal class DocumentPicker(private val reactContext: ReactApplicationContext) {

  private val pending: MutableSet<ActivityEventListener> = ConcurrentHashMap.newKeySet()

  fun select(writable: Boolean, title: String?, type: String?, extraTypes: Array<String>?, promise: Promise) {
    val description =
      "writable: $writable, type: $type, title: $title and extra types: ${extraTypes?.contentToString()}"

    val intent =
      if (writable) {
        Intent(Intent.ACTION_CREATE_DOCUMENT).addFlags(
          Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
        )
      } else {
        Intent(Intent.ACTION_GET_CONTENT)
          .addCategory(Intent.CATEGORY_OPENABLE)
          .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
    intent.setType(type ?: "*/*")
    if (title != null) intent.putExtra(Intent.EXTRA_TITLE, title)
    if (extraTypes != null) intent.putExtra(Intent.EXTRA_MIME_TYPES, extraTypes)

    val currentActivity = reactContext.currentActivity
    if (currentActivity == null) {
      Log.w(LIBRARY_NAME, "Cannot selectDocument using parameters $description. Current activity is null.")
      promise.reject("INVALID_ACTIVITY", "Activity is null.")
      return
    }

    val pickRequestCode = if (writable) WRITABLE_REQUEST_CODE else READABLE_REQUEST_CODE
    val listener =
      object : BaseActivityEventListener() {
        override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
          // Results meant for other modules or screens leave this pick waiting.
          if (requestCode != pickRequestCode) return
          remove(this)

          Log.d(
            LIBRARY_NAME,
            "selectDocument using parameters $description completed with requestCode: $requestCode, " +
              "resultCode: $resultCode, data: $data.",
          )
          if (resultCode == Activity.RESULT_OK) {
            promise.resolve(data?.data?.toString())
          } else {
            promise.reject("SELECT_CANCELLED", resultCode.toString())
          }
        }
      }

    pending.add(listener)
    reactContext.addActivityEventListener(listener)
    try {
      currentActivity.startActivityForResult(intent, pickRequestCode)
    } catch (e: Exception) {
      remove(listener)
      Log.i(LIBRARY_NAME, "Failed to selectDocument using parameters $description!", e)
      promise.reject("SELECT_FAILED", e.message)
    }
  }

  fun close() {
    pending.forEach(reactContext::removeActivityEventListener)
    pending.clear()
  }

  private fun remove(listener: ActivityEventListener) {
    pending.remove(listener)
    reactContext.removeActivityEventListener(listener)
  }

  private companion object {
    const val READABLE_REQUEST_CODE = 10000
    const val WRITABLE_REQUEST_CODE = 20000
  }
}
