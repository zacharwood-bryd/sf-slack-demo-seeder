const app = document.querySelector("#app");
const navLinks = document.querySelectorAll("[data-nav]");

const EXAMPLE = {
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
  ].join("\n"),
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setNav(name) {
  for (const link of navLinks) {
    if (link.dataset.nav === name) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
}

async function getJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "The request failed.");
  return body;
}

function briefView() {
  setNav("new");
  app.innerHTML = `
    <section class="hero">
      <div class="lede">
        <p class="eyebrow">New brief</p>
        <h1>Name the story. See what is still yours.</h1>
        <p>Industry, use case, and the flow, one beat per line. The plan separates the setup you click from the records and the talk track an agent builds.</p>
        <button class="secondary" id="use-example" type="button">Fill the Harbor &amp; Pine example</button>
      </div>
      <form class="sheet" id="brief-form">
        <label>Industry
          <input name="industry" required autocomplete="off" />
        </label>
        <label>Company <span style="font-weight:400;color:var(--muted)">(optional)</span>
          <input name="company" autocomplete="off" />
        </label>
        <label>Use case
          <textarea name="useCase" required></textarea>
        </label>
        <label>Flow, one beat per line
          <textarea name="beats" required placeholder="The account opens.&#10;A case stalls.&#10;Slack swarms the owner."></textarea>
        </label>
        <div class="row">
          <button type="submit">Build the plan</button>
        </div>
        <p class="error" id="form-error" hidden></p>
      </form>
    </section>
  `;

  document.querySelector("#use-example").addEventListener("click", () => {
    const form = document.querySelector("#brief-form");
    form.industry.value = EXAMPLE.industry;
    form.company.value = EXAMPLE.company;
    form.useCase.value = EXAMPLE.useCase;
    form.beats.value = EXAMPLE.beats;
    form.industry.focus();
  });

  document.querySelector("#brief-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const error = document.querySelector("#form-error");
    error.hidden = true;
    const beats = form.beats.value
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    try {
      const spec = await getJson("/api/demos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          industry: form.industry.value,
          company: form.company.value,
          useCase: form.useCase.value,
          beats,
        }),
      });
      location.hash = `#/plan/${spec.id}`;
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
    }
  });
}

function steps(items) {
  return items
    .map(
      (step) => `
        <li>
          <strong>${escapeHtml(step.title)}</strong>
          <p>${escapeHtml(step.detail)}</p>
        </li>`,
    )
    .join("");
}

function planView(spec) {
  setNav("library");
  const links = spec.salesforceIds?.length
    ? `<section class="track links">
        <h2>Records in the demo org</h2>
        <ul>
          ${spec.salesforceIds
            .map((item) => `<li>${escapeHtml(item.type)} · ${escapeHtml(item.id)}</li>`)
            .join("")}
        </ul>
      </section>`
    : "";
  app.innerHTML = `
    <article>
      <p class="eyebrow">${escapeHtml(spec.industry)}</p>
      <div class="plan-head">
        <h1>${escapeHtml(spec.title)}</h1>
      </div>
      <p class="use-case">${escapeHtml(spec.useCase)}</p>
      <div class="split">
        <section class="column manual">
          <h2>You do these</h2>
          <ol>${steps(spec.manualSteps)}</ol>
        </section>
        <section class="column agent">
          <h2>The agent does these</h2>
          <ol>${steps(spec.agentSteps)}</ol>
        </section>
      </div>
      <section class="track">
        <h2>Talk track</h2>
        ${spec.talkTrack
          .map(
            (line) => `
            <div class="beat">
              <span>${escapeHtml(line.label)}${line.show ? `<br />${escapeHtml(line.show)}` : ""}</span>
              <p>${escapeHtml(line.say)}</p>
            </div>`,
          )
          .join("")}
      </section>
      ${
        spec.slackDraft
          ? `<section class="track links"><h2>Slack draft</h2><p>${escapeHtml(spec.slackDraft)}</p></section>`
          : ""
      }
      ${links}
    </article>
  `;
}

async function libraryView() {
  setNav("library");
  const demos = await getJson("/api/demos");
  app.innerHTML = `
    <h1 class="page-title">Library</h1>
    <div class="library">
      ${demos
        .map(
          (demo) => `
          <a class="card" href="#/plan/${escapeHtml(demo.id)}">
            <p class="eyebrow">${escapeHtml(demo.industry)}</p>
            <h2>${escapeHtml(demo.title)}</h2>
            <p>${escapeHtml(demo.useCase)}</p>
            <div class="meta">
              <span>${demo.manualSteps.length} manual</span>
              <span>${demo.agentSteps.length} agent</span>
            </div>
          </a>`,
        )
        .join("")}
    </div>
  `;
}

async function render() {
  const hash = location.hash || "#/new";
  const plan = hash.match(/^#\/plan\/([a-z0-9-]+)$/);
  try {
    if (hash === "#/library") {
      await libraryView();
      return;
    }
    if (plan) {
      const spec = await getJson(`/api/demos/${plan[1]}`);
      planView(spec);
      return;
    }
    briefView();
  } catch (error) {
    setNav("");
    app.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }
}

window.addEventListener("hashchange", render);
render();
