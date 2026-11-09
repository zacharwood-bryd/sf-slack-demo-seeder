import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXAMPLE_INPUT, buildPlan, mapBeat } from "./plan.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(readFileSync(path.join(root, "demos/manual-gates.json"), "utf8"));
const spec = buildPlan(EXAMPLE_INPUT, catalog);

assert.equal(spec.id, "healthcare-prior-auth");
assert.equal(spec.tag, "demo-builder:healthcare-prior-auth");
assert.deepEqual(
  spec.manualSteps.map((step) => step.id),
  ["slack-connect", "slack-admin", "salesforce-connect", "org-config", "trial-check"],
);
assert.equal(spec.agentSteps[0].id, "confirm-org");
assert.match(spec.slackDraft, /Harbor & Pine Health/);
assert.ok(spec.agentSteps.some((step) => step.id === "beat-4" && step.title.includes("Slack")));
assert.equal(mapBeat("A new custom object tracks claims.").includes("Case"), true);

const quiet = buildPlan(
  {
    industry: "Retail",
    useCase: "A buyer asks the rep for a reorder.",
    beats: ["Northwind Goods is the account.", "An opportunity opens for the spring reorder."],
  },
  catalog,
);
assert.deepEqual(
  quiet.manualSteps.map((step) => step.id),
  ["salesforce-connect", "org-config", "trial-check"],
);
assert.equal(quiet.slackDraft, "");

const metadata = buildPlan(
  {
    industry: "Energy",
    useCase: "Dispatch a field crew.",
    beats: ["A case opens for the outage.", "A new custom object stores the turbine reading."],
  },
  catalog,
);
assert.ok(metadata.manualSteps.some((step) => step.id === "metadata"));

const forbidden = ["penhallow", "bryd consulting", "bryd technologies", "brydconsultingpteltd"];
const haystack = JSON.stringify(spec).toLowerCase();
for (const word of forbidden) {
  assert.equal(haystack.includes(word), false, word);
}

console.log("plan.test.mjs ok");
