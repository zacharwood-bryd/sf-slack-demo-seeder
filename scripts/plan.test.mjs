import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EDUCATION_INPUT, buildPlan, mapBeat } from "./plan.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(readFileSync(path.join(root, "demos/manual-gates.json"), "utf8"));

const channelPlan = buildPlan(EDUCATION_INPUT, catalog);
assert.equal(channelPlan.id, "education-advising");
assert.equal(channelPlan.slack.mode, "workspace");
assert.equal(channelPlan.slack.workspaceName, "Northbridge Academy");
assert.equal(channelPlan.slack.workspaceDomain, "education-advising");
assert.equal(channelPlan.slack.channel, "updates");
assert.match(channelPlan.slack.message, /Northbridge Academy/);
assert.match(channelPlan.agentSteps[1].detail, /admin\.teams\.create/);
assert.deepEqual(
  channelPlan.manualSteps.map((step) => step.id),
  ["install-slack-app", "slack-token", "salesforce-connect", "flow-deploy"],
);
assert.equal(channelPlan.agentSteps[1].title, "Workspace Northbridge Academy");
assert.ok(channelPlan.agentSteps.some((step) => step.id === "publish-flow"));

const quiet = buildPlan(
  {
    industry: "Retail",
    useCase: "A buyer asks the rep for a reorder.",
    beats: ["Northwind Goods is the account.", "An opportunity opens for the spring reorder."],
  },
  catalog,
);
assert.equal(quiet.slack.mode, "workspace");
assert.equal(quiet.slack.workspaceName, "Retail sample account");
assert.ok(quiet.agentSteps.some((step) => step.title.includes("Opportunity") || step.detail.includes("Opportunity")));

const metadata = buildPlan(
  {
    industry: "Energy",
    useCase: "Dispatch a field crew.",
    beats: ["A case opens for the outage.", "A new custom object stores the turbine reading."],
  },
  catalog,
);
assert.ok(metadata.manualSteps.some((step) => step.id === "metadata"));
assert.equal(mapBeat("A new custom object tracks claims.").includes("Case"), true);

const haystack = JSON.stringify(channelPlan).toLowerCase();
assert.match(haystack, /admin\.teams\.create/);
assert.equal(haystack.includes("enable_section"), false);

console.log("plan.test.mjs ok");
