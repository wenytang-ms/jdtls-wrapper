## project setup

Add a .npmrc to your project, in the same directory as your package.json

```
registry=https://pkgs.dev.azure.com/mseng/_packaging/MS-International/npm/registry/              
always-auth=true
```

### Setup credentials

#### step 1
Copy the code below to your user [.npmrc](https://learn.microsoft.com/en-us/azure/devops/artifacts/npm/npmrc?view=azure-devops&tabs=windows).
```
; begin auth token
//pkgs.dev.azure.com/mseng/_packaging/MS-International/npm/registry/:username=mseng
//pkgs.dev.azure.com/mseng/_packaging/MS-International/npm/registry/:_password=[BASE64_ENCODED_PERSONAL_ACCESS_TOKEN]
//pkgs.dev.azure.com/mseng/_packaging/MS-International/npm/registry/:email=npm requires email to be set but doesn't use the value
//pkgs.dev.azure.com/mseng/_packaging/MS-International/npm/:username=mseng
//pkgs.dev.azure.com/mseng/_packaging/MS-International/npm/:_password=[BASE64_ENCODED_PERSONAL_ACCESS_TOKEN]
//pkgs.dev.azure.com/mseng/_packaging/MS-International/npm/:email=npm requires email to be set but doesn't use the value
; end auth token
```

#### step 2
Generate a Personal Access Token with Packaging read & write scopes.

#### step 3
Base64 encode the personal access token from Step 2.

One safe and secure method of Base64 encoding a string is to:

1. From a command/shell prompt run:
```bash
node -e "require('readline') .createInterface({input:process.stdin,output:process.stdout,historySize:0}) .question('PAT> ',p => { b64=Buffer.from(p.trim()).toString('base64');console.log(b64);process.exit(); })"
```
2. Paste your personal access token value and press Enter/Return
3. Copy the Base64 encoded value

#### step 4
Replace both [BASE64_ENCODED_PERSONAL_ACCESS_TOKEN] values in your user .npmrc file with your personal access token from Step 3.

## usage
Run the credential provider in the directory with your project's .npmrc configured with an Azure Artifacts feed:
`artifacts-npm-credprovider`

## Restore packages
Run this command in your project directory
```bash
npm install
```

## Publish packages

Run this command in your project directory

```bash
npm publish
```