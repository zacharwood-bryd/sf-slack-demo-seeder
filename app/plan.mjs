/**
 * Shared demo plan. The skill, the README, and the app all follow these rules.
 * Keep the gate ids aligned with demos/manual-gates.json.
 */

export const EXAMPLE_INPUT = {
  id: "healthcare-prior-auth",
  industry: "Healthcare",
  company: "Harbor & Pine Health",
  useCase:
    "A nurse practitioner requests prior authorization for an MRI, and the payer team swarms in Slack when the case stalls.",
  beats: [
    "Harbor & Pine Health is the member's clinic account, with Avery Cole as the patient on the chart.",
    "A case is filed for prior authorization of an MRI, waiting on the clinical note.",
    "The case stalls past the payer's two-day window.",
    "Slack swarms the payer channel with the case, the missing note, and the owner.",
    "The case moves to approved once the note arrives, and the swarm closes.",
  ],
};

const SLACK = /\b(slack|channel|swarm|notify|notification|post)\b/i;
const CASE = /\b(cases?|claims?|tickets?|authorizations?|support|incidents?|complaints?|stalls?)\b|prior auth/i;
const OPP = /\b(opportunities|opportunity|deals?|pipeline|quotes?|renewals?)\b/i;
const ACCOUNT = /\b(accounts?|customers?|compan(?:y|ies)|members?|patients?|payers?|clinics?|charts?)\b/i;
const METADATA = /\b(custom objects?|new fields?|apex|triggers?|page layouts?|flexipages?)\b/i;

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}

export function beatsFrom(value) {
  if (Array.isArray(value)) {
    return value.map((beat) => String(beat).trim()).filter(Boolean);
  }
  return String(value || "")
    .split(/\n+/)
    .map((beat) => beat.replace(/^\s*(?:\d+[\).\]]\s*|[-*]\s*)/, "").trim())
    .filter(Boolean);
}

export function mapBeat(beat) {
  const objects = [];
  if (ACCOUNT.test(beat)) objects.push("Account");
  if (CASE.test(beat)) objects.push("Case");
  if (OPP.test(beat)) objects.push("Opportunity");
  if (SLACK.test(beat)) objects.push("Slack demo bundle record");
  if (objects.length === 0) objects.push("Case");
  return objects;
}

function gate(catalog, id) {
  const found = catalog.find((item) => item.id === id);
  if (!found) {
    throw new Error(`Missing manual gate: ${id}`);
  }
  return { id: found.id, title: found.title, detail: found.detail };
}

function sentence(value) {
  const text = String(value).trim();
  if (!text) return text;
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

export function buildPlan(input, catalog) {
  const industry = String(input.industry || "").trim();
  const useCase = String(input.useCase || "").trim();
  const company = String(input.company || "").trim() || `${industry} sample account`;
  const beats = beatsFrom(input.beats);
  if (!industry) throw new Error("Industry is required.");
  if (!useCase) throw new Error("Use case is required.");
  if (beats.length < 2) throw new Error("Add at least two beats, one per line.");

  const id = slugify(input.id || `${industry} ${useCase}`);
  if (!id) throw new Error("Could not make an id from this brief.");

  const blob = `${useCase}\n${beats.join("\n")}`;
  const wantsSlack = SLACK.test(blob);
  const wantsMetadata = METADATA.test(blob);
  const gates = catalog?.gates || catalog || [];

  const manualIds = [];
  if (wantsSlack) manualIds.push("slack-connect", "slack-admin");
  manualIds.push("salesforce-connect", "org-config", "trial-check");
  if (wantsMetadata) manualIds.push("metadata");

  const tag = `demo-builder:${id}`;
  const mapped = beats.map(mapBeat);
  const agentSteps = [
    {
      id: "confirm-org",
      title: "Confirm the demo org",
      detail:
        "Read demos/org.local.json. The connected Salesforce org must match demoOrgLabel. If its name is in productionOrgLabels, or its host is in productionOrgHosts, stop before any write.",
    },
  ];

  beats.forEach((beat, index) => {
    const objects = mapped[index];
    const records = objects.filter((object) => object !== "Slack demo bundle record");
    const parts = [];
    if (records.length) parts.push(`Create or update the ${records.join(" and ")}.`);
    if (objects.includes("Slack demo bundle record")) {
      parts.push(
        "Create a Slack demo bundle record and draft the message in the spec. Leave the actual Slack post to the person running the demo.",
      );
    }
    agentSteps.push({
      id: `beat-${index + 1}`,
      title: `Beat ${index + 1}: ${objects.join(" + ")}`,
      detail: `${parts.join(" ")} ${sentence(beat)} Tag the Name or Subject, and the Description, with [${tag}]. Use an Industry picklist value the org already has.`,
    });
  });

  agentSteps.push({
    id: "save-spec",
    title: "Save the talk track",
    detail: `Write the plan to demos/${id}.json. Put record ids only in demos/${id}.links.json, which stays gitignored.`,
  });

  const slackDraft = wantsSlack
    ? [`*${company}*`, sentence(useCase), ...beats.map((beat, index) => `${index + 1}. ${sentence(beat)}`), `Tag: [${tag}]`].join("\n")
    : "";

  const talkTrack = [
    {
      label: "Open",
      show: "Account",
      say: `${company} is the ${industry.toLowerCase()} account on screen. ${sentence(useCase)}`,
    },
    ...beats.map((beat, index) => ({
      label: `Beat ${index + 1}`,
      show: mapped[index].join(", "),
      say: sentence(beat),
    })),
    {
      label: "Close",
      show: wantsSlack ? "Slack draft" : mapped[mapped.length - 1].join(", "),
      say: wantsSlack
        ? "Leave the Salesforce record on screen and post the drafted swarm in the channel you named. The agent writes the words. You send them."
        : "Leave the last record on screen and say who owns the next step. Every record carries the demo tag, so this story can be found again without touching the rest of the org.",
    },
  ];

  return {
    id,
    title: company,
    industry,
    company,
    useCase,
    beats,
    manualSteps: manualIds.map((item) => gate(gates, item)),
    agentSteps,
    talkTrack,
    salesforceIds: [],
    slackDraft,
    tag,
  };
}
