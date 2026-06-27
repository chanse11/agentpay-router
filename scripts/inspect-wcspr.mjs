// Inspect the WCSPR token contract via CSPR.cloud REST API to find its entry
// points (so we know how to wrap CSPR -> WCSPR).
//
//   node scripts/inspect-wcspr.mjs
//
import { config } from "../server/config.js";

const PKG = config.x402.asset; // WCSPR contract package hash
const BASE = "https://api.testnet.cspr.cloud";
const headers = { accept: "application/json", authorization: config.x402.accessToken };

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { headers });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}

console.log("WCSPR package:", PKG);

const pkg = await get(`/contract-packages/${PKG}`);
console.log("\n/contract-packages ->", pkg.status);
console.log(JSON.stringify(pkg.json, null, 2).slice(0, 1500));

// Find the latest/active contract hash from the package.
const contracts =
  pkg.json?.contracts ||
  pkg.json?.data?.contracts ||
  (pkg.json?.latest_version_contract_hash ? [{ contract_hash: pkg.json.latest_version_contract_hash }] : []);

let contractHash =
  pkg.json?.latest_version_contract_hash ||
  contracts?.[0]?.contract_hash ||
  null;

if (!contractHash) {
  const list = await get(`/contract-packages/${PKG}/contracts`);
  console.log("\n/contracts ->", list.status);
  console.log(JSON.stringify(list.json, null, 2).slice(0, 1200));
  contractHash = list.json?.data?.[0]?.contract_hash || null;
}

console.log("\ncontractHash:", contractHash);

if (contractHash) {
  const c = await get(`/contracts/${contractHash}?includes=entry_points`);
  console.log("\n/contracts/{hash}?includes=entry_points ->", c.status);
  const eps = c.json?.entry_points || c.json?.data?.entry_points || c.json;
  console.log(JSON.stringify(eps, null, 2).slice(0, 3000));
}
