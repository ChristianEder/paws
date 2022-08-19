import { Stack, StackProps, Duration, aws_ecs, aws_ecs_patterns, aws_route53, aws_route53_targets, aws_certificatemanager, aws_cloudwatch, aws_cloudwatch_actions, aws_sns, aws_sns_subscriptions, RemovalPolicy } from 'aws-cdk-lib';
import { CachePolicy, CloudFrontWebDistribution, Distribution, OriginAccessIdentity, OriginProtocolPolicy, SecurityPolicyProtocol, SSLMethod } from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { Bucket, BucketAccessControl } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export class StaticWebsiteS3Stack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const bucket = new Bucket(this, 'website', {
      publicReadAccess: true,
      removalPolicy: RemovalPolicy.DESTROY,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html'
    });

    const deployment = new BucketDeployment(this, "website-deployment", {
      sources: [
        Source.asset('website')
      ],
      destinationBucket: bucket
    });

    const originAccessIdentity = new OriginAccessIdentity(this, 'OriginAccessIdentity');
    bucket.grantRead(originAccessIdentity);

    const hostedZone = aws_route53.HostedZone.fromLookup(this, 'website-hosted-zone', {
      domainName: 'z-iot-starter-kit.click'
    });
    
    const certificate = new aws_certificatemanager.DnsValidatedCertificate(this, 'website-certificate', {
      domainName: 'z-iot-starter-kit.click',
      hostedZone: hostedZone,
      region: 'us-east-1'
    });

    const distribution = new Distribution(this, 'website-distribution', {
      defaultRootObject: 'index.html',
      domainNames: ['z-iot-starter-kit.click'],
      certificate: certificate,
      defaultBehavior: {
        cachePolicy: new CachePolicy(this, 'website-caching', {
          defaultTtl: Duration.minutes(1)
        }),
        origin: new S3Origin(bucket, { originAccessIdentity }),
      },
    });

    new aws_route53.ARecord(this, 'some-a-record', {
      zone: hostedZone,
      target: aws_route53.RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
      ttl: Duration.minutes(1),
    });
  }
}
