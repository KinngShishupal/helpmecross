package com.kinngshishupal.helpmecross

import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/** Tiny key-value store for game progress, backed by SharedPreferences. */
class GameStorageModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {

  private val prefs = context.getSharedPreferences("help_me_cross", Context.MODE_PRIVATE)

  override fun getName() = NAME

  @ReactMethod
  fun getItem(key: String, promise: Promise) {
    promise.resolve(prefs.getString(key, null))
  }

  @ReactMethod
  fun setItem(key: String, value: String) {
    prefs.edit().putString(key, value).apply()
  }

  companion object {
    const val NAME = "GameStorage"
  }
}
