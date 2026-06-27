import { config, llmEnabled } from "./config.js";

const SYSTEM_PROMPT = `You are the Research Agent inside AgentPay Router, an autonomous agent on Casper.
You receive a task, a list of paid services (each with price in CSPR and a reputation score 0-100),
a spending budget in CSPR, and policy flags. You must decide whether buying the required services is
worth it, given the budget and reputation policy.

Return STRICT JSON only, matching this schema:
{
  "decision": "buy" | "reject",
  "reason": "one or two sentences of plain reasoning",
  "confidence": <integer 0-100>,
  "rejectionType": "none" | "budget" | "reputation" | "policy"
}
Reject if total cost exceeds budget (rejectionType "budget").
Reject if reputation policy is on and any required service scores below 86 (rejectionType "reputation").
Otherwise decide "buy" with a confidence reflecting data quality and reputation.`;

function heuristicDecision({ task, requiredServices, budget, requireReputation }) {
  const totalCost = requiredServices.reduce((s, x) => s + x.price, 0);
  if (totalCost > budget) {
    return {
      decision: "reject",
      reason: `Required ${totalCost.toFixed(2)} CSPR exceeds the ${budget.toFixed(2)} CSPR budget.`,
      confidence: 0,
      rejectionType: "budget",
      simulated: true
    };
  }
  const lowRep = requireReputation && requiredServices.find((x) => x.reputation < 86);
  if (lowRep) {
    return {
      decision: "reject",
      reason: `${lowRep.name} reputation ${lowRep.reputation}/100 is below the policy threshold.`,
      confidence: 0,
      rejectionType: "reputation",
      simulated: true
    };
  }
  const avgRep = requiredServices.reduce((s, x) => s + x.reputation, 0) / requiredServices.length;
  return {
    decision: "buy",
    reason: `${task.title}: services fit the budget and average reputation is ${avgRep.toFixed(0)}/100, so the paid route is worth it.`,
    confidence: Math.round(Math.min(95, avgRep)),
    rejectionType: "none",
    simulated: true
  };
}

export async function decide(input) {
  if (!llmEnabled()) {
    if (config.strict) throw new Error("LLM not configured (set LLM_API_KEY).");
    return heuristicDecision(input);
  }

  const userPayload = {
    task: input.task,
    budgetCspr: input.budget,
    requireReputation: input.requireReputation,
    requiredServices: input.requiredServices.map((s) => ({
      id: s.id,
      name: s.name,
      priceCspr: s.price,
      reputation: s.reputation,
      description: s.description
    }))
  };

  try {
    const res = await fetch(`${config.llm.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.llm.apiKey}`
      },
      body: JSON.stringify({
        model: config.llm.model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(userPayload) }
        ]
      })
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`LLM HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    return {
      decision: parsed.decision === "reject" ? "reject" : "buy",
      reason: String(parsed.reason || "").slice(0, 400),
      confidence: Math.max(0, Math.min(100, Math.round(Number(parsed.confidence) || 0))),
      rejectionType: parsed.rejectionType || "none",
      simulated: false,
      model: config.llm.model
    };
  } catch (err) {
    // Fail safe: fall back to the deterministic policy rather than crashing the demo.
    const fallback = heuristicDecision(input);
    fallback.reason = `LLM call failed (${err.message}). Policy fallback: ${fallback.reason}`;
    return fallback;
  }
}
