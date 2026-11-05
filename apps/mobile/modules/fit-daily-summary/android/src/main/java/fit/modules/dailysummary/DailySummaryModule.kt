package fit.modules.dailysummary

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DailySummaryModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FitDailySummary")
    AsyncFunction("show") { title: String, body: String, expiresAt: Double ->
      val context = requireNotNull(appContext.reactContext) { "Aplicativo indisponível." }
      require(title.length <= 160 && body.length <= 4096 && expiresAt.isFinite()) { "Resumo inválido." }
      DailySummaryNotification.show(context, title, body, expiresAt.toLong())
    }
    AsyncFunction("clear") {
      val context = requireNotNull(appContext.reactContext) { "Aplicativo indisponível." }
      DailySummaryNotification.clear(context)
    }
  }
}
