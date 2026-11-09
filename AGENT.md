# Demo builder

You are the coding agent. The person chooses the industry, the company, the use case, and the story. You seed the Salesforce org this session is signed into, and you create a new Slack workspace for that story.

Use the industry they give you. The files `demos/education-advising.json` and `demos/healthcare-prior-auth.json` are sample briefs. They are not the default demo.

You do not connect Slack to Salesforce. That connection is Salesforce for Slack, Salesforce's native connector, and a person sets it up by hand for every new workspace. You do not deploy a flow, a named credential, or an HTTP callout to make records appear in Slack.

This is only installed on a Slack Enterprise Grid org. One install of the app in `slack/manifest.json` covers the org. That app creates workspaces. It does not post messages. Every demo is a new workspace.

Do not build a website. Do not build a Slack bot that replies to people. Do not reuse an existing workspace for a new story.

The human instructions are in `README.md`. Gate text is in `demos/manual-gates.json`. Build the plan with `scripts/plan.mjs`. This command shows the shape. Replace the sample values with the brief you were given:

```bash
node --input-type=module -e "
import { buildPlan } from './scripts/plan.mjs';
import { readFileSync } from 'node:fs';
const catalog = JSON.parse(readFileSync('demos/manual-gates.json','utf8'));
const spec = buildPlan({
  industry: 'Education',
  company: 'Northbridge Academy',
  useCase: 'An advisor picks up a student who waited two days for a course change.',
  beats: ['Northbridge Academy is the school account, and Maya Chen is the student.', 'A case opens for a course change.']
}, catalog);
console.log(JSON.stringify(spec, null, 2));
"
```

Northbridge Academy in that sample is fictional.

## Before any write

1. Identify the Salesforce org the session is signed into. That is the org you seed. A demo org is the usual choice. You do not keep a list of allowed or forbidden orgs.
2. Confirm the workspace app is installed on the Enterprise Grid org and granted to future workspaces. If it is not, print the `install-slack-app` gate and stop.
3. You need the org-admin user token in the agent's secret store. It calls `admin.teams.create`. If it is missing, print the `slack-token` gate and stop. Do not ask for a bot token to store in Salesforce.

## Intake

The person supplies the industry. Ask only for what the message left out: industry, use case, ordered beats, and the company name when the beats do not name the account. The beats are the demo story. They are not a Salesforce flow.

## New workspace

The plan names the workspace after the company and sets `team_domain` to the demo id, cut to 21 characters.

1. `admin.teams.create` with `team_name` and `team_domain` from the plan. Save the returned team id.
2. Stop. Do not call `chat.postMessage`. Do not invite a bot to post updates.

## Salesforce records

Map each beat:

| When the beat mentions | Create or update |
| --- | --- |
| account, customer, company, member, patient, payer, clinic, chart, school, student | Account |
| case, claim, ticket, prior auth, authorization, support, incident, stall | Case |
| opportunity, deal, pipeline, quote, renewal | Opportunity |

A beat that maps to none becomes a Case. Tag the Name or Subject, and the Description, with `[demo-builder:<id>]`. Use an Industry picklist value the org already has. Describe the object before you set one.

Account, Case, and Opportunity are the default when the story fits them. When a beat needs a new object or field, create it through the Salesforce MCP connection before you insert records. Do not use the Salesforce CLI. Do not create or edit Apex. If the story depends on Apex, say that this project does not do that and leave Apex out. If the MCP connection cannot create the object or field, print the `metadata` gate and stop.

## Hand off the connector

When the workspace and the records exist, print the `slack-salesforce` gate with the new workspace name. A person adds Salesforce for Slack to that workspace and connects it to the org you seeded. Do this handoff on every demo, even when the org was connected to an older workspace.

Do not deploy a flow to send the records. Do not create a named credential. The native connector is the integration.

## Save

Write `demos/<id>.json` with `salesforceIds` as `[]`. Write record ids and the Slack team id only to `demos/<id>.links.json`. That links file is gitignored.

## Never

- Add a slash command, an app home conversation, or a bot people talk to.
- Build a web app for the brief.
- Put the demo in a workspace that already existed.
- Call `chat.postMessage`, or deploy a flow, named credential, or HTTP callout, to publish records into Slack.
- Use the Salesforce CLI.
- Create or edit Apex.
- Put an org name, a host, a user, or a token from the person's own systems into a committed file.
