import dotenv from "dotenv";

dotenv.config();

function bool(value, fallback = false) {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

export const config = {
  port: Number(process.env.PORT || 5173),

  // --- Step 3: Real LLM agent decision (OpenAI-compatible Chat Completions) ---
  llm: {
    apiKey: process.env.LLM_API_KEY || "",
    baseUrl: (process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
    model: process.env.LLM_MODEL || "gpt-4o-mini"
  },

  // --- Step 1: Real x402 payment flow (CSPR.cloud x402 Facilitator) ---
  // The facilitator settles the `exact` scheme using CEP-18 tokens authorized
  // via EIP-712 signatures. Docs: https://docs.cspr.cloud/x402-facilitator-api
  x402: {
    facilitatorUrl: (process.env.CASPER_X402_FACILITATOR_URL || "https://x402-facilitator.cspr.cloud").replace(/\/$/, ""),
    // CAIP-2 network id: "casper:casper-test" (testnet) or "casper:casper" (mainnet).
    network: process.env.X402_NETWORK || "casper:casper-test",
    // CSPR.cloud access token (UUID) from https://console.cspr.build.
    accessToken: process.env.CSPR_CLOUD_ACCESS_KEY || "",
    // CEP-18 token contract package hash used as the payment asset.
    asset: process.env.X402_ASSET || "",
    // Payee public key hex (receives the CEP-18 micropayment).
    payTo: process.env.X402_PAY_TO || "",
    maxTimeoutSeconds: Number(process.env.X402_TIMEOUT_SECONDS || 900),
    // HTTP timeout for facilitator calls (settle waits for on-chain confirmation).
    requestTimeoutMs: Number(process.env.X402_REQUEST_TIMEOUT_MS || 90000),
    // If true, call facilitator /settle (needs the buyer to hold the asset).
    // Default false: verify the x402 authorization, settle on-chain via transfer.
    facilitatorSettle: bool(process.env.X402_FACILITATOR_SETTLE, false),
    // EIP-712 domain fields for the CEP-18 token (must match the on-chain token).
    assetExtra: {
      name: process.env.X402_ASSET_NAME || "Wrapped CSPR",
      version: process.env.X402_ASSET_VERSION || "1",
      decimals: process.env.X402_ASSET_DECIMALS || "9",
      symbol: process.env.X402_ASSET_SYMBOL || "WCSPR"
    }
  },

  // --- Step 2: Real Casper Testnet settlement deploy (casper-js-sdk v5) ---
  casper: {
    rpcUrl: process.env.CASPER_NODE_RPC_URL || "",
    chainName: process.env.CASPER_CHAIN_NAME || "casper-test",
    // PEM contents OR an absolute path to the secret key PEM file.
    secretKeyPem: process.env.CASPER_SECRET_KEY_PEM || "",
    secretKeyPath: process.env.CASPER_SECRET_KEY_PATH || "",
    // Key algorithm: "ed25519" (default) or "secp256k1".
    keyAlgo: process.env.CASPER_KEY_ALGO || "ed25519",
    // Deployed AgentPay Router settlement contract hash (hex, no prefix).
    routerContractHash: process.env.CASPER_ROUTER_CONTRACT_HASH || "",
    // Gas payment for the settlement call, in motes.
    settlementPaymentMotes: process.env.CASPER_SETTLEMENT_PAYMENT_MOTES || "2500000000",
    // On-chain settlement transfer (when no contract is deployed): a real native
    // CSPR transfer to the service-provider account. Min testnet transfer is 2.5 CSPR.
    settlementPayeeHash:
      process.env.CASPER_SETTLEMENT_PAYEE_HASH ||
      (process.env.X402_PAY_TO || "").replace(/^00/, ""),
    settlementTransferMotes: process.env.CASPER_SETTLEMENT_TRANSFER_MOTES || "2500000000",
    // Optional CSPR.cloud access key, sent as the `Authorization` header.
    csprCloudAccessKey: process.env.CSPR_CLOUD_ACCESS_KEY || ""
  },

  // When true, missing real-integration config throws instead of simulating.
  strict: bool(process.env.AGENTPAY_STRICT, false)
};

export function llmEnabled() {
  return Boolean(config.llm.apiKey);
}

export function x402Enabled() {
  return Boolean(
    config.x402.facilitatorUrl &&
      config.x402.accessToken &&
      config.x402.payTo &&
      config.x402.asset &&
      (config.casper.secretKeyPem || config.casper.secretKeyPath)
  );
}

export function casperEnabled() {
  return Boolean(
    config.casper.rpcUrl &&
      config.casper.routerContractHash &&
      (config.casper.secretKeyPem || config.casper.secretKeyPath)
  );
}

// Real on-chain settlement via a native CSPR transfer (no deployed contract needed).
export function casperTransferEnabled() {
  return Boolean(
    config.casper.rpcUrl &&
      config.casper.settlementPayeeHash &&
      (config.casper.secretKeyPem || config.casper.secretKeyPath)
  );
}
