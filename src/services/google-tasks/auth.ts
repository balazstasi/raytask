import { OAuth } from "@raycast/api";
import { OAuthService } from "@raycast/utils";

export const GOOGLE_TASKS_SCOPE = "https://www.googleapis.com/auth/tasks";

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * Creates a Google OAuth service for the Tasks scope. Uses a dedicated `providerId` so
 * tokens are namespaced for this extension. Adds `access_type=offline` and `prompt=consent`
 * so Google returns a refresh token for automatic access-token renewal.
 */
export function createGoogleOAuthService(clientId: string): OAuthService {
  const client = new OAuth.PKCEClient({
    redirectMethod: OAuth.RedirectMethod.AppURI,
    providerName: "Google",
    providerIcon: "icon.png",
    providerId: "google-tasks",
    description: "Connect your Google Tasks account",
  });

  return new OAuthService({
    client,
    clientId,
    scope: GOOGLE_TASKS_SCOPE,
    authorizeUrl: GOOGLE_AUTHORIZE_URL,
    tokenUrl: GOOGLE_TOKEN_URL,
    refreshTokenUrl: GOOGLE_TOKEN_URL,
    bodyEncoding: "url-encoded",
    extraParameters: {
      access_type: "offline",
      prompt: "consent",
    },
  });
}
