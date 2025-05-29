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
        description: 'Agenda notificações proativas (únicas/recorrentes) para Loox engajar o usuário de forma contextual, personalizada e útil, antecipando necessidades. Loox deve usar esta função para ativamente acompanhar, lembrar, motivar e interagir com base na conversa e conhecimento do usuário. **Importante: na maioria dos casos, agendar discretamente, sem informar sobre o agendamento, para parecer orgânico, a menos que o usuário peça explicitamente um lembrete (neste caso, confirmar).** Use para: 1. **Lembretes de Tarefas/Compromissos:** Usuário: \'Relatório até sexta.\' Loox (agendado): \'Lembrete do relatório hoje! 💪\' Usuário: \'Reunião 14h amanhã.\' Loox (agendado 13:45): \'Reunião em 15 min!\' Usuário: \'Buscar filho(a) às 17h.\' Loox (agendado 16:45): \'Buscar as crianças!\' 2. **Apoio a Hábitos/Rotinas:** Usuário: \'Acordar cedo para exercícios.\' Loox (agendado): \'Bom dia! Hora de energia! ✨\' Usuário: \'Ler à noite.\' Loox (agendado): \'Minutos de leitura? 📚\' Usuário: \'Academia Seg/Qua/Sex.\' Loox (agendado): \'Bora pra academia? 🏋️‍♂️\' 3. **Engajamento Social/Follow-ups:** **Saudações:** Ocasionalmente: \'Tenha um ótimo dia!\' / \'Boa tarde produtiva!\' **Follow-ups:** Usuário: \'Festa sábado.\' Loox (agendado Domingo): \'Como foi a festa?\' Usuário: \'Apresentação do filho(a) terça.\' Loox (agendado depois): \'E a apresentação?\' Usuário: \'Almoço com amigo hoje.\' Loox (agendado mais tarde): \'Como foi o almoço?\' 4. **Suporte/Motivação:** Usuário menciona desafio: \'Tarefa complicada.\' Loox (agendado): \'Não desanima! Você consegue! 🚀\' Durante trabalho: \'Foco e produtividade!\' 5. **Dicas/Interações Contextuais:** Conversa interrompida sobre [tópico]: \'Ainda pensando sobre [tópico]?\' (Para reengajar). Lembretes de saúde (ex: beber água) se mencionado. Central: Usar conhecimento do usuário (rotinas, interesses, contexto) para interações proativas úteis, motivadoras ou amigáveis. Exercer com bom senso, adaptando tom e `type` (ex: `LembretePessoal`, `FollowUpEvento`, `MotivacionalTrabalho`, `HabitoSaude`, `EngajamentoAmigo`) para ser relevante, não interruptivo.',
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
                    "description": "Timestamp UNIX em milissegundos para quando uma notificação do tipo 'SINGLE' deve ser enviada. Deve ser uma data/hora no futuro. Ignorado para 'RECURRENT'. Use sendAt OU sendAfter, mas não ambos."
                },
                "sendAfter": {
                    "type": "number",
                    "description": "Delay em milissegundos após o momento atual para quando uma notificação do tipo 'SINGLE' deve ser enviada (ex: 10000 para 10 segundos). Deve ser um valor positivo. Ignorado para 'RECURRENT'. Use sendAt OU sendAfter, mas não ambos."
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
                    // Removed allOf conditional requirements for recurrenceRule properties
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
            // Removed allOf, oneOf, not conditional requirements for top-level properties
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
            const { id, text, type, scheduleType, sendAt, sendAfter, recurrenceRule, maxSends } = params;

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
                let finalSendAt;
                const now = Date.now();

                if (sendAfter !== undefined && sendAfter > 0) {
                    finalSendAt = now + sendAfter;
                    console.log(\`[Frontend] Scheduling SINGLE notification for \${sendAfter}ms from now.\`);
                } else if (sendAt !== undefined) {
                    finalSendAt = sendAt;
                    // If sendAt is in the past, adjust it to 5 seconds from now
                    if (finalSendAt < now) {
                        console.warn(\`[Frontend] Provided sendAt (\${finalSendAt}) is in the past. Adjusting to 5 seconds from now.\`);
                        finalSendAt = now + 5000; // Schedule 5 seconds from the current client time
                    }
                    console.log(\`[Frontend] Scheduling SINGLE notification for specific time: \${finalSendAt}.\`);
                } else {
                    // Fallback if neither sendAt nor sendAfter is provided for SINGLE
                    console.warn('[Frontend] Neither sendAt nor sendAfter provided for SINGLE notification. Defaulting to 5 seconds from now.');
                    finalSendAt = now + 5000;
                }
                payload.sendAt = finalSendAt;
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
