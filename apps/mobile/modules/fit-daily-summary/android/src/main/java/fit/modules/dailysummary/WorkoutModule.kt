package fit.modules.dailysummary

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class WorkoutModule : Module() {
  private var context: Context? = null
  private val updates = object : BroadcastReceiver() { override fun onReceive(context: Context, intent: Intent) { sendEvent("onWorkoutChanged", emptyMap<String, Any>()) } }
  override fun definition() = ModuleDefinition {
    Name("FitWorkout")
    Events("onWorkoutChanged")
    OnCreate {
      context = appContext.reactContext
      if (Build.VERSION.SDK_INT >= 33) context?.registerReceiver(updates, IntentFilter(WorkoutNotification.CHANGED), Context.RECEIVER_NOT_EXPORTED)
      else context?.registerReceiver(updates, IntentFilter(WorkoutNotification.CHANGED))
    }
    OnDestroy { try { context?.unregisterReceiver(updates) } catch (_: IllegalArgumentException) {} ; context = null }
    AsyncFunction("showControls") { owner: String, id: String, label: String, exercises: String, progress: String ->
      require(owner.length <= 36 && id.length <= 36 && label.length <= 5 && exercises.length <= 16000 && progress.length <= 20000)
      WorkoutNotification.showControls(requireNotNull(appContext.reactContext), owner, id, label, exercises, progress)
    }
    AsyncFunction("show") { owner: String, id: String, label: String, done: Int, total: Int, progress: String ->
      require(owner.length <= 36 && id.length <= 36 && label.length <= 5 && progress.length <= 20000)
      WorkoutNotification.show(requireNotNull(appContext.reactContext), owner, id, label, done, total, progress)
    }
    AsyncFunction("read") { owner: String, id: String -> WorkoutNotification.readAction(requireNotNull(appContext.reactContext), owner, id) }
    AsyncFunction("acknowledge") { progress: String -> WorkoutNotification.acknowledge(requireNotNull(appContext.reactContext), progress) }
    AsyncFunction("clear") { WorkoutNotification.clear(requireNotNull(appContext.reactContext)) }
  }
}
