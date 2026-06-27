# Casper Agentic Buildathon 2026 — Official Requirements & Plan

> Source: https://dorahacks.io/hackathon/casper-agentic-buildathon/detail
> (Qualification Round). This file is the single source of truth for what we
> must deliver. Every task below maps to an official requirement.

## Key facts

- **Organizer:** Casper Association · **Platform:** DoraHacks
- **Prize pool:** $150,000 (Cash $30k + x402 Ecosystem Credits $100k + in-kind $20k)
- **Track:** One unified "Casper Innovation Track"
- **Focus:** Agentic AI, with emphasis on DeFi and/or Real-World Assets (RWA)
- **Structure:** Qualification Round (community vote + prototype qualification) → Final Round (jury)

## Timeline

| Date | Milestone |
| --- | --- |
| 2026-06-01 | Submissions open |
| **2026-07-01 08:00** | **Qualification Round submission deadline** |
| 2026-07-01 .. 07-05 | Qualification evaluation + finalist selection |
| 2026-07-06 .. 07-19 | Final Round (2 weeks) |
| Late July 2026 | Final judging + winners |

## Mandatory submission requirements (ALL required)

1. **Working prototype deployed on Casper Testnet with a transaction-producing
   on-chain component.** (This is also the Builder Merit Path qualification gate.)
2. **Open-source GitHub/GitLab/Bitbucket repository** with a README containing
   documentation and usage instructions.
3. **Public demo video** explaining the project, features, and a walkthrough.
4. Register as Hacker + **Submit BUIDL** on DoraHacks (attach repo + video).

## Eligibility

- Solo or any team size.
- **All code/content must be original and newly developed for the Buildathon.**
- Focus on Agentic AI applications (DeFi and/or RWA emphasis).

## Qualification advancement

- **Community Voting Path:** top 3 by votes on the CSPR.fans app advance directly.
- **Builder Merit Path:** all others must meet the technical bar (working testnet
  prototype with a transaction-producing on-chain component) to advance to jury.

## Final Round judging criteria

| Criterion | What it rewards |
| --- | --- |
| Technical Execution | Code quality, architecture, completeness |
| Innovation & Originality | Novel approach, tech, ideas |
| Use of AI / Agentic Systems | Meaningful AI agent / autonomy integration |
| Real-World Applicability | Usefulness in DeFi & RWA |
| User Experience & Design | Interface and interaction quality |
| Working Smart Contracts | Functional, deployed contracts on Casper Testnet |
| Long-Term Launch Plans | Real project, socials, deployment plans |
| Potential for Long-Term Impact | Casper ecosystem growth |

## Encouraged toolkit (we already use these)

- x402 micropayments (CSPR.cloud facilitator) — IN USE (verify live)
- CSPR.cloud APIs (node RPC + access token) — configured
- Odra smart contract framework — contract written (`contracts/odra-router`)
- MCP servers, CSPR.click Agent Skill — optional enhancers

## Our submission checklist (live status)

| # | Requirement | Status | Owner task |
| --- | --- | --- | --- |
| 1 | Testnet prototype with on-chain tx | ✅ DONE | Real testnet settlement tx confirmed (deploy `88b93c07...`, block 8315021) |
| 2 | Public repo + README | ☐ TODO | Push to GitHub; verify no secrets committed |
| 3 | Demo video | ⛔ NOT MET | Record dashboard walkthrough incl. real tx hash |
| 4 | DoraHacks BUIDL submitted | ☐ TODO | Register + submit with repo + video |
| — | Originality | ✅ | New code for the buildathon |
| — | Agentic AI + DeFi/RWA focus | ✅ | Router + LLM decision + DeFi/RWA tasks |

## Verified facts (live integration)

- CSPR.cloud x402 facilitator: `https://x402-facilitator.cspr.cloud` — `/verify` returns `isValid:true` for our signed payload ✅
- CSPR.cloud REST (testnet): `https://api.testnet.cspr.cloud`
- WCSPR test token (asset): package `3d80df21ba4ee4d66a2a1f60c32570dd5685e4b279f6538162a5fd1314847c1e`, decimals 9, symbol WCSPR
- Buyer/router account (x402 address): `00cfd5cfdbdbe680762afd41c46fc26791a51e2ef4313aa64d94e0ef10854a876f`
- **First real on-chain settlement tx:** `88b93c07f02f316bd9edf514b797b9d1191001023360b14d23418d8040de5eb2`
  (block 8315021, 2.5 CSPR transfer buyer → provider). View on testnet.cspr.live.

## On-chain settlement design

- x402 layer (live): the router issues an HTTP 402 challenge, the buyer key signs
  an EIP-712 `transfer_with_authorization`, and the CSPR.cloud facilitator
  **verifies** the authorization (`/verify` → `isValid`).
- Casper settlement (live): the verified payment is then settled on Casper Testnet
  as a real native CSPR transfer to the service provider (`settleByTransfer`),
  producing the receipt's transaction hash.
- Optional: set `X402_FACILITATOR_SETTLE=1` to settle WCSPR through the facilitator
  instead (requires the buyer to hold WCSPR).

## Working agreement

- Follow this document. When a step is done, update the status table above.
- Do not commit `.env`, `keys/`, or any `*.pem` (already gitignored).
- Prefer the real Casper AI Toolkit components over custom reimplementations.
