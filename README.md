# Bite

Bite transforms long-form, story-heavy Substack cooking newsletters into a private, clean, and searchable digital recipe shelf.

Instead of hunting through inbox archives, scrolling past personal essays, or squinting at unformatted recipe text, Bite discovers posts from your favorite culinary writers, extracts only the culinary data with AI, and delivers an interactive cookbook built for cooking in the kitchen.

## What Bite Does

- **Newsletter Ingestion**: Follow any public Substack publication (e.g. `newsletter.substack.com`) to import its recipes.
- **AI-Powered Recipe Extraction**: Parses public article text with Amazon Bedrock to extract structured recipe data, including titles, descriptions, categorized ingredients, step-by-step instructions, prep and cook times, and servings.
- **Idempotent Discovery**: Computes deterministic SHA-256 identifiers across feeds, source articles, and recipes so content is extracted once and never duplicated.
- **Interactive Kitchen View**: View recipes in an interactive modal with checkable ingredient lists, step-by-step progress tracking, mobile tab switching between ingredients and method, and links to original posts.
- **Formatted Clipboard Export**: One-click recipe copy formatted specifically for quick reading, personal notes, and LLM prompts.
- **Browse and Search**: Filter your collection by creator or category, search across ingredients and titles, and navigate with directional page transitions.
- **Daily Automated Sync**: Runs on an EventBridge schedule at 6:00 AM America/New_York to discover and extract newly published recipes automatically.

## Planned Features (To-Do)

- **AI Cooking Chatbot**: Add a conversational cooking assistant that streams answers and allows users to ask questions about their saved recipes (e.g., ingredient substitutions, step clarifications, scaling, wine pairings, and pantry availability).

## Architecture

- **Frontend**: React 19 single-page app built with Vite, TypeScript, and Tailwind CSS.
- **Backend**: Python 3.12 AWS Lambda functions managed with `uv`.
- **Infrastructure**: AWS CDK in TypeScript targeting `us-east-1`.
- **Authentication**: Amazon Cognito User Pool with Google OAuth federation and PKCE.
- **Database**: Amazon DynamoDB storing creators, follows, source items, and extracted recipes.
- **Queueing & Async Workers**: Amazon SQS with a dead-letter queue (DLQ) and partial-batch failure reporting for robust extraction.
- **AI Model**: Amazon Bedrock Converse API with structured JSON output schema.
- **Scheduler**: Amazon EventBridge Scheduler for automated daily feed polling.

## Local Verification

Verify the entire repository locally before deployment:

```bash
# Backend checks (Python 3.12 via uv)
cd backend
uv sync --frozen
uv run ruff check src tests
uv run pytest -q

# Infrastructure checks (AWS CDK via npm)
cd ../infrastructure
npm ci
npm run build
npm test -- --runInBand

# Frontend checks (React + Vite via npm)
cd ../frontend
npm ci
npm run build
npm run lint
```

## Configure the Frontend

Copy `frontend/.env.example` to `frontend/.env` and provide the values from your CDK deployment outputs:

```dotenv
VITE_COGNITO_USER_POOL_ID=
VITE_COGNITO_USER_POOL_CLIENT_ID=
VITE_COGNITO_DOMAIN=
VITE_API_URL=
```

Google OAuth credentials must exist in AWS Secrets Manager as `bite/google-oauth` containing `clientId` and `clientSecret` JSON properties.

## Deployment Notes

Deploy in `us-east-1`, where the configured Amazon Bedrock model is available. The CDK deployment packages Lambda dependencies directly from `backend/uv.lock`.

To deploy with a hosted frontend URL:

```bash
cd infrastructure
npx cdk deploy -c frontendUrl=https://your-app.example.com
```

No AWS deployment is performed by local verification commands.
