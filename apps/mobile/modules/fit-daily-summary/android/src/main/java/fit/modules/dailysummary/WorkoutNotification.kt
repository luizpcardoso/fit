package fit.modules.dailysummary

import android.Manifest
import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import android.view.View
import android.widget.RemoteViews
import org.json.JSONArray
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Native chronometer + inexact rest alarm: no polling or continuously running service. */
internal object WorkoutNotification {
  private const val CHANNEL = "fit-workout"
  private const val REST_CHANNEL = "fit-workout-rest"
  private const val ID = 7422
  private const val KEY = "fit.workout.notification"
  const val CHANGED = "fit.workout.CHANGED"
  private val lock = Any()
  private fun prefs(c: Context) = c.getSharedPreferences(KEY, Context.MODE_PRIVATE)
  private fun manager(c: Context) = c.getSystemService(NotificationManager::class.java)
  private fun alarm(c: Context) = c.getSystemService(AlarmManager::class.java)
  private fun key(): SecretKey {
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (store.getKey(KEY, null) as? SecretKey)?.let { return it }
    return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
      init(KeyGenParameterSpec.Builder(KEY, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
    }.generateKey()
  }
  private fun load(c: Context): JSONObject? {
    val encoded = prefs(c).getString("encrypted", null) ?: return null
    return try {
      val parts = encoded.split(":")
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)))
      JSONObject(String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), Charsets.UTF_8))
    } catch (_: Exception) { null }
  }
  private fun save(c: Context, value: JSONObject) {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
    val encrypted = cipher.doFinal(value.toString().toByteArray(Charsets.UTF_8))
    check(prefs(c).edit().putString("encrypted", Base64.encodeToString(cipher.iv, Base64.NO_WRAP) + ":" + Base64.encodeToString(encrypted, Base64.NO_WRAP)).commit())
  }
  private fun signal(c: Context, action: String, id: String) = PendingIntent.getBroadcast(c, when (action) { "rest" -> 12; "previous" -> 14; "next" -> 15; "series" -> 16; "restAdd" -> 17; "restSkip" -> 18; else -> 11 },
    Intent(c, WorkoutReceiver::class.java).setAction("fit.workout.$action").setData(Uri.parse("fit://workout-control/$id/$action")).putExtra("id", id), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  private fun enabled(c: Context): Boolean = (Build.VERSION.SDK_INT < 33 || c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) && manager(c).areNotificationsEnabled()
  fun show(c: Context, owner: String, id: String, label: String, done: Int, total: Int, progress: String) = synchronized(lock) {
    val previous = load(c)
    // A button press owns the state until JS has read it, avoiding stale render overwrites.
    if (previous?.optString("owner") == owner && previous.optString("id") == id && previous.optBoolean("pending")) return@synchronized
    val state = JSONObject().put("owner", owner).put("id", id).put("label", label).put("done", done).put("total", total).put("progress", JSONObject(progress)).put("pending", false)
    save(c, state); post(c, state); schedule(c, state)
  }
  fun showControls(c: Context, owner: String, id: String, label: String, exercises: String, progress: String) = synchronized(lock) {
    val previous = load(c)
    if (previous?.optString("owner") == owner && previous.optString("id") == id && previous.optBoolean("pending")) return@synchronized
    val movements = JSONArray(exercises)
    require(movements.length() in 1..50)
    for (i in 0 until movements.length()) {
      val e = movements.getJSONObject(i)
      require(e.getString("id").length == 36 && e.getString("name").length <= 100 && e.getInt("sets") in 1..20 && e.optInt("restSeconds") in 0..3600)
    }
    val state = JSONObject().put("owner", owner).put("id", id).put("label", label).put("movements", movements).put("progress", JSONObject(progress)).put("pending", false)
    save(c, state); post(c, state); schedule(c, state)
  }
  fun readAction(c: Context, owner: String, id: String): String? = synchronized(lock) {
    val state = load(c) ?: return@synchronized null
    if (state.optString("owner") != owner || state.optString("id") != id || !state.optBoolean("pending")) return@synchronized null
    // Keep pending until the next show acknowledges the same progress, so a JS crash can retry.
    state.getJSONObject("progress").toString()
  }
  fun acknowledge(c: Context, progress: String) = synchronized(lock) {
    val state = load(c) ?: return@synchronized
    if (state.getJSONObject("progress").toString() == JSONObject(progress).toString()) {
      state.put("pending", false); save(c, state)
    }
  }
  private fun schedule(c: Context, state: JSONObject) {
    alarm(c).cancel(signal(c, "rest", state.getString("id")))
    val p = state.getJSONObject("progress")
    if (p.optString("status") == "running" && !p.isNull("restEndsAt") && p.getLong("restEndsAt") > System.currentTimeMillis())
      alarm(c).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, p.getLong("restEndsAt"), signal(c, "rest", state.getString("id")))
  }
  internal fun toggle(p: JSONObject, now: Long): Boolean {
      if (p.optString("status") == "running") {
        p.put("status", "paused").put("pausedAt", now)
        p.put("restRemainingMs", if (p.isNull("restEndsAt")) JSONObject.NULL else maxOf(0L, p.getLong("restEndsAt") - now)).put("restEndsAt", JSONObject.NULL)
      } else if (p.optString("status") == "paused") {
        p.put("status", "running").put("pausedMs", p.getLong("pausedMs") + maxOf(0L, now - p.getLong("pausedAt"))).put("pausedAt", JSONObject.NULL)
        p.put("restEndsAt", if (p.isNull("restRemainingMs")) JSONObject.NULL else now + p.getLong("restRemainingMs")).put("restRemainingMs", JSONObject.NULL)
      } else return false
    return true
  }
  internal fun applyControl(state: JSONObject, action: String, now: Long): Boolean {
    val p = state.getJSONObject("progress")
    if (action == "toggle") return toggle(p, now)
    if (p.optString("status") != "running" && p.optString("status") != "paused") return false
    val movements = state.optJSONArray("movements") ?: return false
    val index = p.getInt("currentIndex")
    if (action == "previous" || action == "next") {
      val target = (index + if (action == "next") 1 else -1).coerceIn(0, movements.length() - 1)
      if (target == index) return false
      p.put("currentIndex", target); return true
    }
    if (action == "restAdd" || action == "restSkip") {
      if (p.getString("status") != "running" || p.isNull("restEndsAt")) return false
      if (action == "restSkip") p.put("restEndsAt", JSONObject.NULL).put("restRemainingMs", JSONObject.NULL)
      else p.put("restEndsAt", minOf(now + 3_600_000L, maxOf(now, p.getLong("restEndsAt")) + 30_000L))
      return true
    }
    if (action != "series" || p.getString("status") != "running") return false
    val exercise = movements.getJSONObject(index)
    val states = p.getJSONArray("exercises")
    val item = (0 until states.length()).map { states.getJSONObject(it) }.find { it.getString("id") == exercise.getString("id") } ?: return false
    val done = item.getJSONArray("completedSets")
    val next = (0 until exercise.getInt("sets")).find { candidate -> (0 until done.length()).none { done.getInt(it) == candidate } } ?: return false
    done.put(next); item.put("skipped", false)
    val rest = if (done.length() < exercise.getInt("sets")) exercise.optInt("restSeconds", 0) else 0
    p.put("restEndsAt", if (rest > 0) now + rest * 1000L else JSONObject.NULL).put("restRemainingMs", JSONObject.NULL)
    return true
  }
  fun action(c: Context, action: String?, id: String?) = synchronized(lock) {
    val state = load(c) ?: return@synchronized
    if (state.optString("id") != id) return@synchronized
    val p = state.getJSONObject("progress")
    val now = System.currentTimeMillis()
    if (action in listOf("fit.workout.toggle", "fit.workout.previous", "fit.workout.next", "fit.workout.series", "fit.workout.restAdd", "fit.workout.restSkip")) {
      if (!applyControl(state, action!!.removePrefix("fit.workout."), now)) return@synchronized
      state.put("pending", true); save(c, state); post(c, state); schedule(c, state)
      c.sendBroadcast(Intent(CHANGED).setPackage(c.packageName))
    } else if (action == "fit.workout.rest" && p.optString("status") == "running" && !p.isNull("restEndsAt") && p.getLong("restEndsAt") <= now && enabled(c)) {
      val builder = Notification.Builder(c, REST_CHANNEL).setSmallIcon(R.drawable.fit_summary_notification).setContentTitle("Descanso concluído").setContentText("Quando estiver pronto, continue seu treino.").setAutoCancel(true).setVisibility(Notification.VISIBILITY_PRIVATE).setContentIntent(open(c))
      manager(c).notify(ID + 1, builder.build())
      post(c, state)
    }
  }
  private fun open(c: Context): PendingIntent {
    val intent = c.packageManager.getLaunchIntentForPackage(c.packageName)!!.apply { action = Intent.ACTION_VIEW; data = Uri.parse("fit:///workout-run"); addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP) }
    return PendingIntent.getActivity(c, 13, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }
  internal fun card(c: Context, state: JSONObject, expanded: Boolean, now: Long): RemoteViews {
    val p = state.getJSONObject("progress")
    val movements = state.getJSONArray("movements")
    val index = p.getInt("currentIndex")
    val exercise = movements.getJSONObject(index)
    val states = p.getJSONArray("exercises")
    val current = (0 until states.length()).map { states.getJSONObject(it) }.first { it.getString("id") == exercise.getString("id") }
    val done = current.getJSONArray("completedSets").length()
    val paused = p.getString("status") == "paused"
    val elapsed = maxOf(0L, (if (paused) p.getLong("pausedAt") else now) - p.getLong("startedAt") - p.getLong("pausedMs"))
    val sets = exercise.getInt("sets")
    val rest = restLine(c, p, now, done, sets)
    return RemoteViews(c.packageName, if (expanded) R.layout.fit_workout_expanded else R.layout.fit_workout_compact).apply {
      setTextViewText(R.id.workout_exercise, if (expanded) exercise.getString("name") else "${state.getString("label")} · ${exercise.getString("name")}")
      // Collapsed, the second line follows what matters now: the rest, otherwise the set count.
      setTextViewText(R.id.workout_series, if (!expanded && rest != null) rest else "Exercício ${index + 1}/${movements.length()} · $done/$sets séries")
      setChronometer(R.id.workout_elapsed, SystemClock.elapsedRealtime() - elapsed, null, !paused)
      if (paused) setTextViewText(R.id.workout_elapsed, String.format(java.util.Locale.ROOT, "%02d:%02d:%02d", elapsed / 3600000, elapsed / 60000 % 60, elapsed / 1000 % 60))
      if (expanded) {
        setTextViewText(R.id.workout_identity, "Treino ${state.getString("label")} · ${if (paused) "Pausado" else "Em andamento"}")
        setTextViewText(R.id.workout_rest_label, rest ?: "Sem descanso em andamento")
        setViewVisibility(R.id.workout_rest, View.GONE)
        // "Concluir série" is a system action now; the inline button stays only for older layouts.
        setViewVisibility(R.id.workout_complete_series, View.GONE)
        setOnClickPendingIntent(R.id.workout_complete_series, signal(c, "series", state.getString("id")))
      }
    }
  }
  /**
   * Rest as a fixed end time ("até 10:42"): the alarm is inexact, so a running countdown could
   * pass zero and show negative time before the card is refreshed.
   */
  internal fun restLine(c: Context, p: JSONObject, now: Long, done: Int, sets: Int): String? {
    val next = if (done < sets) " · próxima série ${done + 1}/$sets" else ""
    if (p.getString("status") == "paused") return if (p.isNull("restRemainingMs")) null else "Descanso pausado · faltam ${p.getLong("restRemainingMs") / 1000} s"
    if (p.isNull("restEndsAt")) return null
    val end = p.getLong("restEndsAt")
    if (end <= now) return "Descanso concluído$next"
    return "Descanso até ${android.text.format.DateFormat.getTimeFormat(c).format(java.util.Date(end))}$next"
  }
  @Suppress("DEPRECATION")
  private fun post(c: Context, state: JSONObject) {
    if (!enabled(c)) return
    manager(c).createNotificationChannel(NotificationChannel(CHANNEL, "Treino em andamento", NotificationManager.IMPORTANCE_LOW).apply { setSound(null, null); enableVibration(false); setShowBadge(false); lockscreenVisibility = Notification.VISIBILITY_PRIVATE })
    manager(c).createNotificationChannel(NotificationChannel(REST_CHANNEL, "Fim do descanso", NotificationManager.IMPORTANCE_DEFAULT).apply { lockscreenVisibility = Notification.VISIBILITY_PRIVATE })
    val p = state.getJSONObject("progress")
    val paused = p.getString("status") == "paused"
    val now = System.currentTimeMillis()
    val elapsed = maxOf(0L, (if (paused) p.getLong("pausedAt") else now) - p.getLong("startedAt") - p.getLong("pausedMs"))
    val rest = if (p.isNull("restEndsAt")) 0L else p.getLong("restEndsAt") - now
    val body = if (state.has("movements")) restLine(c, p, now, 0, 0)?.substringBefore(" · próxima") ?: "Toque para abrir o treino" else "${state.optInt("done")} de ${state.optInt("total")} exercícios" + if (paused) " · Pausado" else if (rest > 0) " · Descansando" else " · Em andamento"
    val controlled = state.has("movements")
    val builder = Notification.Builder(c, CHANNEL).setSmallIcon(R.drawable.fit_summary_notification)
      .setContentTitle("Treino ${state.getString("label")} · ${if (paused) "Pausado" else "Em andamento"}")
      .setContentText(body)
      .setOngoing(true).setAutoCancel(false).setOnlyAlertOnce(true).setLocalOnly(true).setVisibility(Notification.VISIBILITY_PRIVATE)
      .setContentIntent(open(c)).setCategory(Notification.CATEGORY_PROGRESS)
    if (controlled) {
      builder.setStyle(Notification.DecoratedCustomViewStyle())
        .setCustomContentView(card(c, state, false, now)).setCustomBigContentView(card(c, state, true, now))
        .setShowWhen(false)
      val id = state.getString("id")
      val movements = state.getJSONArray("movements")
      val index = p.getInt("currentIndex")
      val exercise = movements.getJSONObject(index)
      val states = p.getJSONArray("exercises")
      val done = (0 until states.length()).map { states.getJSONObject(it) }.first { it.getString("id") == exercise.getString("id") }.getJSONArray("completedSets").length()
      val sets = exercise.getInt("sets")
      // The most frequent action comes first; pausing and other changes stay in the app.
      when {
        paused -> builder.addAction(Notification.Action.Builder(null, "Retomar", signal(c, "toggle", id)).build()).addAction(Notification.Action.Builder(null, "Abrir treino", open(c)).build())
        rest > 0 -> builder.addAction(Notification.Action.Builder(null, if (done < sets) "Concluir série ${done + 1}/$sets" else "Próximo", signal(c, if (done < sets) "series" else "next", id)).build())
          .addAction(Notification.Action.Builder(null, "+30 s", signal(c, "restAdd", id)).build())
          .addAction(Notification.Action.Builder(null, "Pular descanso", signal(c, "restSkip", id)).build())
        done < sets -> builder.addAction(Notification.Action.Builder(null, "Concluir série ${done + 1}/$sets", signal(c, "series", id)).build())
          .addAction(Notification.Action.Builder(null, "Anterior", signal(c, "previous", id)).build())
          .addAction(Notification.Action.Builder(null, "Próximo", signal(c, "next", id)).build())
        else -> builder.addAction(Notification.Action.Builder(null, if (index < movements.length() - 1) "Próximo exercício" else "Abrir para finalizar", if (index < movements.length() - 1) signal(c, "next", id) else open(c)).build())
          .addAction(Notification.Action.Builder(null, "Anterior", signal(c, "previous", id)).build())
      }
    } else {
      builder.addAction(Notification.Action.Builder(null, if (paused) "Retomar" else "Pausar", signal(c, "toggle", state.getString("id"))).build())
        .addAction(Notification.Action.Builder(null, "Abrir treino", open(c)).build())
      if (!paused) builder.setWhen(now - elapsed).setUsesChronometer(true)
      else builder.setShowWhen(false).setSubText("Tempo ativo: ${elapsed / 60000} min")
    }
    manager(c).notify(ID, builder.build())
  }
  fun clear(c: Context) = synchronized(lock) {
    val id = load(c)?.optString("id") ?: ""
    prefs(c).edit().clear().commit()
    alarm(c).cancel(signal(c, "rest", id)); manager(c).cancel(ID); manager(c).cancel(ID + 1)
  }
}
class WorkoutReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) { try { WorkoutNotification.action(context, intent.action, intent.getStringExtra("id")) } catch (_: Exception) { /* State remains durable; opening the app recovers it. */ } }
}
