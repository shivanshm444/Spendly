const { withAndroidManifest, withMainApplication, withAndroidColors, withAndroidStrings, createRunOncePlugin, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin to register SmsReceiver and native modules.
 */
const withSmsReceiver = (config) => {
    // 1. Add Permissions
    config = withAndroidManifest(config, (config) => {
        const mainApplication = config.modResults.manifest.application[0];

        // Ensure permissions exist
        if (!config.modResults.manifest['uses-permission']) {
            config.modResults.manifest['uses-permission'] = [];
        }

        const permissions = [
            'android.permission.READ_SMS',
            'android.permission.RECEIVE_SMS',
            'android.permission.FOREGROUND_SERVICE',
            'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
            'android.permission.POST_NOTIFICATIONS',
            'android.permission.RECEIVE_BOOT_COMPLETED',
        ];

        permissions.forEach((perm) => {
            if (!config.modResults.manifest['uses-permission'].find((p) => p.$['android:name'] === perm)) {
                config.modResults.manifest['uses-permission'].push({ $: { 'android:name': perm } });
            }
        });

        // 2. Register Receiver and Service
        if (!mainApplication.receiver) mainApplication.receiver = [];
        if (!mainApplication.service) mainApplication.service = [];

        const receiverName = 'com.banktracker.app.SmsReceiver';
        if (!mainApplication.receiver.find((r) => r.$['android:name'] === receiverName)) {
            mainApplication.receiver.push({
                $: {
                    'android:name': receiverName,
                    'android:enabled': 'true',
                    'android:exported': 'true',
                },
                'intent-filter': [
                    {
                        $: { 'android:priority': '999' },
                        action: [{ $: { 'android:name': 'android.provider.Telephony.SMS_RECEIVED' } }],
                    },
                ],
            });
        }

        const serviceName = 'com.banktracker.app.SmsMonitorService';
        if (!mainApplication.service.find((s) => s.$['android:name'] === serviceName)) {
            mainApplication.service.push({
                $: {
                    'android:name': serviceName,
                    'android:enabled': 'true',
                    'android:exported': 'false',
                    'android:foregroundServiceType': 'specialUse',
                },
            });
        }

        const bootReceiverName = 'com.banktracker.app.BootReceiver';
        if (!mainApplication.receiver.find((r) => r.$['android:name'] === bootReceiverName)) {
            mainApplication.receiver.push({
                $: {
                    'android:name': bootReceiverName,
                    'android:enabled': 'true',
                    'android:exported': 'true',
                },
                'intent-filter': [
                    {
                        action: [{ $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } }],
                    },
                ],
            });
        }

        return config;
    });

    // 3. Register Native Module Package in MainApplication.kt
    config = withMainApplication(config, (config) => {
        if (config.modResults.language === 'kt') {
            let content = config.modResults.contents;
            const importPackage = 'import com.banktracker.app.SmsTransactionPackage';
            if (!content.includes(importPackage)) {
                content = content.replace(/package .*\n/, (match) => `${match}${importPackage}\n`);
            }
            const addPackage = 'add(SmsTransactionPackage())';
            if (!content.includes(addPackage)) {
                // Target the 'packages.apply {' block or the DefaultReactNativeHost structure
                const applyRegex = /PackageList\(this\)\.packages\.apply\s*\{/;
                if (applyRegex.test(content)) {
                    content = content.replace(applyRegex, (match) => `${match}\n                ${addPackage}`);
                } else {
                    // Fallback for different formatting
                    const fallbackRegex = /override\s+fun\s+getPackages\(\):\s+List<ReactPackage>\s*=\s*PackageList\(this\)\.packages/;
                    if (fallbackRegex.test(content)) {
                        content = content.replace(fallbackRegex, (match) => `override fun getPackages(): List<ReactPackage> = PackageList(this).packages.toMutableList().apply { ${addPackage} }`);
                    }
                }
            }
            config.modResults.contents = content;
        }
        return config;
    });

    // 4. Copy Native Files (Dangerous Mod)
    config = withDangerousMod(config, [
        'android',
        async (config) => {
            const projectRoot = config.modRequest.projectRoot;
            const targetDir = path.join(projectRoot, 'android/app/src/main/java/com/banktracker/app');
            const sourceDir = path.join(projectRoot, 'native-sms');

            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            const files = ['SmsReceiver.kt', 'SmsTransactionModule.kt', 'SmsTransactionPackage.kt', 'SmsMonitorService.kt', 'BootReceiver.kt'];
            files.forEach((file) => {
                const sourcePath = path.join(sourceDir, file);
                const targetPath = path.join(targetDir, file);
                if (fs.existsSync(sourcePath)) {
                    fs.copyFileSync(sourcePath, targetPath);
                    console.log(`✅ Copied ${file} to native project`);
                }
            });

            return config;
        },
    ]);

    return config;
};

module.exports = createRunOncePlugin(withSmsReceiver, 'withSmsReceiver', '1.0.0');
