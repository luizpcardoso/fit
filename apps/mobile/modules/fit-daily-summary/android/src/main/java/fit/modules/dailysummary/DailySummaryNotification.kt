package fit.modules.dailysummary

import android.Manifest
import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.util.AtomicFile
import java.io.File
import org.json.JSONObject

/** Event-driven restoration; no running service, polling, network requests or JS wakeup. */
internal object DailySummaryNotification {
  const val CHANNEL = "fit-daily-summary"
  const val TAG = "fit.daily-summary.native"
  const val ID = 7421
  const val DISMISSED = "fit.daily-summary.DISMISSED"
  const val EXPIRED = "fit.daily-summary.EXPIRED"
  private val lock = Any()
  private data class Snapshot(val title: String, val body: String, val expiresAt: Long)
  private fun file(context: Context) = AtomicFile(File(context.noBackupFilesDir, "fit-daily-summary.json"))
  private fun manager(context: Context) = context.getSystemService(NotificationManager::class.java)
  private fun alarm(context: Context) = context.getSystemService(AlarmManager::class.java)
  private fun signal(context: Context, action: String, code: Int) = PendingIntent.getBroadcast(
    context, code, Intent(context, DailySummaryReceiver::class.java).setAction(action),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
  )

  private fun read(context: Context): Snapshot? = try {
    val value = JSONObject(file(context).openRead().bufferedReader().use { it.readText() })
    Snapshot(value.getString("title"), value.getString("body"), value.getLong("expiresAt"))
  } catch (_: Exception) { null }

  private fun enabled(context: Context): Boolean {
    if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false
    if (!manager(context).areNotificationsEnabled()) return false
    if (Build.VERSION.SDK_INT >= 26) {
      val channel = manager(context).getNotificationChannel(CHANNEL) ?: return false
      return channel.importance != NotificationManager.IMPORTANCE_NONE
    }
    return true
  }

  fun show(context: Context, title: String, body: String, expiresAt: Long) = synchronized(lock) {
    if (Build.VERSION.SDK_INT >= 26) {
      manager(context).createNotificationChannel(NotificationChannel(CHANNEL, "Resumo do dia", NotificationManager.IMPORTANCE_LOW).apply {
        description = "Ações realizadas e faltantes, sem som ou vibração."
        setSound(null, null); enableVibration(false); setShowBadge(false)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      })
    }
    check(enabled(context)) { "Ative as notificações do resumo nos ajustes do Android." }
    val storage = file(context)
    val output = storage.startWrite()
    try {
      output.write(JSONObject().put("title", title).put("body", body).put("expiresAt", expiresAt).toString().toByteArray(Charsets.UTF_8))
      storage.finishWrite(output)
    } catch (error: Exception) { storage.failWrite(output); throw error }
    post(context, Snapshot(title, body, expiresAt))
    // Inexact, once per day. No extra alarm permission is needed.
    alarm(context).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, expiresAt, signal(context, EXPIRED, 2))
  }

  fun restore(context: Context) = synchronized(lock) {
    val snapshot = read(context) ?: return@synchronized
    if (enabled(context)) {
      try { post(context, snapshot) } catch (_: SecurityException) { /* Permission may have changed after the check. */ }
    }
  }

  @Suppress("DEPRECATION")
  private fun post(context: Context, snapshot: Snapshot) {
    val expired = System.currentTimeMillis() >= snapshot.expiresAt
    val title = if (expired) "Orami · Resumo do dia" else snapshot.title
    val body = if (expired) "O dia mudou. Abra a Orami para atualizar as ações realizadas e faltantes." else snapshot.body
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
      action = Intent.ACTION_VIEW; data = Uri.parse("fit:///?showChecks=1")
      addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, CHANNEL) else Notification.Builder(context)
    builder.setSmallIcon(R.drawable.fit_summary_notification).setContentTitle(title).setContentText(body)
      .setStyle(Notification.BigTextStyle().bigText(body)).setOngoing(true).setAutoCancel(false)
      .setOnlyAlertOnce(true).setShowWhen(false).setLocalOnly(true)
      .setCategory(Notification.CATEGORY_STATUS).setVisibility(Notification.VISIBILITY_PUBLIC)
      .setDeleteIntent(signal(context, DISMISSED, 1)).setSound(null).setVibrate(longArrayOf())
    if (launch != null) builder.setContentIntent(PendingIntent.getActivity(context, 3, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
    manager(context).notify(TAG, ID, builder.build())
  }

  fun clear(context: Context) = synchronized(lock) {
    // Delete persisted state before cancellation: delayed dismiss broadcasts cannot resurrect it.
    file(context).delete()
    alarm(context).cancel(signal(context, EXPIRED, 2))
    manager(context).cancel(TAG, ID)
  }
}
