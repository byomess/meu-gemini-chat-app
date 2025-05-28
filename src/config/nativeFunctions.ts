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
    description: 'Schedules a notification (single or recurrent) by sending a request to the backend push server. This function allows for flexible scheduling based on the provided parameters.',
    parametersSchema: JSON.stringify({
      "type": "object",
      "properties": {
          "id": {
              "type": "string",
              "description": "ID único opcional para a notificação (UUID recomendado). Se omitido, um ID será gerado pelo servidor. Fornecer um ID permite atualizar um agendamento existente com o mesmo ID."
          },
          "text": {
              "type": "string",
              "description": "O texto exato a ser exibido na notificação."
          },
          "type": {
              "type": "string",
              "description": "Um tipo ou categoria para esta notificação, usado para agrupamento ou diferenciação (ex: 'LembreteTrabalho', 'Hidratacao', 'DicaProdutividade', 'AlertaSistema')."
          },
          "scheduleType": {
              "type": "string",
              "description": "Define se a notificação é um disparo único ('SINGLE') ou recorrente ('RECURRENT').",
              "enum": [
                  "SINGLE",
                  "RECURRENT"
              ]
          },
          "sendAt": {
              "type": "number",
              // Removed "format": "int64" as it's not supported by the API
              "description": "Timestamp UNIX em milissegundos para quando uma notificação do tipo 'SINGLE' deve ser enviada. Deve ser uma data/hora no futuro. Ignorado para 'RECURRENT'."
          },
          "recurrenceRule": {
              "type": "object",
              "description": "Define as regras de recorrência para notificações do tipo 'RECURRENT'. Ignorado para 'SINGLE'.",
              "properties": {
                  "type": {
                      "type": "string",
                      "description": "O tipo de regra de recorrência.",
                      "enum": [
                          "INTERVAL",
                          "WEEKLY",
                          "MONTHLY"
                      ]
                  },
                  "intervalMs": {
                      "type": "number",
                      "description": "Intervalo em milissegundos para recorrência do tipo 'INTERVAL' (ex: 3600000 para 1 hora, 86400000 para 1 dia). Deve ser um valor positivo."
                  },
                  "daysOfWeek": {
                      "type": "array",
                      "items": {
                          "type": "number",
                          "minimum": 0,
                          "maximum": 6
                      },
                      "description": "Array de dias da semana (0=Domingo, 1=Segunda,..., 6=Sábado) para recorrência do tipo 'WEEKLY'."
                  },
                  "daysOfMonth": {
                      "type": "array",
                      "items": {
                          "type": "number",
                          "minimum": 1,
                          "maximum": 31
                      },
                      "description": "Array de dias do mês (1-31) para recorrência do tipo 'MONTHLY'. Se um dia não existir em um determinado mês (ex: 31 em Fevereiro), será ignorado para aquele mês."
                  },
                  "timeOfDay": {
                      "type": "object",
                      "description": "Horário específico do dia (HH:MM) para recorrências do tipo 'WEEKLY' ou 'MONTHLY'.",
                      "properties": {
                          "hour": {
                              "type": "number",
                              "minimum": 0,
                              "maximum": 23,
                              "description": "A hora do dia, em formato 24 horas (0-23)."
                          },
                          "minute": {
                              "type": "number",
                              "minimum": 0,
                              "maximum": 59,
                              "description": "O minuto da hora (0-59)."
                          }
                      },
                      "required": [
                          "hour",
                          "minute"
                      ]
                  }
              },
              "required": [
                  "type"
              ]
          },
          "maxSends": {
              "type": "number",
              "description": "Número máximo de envios para notificações do tipo 'RECURRENT'. Use -1 ou omita para envios infinitos. Para 'SINGLE', este valor é ignorado (efetivamente 1 envio). Default: -1.",
              "default": -1
          }
      },
      "required": [
          "text",
          "type",
          "scheduleType"
      ]
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
            const { id, text, type, scheduleType, sendAt, recurrenceRule, maxSends } = params;

            const permission = await requestNotificationPermission();
            if (permission !== 'granted') {
                console.warn('[Frontend] Notification permission not granted. Cannot schedule proactive notification.');
                return { status: 'error', message: 'Notification permission denied. Proactive notifications require permission.' };
            }

            const SCHEDULE_ENDPOINT = 'http://localhost:5000/schedule-notification';
            
            const payload = {
                id: id, // Optional, will be undefined if not provided
                text: text,
                type: type,
                scheduleType: scheduleType,
                maxSends: maxSends !== undefined ? maxSends : -1, // Use provided maxSends or default to -1
            };

            if (scheduleType === 'SINGLE') {
                payload.sendAt = sendAt;
            } else if (scheduleType === 'RECURRENT') {
                payload.recurrenceRule = recurrenceRule;
            }

            try {
                const response = await fetch(SCHEDULE_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
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
