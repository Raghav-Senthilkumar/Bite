# Bite — Reliable AWS MVP Architecture (v2)

## 1. MVP outcome

By tomorrow, one user should be able to:

1. Sign in with Google through Amazon Cognito.
2. Follow a small number of public Substack publications.
3. Trigger an initial import of recent public posts.
4. See import progress and failures.
5. Browse globally shared, deduplicated recipes from followed creators.
6. Maintain a private pantry.
7. Rank recipes by quantity-aware pantry readiness.
8. Ask an AI cooking assistant about accessible recipes, missing ingredients, and substitutions.
9. Leave the system running and verify that the daily job discovers new Substack posts.

TikTok, transcription, pantry OCR, full-text search, and recipe images are explicitly outside this MVP.

## 2. Product rules

- A creator and its extracted recipes are global records.
- Following a creator is private and user-specific.
- The same source post is fetched and extracted once, even when several users follow its creator.
- A user's feed is the union of recipes belonging to creators they follow.
- When a source post contains several recipes, every confidently extracted recipe is saved as a separate canonical recipe.
- Pantry contents and chat history are private to the user.
- Canonical recipes are read-only in the MVP; user-specific notes and corrections are deferred.
- Only public Substack RSS content is supported. Authenticated paid-newsletter content is not accessed.
- Source attribution and a link to the original post are always retained.

## 3. AWS architecture

```text
Browser
  |
  +-- Cognito Managed Login + Google OAuth (Authorization Code + PKCE)
  |
  +-- CloudFront
        |-- /*       -> private S3 SPA origin
        `-- /api/*   -> API Gateway HTTP API
                           |-- Cognito JWT authorizer
                           `-- API Lambda (Python router)
                                 |-- DynamoDB
                                 |-- SQS discovery/extraction queue
                                 `-- Bedrock Converse API (agent chat)

Creator added or daily schedule
  -> Discovery Lambda
       -> fetch and parse public Substack RSS
       -> conditionally create SourceItem records
       -> one SQS message per new source item
            -> Extraction Lambda
                 -> obtain public article text
                 -> Bedrock structured recipe extraction
                 -> conditionally write canonical Recipe records
                 -> update import status

EventBridge Scheduler
  -> once daily -> Discovery Lambda for all active creators

SQS failures
  -> dead-letter queue -> visible failure status + CloudWatch alarm
```

### Why API Gateway for this MVP

Use an API Gateway HTTP API instead of Lambda Function URLs. It provides a Cognito JWT authorizer, one stable `/api` origin, route-level configuration, request limits, and clearer logs. This is a better reliability/learning tradeoff than maintaining authentication middleware in every public Lambda.

### Runtime choices

- Infrastructure: AWS CDK with TypeScript
- Primary AWS Region: `us-east-1`
- API and workers: Python 3.12 on AWS Lambda
- Backend dependency and environment management: `uv` with a committed `backend/uv.lock`
- CDK dependency management: npm with a committed `infrastructure/package-lock.json`
- Frontend: React, Vite, TypeScript, Tailwind CSS, TanStack Query
- Authentication client: Amplify Auth libraries backed by Cognito
- RSS parsing: a maintained XML/RSS parser plus HTML-to-text sanitization
- Backend validation: Pydantic at API, queue, database, and model-output boundaries
- Frontend validation: Zod for browser-owned forms and untrusted browser data
- AI: Amazon Bedrock Converse API; model IDs supplied through environment configuration

### Project tooling and package boundaries

Keep the TypeScript CDK application and Python backend as independent projects:

```text
Bite/
├── infrastructure/
│   ├── package.json        # AWS CDK and TypeScript dependencies
│   ├── package-lock.json   # committed npm lockfile
│   ├── bin/
│   └── lib/
├── backend/
│   ├── pyproject.toml      # Pydantic, Powertools, and Python tooling
│   ├── uv.lock             # committed backend dependency lockfile
│   ├── src/bite_backend/
│   └── tests/
├── frontend/                    # React + TypeScript; managed with npm
└── shared/                      # JSON Schema, API contracts, and cross-language fixtures
```

Run backend commands from `backend/` with `uv sync`, `uv run`, and the committed
`uv.lock`. Run infrastructure commands from `infrastructure/` with `npm ci` and
the locally pinned CLI, for example `npx cdk synth`. Do not use `uv` to manage CDK
dependencies, and do not use npm to manage backend dependencies.

The CDK application packages Python Lambda assets from `backend/`, but backend
modules must never import infrastructure modules. Lambda deployment bundles must
be reproducible from `backend/uv.lock`. Generate JSON Schema from canonical
Pydantic models when the frontend needs a shared contract; do not duplicate Python
models as hand-maintained TypeScript interfaces.

## 4. DynamoDB model

Use separate tables for the learning MVP. A single-table design can be introduced later if access patterns justify it.

### `Users`

Key: `userId` (Cognito `sub`)

```json
{
  "userId": "cognito-sub",
  "email": "user@example.com",
  "displayName": "Jane",
  "pictureUrl": "https://...",
  "pantry": [
    {
      "name": "olive oil",
      "normalizedName": "olive oil",
      "quantity": 500,
      "unit": "milliliter",
      "updatedAt": "ISO-8601"
    },
    {
      "name": "garlic",
      "normalizedName": "garlic",
      "quantity": 6,
      "unit": "clove",
      "updatedAt": "ISO-8601"
    }
  ],
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

The pantry can remain on the user record for the MVP because it is bounded to 500
entries, ingredient names are limited to 100 characters, units to 32 characters,
and the backend rejects a serialized user item above 350 KB to retain headroom
below DynamoDB's 400 KB item limit. It is replaced atomically. `quantity` must be
a positive decimal and `unit` must be canonicalized when the pantry is saved. The
`PUT /api/pantry` endpoint replaces the complete validated pantry list and updates
the user record's `updatedAt`. Cooking a recipe does not automatically consume
inventory in the MVP; users manually update pantry amounts.

### `Creators`

Key: `creatorId`

`creatorId` is a deterministic hash of the canonical feed URL.

```json
{
  "creatorId": "sha256:...",
  "platform": "substack",
  "feedUrl": "https://publication.example/feed",
  "siteUrl": "https://publication.example",
  "displayName": "Publication Name",
  "status": "ACTIVE",
  "lastCheckedAt": "ISO-8601",
  "lastSuccessfulCheckAt": "ISO-8601",
  "lastError": null,
  "createdAt": "ISO-8601"
}
```

Do not store follower IDs in this record.

### `Follows`

- Partition key: `userId`
- Sort key: `creatorId`
- GSI: `creatorId` + `userId`, for follower counts or cleanup

```json
{
  "userId": "cognito-sub",
  "creatorId": "sha256:...",
  "followedAt": "ISO-8601"
}
```

### `SourceItems`

Key: `sourceItemId`

`sourceItemId` is a deterministic hash of the platform plus the source's stable GUID or canonical URL. A conditional put makes discovery idempotent.

```json
{
  "sourceItemId": "sha256:...",
  "creatorId": "sha256:...",
  "sourceUrl": "https://...",
  "sourceGuid": "rss-guid-if-present",
  "title": "Post title",
  "publishedAt": "ISO-8601",
  "status": "QUEUED | PROCESSING | COMPLETE | NO_RECIPE | FAILED",
  "attemptCount": 0,
  "errorCode": null,
  "discoveredAt": "ISO-8601",
  "completedAt": null
}
```

GSI: `creatorId` + `publishedAt`.

### `Recipes`

Key: `recipeId`

Use a deterministic recipe ID based on `sourceItemId` plus the recipe position within the source. This supports more than one recipe in a post without duplication.

```json
{
  "recipeId": "sha256:...",
  "sourceItemId": "sha256:...",
  "creatorId": "sha256:...",
  "sourceUrl": "https://...",
  "title": "Lemony Chicken",
  "description": "...",
  "ingredients": [
    {
      "raw": "2 cloves garlic, minced",
      "name": "garlic",
      "quantity": 2,
      "unit": "clove",
      "optional": false
    }
  ],
  "instructions": ["..."],
  "cookTimeMinutes": 35,
  "servings": 4,
  "tags": ["dinner"],
  "extractionConfidence": 0.91,
  "publishedAt": "ISO-8601",
  "createdAt": "ISO-8601"
}
```

GSI: `creatorId` + `publishedAt`.

There is no ingredients GSI and no cook-time-only GSI. The API queries recipes for the user's few followed creators, merges them, and applies filters in memory. Results are bounded and paginated.

### `ChatMessages`

- Partition key: `sessionId`
- Sort key: `messageKey`, whose value is `createdAt#messageId`
- GSI: `userId` + `updatedAt`
- TTL attribute: `expiresAt`

Store each message separately. Never append an unbounded conversation to one DynamoDB item.

## 5. Authentication

1. The SPA starts Cognito Managed Login with Google federation.
2. Use Authorization Code flow with PKCE.
3. Cognito redirects to `/auth/callback` in the SPA.
4. The frontend library exchanges the code and maintains the Cognito session.
5. API calls send the Cognito access token.
6. API Gateway validates issuer, audience/client, signature, and expiration.
7. Lambdas derive `userId` only from verified JWT claims and never accept it from request JSON.
8. The first `GET /me` or `PUT /me` conditionally creates the user profile.

`/auth/callback` is a frontend route, not a Lambda endpoint. There are no custom backend refresh or logout endpoints in this MVP.

## 6. Creator import and daily update

### Add creator

```text
POST /api/creators
  -> validate and canonicalize URL
  -> resolve/verify public RSS feed
  -> conditionally create global Creator
  -> create private Follow
  -> invoke Discovery Lambda asynchronously for that creator
  -> return creator and import status
```

Initial discovery imports the newest 20 posts by default. The limit is a server-side environment value and can be raised after measuring cost and quality. RSS may expose fewer posts; the system does not assume `?limit=100` support.

### Discovery behavior

For every RSS item:

1. Prefer RSS GUID; otherwise canonicalize the post URL.
2. Derive deterministic `sourceItemId`.
3. Create `SourceItems` with a conditional write.
4. Only enqueue the item when the conditional write succeeds.
5. Update `lastSuccessfulCheckAt` after the feed was successfully parsed and queued.

Do not rely on `lastPostUrl`. This prevents missed posts, duplicates, and incorrect cursors after partial failure.

### Extraction behavior

1. Claim source item using a conditional status update.
2. Use RSS full content when available; otherwise fetch the public post page.
3. Sanitize HTML and cap input characters/tokens.
4. Ask Bedrock for schema-constrained structured output.
5. Validate output with Pydantic.
6. Write zero or more canonical recipe records conditionally.
7. Mark the source item `COMPLETE`, `NO_RECIPE`, or `FAILED`.

Configure SQS partial-batch failure handling, bounded retries, and a dead-letter queue. The queue visibility timeout must safely exceed the worker timeout and retry window.

### Daily check

EventBridge Scheduler runs once per day at 6:00 AM in the `America/New_York` timezone. It invokes discovery for every active creator. The same deterministic IDs make scheduled checks safe to repeat.

The UI shows:

- last successful check;
- queued/processing/completed/failed counts;
- a manual “Check now” button with a per-creator cooldown.

## 7. Feed and pantry matching

### Personalized feed

1. Query the user's follows.
2. Query each followed creator's recipe GSI in parallel with a strict concurrency limit.
3. Merge and sort by `publishedAt`.
4. Return a bounded page plus cursor metadata.

This fan-out is acceptable for a few followed creators. Introduce a feed projection only when measurements show it is necessary; do not duplicate recipe bodies.

### Deterministic pantry readiness

Normalize ingredient names and units during extraction and pantry entry. Start
with lowercase, singularization, punctuation removal, and a small alias map.
Support deterministic conversions within compatible unit families, such as
kilograms to grams, liters to milliliters, and tablespoons to milliliters. Never
infer density-based weight/volume conversions or unreliable conversions such as
garlic bulbs to cloves. Ignore water, salt, and pepper when calculating readiness.
Oils remain normal pantry ingredients because their availability, type, and amount
can materially affect a recipe.

Assign every required ingredient exactly one status:

- `SUFFICIENT`: matching pantry ingredient exists and its comparable quantity meets the recipe requirement.
- `INSUFFICIENT`: matching pantry ingredient exists, but its comparable quantity is too low.
- `UNKNOWN_AMOUNT`: the ingredient exists, but a quantity is missing, vague, or cannot be converted safely.
- `MISSING`: no matching pantry ingredient exists.

```text
required  = non-optional recipe ingredients excluding configured staples
satisfied = required ingredients with status SUFFICIENT
coverage  = satisfied / required

readiness:
  READY     = every required ingredient is SUFFICIENT
  MAYBE     = none are MISSING or INSUFFICIENT, but at least one is UNKNOWN_AMOUNT
  NOT_READY = at least one is MISSING or INSUFFICIENT

sort by:
  1. readiness: READY, then MAYBE, then NOT_READY
  2. coverage descending
  3. missing + insufficient count ascending
  4. publication date descending
```

Return sufficient, insufficient, unknown-amount, and missing ingredients, including
required and available quantities when comparable, so the UI and AI assistant can
explain the result. Keep this calculation deterministic; do not pay for an LLM
call just to rank recipes. The assistant must not claim the user can cook a recipe
when readiness is `MAYBE` or `NOT_READY`.

## 8. AI cooking assistant

The assistant is a small tool-using loop implemented in the API Lambda with the Bedrock Converse API. It is not a managed Bedrock Agent for the MVP.

Available tools:

- `list_followed_creators()`
- `search_my_recipes(query, maxCookTimeMinutes, ingredients)`
- `get_recipe(recipeId)`
- `get_my_pantry()`
- `rank_recipes_for_my_pantry()`

Rules:

- Tools always scope data using the authenticated Cognito `sub`.
- `get_recipe` verifies that the recipe belongs to a creator the user follows.
- The model may explain substitutions, but it does not mutate the pantry or follow list.
- Pantry tools expose normalized quantities and deterministic readiness results; the model does not estimate unverified amounts.
- The assistant may answer general cooking questions, but it clearly distinguishes general advice from facts retrieved from the user's followed recipes.
- Limit tool rounds, input history, output tokens, and messages per user per day.
- Send only the most recent bounded conversation window plus retrieved recipe context.
- Present allergy and food-safety advice conservatively and avoid claiming medical authority.

## 9. HTTP API

```text
GET    /api/me
PUT    /api/me

GET    /api/creators
POST   /api/creators              { url }
DELETE /api/creators/{creatorId}
POST   /api/creators/{creatorId}/check
GET    /api/creators/{creatorId}/status

GET    /api/recipes
GET    /api/recipes/{recipeId}
GET    /api/recipes/cook-now

GET    /api/pantry
PUT    /api/pantry                { ingredients: [{ name, quantity, unit }] }

POST   /api/chat                  { sessionId?, message }
GET    /api/chat/{sessionId}
DELETE /api/chat/{sessionId}
```

All endpoints except a health endpoint require Cognito authorization.

## 10. Reliability and cost controls required before launch

- AWS Budget with low thresholds and email alerts.
- CloudWatch alarms for API errors, extraction errors, queue age, and dead-letter messages.
- Structured JSON logs with request ID, user ID, creator ID, and source item ID where applicable.
- Reserved concurrency on extraction and agent Lambdas to cap spend.
- Initial import cap: 20 source posts per creator.
- Manual refresh cooldown: 15 minutes per creator.
- Agent daily message cap and per-response token cap.
- Maximum article input size before model invocation.
- DynamoDB point-in-time recovery may be enabled after verifying its cost/availability for the account.
- S3 Block Public Access enabled; CloudFront uses origin access control.
- Secrets such as Google client secret stored in Secrets Manager or deployment configuration, never in source control.

The AWS Free Tier must be treated as account-specific. Infrastructure can be very inexpensive at MVP volume, but Bedrock is metered and exact cost depends on the configured model and token counts. Do not describe the whole application as guaranteed `$0`.

## 11. Tomorrow build sequence

### Milestone 1 — deployable foundation

- TypeScript CDK app plus a `uv`-managed Python backend with locked dependencies
- S3, CloudFront, HTTP API, API Lambda
- DynamoDB tables
- SQS queue and dead-letter queue
- CloudWatch logs, alarms, and AWS Budget

Success: the SPA and authenticated health/profile request work in AWS.

### Milestone 2 — Google authentication

- Google OAuth client
- Cognito user pool, domain, app client, and Google IdP
- PKCE frontend flow
- protected API route

Success: sign in, reload, call `/api/me`, and sign out.

### Milestone 3 — Substack vertical slice

- add creator and validate RSS
- follow relationship
- discovery Lambda
- SQS extraction worker
- structured Bedrock extraction
- import status UI

Success: one public Substack becomes browsable recipes without duplicate extraction.

### Milestone 4 — pantry and Cook Now

- pantry editor
- ingredient normalization
- deterministic quantity-aware readiness ranking
- sufficient/insufficient/unknown/missing ingredient UI

Success: pantry amount edits immediately change recipe ordering, readiness, and explanations.

### Milestone 5 — assistant

- Bedrock Converse tool loop
- scoped recipe/pantry tools
- bounded chat persistence
- rate and token limits

Success: the assistant can recommend an accessible recipe and explain missing ingredients using only the user's followed creators.

### Milestone 6 — scheduled verification

- EventBridge Scheduler daily rule
- manual “Check now” path
- status timestamps and CloudWatch visibility

Success: the next run is observable even when no new post exists, and repeated discovery creates no duplicate source or recipe records.

## 12. Deferred work

- TikTok imports and creator monitoring
- video/audio download or transcription
- pantry OCR
- advanced full-text or semantic search
- WebSocket/streamed notifications
- recipe image ingestion
- sharing and social features
- OpenSearch, Redis, ECS, and multi-region infrastructure

These are not needed to validate the MVP and should not be provisioned yet.

## 13. Locked MVP defaults

- Extract every confidently identified recipe from a source post.
- Store pantry quantities and canonical units; bound the pantry to 500 entries.
- Ignore water, salt, and pepper in pantry readiness; treat oils as quantity-aware pantry ingredients.
- Never claim a recipe is cookable when required quantities are missing, insufficient, or not safely comparable.
- Keep canonical recipes read-only.
- Deploy primarily in `us-east-1`.
- Run daily discovery at 6:00 AM `America/New_York`.
- Permit general cooking guidance, clearly separated from retrieved recipe facts.
