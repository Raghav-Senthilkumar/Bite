import * as cdk from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
import { InfrastructureStack } from '../lib/infrastructure-stack';

function createTemplate(): Template {
  const app = new cdk.App();
  const stack = new InfrastructureStack(app, 'TestStack');
  return Template.fromStack(stack);
}

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
