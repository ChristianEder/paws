import { Stack, StackProps, Duration, aws_ecs, aws_ecs_patterns, aws_route53, aws_route53_targets, aws_certificatemanager, aws_cloudwatch, aws_cloudwatch_actions, aws_sns, aws_sns_subscriptions, RemovalPolicy } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
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


    // const hostedZone = aws_route53.HostedZone.fromLookup(this, 'some-zone', {
    //   domainName: 'z-iot-starter-kit.click'
    // });

    // const certificate = new aws_certificatemanager.Certificate(this, 'some-certificate-dev', {
    //   domainName: 'dev.z-iot-starter-kit.click',
    //   validation: aws_certificatemanager.CertificateValidation.fromDns(hostedZone)
    // });


    // new aws_route53.ARecord(this, 'some-a-record', {
    //   recordName: 'dev',
    //   zone: hostedZone,
    //   target: aws_route53.RecordTarget.fromAlias(new aws_route53_targets.LoadBalancerTarget(service.loadBalancer)),
    //   ttl: Duration.minutes(1)
    // });
  }
}
