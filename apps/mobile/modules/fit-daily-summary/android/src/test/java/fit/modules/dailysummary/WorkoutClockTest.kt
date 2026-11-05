package fit.modules.dailysummary

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class WorkoutClockTest {
  private fun progress() = JSONObject().put("status", "running").put("startedAt", 1000L)
    .put("pausedAt", JSONObject.NULL).put("pausedMs", 0L).put("restEndsAt", 61000L).put("restRemainingMs", JSONObject.NULL)
  @Test fun pauseAndResumePreserveActiveTimeAndRemainingRest() {
    val p = progress()
    assertTrue(WorkoutNotification.toggle(p, 11000L))
    assertEquals("paused", p.getString("status"))
    assertEquals(50000L, p.getLong("restRemainingMs"))
    assertTrue(p.isNull("restEndsAt"))
    assertTrue(WorkoutNotification.toggle(p, 101000L))
    assertEquals("running", p.getString("status"))
    assertEquals(90000L, p.getLong("pausedMs"))
    assertEquals(151000L, p.getLong("restEndsAt"))
    assertTrue(p.isNull("pausedAt"))
  }
  @Test fun expiredRestAndTerminalSessionsNeverRestartImplicitly() {
    val p = progress()
    WorkoutNotification.toggle(p, 71000L)
    assertEquals(0L, p.getLong("restRemainingMs"))
    p.put("status", "completed")
    assertFalse(WorkoutNotification.toggle(p, 81000L))
    assertEquals("completed", p.getString("status"))
  }

  private fun state(): JSONObject {
    val movements = org.json.JSONArray().put(JSONObject().put("id", "exercise-a").put("name", "Supino").put("sets", 2).put("restSeconds", 60)).put(JSONObject().put("id", "exercise-b").put("name", "Remada").put("sets", 3).put("restSeconds", 30))
    val p = progress().put("currentIndex", 0).put("exercises", org.json.JSONArray().put(JSONObject().put("id", "exercise-a").put("completedSets", org.json.JSONArray()).put("skipped", false)).put(JSONObject().put("id", "exercise-b").put("completedSets", org.json.JSONArray()).put("skipped", false)))
    return JSONObject().put("id", "run-a").put("label", "A").put("movements", movements).put("progress", p)
  }
  @Test fun restControlsExtendOrSkipOnlyARunningRest() {
    val state = state(); val p = state.getJSONObject("progress")
    assertTrue(WorkoutNotification.applyControl(state, "restAdd", 50000L))
    assertEquals(91000L, p.getLong("restEndsAt"))
    assertTrue(WorkoutNotification.applyControl(state, "restAdd", 100000L))
    assertEquals("an expired rest restarts from now", 130000L, p.getLong("restEndsAt"))
    assertTrue(WorkoutNotification.applyControl(state, "restSkip", 100000L))
    assertTrue(p.isNull("restEndsAt"))
    assertFalse(WorkoutNotification.applyControl(state, "restSkip", 100000L))
    assertFalse(WorkoutNotification.applyControl(state, "restAdd", 100000L))
  }
  @Test fun restLineNeverShowsNegativeTime() {
    val context = org.robolectric.RuntimeEnvironment.getApplication() as android.content.Context
    val p = progress()
    assertTrue(WorkoutNotification.restLine(context, p, 30000L, 1, 3)!!.startsWith("Descanso até "))
    assertEquals("Descanso concluído · próxima série 2/3", WorkoutNotification.restLine(context, p, 70000L, 1, 3))
    p.put("restEndsAt", JSONObject.NULL)
    assertNull(WorkoutNotification.restLine(context, p, 70000L, 1, 3))
  }
  @Test fun controlsChangeTheSameSeriesAndPositionWithoutResettingTotalTime() {
    val state = state(); val p = state.getJSONObject("progress")
    assertFalse(WorkoutNotification.applyControl(state, "previous", 10000L))
    assertTrue(WorkoutNotification.applyControl(state, "series", 10000L))
    assertEquals(70000L, p.getLong("restEndsAt"))
    assertTrue(WorkoutNotification.applyControl(state, "series", 11000L))
    assertFalse(WorkoutNotification.applyControl(state, "series", 12000L))
    assertEquals(2, p.getJSONArray("exercises").getJSONObject(0).getJSONArray("completedSets").length())
    assertTrue(WorkoutNotification.applyControl(state, "next", 13000L))
    assertEquals(1, p.getInt("currentIndex"))
    assertFalse(WorkoutNotification.applyControl(state, "next", 14000L))
    assertEquals(1000L, p.getLong("startedAt"))
    WorkoutNotification.applyControl(state, "toggle", 15000L)
    assertFalse(WorkoutNotification.applyControl(state, "series", 16000L))
    assertTrue(WorkoutNotification.applyControl(state, "previous", 17000L))
    assertEquals("paused", p.getString("status"))
  }
  @org.robolectric.annotation.GraphicsMode(org.robolectric.annotation.GraphicsMode.Mode.NATIVE)
  @Test fun expandedCardShowsCurrentExerciseSeriesAndIndependentTotalChronometer() {
    val context = org.robolectric.RuntimeEnvironment.getApplication() as android.content.Context
    val state = state()
    val view = WorkoutNotification.card(context, state, true, 11000L).apply(context, android.widget.FrameLayout(context))
    assertEquals("Supino", view.findViewById<android.widget.TextView>(R.id.workout_exercise).text.toString())
    assertTrue(view.findViewById<android.widget.TextView>(R.id.workout_series).text.toString().contains("0/2"))
    val clock = view.findViewById<android.widget.Chronometer>(R.id.workout_elapsed)
    assertEquals(android.os.SystemClock.elapsedRealtime() - 10000L, clock.base)
    assertNotNull(view.findViewById<android.widget.Button>(R.id.workout_complete_series))
    System.getenv("FIT_WORKOUT_PREVIEW_PATH")?.let { output ->
      val preview = state()
      val progress = preview.getJSONObject("progress")
      progress.put("startedAt", System.currentTimeMillis() - 187000L).put("currentIndex", 1)
      WorkoutNotification.applyControl(preview, "series", System.currentTimeMillis())
      progress.put("restEndsAt", System.currentTimeMillis() + 45000L)
      val content = WorkoutNotification.card(context, preview, true, System.currentTimeMillis()).apply(context, android.widget.FrameLayout(context))
      val frame = android.widget.FrameLayout(context).apply { setPadding(16, 16, 16, 16); setBackgroundColor(android.graphics.Color.WHITE); addView(content) }
      frame.measure(android.view.View.MeasureSpec.makeMeasureSpec(360, android.view.View.MeasureSpec.EXACTLY), android.view.View.MeasureSpec.makeMeasureSpec(260, android.view.View.MeasureSpec.AT_MOST))
      frame.layout(0, 0, frame.measuredWidth, frame.measuredHeight)
      val bitmap = android.graphics.Bitmap.createBitmap(frame.measuredWidth, frame.measuredHeight, android.graphics.Bitmap.Config.ARGB_8888)
      frame.draw(android.graphics.Canvas(bitmap))
      java.io.File(output).apply { parentFile?.mkdirs(); outputStream().use { bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it) } }
    }

  }
}
