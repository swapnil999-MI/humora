// Social sign-in with PKCE. The server never puts tokens in a redirect URL: it
// sends back a one-time code, and only this browser tab can redeem it, because
// it alone holds the secret ("verifier") whose hash was sent at the start.
import { api } from './client';

const VERIFIER_KEY = 'humora_oauth_verifier';

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Starts a social sign-in: remembers a fresh verifier and goes to the provider. */
export async function startOAuth(provider: 'google' | 'github' | 'microsoft'): Promise<void> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  window.location.href = `/api/v1/auth/oauth/${provider}?client=web&challenge=${challenge}`;
}

interface OAuthTokens {
  access_token: string;
  refresh_token: string;
}

/**
 * Redeems the one-time code the provider round trip came back with. Returns
 * null if this tab did not start a sign-in (e.g. a link someone else crafted).
 */
export async function finishOAuth(code: string): Promise<OAuthTokens | null> {
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  if (!verifier) return null;
  return api.post<OAuthTokens>('/auth/oauth/exchange', { code, verifier });
}
