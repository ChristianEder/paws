import { Construct, Tags, aws_s3 } from 'aws-cdk-lib';

export class SecureBucket extends Construct {

    public readonly bucket: aws_s3.Bucket;

    constructor(scope: Construct, id: string, props?: aws_s3.BucketProps) {
        super(scope, id);

        let newProps: aws_s3.BucketProps = { ...props };
        const encryption = newProps?.encryption;

        if (encryption === undefined || encryption === aws_s3.BucketEncryption.UNENCRYPTED) {
            // @ts-ignore TS2540
            newProps.encryption = BucketEncryption.KMS_MANAGED;
        }

        this.bucket = new aws_s3.Bucket(this, id, newProps);

        Tags.of(this).add('encrypted', 'true')
    }
}