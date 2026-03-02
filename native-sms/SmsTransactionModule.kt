package com.banktracker.app

import android.content.Context
import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SmsTransactionModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val PREFS_NAME = "BankTrackerSmsPrefs"
        private const val KEY_PENDING_AMOUNT = "pending_amount"
        private const val KEY_PENDING_MERCHANT = "pending_merchant"
        private const val KEY_PENDING_DATE = "pending_date"
        private const val KEY_PENDING_MESSAGE = "pending_message"
        private const val KEY_HAS_PENDING = "has_pending"
    }

    override fun getName(): String = "SmsTransactionModule"

    @ReactMethod
    fun getPendingTransaction(promise: Promise) {
        try {
            val activity = getCurrentActivity()
            val intent = activity?.intent

            // Priority 1: Check Intent Extras (from notification tap)
            if (intent != null && intent.getBooleanExtra("from_notification", false)) {
                val map = Arguments.createMap().apply {
                    putString("amount", intent.getStringExtra("transaction_amount") ?: "0")
                    putString("merchant", intent.getStringExtra("transaction_merchant") ?: "Unknown")
                    putString("date", intent.getStringExtra("transaction_date") ?: "")
                    putString("message", intent.getStringExtra("transaction_message") ?: "")
                }
                intent.removeExtra("from_notification")
                promise.resolve(map)
                return
            }

            // Priority 2: Check SharedPreferences (fallback/background detection)
            val prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            if (prefs.getBoolean(KEY_HAS_PENDING, false)) {
                val map = Arguments.createMap().apply {
                    putString("amount", prefs.getString(KEY_PENDING_AMOUNT, "0"))
                    putString("merchant", prefs.getString(KEY_PENDING_MERCHANT, "Unknown"))
                    putString("date", prefs.getString(KEY_PENDING_DATE, ""))
                    putString("message", prefs.getString(KEY_PENDING_MESSAGE, ""))
                }
                prefs.edit().putBoolean(KEY_HAS_PENDING, false).apply()
                promise.resolve(map)
                return
            }

            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun startForegroundService(promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, SmsMonitorService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactApplicationContext.startForegroundService(intent)
            } else {
                reactApplicationContext.startService(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }
}
