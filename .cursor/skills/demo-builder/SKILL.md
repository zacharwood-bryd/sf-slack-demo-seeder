---
name: demo-builder
description: >-
  Build a Salesforce demo and publish its changes into Slack. Use when someone
  gives an industry, a use case, and a flow and wants a coding agent to seed
  the demo org and land the updates in Slack automatically. The Slack app is a
  publisher, not a bot people talk to. Refuse production orgs.
---

# Demo builder

You are the coding agent. The person gives you an industry, a use case, and the flow. You seed the Salesforce demo org and wire a record-triggered flow so later changes show up in Slack on their own.

Do not build a website. Do not build a Slack bot that replies to people. The Slack app in `slack/manifest.json` only posts messages.

The human instructions are in `README.md`. Gate text is in `demos/manual-gates.json`. Build the plan with `scripts/plan.mjs` instead of inventing a second split:

```bash
node --input-type=module -e "
import { buildPlan } from './scripts/plan.mjs';
import { readFileSync } from 'node:fs';
const catalog = JSON.parse(readFileSync('demos/manual-gates.json','utf8'));
const org = JSON.parse(readFileSync('demos/org.local.json','utf8'));
const spec = buildPlan({
  industry: 'Education',
  company: 'Northbridge Academy',
  useCase: 'An advisor picks up a student who waited two days for a course change.',
  beats: ['Northbridge Academy is the school account, and Maya Chen is the student.', 'A case opens for a course change.']
}, catalog, { enterpriseGrid: org.slack.enterpriseGrid });
console.log(JSON.stringify(spec, null, 2));
"
```

`demos/education-advising.json` is that brief already planned for a single Slack workspace. Northbridge Academy is fictional.

## Before any write

1. Read `demos/org.local.json`. If it is missing, stop. Tell the person to copy `demos/org.example.json` and fill it in. Point them at "Manual setup" in `README.md`.
2. Identify the connected Salesforce org: company name and host.
3. Stop when that name is in `productionOrgLabels` or that host is in `productionOrgHosts`. Say which org you refused.
4. Stop when the connected name does not match `demoOrgLabel`.
5. Read `slack.enterpriseGrid`. True means create a workspace with `admin.teams.create`. False means create a channel in the workspace where the app is already installed.
6. If `trialExpires` is within 14 days, say so. You cannot renew an org.

## Intake

Ask only for what the message left out: industry, use case, ordered beats, and the company name when the beats do not name the account.

## Slack surface

| `slack.enterpriseGrid` | What you create |
| --- | --- |
| true | A workspace named for the industry, then a channel `#<demo id>` inside it. Requires the org-admin user token from an org-level install. |
| false | A channel `#<demo id>` where Demo Publisher is installed. |

Slack methods, in order, after the install exists:

- Grid workspace: `admin.teams.create` with `team_name` set to the industry.
- Channel: `conversations.create` with the channel name from the plan.
- `conversations.invite` for the Demo Publisher bot.
- Do not call `chat.postMessage` yourself except to prove the token. Ongoing posts belong to the Salesforce flow.

If the install or the token is missing, print the `install-slack-app` and `slack-token` gates and stop before Salesforce writes.

## Salesforce records

Map each beat:

| When the beat mentions | Create or update |
| --- | --- |
| account, customer, company, member, patient, payer, clinic, chart, school, student | Account |
| case, claim, ticket, prior auth, authorization, support, incident, stall | Case |
| opportunity, deal, pipeline, quote, renewal | Opportunity |

A beat that maps to none becomes a Case. Tag the Name or Subject, and the Description, with `[demo-builder:<id>]`. Use an Industry picklist value the org already has. Describe the object before you set one.

The worked education case is a Case whose Subject contains the tag, because the publisher flow watches Case.

## Publisher flow

After the records exist, the demo is not done until Case changes post themselves.

- After-save flow on Case.
- Filter: Subject contains `[demo-builder:<id>]`.
- Create and Status changes both send `salesforce/slack-post.json` to `https://slack.com/api/chat.postMessage`.
- Channel id is the one you just created.
- Authorization is the named credential. Never paste the bot token into the flow, the spec, or git.

Deploy with the Salesforce CLI or the Metadata API when the org login can deploy. When it cannot, print the `flow-deploy` gate and stop with the flow still inactive. Say that records exist and Slack will stay quiet until the flow is deployed.

## Save

Write `demos/<id>.json` with `salesforceIds` as `[]`. Write record ids and the Slack channel id only to `demos/<id>.links.json`. Both secrets files are gitignored: `demos/org.local.json` and `demos/*.links.json`.

## Never

- Add a slash command, an app home conversation, or a bot people talk to.
- Build a web app for the brief.
- Create Slack workspaces when `slack.enterpriseGrid` is false.
- Write to a production org, or to any Salesforce org other than `demoOrgLabel`.
- Deploy new objects, fields, or Apex. The publisher flow is the only metadata this skill deploys.
- Commit tokens, org ids, hosts, or real org names.
