// Isolated test: build a signed x402 payment payload with the official scheme
// and call the real CSPR.cloud facilitator /verify (fast, no on-chain wait).
//
//   node scripts/test-x402-verify.mjs
//
import { config } from "../server/config.js";
import { buildPaymentRequirements } from "../server/x402.js";
import { createSignedPaymentPayload } from "../server/casper.js";

const service = { id: "svc-test", name: "Test", price: 0.01, description: "verify test" };

const requirements = buildPaymentRequirements(service);
console.log("paymentRequirements:", JSON.stringify(requirements, null, 2));

const resourceUrl = "casper://agentpay/svc-test";
const paymentPayload = await createSignedPaymentPayload(requirements, resourceUrl);
console.log("\npaymentPayload:", JSON.stringify(paymentPayload, null, 2));

const res = await fetch(`${config.x402.facilitatorUrl}/verify`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    accept: "application/json",
    authorization: config.x402.accessToken
  },
  body: JSON.stringify({ paymentPayload, paymentRequirements: requirements })
});

console.log("\n/verify HTTP", res.status);
console.log(await res.text());
