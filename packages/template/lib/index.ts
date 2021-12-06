import { Construct, Tags } from '@aws-cdk/core';
import { Bucket, BucketEncryption, BucketProps } from '@aws-cdk/aws-s3'

export class SecureBucket extends Construct {

    public readonly bucket: Bucket;

    constructor(scope: Construct, id: string, props?: BucketProps) {
        super(scope, id);

        let newProps: BucketProps = { ...props };
        const encryption = newProps?.encryption;

        if (encryption === undefined || encryption === BucketEncryption.UNENCRYPTED) {
            // @ts-ignore TS2540
            newProps.encryption = BucketEncryption.KMS_MANAGED;
        }

        this.bucket = new Bucket(this, id, newProps);

        Tags.of(this).add('encrypted', 'true')
    }
}