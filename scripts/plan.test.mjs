import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EDUCATION_INPUT, buildPlan, mapBeat } from "./plan.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(readFileSync(path.join(root, "demos/manual-gates.json"), "utf8"));

const channelPlan = buildPlan(EDUCATION_INPUT, catalog, { enterpriseGrid: false });
assert.equal(channelPlan.id, "education-advising");
assert.equal(channelPlan.slack.mode, "channel");
assert.equal(channelPlan.slack.channel, "education-advising");
assert.equal(channelPlan.slack.workspaceName, "");
assert.match(channelPlan.slack.message, /Northbridge Academy/);
assert.deepEqual(
  channelPlan.manualSteps.map((step) => step.id),
  ["install-slack-app", "slack-token", "salesforce-connect", "org-config", "trial-check", "flow-deploy"],
);
assert.equal(channelPlan.agentSteps[1].title, "Channel: #education-advising");
assert.ok(channelPlan.agentSteps.some((step) => step.id === "publish-flow"));

const gridPlan = buildPlan(EDUCATION_INPUT, catalog, { enterpriseGrid: true });
assert.equal(gridPlan.slack.mode, "workspace");
assert.equal(gridPlan.slack.workspaceName, "Education");
assert.match(gridPlan.agentSteps[1].detail, /admin\.teams\.create/);

const quiet = buildPlan(
  {
    industry: "Retail",
    useCase: "A buyer asks the rep for a reorder.",
    beats: ["Northwind Goods is the account.", "An opportunity opens for the spring reorder."],
  },
  catalog,
);
assert.equal(quiet.slack.mode, "channel");
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

const forbidden = ["penhallow", "bryd consulting", "bryd technologies", "brydconsultingpteltd", "meridian"];
const haystack = JSON.stringify(channelPlan).toLowerCase();
for (const word of forbidden) {
  assert.equal(haystack.includes(word), false, word);
}

console.log("plan.test.mjs ok");
