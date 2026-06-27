# DoraHacks Submission — AgentPay Router

## Project Name

AgentPay Router

## Tagline

A Casper x402 payment + reputation router that lets autonomous AI agents
authorize, settle, and verify service payments on-chain without human approval.

## One-liner

Autonomous agents pay each other per request: the buyer signs an x402 / EIP-712
authorization, the CSPR.cloud facilitator verifies it, and the router settles the
payment on Casper Testnet — producing a verifiable on-chain receipt.

## Links

- GitHub: https://github.com/chanse11/agentpay-router
- Demo video: https://github.com/chanse11/agentpay-router/blob/main/docs/agentpay-router-live-demo.mp4
- Live example settlement tx (Casper Testnet):
  `88b93c07f02f316bd9edf514b797b9d1191001023360b14d23418d8040de5eb2`
  → https://testnet.cspr.live/deploy/88b93c07f02f316bd9edf514b797b9d1191001023360b14d23418d8040de5eb2

## Problem

AI agents can decide and coordinate, but they lack payment and trust
infrastructure. When one agent buys data or compute from another, the provider
needs proof of payment, the buyer needs proof of delivery, and downstream
systems need to verify the result — all without a human in the loop.

## Solution

AgentPay Router is the payment, proof, and reputation layer for agent-to-agent
commerce on Casper:

1. A service agent answers with an HTTP **402 Payment Required** challenge.
2. The buyer/router agent checks budget and reputation policy, then signs an
   **x402 EIP-712 `transfer_with_authorization`**.
3. The **CSPR.cloud x402 facilitator verifies** the authorization.
4. The router **settles on Casper Testnet** as a real transfer to the provider,
   returning a transaction hash other agents can verify before trusting results.

The differentiator is the routing + reputation + policy layer on top of x402
(which Casper already ships): deciding which services are worth buying,
enforcing budget/reputation rules, and producing verifiable receipts.

## What is real (live integrations)

Every layer is a real call and degrades to a clearly-labeled `[sim]` fallback
when a credential is absent, so the demo always runs. `GET /api/health` reports
live vs simulated.

- **Agent decision** — OpenAI-compatible LLM (`server/llm.js`); heuristic fallback.
- **x402 authorization** — live `/verify` against the CSPR.cloud facilitator
  (`https://x402-facilitator.cspr.cloud`), with EIP-712 signing via the official
  `@make-software/casper-x402` package. Verified responses return `isValid:true`.
- **On-chain settlement** — a real native CSPR transfer to the service provider
  via `casper-js-sdk` v5, producing a confirmed Casper Testnet transaction
  (see the example tx above).
- **Settlement contract (optional)** — an Odra contract (`contracts/odra-router`)
  with `record_payment` / `update_reputation` for richer on-chain receipts when
  deployed. Set `X402_FACILITATOR_SETTLE=1` to settle WCSPR through the
  facilitator instead of a native transfer.

## Casper / AI Toolkit usage

- **x402** (Casper AI Toolkit): real challenge + facilitator verification.
- **CSPR.cloud**: facilitator API + testnet Node RPC + REST (tx verification),
  authenticated with a CSPR.cloud access token.
- **casper-js-sdk v5**: signing and submitting the Casper Testnet settlement tx.
- **Odra**: settlement contract source for on-chain receipts and reputation.

## AI / Agentic system usage

An LLM-driven Research Agent decides whether buying external services is worth it
given the task, budget, and reputation policy. It rejects routes that exceed
budget and refuses low-reputation services when verification is required, then
autonomously authorizes payment and triggers settlement.

## Demo script

1. Open the dashboard (`npm start` → http://127.0.0.1:5173). The status line shows
   LLM / x402 / Casper as LIVE.
2. Choose "Find the best yield opportunity on Casper DeFi" and Run Agent Task.
3. Watch the trace: agent decision → x402 authorization verified by the
   facilitator → **Casper settlement transaction hash**.
4. Open the tx hash on testnet.cspr.live to prove it is a real on-chain transfer.
5. Lower the budget and run the RWA task to show budget / reputation-based
   rejection (autonomous policy enforcement).

## Tech stack

- Node + Express backend orchestration (`server/`)
- OpenAI-compatible LLM for autonomous agent decisions
- CSPR.cloud x402 facilitator + `@make-software/casper-x402` (EIP-712 / CEP-18)
- `casper-js-sdk` v5 for Casper Testnet settlement transactions
- Odra (Rust) settlement contract (`contracts/odra-router`)
- HTML / CSS / JS dashboard

## Future milestones

- Deploy the Odra settlement contract to Testnet and route receipts on-chain.
- Settle WCSPR via the facilitator (`transfer_with_authorization`) end-to-end.
- Persist agent identity + reputation, backed by contract state and CSPR.cloud.
- Let third-party agents register services on-chain.
- Integrate the Casper MCP Server so agents can query receipts directly.
