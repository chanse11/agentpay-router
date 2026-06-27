// Query the WCSPR contract definition from the node to read the `deposit`
// entry point's arguments (decides whether wrapping needs session WASM).
//
//   node scripts/inspect-deposit.mjs
//
import { config } from "../server/config.js";

const RPC = config.casper.rpcUrl; // https://node.testnet.casper.network/rpc
const contractKey = "hash-4b351800391d4a47a7f932e9498516ed59bb41056d2743c14a8b1a5f90f67b3e";

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
  });
  return res.json();
}

// Casper 2.0: query_global_state with latest state.
let out = await rpc("query_global_state", { state_identifier: null, key: contractKey, path: [] });
if (out.error) {
  console.log("query_global_state error:", JSON.stringify(out.error));
  // Fallback: state_get_item needs a state root hash.
  const sr = await rpc("chain_get_state_root_hash", {});
  const srh = sr.result?.state_root_hash;
  out = await rpc("state_get_item", { state_root_hash: srh, key: contractKey, path: [] });
}

const stored = out.result?.stored_value;
const contract = stored?.Contract || stored?.contract;
if (!contract) {
  console.log("Raw result (truncated):", JSON.stringify(out.result).slice(0, 1500));
  process.exit(0);
}

const eps = contract.entry_points || contract.entryPoints || [];
const deposit = eps.find((e) => (e.name || e.entry_point?.name) === "deposit") || null;
console.log("Entry points:", eps.map((e) => e.name || e.entry_point?.name).join(", "));
console.log("\ndeposit definition:");
console.log(JSON.stringify(deposit, null, 2));
