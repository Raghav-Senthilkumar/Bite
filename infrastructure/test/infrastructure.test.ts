import * as cdk from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
import { InfrastructureStack } from '../lib/infrastructure-stack';

test('creates the public health endpoint', () => {
  const app = new cdk.App();
  const stack = new InfrastructureStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::Lambda::Function', {
    Handler: 'bite_backend.health.handler',
    Runtime: 'python3.12',
  });

  template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
    RouteKey: 'GET /api/health',
  });
});