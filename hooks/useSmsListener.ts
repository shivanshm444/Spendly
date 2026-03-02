import { useEffect, useRef, useCallback } from 'react';
import { PermissionsAndroid, Platform, AppState } from 'react-native';
import SmsAndroid from 'react-native-get-sms-android';

export type ParsedTransaction = {
    amount: number;
    merchant: string;
    date: string;
    message: string;
    category: string;
    notes: string;
};

const parseBankSMS = (message: string, date: string): ParsedTransaction | null => {
    const amountMatch =
        message.match(/Rs\.?\s*([\d,]+(?:\.\d{1,2})?)/i) ||
        message.match(/INR\s*([\d,]+(?:\.\d{1,2})?)/i) ||
        message.match(/(?:debited|deducted|spent|paid)\s*(?:Rs\.?|INR)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (!amountMatch) return null;

    const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    const isDebit = /debit|debited|spent|paid|deducted|withdrawn|purchase/i.test(message);
    if (!isDebit) return null;
    if (amount <= 0 || amount > 10000000) return null;

    const merchantMatch =
        message.match(/at\s+([A-Za-z][A-Za-z\s.\-&']+?)(?:\.|,|\s+Avl|\s+on|\s+Ref)/i) ||
        message.match(/to\s+([A-Za-z][A-Za-z\s.\-&']+?)(?:\s+Ref|\s+on|\.|,)/i) ||
        message.match(/(?:at|to|for)\s+([A-Za-z0-9][A-Za-z0-9\s]+)/i);
    const merchant = merchantMatch ? merchantMatch[1].trim().substring(0, 30) : 'Unknown';

    return { amount, merchant, date, message, category: '', notes: '' };
};

export function useSmsListener(
    onNewTransaction: (transaction: ParsedTransaction) => void,
    enabled: boolean = true
) {
    const lastTimestampRef = useRef<number>(Date.now());
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const processedRef = useRef<Set<string>>(new Set());

    const requestPermission = useCallback(async (): Promise<boolean> => {
        if (Platform.OS !== 'android') return false;
        try {
            const readGranted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.READ_SMS,
                {
                    title: 'SMS Permission',
                    message: 'Spendly needs SMS access to auto-detect transactions.',
                    buttonNeutral: 'Ask Me Later',
                    buttonNegative: 'Cancel',
                    buttonPositive: 'Allow',
                }
            );
            const receiveGranted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
                {
                    title: 'SMS Permission',
                    message: 'Spendly needs to receive SMS to auto-detect new transactions.',
                    buttonNeutral: 'Ask Me Later',
                    buttonNegative: 'Cancel',
                    buttonPositive: 'Allow',
                }
            );
            return (
                readGranted === PermissionsAndroid.RESULTS.GRANTED &&
                receiveGranted === PermissionsAndroid.RESULTS.GRANTED
            );
        } catch (e) {
            console.warn('SMS permission request failed:', e);
            return false;
        }
    }, []);

    const checkForNewSms = useCallback(() => {
        if (Platform.OS !== 'android' || !SmsAndroid || !SmsAndroid.list) return;

        const filter = {
            box: 'inbox',
            minDate: lastTimestampRef.current,
            maxCount: 20,
        };

        SmsAndroid.list(
            JSON.stringify(filter),
            (_fail: string) => {
                // silently fail on poll
            },
            (_count: number, smsList: string) => {
                try {
                    const messages = JSON.parse(smsList);
                    let latestTimestamp = lastTimestampRef.current;

                    messages.forEach((sms: any) => {
                        const smsDate = parseInt(String(sms.date || '0'));
                        const smsId = `${sms.date}_${sms.address}_${(sms.body || '').substring(0, 50)}`;

                        // Skip already processed
                        if (processedRef.current.has(smsId)) return;
                        if (smsDate <= lastTimestampRef.current) return;

                        const body = sms.body || '';
                        // Check if it's a bank transaction SMS
                        if (
                            /debit|debited|spent|paid|deducted|withdrawn|purchase/i.test(body) &&
                            /Rs\.?|INR|₹/i.test(body)
                        ) {
                            const parsed = parseBankSMS(body, String(smsDate));
                            if (parsed) {
                                processedRef.current.add(smsId);
                                onNewTransaction(parsed);
                            }
                        }

                        if (smsDate > latestTimestamp) {
                            latestTimestamp = smsDate;
                        }
                    });

                    if (latestTimestamp > lastTimestampRef.current) {
                        lastTimestampRef.current = latestTimestamp;
                    }
                } catch (e) {
                    // silently fail
                }
            }
        );
    }, [onNewTransaction]);

    useEffect(() => {
        if (!enabled || Platform.OS !== 'android') return;

        let isMounted = true;

        const startListening = async () => {
            const hasPermission = await requestPermission();
            if (!hasPermission || !isMounted) return;

            // Set initial timestamp to now so we only detect NEW SMS
            lastTimestampRef.current = Date.now();

            // Poll every 10 seconds
            intervalRef.current = setInterval(checkForNewSms, 10000);
        };

        startListening();

        // Pause/resume on app state change
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active' && isMounted) {
                if (!intervalRef.current) {
                    intervalRef.current = setInterval(checkForNewSms, 10000);
                }
            } else {
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
            }
        });

        return () => {
            isMounted = false;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            subscription.remove();
        };
    }, [enabled, checkForNewSms, requestPermission]);
}
