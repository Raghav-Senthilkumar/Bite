import { Amplify } from 'aws-amplify';
import { signOut } from 'aws-amplify/auth';

const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID?.trim();
const userPoolClientId = import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID?.trim();
const domain = import.meta.env.VITE_COGNITO_DOMAIN
  ?.trim()
  .replace(/^https?:\/\//, '')
  .replace(/\/$/, '');

export const authConfigured = Boolean(
  userPoolId && userPoolClientId && domain,
);

// Clear any stale inflight OAuth lock when we are not on an OAuth callback URL
export function clearStaleOAuthState(): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  if (params.has('code') || params.has('error')) return;

  try {
    for (const key of Object.keys(window.localStorage)) {
      if (
        key.endsWith('.inflightOAuth') ||
        key.endsWith('.inflightOAuthDeadline') ||
        key.endsWith('.oauthPKCE') ||
        key.endsWith('.oauthState')
      ) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore storage access errors
  }
}

// Clear Cognito OAuth redirect flags and tokens locally so signOut() does not
// navigate the browser to a blank/misconfigured external Cognito /logout page.
export async function clearSessionAndSignOut(): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      for (const key of Object.keys(window.localStorage)) {
        if (
          key.startsWith('CognitoIdentityServiceProvider.') ||
          key.startsWith('amplify-')
        ) {
          window.localStorage.removeItem(key);
        }
      }
      window.sessionStorage.clear();
    } catch {
      // Ignore storage errors
    }
  }

  try {
    await signOut();
  } catch {
    // Tokens are already cleared from storage
  }

  if (typeof window !== 'undefined' && window.location.pathname !== '/') {
    window.history.replaceState({}, '', '/');
  }
}

clearStaleOAuthState();

if (userPoolId && userPoolClientId && domain) {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
        loginWith: {
          oauth: {
            domain,
            scopes: ['openid', 'email', 'profile'],
            redirectSignIn: [
              `${window.location.origin}/auth/callback`,
            ],
            redirectSignOut: [`${window.location.origin}/`],
            responseType: 'code',
          },
        },
      },
    },
  });
}

import 'aws-amplify/auth/enable-oauth-listener';
