package fit.modules.dailysummary

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.os.Looper
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class DailySummaryNotificationTest {
  private val context: Context get() = RuntimeEnvironment.getApplication()
  private val notifications get() = context.getSystemService(NotificationManager::class.java)
  private fun posted() = shadowOf(notifications).getNotification(DailySummaryNotification.TAG, DailySummaryNotification.ID)
  @Before fun setup() {
    shadowOf(context.applicationContext as android.app.Application).grantPermissions(android.Manifest.permission.POST_NOTIFICATIONS)
    DailySummaryNotification.clear(context)
  }
  @After fun cleanup() { DailySummaryNotification.clear(context) }

  @Test fun dismissedCardReturnsFromNativeCacheWithoutJavaScript() {
    DailySummaryNotification.show(context, "Orami · 1 de 3 checks", "1 realizado · 2 faltantes", System.currentTimeMillis() + 60000)
    val original = posted()
    assertNotNull(original)
    assertNotNull(original.deleteIntent)
    assertTrue(original.flags and Notification.FLAG_ONGOING_EVENT != 0)
    notifications.cancel(DailySummaryNotification.TAG, DailySummaryNotification.ID)
    original.deleteIntent.send()
    shadowOf(Looper.getMainLooper()).idle()
    assertEquals("1 realizado · 2 faltantes", posted().extras.getCharSequence(Notification.EXTRA_TEXT).toString())
  }

  @Test fun disablingDeletesCacheAndPreventsLateResurrection() {
    DailySummaryNotification.show(context, "Resumo", "Dados antigos", System.currentTimeMillis() + 60000)
    DailySummaryNotification.clear(context)
    DailySummaryReceiver().onReceive(context, Intent(DailySummaryNotification.DISMISSED))
    DailySummaryReceiver().onReceive(context, Intent(DailySummaryNotification.EXPIRED))
    assertNull(posted())
    assertEquals(0, shadowOf(context.getSystemService(AlarmManager::class.java)).scheduledAlarms.size)
  }

  @Test fun dismissedOldCardUsesLatestValuesAndOnlyOneNotification() {
    DailySummaryNotification.show(context, "Resumo", "0 realizados", System.currentTimeMillis() + 60000)
    DailySummaryNotification.show(context, "Resumo", "2 realizados", System.currentTimeMillis() + 60000)
    DailySummaryReceiver().onReceive(context, Intent(DailySummaryNotification.DISMISSED))
    assertEquals("2 realizados", posted().extras.getCharSequence(Notification.EXTRA_TEXT).toString())
    assertEquals(1, shadowOf(notifications).allNotifications.size)
  }

  @Test fun expiredSnapshotIsReplacedByNeutralText() {
    DailySummaryNotification.show(context, "3 de 3 checks", "3 realizados de ontem", System.currentTimeMillis() - 1)
    DailySummaryReceiver().onReceive(context, Intent(DailySummaryNotification.EXPIRED))
    assertTrue(posted().extras.getCharSequence(Notification.EXTRA_TEXT).toString().startsWith("O dia mudou."))
  }

  @Test fun blockedChannelIsRespected() {
    DailySummaryNotification.show(context, "Resumo", "0 realizados", System.currentTimeMillis() + 60000)
    shadowOf(notifications).setNotificationsEnabled(false)
    notifications.cancel(DailySummaryNotification.TAG, DailySummaryNotification.ID)
    DailySummaryReceiver().onReceive(context, Intent(DailySummaryNotification.DISMISSED))
    assertNull(posted())
  }
}
