using Amazon.CDK;
using Amazon.CDK.AWS.S3;

namespace DotnetTemplateUsage
{
    public class DotnetTemplateUsageStack : Stack
    {
        internal DotnetTemplateUsageStack(Construct scope, string id, IStackProps props = null) : base(scope, id, props)
        {
            new Paws.template.SecureBucket(this, "secure-bucket", new BucketProps { });
        }
    }
}
