import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib/core';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

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