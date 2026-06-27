import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { config, llmEnabled, x402Enabled, casperEnabled, casperTransferEnabled } from "./config.js";
import { services, taskProfiles, servicesForTask } from "./agents.js";
import { decide } from "./llm.js";
import { challenge, verifyAndSettle } from "./x402.js";
import { recordSettlement, createSignedPaymentPayload, buyerPublicKeyHex, hashResult } from "./casper.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");

const app = express();
app.use(express.json());

// --- Integration status (real vs simulated) ---
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    integrations: {
      llm: { live: llmEnabled(), model: config.llm.model },
      x402: { live: x402Enabled(), network: config.x402.network },
      casper: { live: casperEnabled() || casperTransferEnabled(), chainName: config.casper.chainName, mode: casperEnabled() ? "contract" : casperTransferEnabled() ? "transfer" : "sim" }
    },
    buyerPublicKey: buyerPublicKeyHex()
  });
});

app.get("/api/catalog", (_req, res) => {
  res.json({ services, taskProfiles });
});

// --- Orchestrate one autonomous paid task end to end ---
app.post("/api/run", async (req, res) => {
  const { task: taskKey = "yield", budget = 42, autoPay = true, requireReputation = true } = req.body || {};
  const profile = taskProfiles[taskKey];
  if (!profile) return res.status(400).json({ error: `Unknown task: ${taskKey}` });

  const required = servicesForTask(taskKey);
  const trace = [];
  const push = (title, detail, extra = {}) => trace.push({ title, detail, ...extra });

  push("Task created", profile.request);

  // Policy gate: human-in-the-loop switch.
  if (!autoPay) {
    push("Payment blocked", "Policy disabled autonomous x402 payments. Human approval is required.");
    return res.json({
      status: "blocked",
      decision: { decision: "reject", reason: "Autonomous payment policy is disabled.", confidence: 0 },
      trace,
      receipt: null
    });
  }

  // Step 3: real (or heuristic) agent decision.
  const decision = await decide({
    task: profile,
    requiredServices: required,
    budget: Number(budget),
    requireReputation: Boolean(requireReputation)
  });
  push(
    `Agent decision: ${decision.decision}`,
    `${decision.reason}${decision.simulated ? " [heuristic]" : ` [LLM: ${decision.model}]`}`,
    { confidence: decision.confidence }
  );

  if (decision.decision === "reject") {
    return res.json({ status: "rejected", decision, trace, receipt: null });
  }

  // Step 1 + 2: for each service run a real x402 settlement, then notarize on Casper.
  const settlements = [];
  let totalPaidCspr = 0;
  try {
    for (const service of required) {
      const resourceUrl = `casper://agentpay/${service.id}`;
      const ch = challenge(service);
      const requirements = ch.accepts[0];
      push("x402 challenge received", `${service.name} requires ${service.price.toFixed(2)} CSPR (HTTP 402).`);

      const settlement = await verifyAndSettle({
        requirements,
        resourceUrl,
        signPayment: createSignedPaymentPayload
      });

      if (!settlement.settled) {
        push("Payment failed", `x402 settlement rejected for ${service.name}: ${settlement.reason || "unknown"}.`);
        return res.json({ status: "rejected", decision, trace, receipt: null });
      }

      totalPaidCspr += service.price;
      settlements.push({ service, settlement });
      push(
        `x402 authorization verified: ${service.name}`,
        `${settlement.simulated ? "[simulated] " : ""}EIP-712 proof ${String(settlement.proofHash).slice(0, 22)}... accepted by facilitator.`,
        { txHash: settlement.txHash }
      );
    }

    push("Services executed", required.map((s) => s.name).join(" -> "));

    // Step 2: record the aggregate settlement receipt on the Casper contract.
    const taskResultHash = hashResult({ task: taskKey, result: profile.result, settlements: settlements.map((s) => s.service.id) });
    const primary = settlements[0]?.settlement;
    const settlementReceipt = {
      receiptId: "rcpt_" + Date.now().toString(36),
      fromAgent: buyerPublicKeyHex() || "research-agent",
      toAgent: settlements.map((s) => s.service.owner).join(","),
      serviceId: settlements.map((s) => s.service.id).join(","),
      amountMotes: settlements.reduce((sum, s) => sum + BigInt(s.settlement.amount || "0"), 0n).toString(),
      x402ProofHash: primary?.proofHash || "",
      taskResultHash
    };

    const onchain = await recordSettlement(settlementReceipt);
    const settleMode = onchain.simulated ? "[simulated] " : onchain.mode === "transfer" ? "[testnet transfer] " : "[contract] ";
    push(
      "Casper settlement recorded",
      `${settleMode}tx ${String(onchain.deployHash).slice(0, 24)}... settles the agent's payment on Casper Testnet.`,
      { deployHash: onchain.deployHash }
    );

    return res.json({
      status: "settled",
      decision,
      trace,
      receipt: {
        deployHash: onchain.deployHash,
        deploySimulated: onchain.simulated,
        paymentProof: primary?.proofHash || null,
        paymentSimulated: settlements.some((s) => s.settlement.simulated),
        serviceIds: settlements.map((s) => s.service.id),
        totalPaidCspr: totalPaidCspr.toFixed(2),
        reputationDelta: "+3 successful paid task",
        taskResultHash,
        result: profile.result
      }
    });
  } catch (err) {
    push("Error", err.message);
    return res.status(500).json({ status: "error", decision, trace, error: err.message });
  }
});

// Serve the static frontend.
app.use(express.static(rootDir));

app.listen(config.port, () => {
  console.log(`AgentPay Router running at http://127.0.0.1:${config.port}`);
  console.log(
    `Integrations -> LLM:${llmEnabled() ? "live" : "sim"}  x402:${x402Enabled() ? "live" : "sim"}  Casper:${casperEnabled() ? "contract" : casperTransferEnabled() ? "transfer" : "sim"}`
  );
});
