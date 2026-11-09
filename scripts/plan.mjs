/**
 * Turns a demo brief into the manual steps and the build the coding agent runs.
 * Gate ids match demos/manual-gates.json.
 */

export const EDUCATION_INPUT = {
  id: "education-advising",
  industry: "Education",
  company: "Northbridge Academy",
  useCase:
    "An advisor picks up a student case when Maya Chen has waited two days for a course change.",
  beats: [
    "Northbridge Academy is the school account, and Maya Chen is the student.",
    "A case opens for a course change, waiting on the advisor.",
    "The case sits past two days.",
    "The case moves to closed when the advisor approves the change.",
  ],
};

export const HEALTHCARE_INPUT = {
  id: "healthcare-prior-auth",
  industry: "Healthcare",
  company: "Harbor & Pine Health",
  useCase:
    "A nurse practitioner requests prior authorization for an MRI, and the payer team sees the case in Slack when it stalls.",
  beats: [
    "Harbor & Pine Health is the clinic account, with Avery Cole as the patient.",
    "A case is filed for prior authorization of an MRI, waiting on the clinical note.",
    "The case stalls past the payer's two-day window.",
    "The case moves to closed once the note arrives and the request is approved.",
  ],
};

const CASE = /\b(cases?|claims?|tickets?|authorizations?|support|incidents?|complaints?|stalls?)\b|prior auth/i;
const OPP = /\b(opportunities|opportunity|deals?|pipeline|quotes?|renewals?)\b/i;
const ACCOUNT = /\b(accounts?|customers?|compan(?:y|ies)|members?|patients?|payers?|clinics?|charts?|schools?|students?)\b/i;
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
  if (objects.length === 0) objects.push("Case");
  return objects;
}

function gate(catalog, id) {
  const found = catalog.find((item) => item.id === id);
  if (!found) throw new Error(`Missing manual gate: ${id}`);
  return { id: found.id, title: found.title, detail: found.detail };
}

function sentence(value) {
  const text = String(value).trim();
  if (!text) return text;
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

export function buildPlan(input, catalog, options = {}) {
  const industry = String(input.industry || "").trim();
  const useCase = String(input.useCase || "").trim();
  const company = String(input.company || "").trim() || `${industry} sample account`;
  const beats = beatsFrom(input.beats);
  if (!industry) throw new Error("Industry is required.");
  if (!useCase) throw new Error("Use case is required.");
  if (beats.length < 2) throw new Error("Add at least two beats, one per line.");

  const id = slugify(input.id || `${industry} ${useCase}`);
  if (!id) throw new Error("Could not make an id from this brief.");

  const enterpriseGrid = Boolean(options.enterpriseGrid);
  const blob = `${useCase}\n${beats.join("\n")}`;
  const wantsMetadata = METADATA.test(blob);
  const gates = catalog?.gates || catalog || [];
  const tag = `demo-builder:${id}`;
  const channel = id.slice(0, 80);
  const mapped = beats.map(mapBeat);

  const manualIds = ["install-slack-app", "slack-token", "salesforce-connect", "org-config", "trial-check", "flow-deploy"];
  if (wantsMetadata) manualIds.push("metadata");

  const surface = enterpriseGrid
    ? `Create a Slack workspace named ${industry} with admin.teams.create, using the org-admin token. In that workspace create #${channel}, invite Demo Publisher, and use that channel for every post.`
    : `Create #${channel} with conversations.create in the workspace where Demo Publisher is installed. Invite the bot. Use that channel for every post.`;

  const agentSteps = [
    {
      id: "confirm-org",
      title: "Confirm the demo org",
      detail:
        "Read demos/org.local.json. The connected Salesforce org must match demoOrgLabel. If its name is in productionOrgLabels, or its host is in productionOrgHosts, stop before any write.",
    },
    {
      id: "slack-surface",
      title: enterpriseGrid ? `Workspace: ${industry}` : `Channel: #${channel}`,
      detail: surface,
    },
  ];

  beats.forEach((beat, index) => {
    const objects = mapped[index];
    agentSteps.push({
      id: `beat-${index + 1}`,
      title: `Beat ${index + 1}: ${objects.join(" + ")}`,
      detail: `Create or update the ${objects.join(" and ")}. ${sentence(beat)} Tag the Name or Subject, and the Description, with [${tag}]. Use an Industry picklist value the org already has.`,
    });
  });

  agentSteps.push({
    id: "publish-flow",
    title: "Wire Salesforce changes to Slack",
    detail: `Activate an after-save flow on Case for records whose Subject contains [${tag}]. On create and on Status change, POST the body in salesforce/slack-post.json to the channel from this plan. The named credential holds the bot token.`,
  });
  agentSteps.push({
    id: "save-spec",
    title: "Save the spec",
    detail: `Write this plan to demos/${id}.json with salesforceIds left empty. Put record ids and the Slack channel id only in demos/${id}.links.json.`,
  });

  const message = [
    `*${company}*`,
    sentence(useCase),
    ...beats.map((beat, index) => `${index + 1}. ${sentence(beat)}`),
    `Tag: [${tag}]`,
  ].join("\n");

  return {
    id,
    title: company,
    industry,
    company,
    useCase,
    beats,
    slack: {
      mode: enterpriseGrid ? "workspace" : "channel",
      workspaceName: enterpriseGrid ? industry : "",
      channel,
      message,
    },
    manualSteps: manualIds.map((item) => gate(gates, item)),
    agentSteps,
    talkTrack: [
      {
        label: "Open",
        show: "Salesforce account, then the Slack channel",
        say: `${company} is the ${industry.toLowerCase()} account. ${sentence(useCase)}`,
      },
      ...beats.map((beat, index) => ({
        label: `Beat ${index + 1}`,
        show: mapped[index].join(", "),
        say: sentence(beat),
      })),
      {
        label: "Close",
        show: `#${channel}`,
        say: "Change the case status in Salesforce. The Slack channel receives a new message from Demo Publisher without anyone typing in Slack.",
      },
    ],
    salesforceIds: [],
    tag,
  };
}
