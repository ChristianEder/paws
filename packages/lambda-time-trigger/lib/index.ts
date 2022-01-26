import { Construct } from 'constructs';
import { Duration, aws_lambda, aws_stepfunctions, aws_stepfunctions_tasks, aws_events, aws_events_targets } from 'aws-cdk-lib';
import * as cron from 'cron-parser';

/**
 * Defines a cron expression
 */
export interface CronOptionsWithSeconds extends aws_events.CronOptions {
    /**
     * The second to run the Lambda at.
     *
     * @default - At the first second of every minute
     */
    readonly second?: string;
}

/** Defines the schedule for a time trigger */
export interface TimeTriggerSchedule {
    /** Set this to define the schedule using a cron expression. As of now, this is the only supported option */
    readonly cron: CronOptionsWithSeconds;
}

export interface IRulePropsTransform {
    (ruleProps: aws_events.RuleProps): aws_events.RuleProps;
}

export interface IStateMachinePropsTransform {
    (stateMachine: aws_stepfunctions.StateMachineProps): aws_stepfunctions.StateMachineProps;
}

/** Defines an optional set of transforms to apply to the props of resources created by the TimeTrigger */
export interface TimeTriggerTransforms {
    /** Allows to override props for the EventBridge rule triggering the Lambda or Step Function */
    readonly triggerRule?: IRulePropsTransform;
    /** Allows to override props for the Step Function satte machine */
    readonly stateMachine?: IStateMachinePropsTransform;
}

export interface TimeTriggerProps {
    /** Defines the schedule for a time trigger */
    readonly schedule: TimeTriggerSchedule;

    /** Defines an optional set of transforms to apply to the props of resources created by the TimeTrigger */
    readonly transforms?: TimeTriggerTransforms;
}

export class TimeTrigger extends Construct implements aws_lambda.IEventSource {
    constructor(scope: Construct, private id: string, private props: TimeTriggerProps) {
        super(scope, id);
    }

    bind(target: aws_lambda.IFunction): void {
        const scopedId = this.id + '-' + target.node.id;

        const { second, ...restOfCronSchedule } = this.props.schedule.cron;
        const secondOfCronSchedule = (second === null || second === undefined) ? '0' : second;

        if (secondOfCronSchedule === '0') {
            // In this case, we don't need a trigger queue, a plain old regular EventBridge rule will do the job,
            // Because no sub-minute trigger intervals are required.

            // To be discussed: 
            //   How to handle non-zero values which still boil down to only 1 execution per minute, so every value that is just a single number
            //   It might be better to also just ignore the value in this case, since EventBridge anyway doesn't guarantuee execution on the first second of any minute,
            //   so our queue-based solution anyway doesn't guarantuee absolute execution times, but only relative to the EventBridge execution time.

            // @ts-ignore this local is unused but since this is a CDK construct, its still required since the constructor call has side effects
            const defaultScheduleRule = new events.Rule(this, scopedId + '-trigger-rule', this.transformProps({
                enabled: true,
                targets: [new aws_events_targets.LambdaFunction(target)],
                schedule: aws_events.Schedule.cron(restOfCronSchedule)
            }, this.props.transforms?.triggerRule));

            return;
        }

        const cronSchedule = cron.parseExpression(secondOfCronSchedule + ' * * * * *');

        // TODO: Account for the time it takes to invoke the Lambda. Possible solutions that come to mind (not sure which are possible)
        //       - Measure the time the invoke took, substract from next wait
        //       - Invoke without waiting for finishing
        //       - Instead of invoking directly, send message to a queue and trigger the Lambda with that

        const wait = new aws_stepfunctions.Wait(this, scopedId + '-wait', {
            time: aws_stepfunctions.WaitTime.secondsPath('$')
        });

        const invoke = new aws_stepfunctions_tasks.LambdaInvoke(this, scopedId + '-invoke', {
            lambdaFunction: target,
            payload: aws_stepfunctions.TaskInput.fromObject({})
        });

        const waitThenInvoke = new aws_stepfunctions.Choice(this, scopedId + '-waitinvoke')
            .when(aws_stepfunctions.Condition.numberGreaterThan('$', 0), wait.next(invoke))
            .otherwise(invoke);

        const seconds: number[] = [];
        cronSchedule.fields.second.forEach(s => {
            if (seconds.length === 0 || s !== seconds[seconds.length - 1]) {
                seconds.push(s);
            }
        });
        const createLoopItems = new aws_stepfunctions.Pass(this, scopedId + '-loopitems', {
            result: aws_stepfunctions.Result.fromArray(seconds.map((s, i) => i === 0 ? s : (s - seconds[i - 1])))
        });

        const loop = new aws_stepfunctions.Map(this, scopedId + '-loop', {
            itemsPath: '$',
            maxConcurrency: 1,
        }).iterator(waitThenInvoke);

        const stateMachine = createLoopItems.next(loop);

        const triggerFunction = new aws_stepfunctions.StateMachine(this, scopedId + '-trigger-function', this.transformProps({
            stateMachineType: aws_stepfunctions.StateMachineType.EXPRESS,
            timeout: Duration.seconds(90),
            definition: stateMachine
        }, this.props.transforms?.stateMachine));

        // @ts-ignore this local is unused but since this is a CDK construct, its still required since the constructor call has side effects
        const triggerScheduleRule = new events.Rule(this, scopedId + 'trigger-rule', this.transformProps({
            enabled: true,
            targets: [new aws_events_targets.SfnStateMachine(triggerFunction)],
            schedule: aws_events.Schedule.cron(restOfCronSchedule)
        }, this.props.transforms?.triggerRule));
    }

    private transformProps<T>(props: T, transform?: (p: T) => T): T {
        return transform ? transform(props) : props;
    }
}