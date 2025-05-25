// src/services/googleAuthService.ts

// Ensure this interface is available globally after GIS script loads.
// You might need to declare 'google' in a global.d.ts file or similar
// if TypeScript complains, e.g., declare const google: any;
// However, with the script in index.html, it should be available.

let tokenClient: google.accounts.oauth2.TokenClient | null = null;

/**
 * Initializes the Google OAuth 2.0 Token Client.
 * Must be called after the GIS script has loaded.
 * @param clientId Your Google Cloud project's OAuth 2.0 Client ID.
 * @param scope The scopes to request (e.g., 'https://www.googleapis.com/auth/drive.file').
 * @param onTokenResponse Callback function for successful token response.
 * @param onError Callback function for errors during initialization or token response.
 */
export const initGoogleTokenClient = (
    clientId: string,
    scope: string,
    onTokenResponse: (tokenResponse: google.accounts.oauth2.TokenResponse) => void,
    onError: (error: any) => void
): void => {
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
        onError(new Error("Google Identity Services script not loaded yet."));
        return;
    }

    try {
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
        onError(error); // Catch any synchronous errors during init
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
        // This case should ideally be prevented by UI logic (e.g., disabling
        // the connect button until the client is initialized).
        console.error("Google Token Client not initialized. Cannot request access token.");
        // Optionally, you could pass an error back via a callback or promise if this function were async.
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
