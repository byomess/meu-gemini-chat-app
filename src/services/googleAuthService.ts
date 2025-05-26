// src/services/googleAuthService.ts

// Declare gapi to avoid TypeScript errors if it's not globally defined
declare const gapi: any; // gapi is for Google API Client Library, not GIS directly, but often used together.
declare const google: any; // Declare google for GIS

let tokenClient: google.accounts.oauth2.TokenClient | null = null;

/**
 * Waits for the Google Identity Services (GIS) library to be fully loaded.
 * @returns A Promise that resolves when `window.google.accounts.oauth2` is available.
 */
const waitForGoogleAccountsOauth2 = (): Promise<void> => {
    return new Promise((resolve) => {
        const checkGoogle = () => {
            if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
                resolve();
            } else {
                setTimeout(checkGoogle, 50); // Check again after 50ms
            }
        };
        checkGoogle();
    });
};

/**
 * Initializes the Google OAuth 2.0 Token Client.
 * This function will wait for the GIS script to be loaded before proceeding.
 * @param clientId Your Google Cloud project's OAuth 2.0 Client ID.
 * @param scope The scopes to request (e.g., 'https://www.googleapis.com/auth/drive.file').
 * @param onTokenResponse Callback function for successful token response.
 * @param onError Callback function for errors during initialization or token response.
 */
export const initGoogleTokenClient = async (
    clientId: string,
    scope: string,
    onTokenResponse: (tokenResponse: google.accounts.oauth2.TokenResponse) => void,
    onError: (error: any) => void
): Promise<void> => {
    try {
        await waitForGoogleAccountsOauth2(); // Ensure GIS is loaded

        if (tokenClient) {
            // If already initialized, no need to re-initialize unless parameters change significantly.
            // For simplicity, we'll just return if it's already set up.
            // In a more complex app, you might want to re-configure or check if it needs re-init.
            return;
        }

        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: scope,
            callback: (tokenResponse) => {
                if (tokenResponse.error) {
                    onError(tokenResponse); // Pass the whole error response
                    return;
                }
                onTokenResponse(tokenResponse);
            },
            error_callback: (error: any) => { // Handles errors from the token client itself
                onError(error);
            }
        });
    } catch (error) {
        onError(error); // Catch any errors during the waiting or init process
    }
};

/**
 * Requests an access token. The user will be prompted to sign in and grant
 * permissions if they haven't already.
 * Call this after `initGoogleTokenClient` has successfully completed.
 */
export const requestAccessToken = (): void => {
    if (tokenClient) {
        // prompt: '' will attempt a silent token request if possible,
        // otherwise, it will prompt the user for consent.
        // prompt: 'consent' forces the consent screen.
        tokenClient.requestAccessToken({ prompt: '' });
    } else {
        console.error("Google Token Client not initialized. Cannot request access token.");
        // In a real application, you might want to surface this error to the user
        // or trigger re-initialization.
    }
};

/**
 * Fetches the user's profile information (email, name, picture) using an access token.
 * @param accessToken The OAuth 2.0 access token.
 * @returns A promise that resolves to the user's profile information.
 */
export const fetchUserProfile = async (accessToken: string): Promise<{ email: string; name?: string; picture?: string }> => {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to fetch user profile and parse error' }));
        throw new Error(errorData.message || `Failed to fetch user profile. Status: ${response.status}`);
    }
    return response.json();
};

/**
 * Revokes the given Google OAuth 2.0 access token.
 * @param accessToken The access token to revoke.
 * @param onComplete Optional callback function that is called when revocation is complete (successfully or not).
 */
export const revokeAccessToken = (accessToken: string, onComplete?: () => void): void => {
    if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
        google.accounts.oauth2.revoke(accessToken, () => {
            // This callback is called regardless of whether the revocation was successful.
            // The token is now considered invalid by the app.
            tokenClient = null; // Clear the client instance as token is effectively revoked for the app
            if (onComplete) {
                onComplete();
            }
        });
    } else {
        console.error("Google Identity Services script not loaded. Cannot revoke token.");
        if (onComplete) {
            // Still call onComplete to allow local state cleanup.
            onComplete();
        }
    }
};
