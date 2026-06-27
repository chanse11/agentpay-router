// Frontend now talks to the AgentPay Router backend, which runs the real
// agent decision (LLM), x402 settlement, and Casper deploy. When backend
// integrations are not configured they return clearly-flagged simulations.

const els = {
  runButton: document.querySelector("#runButton"),
  resetButton: document.querySelector("#resetButton"),
  budgetSlider: document.querySelector("#budgetSlider"),
  budgetLabel: document.querySelector("#budgetLabel"),
  autoPayToggle: document.querySelector("#autoPayToggle"),
  reputationToggle: document.querySelector("#reputationToggle"),
  taskSelect: document.querySelector("#taskSelect"),
  requestBox: document.querySelector("#requestBox"),
  serviceList: document.querySelector("#serviceList"),
  traceList: document.querySelector("#traceList"),
  receiptBox: document.querySelector("#receiptBox"),
  decisionBox: document.querySelector("#decisionBox"),
  confidenceTag: document.querySelector("#confidenceTag"),
  statusPill: document.querySelector("#statusPill"),
  taskSummary: document.querySelector("#taskSummary"),
  routeCard: document.querySelector(".route-card")
};

let catalog = { services: [], taskProfiles: {} };

function formatCspr(value) {
  return `${Number(value).toFixed(2)} CSPR`;
}

function activeProfile() {
  return catalog.taskProfiles[els.taskSelect.value];
}

function requiredServiceIds() {
  return new Set(activeProfile()?.requiredServices || []);
}

function renderServices() {
  const profile = activeProfile();
  if (!profile) return;
  const required = requiredServiceIds();
  els.requestBox.textContent = profile.request;
  els.serviceList.innerHTML = catalog.services
    .map((service) => {
      const included = required.has(service.id);
      return `
        <article class="service-item" aria-label="${service.name}">
          <div>
            <strong>${included ? "Selected: " : ""}${service.name}</strong>
            <span>${service.description} Reputation ${service.reputation}/100.</span>
          </div>
          <div class="price">${formatCspr(service.price)}</div>
        </article>
      `;
    })
    .join("");
}

function renderReceipt(data = null) {
  const rows = data
    ? [
        ["deploy_hash", `${data.deploySimulated ? "[sim] " : ""}${data.deployHash || "n/a"}`],
        ["payment_proof", `${data.paymentSimulated ? "[sim] " : ""}${data.paymentProof || "n/a"}`],
        ["service_id", data.serviceIds.join(", ")],
        ["task_result_hash", (data.taskResultHash || "").slice(0, 32) + "..."],
        ["reputation_delta", data.reputationDelta]
      ]
    : [
        ["deploy_hash", "pending"],
        ["payment_proof", "pending"],
        ["service_id", "pending"],
        ["task_result_hash", "pending"],
        ["reputation_delta", "pending"]
      ];

  els.receiptBox.innerHTML = rows
    .map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`)
    .join("");
}

function addTrace(title, detail) {
  const item = document.createElement("li");
  const index = els.traceList.children.length + 1;
  item.innerHTML = `
    <div class="trace-index">${index}</div>
    <div>
      <strong>${title}</strong>
      <span>${detail}</span>
    </div>
  `;
  els.traceList.appendChild(item);
}

function setStatus(status, summary) {
  els.statusPill.textContent = status;
  els.taskSummary.textContent = summary;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runTask() {
  els.runButton.disabled = true;
  els.routeCard.classList.add("running");
  els.traceList.innerHTML = "";
  renderReceipt();
  els.decisionBox.textContent = "Running autonomous decision loop...";
  els.confidenceTag.textContent = "In progress";
  setStatus("Negotiating", "Research Agent is deciding whether paid service calls fit the current policy.");

  let data;
  try {
    const res = await fetch("/api/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        task: els.taskSelect.value,
        budget: Number(els.budgetSlider.value),
        autoPay: els.autoPayToggle.checked,
        requireReputation: els.reputationToggle.checked
      })
    });
    data = await res.json();
  } catch (err) {
    addTrace("Network error", `Could not reach the router backend: ${err.message}`);
    setStatus("Error", "The router backend is not reachable. Run `npm start` and reload.");
    els.routeCard.classList.remove("running");
    els.runButton.disabled = false;
    return;
  }

  // Replay the backend trace with a small delay for demo readability.
  for (const step of data.trace || []) {
    addTrace(step.title, step.detail);
    await sleep(450);
  }

  const decision = data.decision || {};

  if (data.status === "blocked") {
    els.decisionBox.textContent = "No payment was made because autonomous payment policy is disabled.";
    els.confidenceTag.textContent = "Blocked";
    setStatus("Blocked", "Autonomous payment is off, so the router stopped before buying services.");
  } else if (data.status === "rejected") {
    els.decisionBox.textContent = decision.reason || "The agent rejected the route.";
    els.confidenceTag.textContent = "Rejected";
    setStatus("Rejected", "The router protected the agent and did not create a settlement record.");
  } else if (data.status === "settled" && data.receipt) {
    renderReceipt(data.receipt);
    els.decisionBox.textContent = `${data.receipt.result} Total paid: ${formatCspr(data.receipt.totalPaidCspr)}. The receipt can be verified by another agent before trusting the result.`;
    els.confidenceTag.textContent = `${decision.confidence}% confidence`;
    setStatus("Settled", "The agent completed a paid service route and produced a Casper-verifiable receipt.");
  } else {
    els.decisionBox.textContent = data.error || "The task did not complete.";
    els.confidenceTag.textContent = "Error";
    setStatus("Error", "Something went wrong while running the task.");
  }

  els.routeCard.classList.remove("running");
  els.runButton.disabled = false;
}

function resetDemo() {
  els.traceList.innerHTML = "";
  renderReceipt();
  els.decisionBox.textContent =
    "The router will produce a verifiable payment receipt and a decision summary after the task runs.";
  els.confidenceTag.textContent = "No run yet";
  setStatus("Ready", "Give the research agent a budget, then let it decide whether buying external data is worth the cost.");
  els.routeCard.classList.remove("running");
  els.runButton.disabled = false;
}

async function loadHealth() {
  try {
    const res = await fetch("/api/health");
    const health = await res.json();
    const i = health.integrations;
    const tag = (live) => (live ? "LIVE" : "SIM");
    setStatus(
      "Ready",
      `LLM:${tag(i.llm.live)} x402:${tag(i.x402.live)} Casper:${tag(i.casper.live)}. Give the agent a budget, then let it decide.`
    );
  } catch {
    /* health is best-effort */
  }
}

async function init() {
  try {
    const res = await fetch("/api/catalog");
    catalog = await res.json();
  } catch (err) {
    els.requestBox.textContent = "Could not load the agent catalog. Start the backend with `npm start`.";
    return;
  }

  document.querySelector("#agentCount").textContent = "3";
  document.querySelector("#serviceCount").textContent = String(catalog.services.length);
  els.budgetLabel.textContent = formatCspr(Number(els.budgetSlider.value));
  renderServices();
  resetDemo();
  loadHealth();
}

els.budgetSlider.addEventListener("input", () => {
  els.budgetLabel.textContent = formatCspr(Number(els.budgetSlider.value));
});

els.taskSelect.addEventListener("change", () => {
  renderServices();
  resetDemo();
});

els.runButton.addEventListener("click", runTask);
els.resetButton.addEventListener("click", resetDemo);

init();
