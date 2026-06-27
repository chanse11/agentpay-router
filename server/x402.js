import crypto from "node:crypto";
import { config, x402Enabled } from "./config.js";

// Convert a human token amount (e.g. 7.5) to integer base units for a CEP-18
// token with the given decimals (e.g. decimals=2 -> "750").
export function parseAmount(price, decimals) {
  const d = Number(decimals) || 0;
  const scaled = Math.round(Number(price) * 10 ** d);
  return BigInt(scaled).toString();
}

/**
 * Build a V2 x402 PaymentRequirements object for a paid service call, matching
 * the CSPR.cloud facilitator schema:
 * https://docs.cspr.cloud/x402-facilitator-api/verify
 */
export function buildPaymentRequirements(service) {
  return {
    scheme: "exact",
    network: config.x402.network,
    amount: parseAmount(service.price, config.x402.assetExtra.decimals),
    asset: config.x402.asset,
    payTo: config.x402.payTo,
    maxTimeoutSeconds: config.x402.maxTimeoutSeconds,
    extra: config.x402.assetExtra
  };
}

/** The service agent's HTTP 402 challenge (x402 v2). */
export function challenge(service) {
  return { httpStatus: 402, x402Version: 2, accepts: [buildPaymentRequirements(service)] };
}

async function facilitatorPost(path, body) {
  const res = await fetch(`${config.x402.facilitatorUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      authorization: config.x402.accessToken
    },
    body: JSON.stringify(body),
    // Settlement waits for on-chain confirmation; bound it so we never hang.
    signal: AbortSignal.timeout(config.x402.requestTimeoutMs)
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`facilitator ${path} -> HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return json;
}

/**
 * Run the real x402 verify + settle round-trip against the CSPR.cloud
 * facilitator. `signPayment(requirements, resourceUrl)` builds the
 * EIP-712-signed PaymentPayload (provided by the Casper module). Falls back to
 * a clearly-flagged simulation when x402 is not configured.
 */
export async function verifyAndSettle({ requirements, resourceUrl, signPayment }) {
  if (!x402Enabled()) {
    if (config.strict) {
      throw new Error(
        "x402 not configured (need CASPER_X402_FACILITATOR_URL, CSPR_CLOUD_ACCESS_KEY, X402_ASSET, X402_PAY_TO and a Casper key)."
      );
    }
    const proof = "x402sim_" + crypto.randomBytes(24).toString("hex");
    return {
      simulated: true,
      verified: true,
      settled: true,
      proofHash: proof,
      txHash: null,
      payer: null,
      amount: requirements.amount,
      note: "Simulated x402 settlement. Configure the CSPR.cloud facilitator for real settlement."
    };
  }

  const paymentPayload = await signPayment(requirements, resourceUrl);
  const body = { paymentPayload, paymentRequirements: requirements };

  const verify = await facilitatorPost("/verify", body);
  if (!verify.isValid) {
    return {
      simulated: false,
      verified: false,
      settled: false,
      reason: verify.invalidReason || verify.invalidMessage || "verification failed",
      raw: verify
    };
  }

  // The EIP-712 signature IS the cryptographic x402 payment authorization proof.
  const proof = paymentPayload.payload?.signature || null;

  // Default: verify-only. The authorization is proven; on-chain settlement is
  // performed by the Casper native transfer step (no asset balance required).
  if (!config.x402.facilitatorSettle) {
    return {
      simulated: false,
      verified: true,
      settled: true,
      settledViaFacilitator: false,
      proofHash: proof,
      txHash: null,
      payer: verify.payer || null,
      amount: requirements.amount
    };
  }

  // Opt-in: settle through the facilitator (requires the buyer to hold the asset).
  const settle = await facilitatorPost("/settle", body);
  return {
    simulated: false,
    verified: true,
    settled: settle.success === true,
    settledViaFacilitator: true,
    proofHash: settle.transaction || proof,
    txHash: settle.transaction || null,
    payer: settle.payer || verify.payer || null,
    amount: requirements.amount,
    reason: settle.success ? undefined : settle.errorReason || settle.errorMessage,
    raw: settle
  };
}
