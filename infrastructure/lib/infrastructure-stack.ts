import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib/core';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const creatorsTable = new dynamodb.Table(this, 'CreatorsTable', {
      partitionKey: {
        name: 'creatorId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const followsTable = new dynamodb.Table(this, 'FollowsTable', {
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'creatorId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    followsTable.addGlobalSecondaryIndex({
      indexName: 'creatorId-userId-index',
      partitionKey: {
        name: 'creatorId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const sourceItemsTable = new dynamodb.Table(this, 'SourceItemsTable', {
      partitionKey: {
        name: 'sourceItemId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    sourceItemsTable.addGlobalSecondaryIndex({
      indexName: 'creatorId-publishedAt-index',
      partitionKey: {
        name: 'creatorId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'publishedAt',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const recipesTable = new dynamodb.Table(this, 'RecipesTable', {
      partitionKey: {
        name: 'recipeId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    recipesTable.addGlobalSecondaryIndex({
      indexName: 'creatorId-publishedAt-index',
      partitionKey: {
        name: 'creatorId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'publishedAt',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const chatMessagesTable = new dynamodb.Table(this, 'ChatMessagesTable', {
      partitionKey: {
        name: 'sessionId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'messageKey',
        type: dynamodb.AttributeType.STRING,
      },
      timeToLiveAttribute: 'expiresAt',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    chatMessagesTable.addGlobalSecondaryIndex({
      indexName: 'userId-updatedAt-index',
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'updatedAt',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const healthFunction = new lambda.Function(this, 'HealthFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'bite_backend.health.handler',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../../backend/src'),
      ),
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
    });

    const api = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: 'bite-api',
    });

    const healthIntegration = new integrations.HttpLambdaIntegration(
      'HealthIntegration',
      healthFunction,
    );

    api.addRoutes({
      path: '/api/health',
      methods: [apigwv2.HttpMethod.GET],
      integration: healthIntegration,
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.apiEndpoint,
    });
  }
}
