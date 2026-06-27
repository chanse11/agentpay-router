// Generates an ED25519 keypair for the buyer/router account and writes
// keys/secret_key.pem (+ public key info). The keys/ folder is gitignored.
//
//   node scripts/generate-key.mjs
//
import fs from "node:fs";
import path from "node:path";
import sdk from "casper-js-sdk";

const { PrivateKey, KeyAlgorithm } = sdk;

const outDir = path.join(process.cwd(), "keys");
fs.mkdirSync(outDir, { recursive: true });

const secretPath = path.join(outDir, "secret_key.pem");
if (fs.existsSync(secretPath)) {
  console.error(`Refusing to overwrite existing ${secretPath}. Delete it first if you want a new key.`);
  process.exit(1);
}

const key = await PrivateKey.generate(KeyAlgorithm.ED25519);
const pem = key.toPem();
const publicKeyHex = key.publicKey.toHex();
const accountHash = key.publicKey.accountHash().toHex();

fs.writeFileSync(secretPath, pem, "utf8");
fs.writeFileSync(path.join(outDir, "public_key_hex"), publicKeyHex, "utf8");

console.log("Wrote:", secretPath);
console.log("Public key (hex):", publicKeyHex);
console.log("Account hash:    ", accountHash);
console.log("");
console.log("Next:");
console.log("  1. Import keys/secret_key.pem into Casper Wallet (Import account -> secret key file).");
console.log("  2. Fund it at https://testnet.cspr.live/tools/faucet (one request per account).");
console.log("  3. In .env set:");
console.log("       CASPER_SECRET_KEY_PATH=./keys/secret_key.pem");
console.log(`       X402_PAY_TO=${publicKeyHex}   # if this account is also the payee`);
