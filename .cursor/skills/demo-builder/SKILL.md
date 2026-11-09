---
name: demo-builder
description: >-
  Build a Salesforce demo and publish its changes into Slack. Use when someone
  gives an industry, a use case, and a flow and wants a coding agent to seed
  the connected Salesforce org and land the updates in one Slack workspace.
  The Slack app is a publisher, not a bot people talk to. Demo channels live
  in one sidebar section.
---

# Demo builder

You are the coding agent. The person gives you an industry, a use case, and the flow. You seed the Salesforce org this session is signed into, and you wire a record-triggered flow so later changes show up in Slack on their own.

Work inside the one Slack workspace where Demo Publisher is installed. Each demo is a channel. All of those channels sit in one sidebar section named Demos, backed by the `@demos` user group.

Do not build a website. Do not build a Slack bot that replies to people. Do not create Slack workspaces. The app in `slack/manifest.json` only posts messages and manages that section.

The human instructions are in `README.md`. Gate text is in `demos/manual-gates.json`. Build the plan with `scripts/plan.mjs`:

```bash
node --input-type=module -e "
import { buildPlan } from './scripts/plan.mjs';
import { readFileSync, existsSync } from 'node:fs';
const catalog = JSON.parse(readFileSync('demos/manual-gates.json','utf8'));
const local = existsSync('demos/org.local.json') ? JSON.parse(readFileSync('demos/org.local.json','utf8')) : {};
const spec = buildPlan({
  industry: 'Education',
  company: 'Northbridge Academy',
  useCase: 'An advisor picks up a student who waited two days for a course change.',
  beats: ['Northbridge Academy is the school account, and Maya Chen is the student.', 'A case opens for a course change.']
}, catalog, {
  sectionName: local.slack?.sectionName,
  sectionHandle: local.slack?.sectionHandle
});
console.log(JSON.stringify(spec, null, 2));
"
```

`demos/education-advising.json` is that brief already planned. Northbridge Academy is fictional. `demos/org.example.json` only overrides the section name and handle. Copy it to `demos/org.local.json` when you want a different label. The default is Demos / `@demos`.

## Before any write

1. Identify the Salesforce org the session is signed into. That is the org you seed. A demo org is the usual choice. You do not keep a list of allowed or forbidden orgs.
2. Identify the Slack workspace where Demo Publisher is installed. If it is not installed, print the `install-slack-app` gate and stop.
3. If the bot token is not yet in a Salesforce named credential for `https://slack.com/api`, print the `slack-token` gate and stop before relying on the flow.
4. If the workspace does not allow user groups, print the `user-groups` gate and stop before creating `@demos`.

## Intake

Ask only for what the message left out: industry, use case, ordered beats, and the company name when the beats do not name the account.

## Slack surface

In the installed workspace, in this order:

1. `conversations.create` for `#<demo id>` from the plan. Invite Demo Publisher.
2. `usergroups.list`. If `@demos` is missing, `usergroups.create` with `name` Demos, `handle` demos, `enable_section` true, and `channels` set to the new channel. If it exists, `usergroups.update` with `enable_section` true and `channels` including every demo channel already on the group plus this one.
3. `usergroups.users.update` to add the person running the demo when you have their Slack user id. The section shows for members of the group. If you do not have an id, say so and tell them to join `@demos`.

Slack has no public API for a personal sidebar section. The user group with `enable_section` is the shared section. It needs a paid Slack plan.

Do not call `chat.postMessage` yourself except to prove the token. Ongoing posts belong to the Salesforce flow.

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

After the records exist, the demo is not done until Case changes post themselves.

- After-save flow on Case.
- Filter: Subject contains `[demo-builder:<id>]`.
- Create and Status changes both send `salesforce/slack-post.json` to `https://slack.com/api/chat.postMessage`.
- Channel id is the one you just created.
- Authorization is the named credential. Never paste the bot token into the flow, the spec, or git.

Deploy with the Salesforce CLI or the Metadata API when the org login can deploy. When it cannot, print the `flow-deploy` gate and stop with the flow still inactive. Say that records exist and Slack will stay quiet until the flow is deployed.

## Save

Write `demos/<id>.json` with `salesforceIds` as `[]`. Write record ids and the Slack channel id only to `demos/<id>.links.json`. That links file is gitignored, as is `demos/org.local.json`.

## Never

- Add a slash command, an app home conversation, or a bot people talk to.
- Build a web app for the brief.
- Create a Slack workspace, or install the app outside the one workspace the person named.
- Put an org name, a host, a user, or a token from the person's own systems into a committed file.
- Deploy new objects, fields, or Apex. The publisher flow is the only metadata this skill deploys.
