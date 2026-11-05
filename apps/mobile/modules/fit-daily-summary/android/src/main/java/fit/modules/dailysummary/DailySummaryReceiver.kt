package fit.modules.dailysummary

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class DailySummaryReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == DailySummaryNotification.DISMISSED || intent.action == DailySummaryNotification.EXPIRED) {
      DailySummaryNotification.restore(context)
    }
  }
}
