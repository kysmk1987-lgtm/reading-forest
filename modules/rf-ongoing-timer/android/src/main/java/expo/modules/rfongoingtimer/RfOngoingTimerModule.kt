package expo.modules.rfongoingtimer

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class OngoingTimerOptions : Record {
  @Field var title: String = ""
  @Field var body: String = ""

  /** Epoch ms the countdown runs to; 0 = no live countdown (e.g. paused). */
  @Field var endsAt: Double = 0.0
  @Field var channelName: String = "Reading timer"
  @Field var color: String? = null
}

/**
 * Lock-screen mini timer: an ongoing (non-swipeable) notification whose chronometer counts down to the end of the
 * current phase. It removes itself when the phase ends (`setTimeoutAfter`), so a stale countdown never lingers while
 * the app is suspended; the app posts the next phase when it runs again.
 */
class RfOngoingTimerModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React context is not available")

  override fun definition() = ModuleDefinition {
    Name("RfOngoingTimer")

    Function("show") { options: OngoingTimerOptions ->
      show(options)
    }

    Function("hide") {
      NotificationManagerCompat.from(context).cancel(TAG, NOTIFICATION_ID)
    }
  }

  private fun show(options: OngoingTimerOptions): Boolean {
    val ctx = context
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
    ) {
      return false
    }
    val manager = NotificationManagerCompat.from(ctx)
    if (!manager.areNotificationsEnabled()) return false

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(CHANNEL_ID, options.channelName, NotificationManager.IMPORTANCE_LOW).apply {
        setShowBadge(false)
        setSound(null, null)
        enableVibration(false)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      }
      (ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)
    }

    val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)?.apply {
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val contentIntent = launch?.let {
      PendingIntent.getActivity(ctx, 0, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
    val icon = ctx.resources.getIdentifier("notification_icon", "drawable", ctx.packageName)
      .takeIf { it != 0 } ?: ctx.applicationInfo.icon

    val builder = NotificationCompat.Builder(ctx, CHANNEL_ID)
      .setSmallIcon(icon)
      .setContentTitle(options.title)
      .setContentText(options.body)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setCategory(NotificationCompat.CATEGORY_PROGRESS)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setPriority(NotificationCompat.PRIORITY_LOW)
    contentIntent?.let { builder.setContentIntent(it) }
    options.color?.let { hex -> runCatching { builder.setColor(Color.parseColor(hex)) } }

    val now = System.currentTimeMillis()
    val endsAt = options.endsAt.toLong()
    if (endsAt > now) {
      builder
        .setShowWhen(true)
        .setWhen(endsAt)
        .setUsesChronometer(true)
        .setChronometerCountDown(true)
        .setTimeoutAfter(endsAt - now)
    } else {
      builder.setShowWhen(false)
    }

    return try {
      manager.notify(TAG, NOTIFICATION_ID, builder.build())
      true
    } catch (e: SecurityException) {
      false
    }
  }

  companion object {
    private const val CHANNEL_ID = "rf-timer-live"
    private const val TAG = "rf-timer-ongoing"
    private const val NOTIFICATION_ID = 7301
  }
}
