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
            notificationText: { type: 'string', description: 'The exact text to be displayed in the notification.' }
        },
        required: ['notificationId', 'notificationType', 'targetIntervalMs', 'notificationText']
    }),
    isNative: true,
    type: 'javascript',
    code: `
        // This function is now deprecated as the notification system shifts to server-driven push.
        // It no longer schedules client-side periodic notifications.
        // It will only request notification permission and log a message.

        async function requestNotificationPermission() {
            if (!('Notification' in window)) {
                return 'unsupported';
            }
            if (Notification.permission === 'granted') {
                return 'granted';
            }
            return await Notification.requestPermission();
        }

        // --- Main execution for the function call (wrapped in async IIFE) ---
        return (async () => {
            console.warn('[Frontend JS scheduleProactiveNotification] This function is deprecated. Proactive notifications are now server-driven via push notifications.');
            console.log('[Frontend JS scheduleProactiveNotification] Function called with params:', params);
            const { notificationId, notificationType, targetIntervalMs, notificationText } = params;

            const permission = await requestNotificationPermission();
            console.log('[Frontend] Notification permission status:', permission);

            if (permission !== 'granted') {
                console.warn('[Frontend] Notification permission not granted. Cannot schedule proactive notification.');
                return { status: 'error', message: 'Notification permission denied by user. Proactive notifications require permission.' };
            }

            // In a server-driven model, the client doesn't "schedule" the notification directly.
            // It only subscribes to push notifications (handled by main.tsx) and the server sends them.
            // This function now serves as a placeholder or a way to ensure permission is requested.
            console.log(\`[Frontend] Proactive notification request received (ID: \${notificationId}, Type: \${notificationType}, Text: "\${notificationText}").
            Please ensure your backend is configured to send push notifications based on your desired logic.\`);

            return { status: 'info', message: 'Proactive notification request processed. Server-driven push notifications are now used. Ensure your backend is configured to send these notifications.', details: { notificationId, notificationType, targetIntervalMs, notificationText } };
        })();
    `
  }
];
