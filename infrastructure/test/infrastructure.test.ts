import * as cdk from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
import { InfrastructureStack } from '../lib/infrastructure-stack';

function createTemplate(): Template {
  const app = new cdk.App({ context: { skipBundling: true } });
  const stack = new InfrastructureStack(app, 'TestStack');
  return Template.fromStack(stack);
}

test('creates the extraction queue, DLQ, and partial batch worker', () => {
  const template = createTemplate();

  template.resourceCountIs('AWS::SQS::Queue', 2);
  template.hasResourceProperties('AWS::SQS::Queue', {
    RedrivePolicy: {
      maxReceiveCount: 3,
    },
  });
  template.hasResourceProperties('AWS::Lambda::Function', {
    Handler: 'bite_backend.extraction.handler',
    Architectures: ['x86_64'],
    Timeout: 90,
    Environment: {
      Variables: {
        BEDROCK_MODEL_ID: 'zai.glm-4.7-flash',
      },
    },
  });
  template.hasResourceProperties('AWS::Lambda::EventSourceMapping', {
    BatchSize: 5,
    FunctionResponseTypes: ['ReportBatchItemFailures'],
    ScalingConfig: {
      MaximumConcurrency: 2,
    },
  });
});

test('runs discovery daily at 6 AM America New York', () => {
  const template = createTemplate();

  template.hasResourceProperties('AWS::Scheduler::Schedule', {
    ScheduleExpression: 'cron(0 6 * * ? *)',
    ScheduleExpressionTimezone: 'America/New_York',
  });
});

test('protects application routes with a JWT authorizer', () => {
  const template = createTemplate();

  template.hasResourceProperties('AWS::ApiGatewayV2::Authorizer', {
    AuthorizerType: 'JWT',
    IdentitySource: ['$request.header.Authorization'],
  });
  template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
    RouteKey: 'POST /api/creators',
    AuthorizationType: 'JWT',
  });
  template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
    RouteKey: 'GET /api/recipes',
    AuthorizationType: 'JWT',
  });
});

test('creates the public health endpoint', () => {
  const template = createTemplate();

  template.hasResourceProperties('AWS::Lambda::Function', {
    Handler: 'bite_backend.health.handler',
    Runtime: 'python3.12',
  });

  template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
    RouteKey: 'GET /api/health',
  });
});

test('creates Google OAuth authentication for the web app', () => {
  const template = createTemplate();

  template.hasResourceProperties('AWS::Cognito::UserPool', {
    UserPoolName: 'bite-users',
    AdminCreateUserConfig: {
      AllowAdminCreateUserOnly: true,
    },
  });

  template.hasResourceProperties('AWS::Cognito::UserPoolIdentityProvider', {
    ProviderName: 'Google',
    ProviderType: 'Google',
    ProviderDetails: {
      authorize_scopes: 'openid email profile',
    },
    AttributeMapping: {
      email: 'email',
      email_verified: 'email_verified',
      given_name: 'given_name',
      family_name: 'family_name',
      picture: 'picture',
    },
  });

  template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
    ClientName: 'bite-web',
    GenerateSecret: false,
    AllowedOAuthFlows: ['code'],
    AllowedOAuthFlowsUserPoolClient: true,
    AllowedOAuthScopes: ['openid', 'email', 'profile'],
    CallbackURLs: ['http://localhost:5173/auth/callback'],
    LogoutURLs: ['http://localhost:5173/'],
    SupportedIdentityProviders: ['Google'],
  });

  template.resourceCountIs('AWS::Cognito::UserPoolDomain', 1);
  template.hasOutput('CognitoDomainUrl', {});
});

test('creates all six retained on-demand tables', () => {
  const template = createTemplate();
  const tables = template.findResources('AWS::DynamoDB::Table');

  expect(Object.keys(tables)).toHaveLength(6);
  for (const table of Object.values(tables)) {
    expect(table.Properties.BillingMode).toBe('PAY_PER_REQUEST');
    expect(table.DeletionPolicy).toBe('Retain');
    expect(table.UpdateReplacePolicy).toBe('Retain');
  }
});

test('creates the users and creators tables with simple primary keys', () => {
  const template = createTemplate();

  template.hasResourceProperties('AWS::DynamoDB::Table', {
    KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'userId', AttributeType: 'S' }],
  });

  template.hasResourceProperties('AWS::DynamoDB::Table', {
    KeySchema: [{ AttributeName: 'creatorId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'creatorId', AttributeType: 'S' }],
  });
});

test('creates the follows table with its reverse lookup index', () => {
  const template = createTemplate();

  template.hasResourceProperties('AWS::DynamoDB::Table', {
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'creatorId', KeyType: 'RANGE' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'creatorId-userId-index',
        KeySchema: [
          { AttributeName: 'creatorId', KeyType: 'HASH' },
          { AttributeName: 'userId', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  });
});

test('creates source item and recipe creator-date indexes', () => {
  const template = createTemplate();

  for (const primaryKey of ['sourceItemId', 'recipeId']) {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      KeySchema: [{ AttributeName: primaryKey, KeyType: 'HASH' }],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'creatorId-publishedAt-index',
          KeySchema: [
            { AttributeName: 'creatorId', KeyType: 'HASH' },
            { AttributeName: 'publishedAt', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
    });
  }
});

test('creates the chat messages table with TTL and user activity index', () => {
  const template = createTemplate();

  template.hasResourceProperties('AWS::DynamoDB::Table', {
    KeySchema: [
      { AttributeName: 'sessionId', KeyType: 'HASH' },
      { AttributeName: 'messageKey', KeyType: 'RANGE' },
    ],
    TimeToLiveSpecification: {
      AttributeName: 'expiresAt',
      Enabled: true,
    },
    GlobalSecondaryIndexes: [
      {
        IndexName: 'userId-updatedAt-index',
        KeySchema: [
          { AttributeName: 'userId', KeyType: 'HASH' },
          { AttributeName: 'updatedAt', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  });
});
