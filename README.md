# PAWS - Patterns for AWS

The PAWS library contains a set of reusable [level 3 constructs](https://docs.aws.amazon.com/cdk/latest/guide/constructs.html#constructs_lib) implemented in TypeScript using the AWS CDK, and published for all [JSII](https://github.com/aws/jsii)-supported ecosystems.

## Prerequisites

- VS Code with devcontainer extension
- Docker
- WSL / Linux

## How to create a new package

- Copy the `packages/template` folder and override all usages of the word `template` with the desired name of the package.
- Add dependendies to `devDependencies` and `peerDependencies` as done in [package.json](packages/template/package.json)
- Implement the package like done in [index.ts](packages/template/lib/index.ts)

## How to build a package

- Open the packages template folder inside a `devcontainer`-VS Code instance
- Run `npm i`, `npm run build` and `npm run package`
- TODO: find out if its supposed to publish the generated JSII package for JS, or better directiony publish the source package

## How to test package creation

- TODO: explain creation of sample project e.g. in .NET

## How to publish a package

- TODO instructions for publishing manually and / or reference GH actions script