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
  }
  // Future native functions can be added here.
  // For example, a native API function that requires a POST request:
  /*
  {
    id: 'native_api_postExample',
    name: 'postExampleData',
    description: 'Sends example data to a test API endpoint.',
    parametersSchema: JSON.stringify({
      type: 'object',
      properties: {
        data: { type: 'string', description: 'Some data to post.' },
        userId: { type: 'number', description: 'A user ID.' }
      },
      required: ['data']
    }),
    isNative: true,
    type: 'api',
    endpointUrl: 'https://jsonplaceholder.typicode.com/posts', // Example endpoint
    httpMethod: 'POST',
  }
  */
];
