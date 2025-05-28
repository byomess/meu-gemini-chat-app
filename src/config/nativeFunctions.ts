// src/config/nativeFunctions.ts
import type { FunctionDeclaration } from '../types';

export const nativeFunctionDeclarations: FunctionDeclaration[] = [
  {
    id: 'native_api_getPublicIP',
    name: 'getPublicIPAddress',
    description: 'Fetches the public IP address of the client from an external API.',
    parametersSchema: JSON.stringify({
      type: 'object',
      properties: {}, // No parameters needed for this function
    }),
    isNative: true,
    type: 'api',
    endpointUrl: 'https://api.ipify.org?format=json',
    httpMethod: 'GET',
  },
  {
    id: 'native_js_showAlert',
    name: 'showAlertInBrowser',
    description: 'Displays a browser alert with a given message and returns a confirmation.',
    parametersSchema: JSON.stringify({
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The message to display in the alert.',
        },
      },
      required: ['message'],
    }),
    isNative: true,
    type: 'javascript',
    code: "alert(params.message); return { status: 'success', messageDisplayed: params.message, details: 'Alert was shown to the user.' };",
  },
  {
    id: 'native_js_getCurrentDateTime',
    name: 'getCurrentDateTime',
    description: 'Gets the current date and time from the client browser.',
    parametersSchema: JSON.stringify({
        type: 'object',
        properties: {
            format: {
                type: 'string',
                description: "Optional format for the date/time string (e.g., 'ISO', 'locale'). Defaults to ISO string.",
                enum: ['ISO', 'locale', 'localeDate', 'localeTime']
            }
        },
    }),
    isNative: true,
    type: 'javascript',
    code: `
      const now = new Date();
      let formattedDateTime;
      switch (params.format) {
        case 'locale':
          formattedDateTime = now.toLocaleString();
          break;
        case 'localeDate':
          formattedDateTime = now.toLocaleDateString();
          break;
        case 'localeTime':
          formattedDateTime = now.toLocaleTimeString();
          break;
        case 'ISO':
        default:
          formattedDateTime = now.toISOString();
      }
      return { currentDateTime: formattedDateTime, timezoneOffset: now.getTimezoneOffset() };
    `
  },
  {
    id: 'native_js_scheduleProactiveNotification',
    name: 'scheduleProactiveNotification',
    description: 'Schedules a periodic proactive notification and registers a generic Periodic Background Sync task for the Service Worker to check for pending notifications.',
    parametersSchema: JSON.stringify({
        type: 'object',
        properties: {
            notificationId: { type: 'string', description: 'A unique UUID for this scheduled notification.' },
            notificationType: { type: 'string', description: "A type or category for this notification (e.g., 'productivity-tip', 'hydration-reminder')." },
            targetIntervalMs: { type: 'number', description: 'The desired interval in milliseconds for this specific notification to be sent (e.g., 7200000 for 2 hours, 14400000 for 4 hours).' },
            initialMessagePrompt: { type: 'string', description: 'An initial prompt for the AI to generate the notification message.' }
        },
        required: ['notificationId', 'notificationType', 'targetIntervalMs', 'initialMessagePrompt']
    }),
    isNative: true,
    type: 'javascript',
    code: `
        const DB_NAME = 'LooxAppDB';
        const DB_VERSION = 1;
        const STORE_NAME = 'scheduledNotifications';
        const GENERIC_SYNC_TAG = 'loox-notification-check';
        // const GENERIC_SYNC_MIN_INTERVAL = 600000; // 10 minutes in milliseconds
        const GENERIC_SYNC_MIN_INTERVAL = 60000; // 1 minute in milliseconds

        function openIndexedDB() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, DB_VERSION);

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    }
                };

                request.onsuccess = (event) => {
                    resolve(event.target.result);
                };

                request.onerror = (event) => {
                    console.error("IndexedDB error:", event.target.error);
                    reject(event.target.error);
                };
            });
        }

        async function saveScheduledNotification(notificationData) {
            console.log('[Frontend JS scheduleProactiveNotification] Opening IndexedDB to save notification...');
            const db = await openIndexedDB();
            console.log('[Frontend JS scheduleProactiveNotification] IndexedDB opened. Saving notification:', notificationData);
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            await store.put(notificationData);
            await transaction.done;
            db.close();
        }

        async function requestNotificationPermission() {
            if (!('Notification' in window)) {
                return 'unsupported';
            }
            if (Notification.permission === 'granted') {
                return 'granted';
            }
            return await Notification.requestPermission();
        }

        async function registerPeriodicSync(tag, minInterval) {
            if (!('serviceWorker' in navigator) || !(navigator.serviceWorker.ready)) {
                console.warn('Service Worker not supported or not ready. Periodic Background Sync may not work.');
                return { success: false, message: 'Service Worker not supported or not ready.' };
            }

            try {
                const registration = await navigator.serviceWorker.ready;
                // Check if periodicSync is available on the registration object
                if (!('periodicSync' in registration)) {
                    const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
                    let message = 'Periodic Background Sync not available on Service Worker registration. Consider checking browser support or HTTPS.';
                    if (isFirefox) {
                        message = 'Periodic Background Sync is not currently supported by default in Firefox. Proactive notifications requiring background sync may not work as expected. You might check Firefox about:config for experimental flags like dom.backgroundSync.periodic.enabled, but this is not recommended for general use.';
                    }
                    console.warn(\`[Frontend] \${message}\`);
                    return { success: false, message: message };
                }

                await registration.periodicSync.register(tag, {
                    minInterval: minInterval,
                });
                console.log(\`[Frontend] Periodic Sync '\${tag}' registered with interval \${minInterval}ms.\`);
                return { success: true, message: \`Periodic Sync '\${tag}' registered.\` };
            } catch (error) {
                console.error(\`[Frontend] Error registering Periodic Sync '\${tag}':\`, error);
                // Specifically check for NotAllowedError if user denied permissions or other issues
                if (error.name === 'NotAllowedError') {
                    return { success: false, message: \`Periodic Sync registration denied. This can happen if the site is not installed as a PWA, notification permissions are blocked, or due to insufficient site engagement. Please check browser settings and ensure the site is installed if applicable.\` };
                }
                return { success: false, message: \`Error registering Periodic Sync: \${error.message}\` };
            }
        }

        // --- Main execution for the function call (wrapped in async IIFE) ---
        return (async () => {
            console.log('[Frontend JS scheduleProactiveNotification] Function called with params:', params);
            const { notificationId, notificationType, targetIntervalMs, initialMessagePrompt } = params;

            const permission = await requestNotificationPermission();
            console.log('[Frontend] Notification permission status:', permission);

            if (permission !== 'granted') {
                console.warn('[Frontend] Notification permission not granted. Cannot schedule proactive notification.');
                return { status: 'error', message: 'Notification permission denied by user.' };
            }

            const newSchedule = {
                id: notificationId,
                type: notificationType, // Use 'type' to avoid collision with 'tag' for sync
                targetIntervalMs: targetIntervalMs,
                nextTriggerTime: Date.now() + targetIntervalMs, // First trigger attempt
                messagePrompt: initialMessagePrompt,
                currentMessage: '', // Will be filled by SW after Gemini call
                messageVariations: [], // Will be filled by SW
                lastVariationIndex: -1,
                enabled: true,
                createdAt: Date.now(),
            };

            try {
                console.log('[Frontend JS scheduleProactiveNotification] Attempting to save scheduled notification:', newSchedule);
                await saveScheduledNotification(newSchedule);
                console.log('[Frontend] Scheduled notification saved to IndexedDB:', newSchedule);

                // Always register the generic sync tag for the SW to check all notifications
                console.log(`[Frontend JS scheduleProactiveNotification] Attempting to register Periodic Sync with tag: '${GENERIC_SYNC_TAG}' and minInterval: ${GENERIC_SYNC_MIN_INTERVAL}ms`);
                const syncResult = await registerPeriodicSync(GENERIC_SYNC_TAG, GENERIC_SYNC_MIN_INTERVAL);
                console.log('[Frontend] Periodic Sync registration result:', syncResult);

                if (syncResult.success) {
                    console.log('[Frontend] Returning success for scheduleProactiveNotification.');
                    return { status: 'success', message: 'Proactive notification scheduled successfully!', scheduleId: notificationId };
                } else {
                    console.warn('[Frontend] Returning warning for scheduleProactiveNotification due to sync registration failure.');
                    return { status: 'warning', message: \`Proactive notification saved, but Periodic Sync registration failed: \${syncResult.message}\`, scheduleId: notificationId };
                }
            } catch (error) {
                console.error('[Frontend] Error scheduling proactive notification:', error);
                console.log('[Frontend] Returning error for scheduleProactiveNotification due to caught exception.');
                return { status: 'error', message: \`Failed to schedule proactive notification: \${error.message}\` };
            }
        })();
    `
  }
];
