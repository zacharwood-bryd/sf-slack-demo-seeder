---
name: demo-builder
description: >-
  Build a Salesforce demo and a new Slack Enterprise Grid workspace for it.
  Use when someone gives an industry, a use case, and a flow and wants a
  coding agent to seed the connected Salesforce org and publish changes into
  that new workspace. The Slack app is a publisher, not a bot people talk to.
---

# Demo builder

You are the coding agent. The person gives you an industry, a use case, and the flow. You seed the Salesforce org this session is signed into, and you create a new Slack workspace for that story. Later Salesforce changes post into that workspace on their own.

This is only installed on a Slack Enterprise Grid org. One install of Demo Publisher covers the org. Every demo is a new workspace, with `#updates` inside it for the posts.

Do not build a website. Do not build a Slack bot that replies to people. Do not reuse an existing workspace for a new story. The app in `slack/manifest.json` posts messages and is granted to workspaces the org creates later.

The human instructions are in `README.md`. Gate text is in `demos/manual-gates.json`. Build the plan with `scripts/plan.mjs`:

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

`demos/education-advising.json` is that brief already planned. Northbridge Academy is fictional.

## Before any write

1. Identify the Salesforce org the session is signed into. That is the org you seed. A demo org is the usual choice. You do not keep a list of allowed or forbidden orgs.
2. Confirm Demo Publisher is installed on the Enterprise Grid org and granted to future workspaces. If it is not, print the `install-slack-app` gate and stop.
3. You need two tokens, neither of them in git. The org-admin user token calls `admin.teams.create`. The bot token is the Salesforce named credential that posts to Slack. If either is missing, print the `slack-token` gate and stop.

## Intake

Ask only for what the message left out: industry, use case, ordered beats, and the company name when the beats do not name the account.

## New workspace

The plan names the workspace after the company and sets `team_domain` to the demo id, cut to 21 characters.

1. `admin.teams.create` with `team_name` and `team_domain` from the plan. Save the returned team id.
2. In that workspace, `conversations.create` for `#updates`. Pass `team_id` when the token is an org token. Invite Demo Publisher.
3. If the app was not granted to future workspaces, stop and say the workspace exists but Demo Publisher is not in it yet. Do not post from a different workspace.

Do not call `chat.postMessage` yourself except to prove the token. Ongoing posts belong to the Salesforce flow, aimed at `#updates` in this workspace.

## Salesforce records

Map each beat:

| When the beat mentions | Create or update |
| --- | --- |
| account, customer, company, member, patient, payer, clinic, chart, school, student | Account |
| case, claim, ticket, prior auth, authorization, support, incident, stall | Case |
| opportunity, deal, pipeline, quote, renewal | Opportunity |

A beat that maps to none becomes a Case. Tag the Name or Subject, and the Description, with `[demo-builder:<id>]`. Use an Industry picklist value the org already has. Describe the object before you set one.

The publisher flow watches Case, so the story needs a Case whose Subject contains the tag.

## Publisher flow

After the records exist, the demo is not done until Case changes post into the new workspace.

- After-save flow on Case.
- Filter: Subject contains `[demo-builder:<id>]`.
- Create and Status changes both send `salesforce/slack-post.json` to `https://slack.com/api/chat.postMessage`.
- Channel id is `#updates` in the workspace you just created.
- Authorization is the named credential. Never paste a token into the flow, the spec, or git.

Deploy with the Salesforce CLI or the Metadata API when the org login can deploy. When it cannot, print the `flow-deploy` gate and stop with the flow still inactive. Say that the workspace and the records exist, and Slack will stay quiet until the flow is deployed.

## Save

Write `demos/<id>.json` with `salesforceIds` as `[]`. Write record ids, the Slack team id, and the channel id only to `demos/<id>.links.json`. That links file is gitignored.

## Never

- Add a slash command, an app home conversation, or a bot people talk to.
- Build a web app for the brief.
- Put the demo in a workspace that already existed.
- Put an org name, a host, a user, or a token from the person's own systems into a committed file.
- Deploy new objects, fields, or Apex. The publisher flow is the only metadata this skill deploys.
