# AgentPay Router Contract (Odra)

Casper settlement contract for the AgentPay Router. Stores agent identities,
paid services, x402 payment receipts, and reputation. Written with the
[Odra](https://odra.dev) framework (targeting Odra 2.1).

## Prerequisites

This machine used for the prototype has Node but **no Rust toolchain**, so the
contract has not been compiled here. To build and deploy you need:

```bash
# 1. Rust + the wasm target
rustup target add wasm32-unknown-unknown

# 2. Odra CLI (cargo-odra)
cargo install cargo-odra --locked

# 3. casper-client (for deploy) or use the odra livenet backend
```

## Build

```bash
cd contracts/odra-router
cargo odra build
# -> wasm artifact under ./wasm/AgentPayRouter.wasm
```

## Test

```bash
cargo odra test          # runs the MockVM unit tests in src/lib.rs
```

## Deploy to Casper Testnet

Option A — `casper-client`:

```bash
casper-client put-transaction session \
  --node-address https://rpc.testnet.casperlabs.io \
  --chain-name casper-test \
  --secret-key ./keys/secret_key.pem \
  --transaction-path ./wasm/AgentPayRouter.wasm \
  --payment-amount 200000000000
```

Option B — Odra livenet backend (`cargo odra` with the `casper-livenet` feature)
using the env vars in the repo `.env`.

## Wire the backend to the deployed contract

After deploy, copy the resulting contract hash into the repo root `.env`:

```env
CASPER_NODE_RPC_URL=https://rpc.testnet.casperlabs.io/rpc
CASPER_ROUTER_CONTRACT_HASH=<hex hash from deploy>
CASPER_SECRET_KEY_PATH=./keys/secret_key.pem
```

The router (`server/casper.js`) then calls `record_payment` for real instead of
producing a simulated deploy hash.

## Entry points

| Entry point          | Purpose                                              |
| -------------------- | ---------------------------------------------------- |
| `register_agent`     | Register an autonomous agent identity                |
| `register_service`   | Register a paid service offered by an agent          |
| `record_payment`     | Store an x402-settled payment receipt                |
| `record_task_result` | Attach a task result hash to a receipt               |
| `update_reputation`  | Adjust agent reputation after verified delivery      |

Read-only views: `get_agent`, `get_service`, `get_receipt`, `get_reputation`,
`total_receipts`.
