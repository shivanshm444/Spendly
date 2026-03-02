package com.banktracker.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.database.Cursor
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat

class SmsMonitorService : Service() {

    companion object {
        private const val TAG = "SmsMonitorService"
        private const val SERVICE_CHANNEL_ID = "sms_monitor_service"
        private const val ALERT_CHANNEL_ID = "bank_transactions"
        private const val SERVICE_NOTIFICATION_ID = 2001
        private const val POLL_INTERVAL = 5000L // 5 seconds
        private const val PREFS_NAME = "BankTrackerSmsPrefs"
        private const val KEY_LAST_SMS_TIMESTAMP = "last_sms_timestamp"
        private const val KEY_PENDING_AMOUNT = "pending_amount"
        private const val KEY_PENDING_MERCHANT = "pending_merchant"
        private const val KEY_PENDING_DATE = "pending_date"
        private const val KEY_PENDING_MESSAGE = "pending_message"
        private const val KEY_HAS_PENDING = "has_pending"
    }

    private val handler = Handler(Looper.getMainLooper())
    private var isRunning = false

    private val pollRunnable = object : Runnable {
        override fun run() {
            if (isRunning) {
                checkForNewSms()
                handler.postDelayed(this, POLL_INTERVAL)
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "Service created")
        createNotificationChannels()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "Service started")

        val notification = createServiceNotification()
        startForeground(SERVICE_NOTIFICATION_ID, notification)

        if (!isRunning) {
            isRunning = true
            // Initialize last timestamp to now if not set, or use existing one
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val lastSaved = prefs.getLong(KEY_LAST_SMS_TIMESTAMP, 0L)
            if (lastSaved == 0L) {
                // If never run before, start from 1 minute ago to catch any very recent SMS
                prefs.edit().putLong(KEY_LAST_SMS_TIMESTAMP, System.currentTimeMillis() - 60000).apply()
            }
            handler.post(pollRunnable)
        }

        return START_STICKY // Restart if killed
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        Log.d(TAG, "Service destroyed")
        isRunning = false
        handler.removeCallbacks(pollRunnable)
        super.onDestroy()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            // Service channel (low priority, persistent)
            val serviceChannel = NotificationChannel(
                SERVICE_CHANNEL_ID,
                "Transaction Monitor",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps Spendly monitoring for new transactions"
                setShowBadge(false)
            }
            notificationManager.createNotificationChannel(serviceChannel)

            // Alert channel (high priority, for transaction alerts)
            val alertChannel = NotificationChannel(
                ALERT_CHANNEL_ID,
                "Bank Transactions",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Alerts for detected bank transactions"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 200, 500)
                setShowBadge(true)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            notificationManager.createNotificationChannel(alertChannel)
        }
    }

    private fun createServiceNotification(): Notification {
        val openIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, SERVICE_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Spendly Active")
            .setContentText("Monitoring for new transactions...")
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pendingIntent)
            .build()
    }

    private fun checkForNewSms() {
        try {
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val lastTimestamp = prefs.getLong(KEY_LAST_SMS_TIMESTAMP, System.currentTimeMillis())

            val uri: Uri = Uri.parse("content://sms/inbox")
            val cursor: Cursor? = contentResolver.query(
                uri,
                arrayOf("_id", "body", "date", "address"),
                "date > ?",
                arrayOf(lastTimestamp.toString()),
                "date DESC"
            )

            cursor?.use {
                var newestTimestamp = lastTimestamp
                while (it.moveToNext()) {
                    val body = it.getString(it.getColumnIndexOrThrow("body")) ?: continue
                    val date = it.getLong(it.getColumnIndexOrThrow("date"))
                    val address = it.getString(it.getColumnIndexOrThrow("address")) ?: ""

                    if (date > newestTimestamp) {
                        newestTimestamp = date
                    }

                    // Check if it's a bank transaction
                    if (isBankTransactionSms(body)) {
                        val amount = extractAmount(body)
                        val merchant = extractMerchant(body)

                        if (amount != null && amount > 0) {
                            Log.d(TAG, "New bank transaction: ₹$amount at $merchant")

                            // Save pending transaction
                            savePendingTransaction(amount, merchant, date, body)

                            // Show notification
                            showTransactionNotification(amount, merchant, body)
                        }
                    }
                }

                // Update last timestamp
                if (newestTimestamp > lastTimestamp) {
                    prefs.edit().putLong(KEY_LAST_SMS_TIMESTAMP, newestTimestamp).apply()
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error checking SMS", e)
        }
    }

    private fun isBankTransactionSms(body: String): Boolean {
        val hasDebitKeyword = Regex(
            "debit|debited|spent|paid|deducted|withdrawn|purchase",
            RegexOption.IGNORE_CASE
        ).containsMatchIn(body)

        val hasAmount = Regex(
            "Rs\\.?|INR|₹",
            RegexOption.IGNORE_CASE
        ).containsMatchIn(body)

        return hasDebitKeyword && hasAmount
    }

    private fun extractAmount(body: String): Double? {
        val patterns = listOf(
            Regex("Rs\\.?\\s*([\\d,]+(?:\\.\\d{1,2})?)", RegexOption.IGNORE_CASE),
            Regex("INR\\s*([\\d,]+(?:\\.\\d{1,2})?)", RegexOption.IGNORE_CASE),
            Regex("₹\\s*([\\d,]+(?:\\.\\d{1,2})?)", RegexOption.IGNORE_CASE)
        )

        for (pattern in patterns) {
            val match = pattern.find(body)
            if (match != null) {
                return match.groupValues[1].replace(",", "").toDoubleOrNull()
            }
        }
        return null
    }

    private fun extractMerchant(body: String): String {
        val patterns = listOf(
            Regex("at\\s+([A-Za-z][A-Za-z\\s.\\-&']+?)(?:\\.|,|\\s+Avl|\\s+on|\\s+Ref)", RegexOption.IGNORE_CASE),
            Regex("to\\s+([A-Za-z][A-Za-z\\s.\\-&']+?)(?:\\s+Ref|\\s+on|\\.|,)", RegexOption.IGNORE_CASE),
            Regex("(?:at|to|for)\\s+([A-Za-z0-9][A-Za-z0-9\\s]+)", RegexOption.IGNORE_CASE)
        )

        for (pattern in patterns) {
            val match = pattern.find(body)
            if (match != null) {
                return match.groupValues[1].trim().take(30)
            }
        }
        return "Unknown"
    }

    private fun savePendingTransaction(amount: Double, merchant: String, timestamp: Long, message: String) {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().apply {
            putString(KEY_PENDING_AMOUNT, amount.toString())
            putString(KEY_PENDING_MERCHANT, merchant)
            putString(KEY_PENDING_DATE, timestamp.toString())
            putString(KEY_PENDING_MESSAGE, message)
            putBoolean(KEY_HAS_PENDING, true)
            apply()
        }
    }

    private fun showTransactionNotification(amount: Double, merchant: String, message: String) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val openIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("from_notification", true)
            putExtra("transaction_amount", amount.toString())
            putExtra("transaction_merchant", merchant)
            putExtra("transaction_date", System.currentTimeMillis().toString())
            putExtra("transaction_message", message)
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            System.currentTimeMillis().toInt(),
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val amountFormatted = if (amount == amount.toLong().toDouble()) {
            "₹${amount.toLong()}"
        } else {
            "₹${"%.2f".format(amount)}"
        }

        val alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

        val notification = NotificationCompat.Builder(this, ALERT_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("💰 New Transaction Fetched")
            .setContentText("₹$amountFormatted at $merchant. Tap to categorize.")
            .setStyle(NotificationCompat.BigTextStyle().bigText(
                "💰 New Transaction Fetched\n\n₹$amountFormatted spent at $merchant\n\nTap here to open Spendly and categorize this transaction."
            ))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setFullScreenIntent(pendingIntent, true)
            .setSound(alarmSound)
            .setVibrate(longArrayOf(0, 500, 200, 500))
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build()

        notificationManager.notify(
            System.currentTimeMillis().toInt(),
            notification
        )

        Log.d(TAG, "Transaction notification posted: $amountFormatted at $merchant")
    }
}
