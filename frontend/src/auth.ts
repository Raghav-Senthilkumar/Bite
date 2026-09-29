import { Amplify } from 'aws-amplify';

const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
const userPoolClientId = import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID;
const domain = import.meta.env.VITE_COGNITO_DOMAIN
  ?.replace(/^https?:\/\//, '')
  .replace(/\/$/, '');

export const authConfigured = Boolean(
  userPoolId && userPoolClientId && domain,
);

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
