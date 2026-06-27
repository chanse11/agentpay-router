# DoraHacks Submission Draft

## Project Name

AgentPay Router

## Tagline

A Casper x402 payment router that lets autonomous AI agents pay, verify, and consume services without human approval.

## Short Description

AgentPay Router demonstrates how autonomous AI agents participate in the agent economy. An LLM-driven Research Agent receives a task, discovers paid services, evaluates a real x402 payment challenge, settles through the Casper x402 Facilitator, and records a verifiable settlement receipt on Casper Testnet via an Odra contract. Other agents and dApps can verify the receipt before trusting the result.

## What is real

Every layer is a real integration that degrades to a clearly-labeled simulation when credentials are absent, so the demo always runs:

- Agent decision: OpenAI-compatible LLM call.
- Payment: real x402 via the CSPR.cloud facilitator, using `@make-software/casper-x402` for EIP-712 `transfer_with_authorization` signing of CEP-18 micropayments.
- Settlement: `casper-js-sdk` v5 deploy calling the Odra contract.
- Contract: Odra settlement contract (`contracts/odra-router`).

Buildathon teams receive sponsored facilitator access; a free CSPR.cloud access token (console.cspr.build) and testnet faucet funds are all that's otherwise needed. `GET /api/health` reports which integrations are live. Simulated values are prefixed `[sim]`.

## Problem

AI agents are becoming capable of making decisions and coordinating work, but they still lack reliable payment and trust infrastructure. If one agent needs data from another agent, the service provider needs proof of payment, the buyer needs proof of service delivery, and downstream systems need a way to verify the result.

## Solution

AgentPay Router provides a payment and settlement layer for agent-to-agent service calls:

- A service agent issues an x402-style pay-per-request challenge.
- The buyer agent checks budget, reputation, and route value.
- The router creates a payment proof.
- The service agents execute the requested work.
- Casper records the payment proof, service IDs, result hash, and reputation delta.

## Casper Usage

The project is designed around Casper Testnet settlement. The settlement contract stores:

- registered agent identities
- registered paid services
- payment proof hashes
- task result hashes
- reputation updates
- service execution history

## AI / Agentic System Usage

An LLM-driven Research Agent (OpenAI-compatible, `server/llm.js`) decides whether to pay for external services given budget and reputation policy. It rejects routes that exceed budget and refuses low-reputation services when verification is required. Without an LLM key it falls back to a deterministic policy heuristic.

## Demo Script

1. Open the dashboard. The status line shows which integrations are LIVE vs SIM.
2. Choose "Find the best yield opportunity on Casper DeFi."
3. Keep autonomous payments enabled.
4. Click "Run Agent Task."
5. Show the LLM decision, x402 challenge, facilitator settlement, service route, and Casper settlement receipt.
6. Lower the budget below the required cost and run again to show budget-based rejection.
7. Choose the RWA task with reputation verification enabled to show how the router refuses low-reputation services.

## Tech Stack

- Node + Express backend orchestration
- OpenAI-compatible LLM for autonomous agent decisions
- CSPR.cloud x402 Facilitator + `@make-software/casper-x402` (CEP-18 / EIP-712)
- `casper-js-sdk` v5 for Casper Testnet deploys
- Odra (Rust) settlement contract (`contracts/odra-router`)
- HTML / CSS / JS dashboard

## Future Milestones

- Deploy the Odra settlement contract to Casper Testnet mainline and wire the contract hash.
- Persist agent identity and reputation pages backed by contract state.
- Allow third-party agents to register services on-chain.
- Integrate the Casper MCP Server so agents can query receipts directly.
- Add CSPR.cloud indexing for receipt history and reputation analytics.
