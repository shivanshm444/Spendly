package com.banktracker.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.os.Build
import android.provider.Telephony
import android.util.Log
import androidx.core.app.NotificationCompat

class SmsReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "SmsReceiver"
        private const val CHANNEL_ID = "bank_transactions"
        
        private const val PREFS_NAME = "BankTrackerSmsPrefs"
        private const val KEY_PENDING_AMOUNT = "pending_amount"
        private const val KEY_PENDING_MERCHANT = "pending_merchant"
        private const val KEY_PENDING_DATE = "pending_date"
        private const val KEY_PENDING_MESSAGE = "pending_message"
        private const val KEY_LAST_SMS_TIMESTAMP = "last_sms_timestamp"
        private const val KEY_HAS_PENDING = "has_pending"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages.isNullOrEmpty()) return

        for (smsMessage in messages) {
            val body = smsMessage.messageBody ?: continue
            val timestamp = smsMessage.timestampMillis

            if (isBankTransactionSms(body)) {
                val amount = extractAmount(body)
                val merchant = extractMerchant(body)

                if (amount != null && amount > 0) {
                    savePendingTransaction(context, amount, merchant, timestamp, body)
                    showNotification(context, amount, merchant, body)
                }
            }
        }
    }

    private fun isBankTransactionSms(body: String): Boolean {
        val hasDebit = Regex("debit|debited|spent|paid|deducted|withdrawn|purchase", RegexOption.IGNORE_CASE).containsMatchIn(body)
        val hasCurrency = Regex("Rs\\.?|INR|₹", RegexOption.IGNORE_CASE).containsMatchIn(body)
        return hasDebit && hasCurrency
    }

    private fun extractAmount(body: String): Double? {
        val pattern = Regex("(?:Rs\\.?|INR|₹)\\s*([\\d,]+(?:\\.\\d{1,2})?)", RegexOption.IGNORE_CASE)
        val match = pattern.find(body)
        return match?.groupValues?.get(1)?.replace(",", "")?.toDoubleOrNull()
    }

    private fun extractMerchant(body: String): String {
        val pattern = Regex("(?:at|to|for)\\s+([A-Za-z0-9][A-Za-z0-9\\s.\\-&']+?)(?:\\.|,|\\s+Avl|\\s+on|\\s+Ref)", RegexOption.IGNORE_CASE)
        val match = pattern.find(body)
        return match?.groupValues?.get(1)?.trim()?.take(30) ?: "Unknown"
    }

    private fun savePendingTransaction(context: Context, amount: Double, merchant: String, date: Long, message: String) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val lastTimestamp = prefs.getLong(KEY_LAST_SMS_TIMESTAMP, 0L)
        
        prefs.edit().apply {
            putString(KEY_PENDING_AMOUNT, amount.toString())
            putString(KEY_PENDING_MERCHANT, merchant)
            putString(KEY_PENDING_DATE, date.toString())
            putString(KEY_PENDING_MESSAGE, message)
            putBoolean(KEY_HAS_PENDING, true)
            // Update last timestamp if this SMS is newer
            if (date > lastTimestamp) {
                putLong(KEY_LAST_SMS_TIMESTAMP, date)
            }
            apply()
        }
    }

    private fun showNotification(context: Context, amount: Double, merchant: String, message: String) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "Bank Transactions", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Alerts for detected bank transactions"
                enableVibration(true)
            }
            notificationManager.createNotificationChannel(channel)
        }

        val openIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("from_notification", true)
            putExtra("transaction_amount", amount.toString())
            putExtra("transaction_merchant", merchant)
            putExtra("transaction_date", System.currentTimeMillis().toString())
            putExtra("transaction_message", message)
        }

        val pendingIntent = PendingIntent.getActivity(
            context, System.currentTimeMillis().toInt(), openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("💸 New Transaction Fetched")
            .setContentText("₹$amount at $merchant. Tap to categorize.")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))
            .build()

        notificationManager.notify(System.currentTimeMillis().toInt(), notification)
    }
}
