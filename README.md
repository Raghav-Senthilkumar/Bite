# Bite

Bite turns public Substack cooking posts into a private, searchable recipe shelf.

## What is implemented

- Google sign-in through Cognito authorization code flow with PKCE
- Add and remove public `*.substack.com` publications
- Idempotent RSS discovery with deterministic SHA-256 IDs
- SQS extraction queue, bounded retries, partial-batch failures, and a DLQ
- Amazon Bedrock Converse extraction using GLM 4.7 Flash and JSON-schema output
- DynamoDB-backed creators, follows, source items, and recipes
- Daily EventBridge Scheduler check at 6:00 AM `America/New_York`
- Responsive recipe list, search, import status, manual check, and recipe details

## Verify locally

```bash
cd backend
uv sync --frozen
uv run ruff check src tests
uv run pytest -q

cd ../infrastructure
npm ci
npm run build
npm test -- --runInBand

cd ../frontend
npm ci
npm run build
npm run lint
```

## Configure the frontend

Copy `frontend/.env.example` to `frontend/.env` and fill in the four values from
the CDK outputs:

```dotenv
VITE_COGNITO_USER_POOL_ID=
VITE_COGNITO_USER_POOL_CLIENT_ID=
VITE_COGNITO_DOMAIN=
VITE_API_URL=
```

The Google OAuth credentials must exist in AWS Secrets Manager as
`bite/google-oauth`, with `clientId` and `clientSecret` JSON properties.

## Deployment notes

Deploy in `us-east-1`, where the default `zai.glm-4.7-flash` model is
available. The CDK deployment bundles the exact Lambda dependencies pinned from
`backend/uv.lock`. Use the `frontendUrl` CDK context for a hosted frontend URL:

```bash
cd infrastructure
npx cdk deploy -c frontendUrl=https://your-app.example.com
```

No AWS deployment is performed by the test commands.
