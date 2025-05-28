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
    description: 'Schedules a periodic proactive notification by sending a request to the backend push server.',
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
            const { notificationId, notificationType, targetIntervalMs, notificationText } = params;

            const permission = await requestNotificationPermission();
            if (permission !== 'granted') {
                console.warn('[Frontend] Notification permission not granted. Cannot schedule proactive notification.');
                return { status: 'error', message: 'Notification permission denied. Proactive notifications require permission.' };
            }

            const SCHEDULE_ENDPOINT = 'http://localhost:5000/schedule-proactive-notification';
            try {
                const response = await fetch(SCHEDULE_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        notificationId,
                        notificationType,
                        targetIntervalMs,
                        notificationText,
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(\`Server responded with status \${response.status}: \${errorData.message || 'Unknown error'}\`);
                }

                const result = await response.json();
                console.log('[Frontend] Proactive notification scheduled via server:', result);
                return { status: 'success', message: 'Proactive notification scheduled via server.', details: result };
            } catch (error) {
                console.error('[Frontend] Error scheduling proactive notification via server:', error);
                return { status: 'error', message: \`Failed to schedule proactive notification: \${error.message}\` };
            }
        })();
    `
  }
];
