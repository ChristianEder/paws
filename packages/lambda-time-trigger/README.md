# PAWS Lambda Time Trigger

This package makes it easy to trigger Lambda functions more often than once a minute - the default service to trigger Lambdas periodically, EventBridge rules, will only allow to define schedules down to a resolution of 1 minute.

Using the PAWS Lambda Time Trigger package, you can define schedules with a resolution down to 1 second.

The PAWS Lambda Time Trigger package will, on top of any resources you create, including the Lambda function to be triggered on a schedule, create:

- An AWS Step Function running the sub-minute schedule you defined by waiting between invokes of your target Lambda
- An EventBrige rule triggering the AWS step function based on the rest of the schedule you define as a CRON expression

If you specify a CRON schedule without the `second` field being set, or with it being set to 0, the `TimeTrigger` will just create a plain EventBridge rule with that schedule triggering your Lambda directly, without the AWS Step Function in between.

## Basic usage

### TypeScript / JavaScript

```typescript
const timeTrigger = new TimeTrigger(this, 'time-trigger', {
  schedule: {
    cron: {
      second: '0-19/5,20-59/20', // Triggers at seconds 0, 5, 10, 15, 20 and 40 of every minute...
      hour: '9-17' // ... of every hour between 9 and 17 each day
    },
  },
});

yourLambdaFunction.addEventSource(timeTrigger);
```

## Known limitations

### Lambda execution time

As of now, the AWS Step Function does not take the time required to execute the scheduled Lambda into account. In other words: if you schedule your Lambda with a TimeTrigger to be executed every 10 seconds (`second:'*/10'`), but your scheduled Lambda takes 1 second to run, you will see the following behavior:

- The AWS Step function will be triggered every minute (unless you specified another schedule)
- The AWS Step function will run your Lambda on...
  - Second 0, taking 1 second to complete, then waiting 10 seconds
  - Second 11, taking 1 second to complete, then waiting 10 seconds
  - Second 22, taking 1 second to complete, then waiting 10 seconds
  - Second 33, taking 1 second to complete, then waiting 10 seconds
  - Second 44, taking 1 second to complete, then waiting 10 seconds
  - Second 55, taking 1 second to complete, then finishing
