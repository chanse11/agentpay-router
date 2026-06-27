// Shared agent + service registry. In production these would be read from the
// Casper Router contract (registered agents / services). For the prototype they
// are defined here and served to the frontend via /api/catalog.

export const services = [
  {
    id: "svc-yield-oracle",
    name: "Yield Oracle Agent",
    owner: "Data Agent",
    price: 0.6,
    description: "Fresh pool APY, liquidity depth, and protocol health scores.",
    reputation: 92
  },
  {
    id: "svc-risk-verifier",
    name: "Risk Verifier Agent",
    owner: "Verifier Agent",
    price: 0.4,
    description: "Counterparty screening and payment anomaly checks.",
    reputation: 88
  },
  {
    id: "svc-rwa-pricer",
    name: "RWA Pricing Agent",
    owner: "Pricing Agent",
    price: 0.8,
    description: "Discounted cash-flow estimate for tokenized invoices and notes.",
    reputation: 84
  },
  {
    id: "svc-settlement-notary",
    name: "Settlement Notary",
    owner: "Casper Router",
    price: 0.2,
    description: "Writes payment receipt, task result hash, and reputation delta.",
    reputation: 99
  }
];

export const taskProfiles = {
  yield: {
    title: "Find the best yield opportunity on Casper DeFi",
    request:
      "Research Agent needs fresh market data, protocol liquidity, and a verification receipt before recommending an allocation.",
    requiredServices: ["svc-yield-oracle", "svc-settlement-notary"],
    result:
      "Allocate only after APY remains above 8.4% and liquidity depth is stable for 3 consecutive checks."
  },
  risk: {
    title: "Check counterparty risk before a treasury payment",
    request:
      "Treasury Agent needs counterparty screening and a signed verification receipt before allowing a DAO payment.",
    requiredServices: ["svc-risk-verifier", "svc-settlement-notary"],
    result:
      "Approve with a reduced limit. The counterparty has normal activity, but the payment should be split into two tranches."
  },
  rwa: {
    title: "Price an RWA-backed credit note",
    request:
      "Research Agent needs an RWA pricing model and a settlement proof before quoting a credit note.",
    requiredServices: ["svc-rwa-pricer", "svc-risk-verifier", "svc-settlement-notary"],
    result:
      "Quote at a 13.2% discount with monthly re-verification. Risk is acceptable only if repayment data is refreshed."
  }
};

export function servicesForTask(taskKey) {
  const profile = taskProfiles[taskKey];
  if (!profile) return [];
  const wanted = new Set(profile.requiredServices);
  return services.filter((s) => wanted.has(s.id));
}
