import fs from "node:fs";
import crypto from "node:crypto";
import casperSdk from "casper-js-sdk";
import { toClientCasperSigner } from "@make-software/casper-x402";
import { ExactCasperScheme } from "@make-software/casper-x402/exact/client";
import { config, casperEnabled, casperTransferEnabled } from "./config.js";

const { Args, CLValue, ContractCallBuilder, Hash, HttpHandler, PrivateKey, RpcClient, KeyAlgorithm, AccountHash, NativeTransferBuilder } = casperSdk;

function keyAlgorithm() {
  return (config.casper.keyAlgo || "ed25519").toLowerCase() === "secp256k1"
    ? KeyAlgorithm.SECP256K1
    : KeyAlgorithm.ED25519;
}

let cachedKey = null;
let cachedRpc = null;

function loadPrivateKey() {
  if (cachedKey) return cachedKey;
  let pem = config.casper.secretKeyPem;
  if (!pem && config.casper.secretKeyPath) {
    pem = fs.readFileSync(config.casper.secretKeyPath, "utf8");
  }
  if (!pem) throw new Error("No Casper secret key configured.");
  // Support either ED25519 or SECP256K1 PEM; algorithm comes from config.
  cachedKey = PrivateKey.fromPem(pem, keyAlgorithm());
  return cachedKey;
}

function getRpc() {
  if (cachedRpc) return cachedRpc;
  const handler = new HttpHandler(config.casper.rpcUrl);
  if (config.casper.csprCloudAccessKey) {
    handler.setCustomHeaders({ Authorization: config.casper.csprCloudAccessKey });
  }
  cachedRpc = new RpcClient(handler);
  return cachedRpc;
}

export function buyerPublicKeyHex() {
  if (!casperEnabled()) return null;
  try {
    return loadPrivateKey().publicKey.toHex();
  } catch {
    return null;
  }
}

/**
 * Build a fully EIP-712-signed x402 PaymentPayload using the official
 * @make-software/casper-x402 ExactCasperScheme. The buyer (router) key signs
 * the CEP-18 `transfer_with_authorization` typed-data; the key never leaves
 * the backend. The returned object matches the CSPR.cloud facilitator schema.
 */
export async function createSignedPaymentPayload(requirements, resourceUrl) {
  const key = loadPrivateKey();
  const signer = toClientCasperSigner(key);
  const scheme = new ExactCasperScheme(signer);
  const result = await scheme.createPaymentPayload(2, requirements);
  return {
    x402Version: result.x402Version,
    resource: { url: resourceUrl },
    accepted: {
      scheme: requirements.scheme,
      network: requirements.network,
      asset: requirements.asset,
      amount: requirements.amount,
      payTo: requirements.payTo,
      maxTimeoutSeconds: requirements.maxTimeoutSeconds
    },
    payload: result.payload
  };
}

export function hashResult(obj) {
  return crypto.createHash("sha256").update(JSON.stringify(obj)).digest("hex");
}

/**
 * Settle on Casper Testnet. Three modes, in priority order:
 *  1. If the Odra router contract is deployed -> call `record_payment`.
 *  2. Else if a key + payee are configured -> a REAL native CSPR transfer to the
 *     service-provider account (the agent's on-chain settlement payment).
 *  3. Else -> a clearly-flagged simulated hash.
 * Returns the real transaction hash for modes 1 and 2.
 */
export async function recordSettlement(receipt) {
  if (!casperEnabled()) {
    // Mode 2: real native CSPR transfer (no deployed contract required).
    if (casperTransferEnabled()) {
      return settleByTransfer(receipt);
    }
    if (config.strict) {
      throw new Error(
        "Casper not configured (set CASPER_NODE_RPC_URL + a secret key, plus a payee or contract hash)."
      );
    }
    return {
      simulated: true,
      deployHash: "deploysim_" + crypto.randomBytes(28).toString("hex"),
      note: "Simulated Casper settlement. Configure CASPER_NODE_RPC_URL + key (+ payee or contract hash) for a real tx."
    };
  }

  const key = loadPrivateKey();
  const rpc = getRpc();

  const transaction = new ContractCallBuilder()
    .byHash(Hash.fromHex(config.casper.routerContractHash))
    .entryPoint("record_payment")
    .runtimeArgs(
      Args.fromMap({
        receipt_id: CLValue.newCLString(receipt.receiptId),
        from_agent: CLValue.newCLString(receipt.fromAgent),
        to_agent: CLValue.newCLString(receipt.toAgent),
        service_id: CLValue.newCLString(receipt.serviceId),
        amount_motes: CLValue.newCLUInt512(receipt.amountMotes),
        x402_proof_hash: CLValue.newCLString(receipt.x402ProofHash || ""),
        task_result_hash: CLValue.newCLString(receipt.taskResultHash || "")
      })
    )
    .from(key.publicKey)
    .chainName(config.casper.chainName)
    .payment(config.casper.settlementPaymentMotes)
    .build();

  await transaction.sign(key);
  const result = await rpc.putTransaction(transaction);

  const deployHash =
    result?.transactionHash?.toHex?.() ||
    result?.transactionHash?.transactionV1?.toHex?.() ||
    (typeof result?.transactionHash === "string" ? result.transactionHash : null);

  return {
    simulated: false,
    deployHash,
    chainName: config.casper.chainName,
    contractHash: config.casper.routerContractHash,
    raw: result
  };
}

function extractTxHash(result) {
  return (
    result?.transactionHash?.toHex?.() ||
    result?.transactionHash?.transactionV1?.toHex?.() ||
    result?.transactionHash?.transactionV1Hash?.toHex?.() ||
    (typeof result?.transactionHash === "string" ? result.transactionHash : null)
  );
}

/**
 * Mode 2: a REAL native CSPR transfer to the service-provider account, signed
 * by the buyer/router key and submitted to Casper Testnet. This is the agent's
 * on-chain settlement payment and produces a verifiable transaction hash.
 */
export async function settleByTransfer(receipt) {
  const key = loadPrivateKey();
  const rpc = getRpc();

  const transaction = new NativeTransferBuilder()
    .from(key.publicKey)
    .targetAccountHash(AccountHash.fromString(`account-hash-${config.casper.settlementPayeeHash}`))
    .amount(config.casper.settlementTransferMotes)
    .chainName(config.casper.chainName)
    .payment(100_000_000)
    .id(Date.now() % 1_000_000)
    .build();

  await transaction.sign(key);
  const result = await rpc.putTransaction(transaction);

  return {
    simulated: false,
    mode: "transfer",
    deployHash: extractTxHash(result),
    chainName: config.casper.chainName,
    payeeAccountHash: config.casper.settlementPayeeHash,
    amountMotes: config.casper.settlementTransferMotes,
    raw: result
  };
}
