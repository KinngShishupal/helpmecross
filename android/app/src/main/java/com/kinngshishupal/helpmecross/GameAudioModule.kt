package com.kinngshishupal.helpmecross

import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.SoundPool
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray

/**
 * Minimal audio engine for the game: short effects through a SoundPool and a
 * single looping music track through MediaPlayer. Sounds live in res/raw.
 */
class GameAudioModule(private val context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context), LifecycleEventListener {

  private val attributes =
      AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_GAME)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
  private val soundPool = SoundPool.Builder().setMaxStreams(8).setAudioAttributes(attributes).build()
  private val loaded = mutableMapOf<String, Int>()
  private var music: MediaPlayer? = null
  private var musicVolume = 0.5f
  private var musicWanted = false

  init {
    context.addLifecycleEventListener(this)
  }

  override fun getName() = NAME

  private fun rawId(name: String) =
      context.resources.getIdentifier(name, "raw", context.packageName)

  @ReactMethod
  fun preload(names: ReadableArray) {
    for (i in 0 until names.size()) {
      val name = names.getString(i) ?: continue
      if (loaded.containsKey(name)) continue
      val id = rawId(name)
      if (id != 0) loaded[name] = soundPool.load(context, id, 1)
    }
  }

  @ReactMethod
  fun play(name: String, volume: Double) {
    val sound = loaded[name] ?: return
    val v = volume.toFloat()
    soundPool.play(sound, v, v, 1, 0, 1f)
  }

  @ReactMethod
  fun playMusic(name: String, volume: Double) {
    musicVolume = volume.toFloat()
    musicWanted = true
    if (music == null) {
      val id = rawId(name)
      if (id == 0) return
      music =
          MediaPlayer.create(context, id)?.apply {
            isLooping = true
            setAudioAttributes(attributes)
          }
    }
    music?.setVolume(musicVolume, musicVolume)
    if (music?.isPlaying == false) music?.start()
  }

  @ReactMethod
  fun stopMusic() {
    musicWanted = false
    music?.takeIf { it.isPlaying }?.pause()
  }

  override fun onHostResume() {
    if (musicWanted) music?.start()
  }

  override fun onHostPause() {
    music?.takeIf { it.isPlaying }?.pause()
  }

  override fun onHostDestroy() {
    music?.release()
    music = null
  }

  override fun invalidate() {
    context.removeLifecycleEventListener(this)
    music?.release()
    music = null
    soundPool.release()
    super.invalidate()
  }

  companion object {
    const val NAME = "GameAudio"
  }
}
