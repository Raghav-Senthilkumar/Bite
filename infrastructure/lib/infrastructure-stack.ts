import * as path from 'node:path';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as cdk from 'aws-cdk-lib/core';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as eventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import * as schedulerTargets from 'aws-cdk-lib/aws-scheduler-targets';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const frontendUrl = this.node.tryGetContext('frontendUrl') ?? 'http://localhost:5173';
    const backendPath = path.join(__dirname, '../../backend');
    const skipBundling = this.node.tryGetContext('skipBundling') === true;
    const sourceCode = lambda.Code.fromAsset(path.join(backendPath, 'src'));
    const extractionCode = skipBundling
      ? sourceCode
      : lambda.Code.fromAsset(backendPath, {
          exclude: ['.venv', '.pytest_cache', '.ruff_cache', 'tests'],
          bundling: {
            image: lambda.Runtime.PYTHON_3_12.bundlingImage,
            platform: 'linux/amd64',
            command: [
              'bash',
              '-c',
              [
                'pip install --no-cache-dir -r /asset-input/requirements.lambda.txt -t /asset-output',
                'cp -r /asset-input/src/bite_backend /asset-output/',
              ].join(' && '),
            ],
          },
        });

    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'bite-users',
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        givenName: { required: false, mutable: true },
        familyName: { required: false, mutable: true },
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const googleCredentials = secretsmanager.Secret.fromSecretNameV2(
      this,
      'GoogleOAuthCredentials',
      'bite/google-oauth',
    );
    const googleProvider = new cognito.UserPoolIdentityProviderGoogle(
      this,
      'GoogleIdentityProvider',
      {
        userPool,
        clientId: googleCredentials.secretValueFromJson('clientId').unsafeUnwrap(),
        clientSecretValue: googleCredentials.secretValueFromJson('clientSecret'),
        scopes: ['openid', 'email', 'profile'],
        attributeMapping: {
          email: cognito.ProviderAttribute.GOOGLE_EMAIL,
          emailVerified: cognito.ProviderAttribute.GOOGLE_EMAIL_VERIFIED,
          givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
          familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
          profilePicture: cognito.ProviderAttribute.GOOGLE_PICTURE,
        },
      },
    );

    const userPoolClient = userPool.addClient('WebClient', {
      userPoolClientName: 'bite-web',
      generateSecret: false,
      preventUserExistenceErrors: true,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [`${frontendUrl}/auth/callback`],
        logoutUrls: [`${frontendUrl}/`],
      },
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.GOOGLE],
    });
    userPoolClient.node.addDependency(googleProvider);

    const userPoolDomain = userPool.addDomain('UserPoolDomain', {
      cognitoDomain: { domainPrefix: `bite-${cdk.Aws.ACCOUNT_ID}` },
    });

    const tableDefaults = {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    };
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      ...tableDefaults,
    });
    const creatorsTable = new dynamodb.Table(this, 'CreatorsTable', {
      partitionKey: { name: 'creatorId', type: dynamodb.AttributeType.STRING },
      ...tableDefaults,
    });
    const followsTable = new dynamodb.Table(this, 'FollowsTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'creatorId', type: dynamodb.AttributeType.STRING },
      ...tableDefaults,
    });
    followsTable.addGlobalSecondaryIndex({
      indexName: 'creatorId-userId-index',
      partitionKey: { name: 'creatorId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const sourceItemsTable = new dynamodb.Table(this, 'SourceItemsTable', {
      partitionKey: { name: 'sourceItemId', type: dynamodb.AttributeType.STRING },
      ...tableDefaults,
    });
    sourceItemsTable.addGlobalSecondaryIndex({
      indexName: 'creatorId-publishedAt-index',
      partitionKey: { name: 'creatorId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'publishedAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const recipesTable = new dynamodb.Table(this, 'RecipesTable', {
      partitionKey: { name: 'recipeId', type: dynamodb.AttributeType.STRING },
      ...tableDefaults,
    });
    recipesTable.addGlobalSecondaryIndex({
      indexName: 'creatorId-publishedAt-index',
      partitionKey: { name: 'creatorId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'publishedAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const chatMessagesTable = new dynamodb.Table(this, 'ChatMessagesTable', {
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'messageKey', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'expiresAt',
      ...tableDefaults,
    });
    chatMessagesTable.addGlobalSecondaryIndex({
      indexName: 'userId-updatedAt-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'updatedAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const deadLetterQueue = new sqs.Queue(this, 'ExtractionDeadLetterQueue', {
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });
    const extractionQueue = new sqs.Queue(this, 'ExtractionQueue', {
      visibilityTimeout: cdk.Duration.minutes(10),
      retentionPeriod: cdk.Duration.days(4),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      deadLetterQueue: { queue: deadLetterQueue, maxReceiveCount: 3 },
    });

    const commonEnvironment = {
      CREATORS_TABLE: creatorsTable.tableName,
      SOURCE_ITEMS_TABLE: sourceItemsTable.tableName,
      RECIPES_TABLE: recipesTable.tableName,
    };
    const discoveryFunction = new lambda.Function(this, 'DiscoveryFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'bite_backend.discovery.handler',
      code: sourceCode,
      memorySize: 256,
      timeout: cdk.Duration.seconds(60),
      environment: {
        ...commonEnvironment,
        EXTRACTION_QUEUE_URL: extractionQueue.queueUrl,
        INITIAL_IMPORT_LIMIT: '20',
      },
    });
    creatorsTable.grantReadWriteData(discoveryFunction);
    sourceItemsTable.grantReadWriteData(discoveryFunction);
    extractionQueue.grantSendMessages(discoveryFunction);

    const extractionFunction = new lambda.Function(this, 'ExtractionFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      architecture: lambda.Architecture.X86_64,
      handler: 'bite_backend.extraction.handler',
      code: extractionCode,
      memorySize: 512,
      timeout: cdk.Duration.seconds(90),
      environment: {
        ...commonEnvironment,
        BEDROCK_MODEL_ID: 'zai.glm-4.7-flash',
      },
    });
    sourceItemsTable.grantReadWriteData(extractionFunction);
    recipesTable.grantWriteData(extractionFunction);
    extractionFunction.addToRolePolicy(
      new iam.PolicyStatement({ actions: ['bedrock:InvokeModel'], resources: ['*'] }),
    );
    extractionFunction.addEventSource(
      new eventSources.SqsEventSource(extractionQueue, {
        batchSize: 5,
        maxConcurrency: 2,
        reportBatchItemFailures: true,
      }),
    );

    new scheduler.Schedule(this, 'DailyDiscoverySchedule', {
      description: 'Check active Substack publications every day at 6:00 AM Eastern.',
      schedule: scheduler.ScheduleExpression.cron({
        minute: '0',
        hour: '6',
        timeZone: cdk.TimeZone.AMERICA_NEW_YORK,
      }),
      target: new schedulerTargets.LambdaInvoke(discoveryFunction, {
        input: scheduler.ScheduleTargetInput.fromObject({ scheduled: true }),
      }),
    });

    const apiFunction = new lambda.Function(this, 'ApiFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'bite_backend.api.handler',
      code: sourceCode,
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        USERS_TABLE: usersTable.tableName,
        FOLLOWS_TABLE: followsTable.tableName,
        DISCOVERY_FUNCTION_NAME: discoveryFunction.functionName,
        ...commonEnvironment,
      },
    });
    usersTable.grantReadWriteData(apiFunction);
    creatorsTable.grantReadWriteData(apiFunction);
    followsTable.grantReadWriteData(apiFunction);
    sourceItemsTable.grantReadData(apiFunction);
    recipesTable.grantReadData(apiFunction);
    discoveryFunction.grantInvoke(apiFunction);

    const healthFunction = new lambda.Function(this, 'HealthFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'bite_backend.health.handler',
      code: sourceCode,
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
    });

    const api = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: 'bite-api',
      corsPreflight: {
        allowOrigins: [frontendUrl],
        allowHeaders: ['authorization', 'content-type'],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.DELETE,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
      },
    });
    api.addRoutes({
      path: '/api/health',
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('HealthIntegration', healthFunction),
    });

    const jwtAuthorizer = new authorizers.HttpJwtAuthorizer(
      'CognitoAuthorizer',
      `https://cognito-idp.${this.region}.${cdk.Aws.URL_SUFFIX}/${userPool.userPoolId}`,
      { jwtAudience: [userPoolClient.userPoolClientId] },
    );
    const apiIntegration = new integrations.HttpLambdaIntegration('ApiIntegration', apiFunction);
    const protectedRoutes: Array<[string, apigwv2.HttpMethod[]]> = [
      ['/api/me', [apigwv2.HttpMethod.GET]],
      ['/api/creators', [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST]],
      ['/api/creators/{creatorId}', [apigwv2.HttpMethod.DELETE]],
      ['/api/creators/{creatorId}/check', [apigwv2.HttpMethod.POST]],
      ['/api/recipes', [apigwv2.HttpMethod.GET]],
      ['/api/recipe-image', [apigwv2.HttpMethod.GET]],
      ['/api/recipes/{recipeId}', [apigwv2.HttpMethod.GET]],
    ];
    for (const [routePath, methods] of protectedRoutes) {
      api.addRoutes({
        path: routePath,
        methods,
        integration: apiIntegration,
        authorizer: jwtAuthorizer,
      });
    }

    new cloudwatch.Alarm(this, 'DeadLetterQueueAlarm', {
      metric: deadLetterQueue.metricApproximateNumberOfMessagesVisible(),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    });

    new cdk.CfnOutput(this, 'ApiUrl', { value: api.apiEndpoint });
    new cdk.CfnOutput(this, 'CognitoUserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'CognitoUserPoolClientId', {
      value: userPoolClient.userPoolClientId,
    });
    new cdk.CfnOutput(this, 'CognitoDomainUrl', { value: userPoolDomain.baseUrl() });
  }
}
