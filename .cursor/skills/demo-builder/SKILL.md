---
name: demo-builder
description: >-
  Build a Slack and Salesforce demo from an industry, a use case, and a flow.
  Use when someone asks for a demo, a talk track, sample Salesforce records, or
  a Slack swarm scenario. List the manual setup before any write. Refuse
  production orgs. New objects, fields, and Apex stay with the human.
---

# Demo builder

Build one demo at a time on a Salesforce demo org. The human supplies the industry, the use case, and the flow. You split that brief into steps they still do by hand and records you create, then you write the talk track.

The public instructions for the human are in `README.md`. The gate text lives in `demos/manual-gates.json`. The same rules are implemented in `app/plan.mjs`. Use that module when you need the split, instead of inventing a second one:

```bash
node --input-type=module -e "import { buildPlan } from './app/plan.mjs'; import { readFileSync } from 'fs'; const catalog = JSON.parse(readFileSync('demos/manual-gates.json','utf8')); console.log(JSON.stringify(buildPlan({ industry: 'Healthcare', useCase: '...', beats: ['...','...'] }, catalog), null, 2))"
```

## Before any write

1. Read `demos/org.local.json`. If it is missing, stop. Tell the human to copy `demos/org.example.json` and fill it in. Point them at "Manual setup" in `README.md`. Do not invent org names.
2. Identify the Salesforce org the session is connected to: company name and host.
3. Stop when the connected name is listed in `productionOrgLabels`, or the connected host is listed in `productionOrgHosts`. Say which org you refused. Do not create or update records there.
4. Stop when the connected name does not match `demoOrgLabel`. Say which org is connected and which label the config expects.
5. If `trialExpires` is set and within 14 days, say so in the manual list. Keep going. You cannot renew an org.

## Intake

Ask only for what the message left out:

- Industry
- Use case, one or two sentences
- Flow, as ordered beats (one action per line)
- Company name, when the beats do not already name the account

A worked brief is `demos/healthcare-prior-auth.json`. Harbor & Pine Health is fictional. Match that shape.

## Map each beat

| When the beat mentions | Create or update |
| --- | --- |
| account, customer, company, member, patient, payer, clinic, chart | Account |
| case, claim, ticket, prior auth, authorization, support, incident, stall | Case |
| opportunity, deal, pipeline, quote, renewal | Opportunity |
| Slack, channel, swarm, notify, notification, post | Slack demo bundle record, plus a drafted message in the spec |

A beat can map to more than one object. A beat that maps to none becomes a Case. Use an Industry picklist value the org already has. Query the describe before you set one.

## Split, then wait

Print two lists before any Salesforce write.

**You do these.** Include a gate from `demos/manual-gates.json` when it applies:

- `slack-connect` and `slack-admin` when any beat or the use case mentions Slack, a channel, a swarm, a notification, or a post
- `salesforce-connect`, `org-config`, and `trial-check` on every brief
- `metadata` when the brief asks for a custom object, a new field, Apex, a trigger, or a page layout

Skip a gate the human has already finished. `org-config` is finished when `demos/org.local.json` is filled in. `salesforce-connect` is finished when the connected org already matches `demoOrgLabel`. `trial-check` is finished when `trialExpires` is empty or more than 14 days away.

**The agent does these.**

1. Confirm the org guard above.
2. One step per beat: create or update the mapped records. Tag the Name or Subject, and the Description, with `[demo-builder:<id>]`.
3. For a Slack beat, create the Slack demo bundle record and keep the drafted message in `slackDraft`. Do not post to Slack.
4. Save the plan to `demos/<id>.json` with `salesforceIds` left as `[]`.
5. Save returned record ids only in `demos/<id>.links.json`. That file is gitignored. Never copy an org id, a host, a login, or a session token into a committed file.

Write Salesforce records only after the human says the remaining manual steps are done, or you have checked that they are already done.

## Talk track

Save `talkTrack` on the spec:

- **Open.** The company, the industry, and the use case, said out loud.
- **One line per beat.** Name the object on screen, then say the beat.
- **Close.** If the story uses Slack, tell the presenter to post the drafted swarm in the channel they named. Otherwise, name who owns the next step. Mention the demo tag so the records can be found again.

## Never

- Deploy new objects, fields, layouts, or Apex. Tell the human that step is `metadata` and wait.
- Write to an org listed as production, or to any org other than `demoOrgLabel`.
- Post, install, or approve anything in Slack.
- Commit `demos/org.local.json`, `demos/*.links.json`, or any real org name, host, or id.
