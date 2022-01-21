import { Construct } from '@aws-cdk/core';
import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as events from '@aws-cdk/aws-events';
import * as eventTargets from '@aws-cdk/aws-events-targets';
import * as stepfunctions from '@aws-cdk/aws-stepfunctions';
import * as tasks from '@aws-cdk/aws-stepfunctions-tasks';
import * as cron from 'cron-parser';

/**
 * Defines a cron expression
 */
export interface CronOptionsWithSeconds extends events.CronOptions {
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

/** Defines an optional set of transforms to apply to the props of resources created by the TimeTrigger */
export interface TimeTriggerTransforms {
    /** Allows to override props for the EventBridge rule triggering the Lambda or Step Function */
    readonly triggerRule?: (ruleProps: events.RuleProps) => events.RuleProps;
    /** Allows to override props for the Step Function satte machine */
    readonly stateMachine?: (stateMachine: stepfunctions.StateMachineProps) => stepfunctions.StateMachineProps;
}

export interface TimeTriggerProps {
    /** Defines the schedule for a time trigger */
    readonly schedule: TimeTriggerSchedule;

    /** Defines an optional set of transforms to apply to the props of resources created by the TimeTrigger */
    readonly transforms?: TimeTriggerTransforms;
}

export class TimeTrigger extends Construct implements lambda.IEventSource {
    constructor(scope: Construct, private id: string, private props: TimeTriggerProps) {
        super(scope, id);
    }

    bind(target: lambda.IFunction): void {
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

            const defaultScheduleRule = new events.Rule(this, scopedId + '-trigger-rule', this.transformProps({
                enabled: true,
                targets: [new eventTargets.LambdaFunction(target)],
                schedule: events.Schedule.cron(restOfCronSchedule)
            }, this.props.transforms?.triggerRule));

            return;
        }

        const cronSchedule = cron.parseExpression(secondOfCronSchedule + ' * * * * *');

        // TODO: Account for the time it takes to invoke the Lambda. Possible solutions that come to mind (not sure which are possible)
        //       - Measure the time the invoke took, substract from next wait
        //       - Invoke without waiting for finishing
        //       - Instead of invoking directly, send message to a queue and trigger the Lambda with that

        const wait = new stepfunctions.Wait(this as any, scopedId + '-wait', {
            time: stepfunctions.WaitTime.secondsPath('$')
        });

        const invoke = new tasks.LambdaInvoke(this as any, scopedId + '-invoke', {
            lambdaFunction: target,
            payload: stepfunctions.TaskInput.fromObject({})
        });

        const waitThenInvoke = new stepfunctions.Choice(this as any, scopedId + '-waitinvoke')
            .when(stepfunctions.Condition.numberGreaterThan('$', 0), wait.next(invoke))
            .otherwise(invoke);

        const seconds: number[] = [];
        cronSchedule.fields.second.forEach(s => {
            if (seconds.length === 0 || s !== seconds[seconds.length - 1]) {
                seconds.push(s);
            }
        });
        const createLoopItems = new stepfunctions.Pass(this as any, scopedId + '-loopitems', {
            result: stepfunctions.Result.fromArray(seconds.map((s, i) => i === 0 ? s : (s - seconds[i - 1])))
        });

        const loop = new stepfunctions.Map(this as any, scopedId + '-loop', {
            itemsPath: '$',
            maxConcurrency: 1,
        }).iterator(waitThenInvoke);

        const stateMachine = createLoopItems.next(loop);

        const triggerFunction = new stepfunctions.StateMachine(this as any, scopedId + '-trigger-function', this.transformProps({
            stateMachineType: stepfunctions.StateMachineType.EXPRESS,
            timeout: cdk.Duration.seconds(90),
            definition: stateMachine
        }, this.props.transforms?.stateMachine));

        const triggerScheduleRule = new events.Rule(this, scopedId + 'trigger-rule', this.transformProps({
            enabled: true,
            targets: [new eventTargets.SfnStateMachine(triggerFunction)],
            schedule: events.Schedule.cron(restOfCronSchedule)
        }, this.props.transforms?.triggerRule));
    }

    private transformProps<T>(props: T, transform?: (p: T) => T): T {
        return transform ? transform(props) : props;
    }
}