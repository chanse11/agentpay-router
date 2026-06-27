# AgentPay Router Casper Contract Interface

This document describes the AgentPay Router settlement contract. It is
implemented with the Odra framework in `contracts/odra-router` (see that
folder's README for build/test/deploy). The signatures below match that
implementation.

## Storage

### Agent

```text
agent_id: String
public_key: String
service_url: String
metadata_hash: String
reputation: u64
created_at: u64
```

### Service

```text
service_id: String
agent_id: String
price_motes: U512
description_hash: String
active: bool
```

### PaymentReceipt

```text
receipt_id: String
from_agent: String
to_agent: String
service_id: String
amount_motes: U512
x402_proof_hash: String
task_result_hash: String
timestamp: u64
```

## Entry Points

### register_agent

Registers an autonomous agent identity.

```text
register_agent(agent_id, public_key, service_url, metadata_hash)
```

### register_service

Registers a paid service offered by an agent.

```text
register_service(service_id, agent_id, price_motes, description_hash)
```

### record_payment

Records an x402-style payment proof after a service challenge is satisfied.

```text
record_payment(receipt_id, from_agent, to_agent, service_id, amount_motes, x402_proof_hash)
```

### record_task_result

Links a service result to an existing receipt.

```text
record_task_result(receipt_id, task_result_hash)
```

### update_reputation

Updates agent reputation after verified delivery. `delta` is signed; the result is clamped to 0..100.

```text
update_reputation(agent_id, delta: i64)
```

## Events

```text
AgentRegistered(agent_id, public_key)
ServiceRegistered(service_id, agent_id, price_motes)
PaymentRecorded(receipt_id, from_agent, to_agent, service_id, amount_motes)
TaskResultRecorded(receipt_id, task_result_hash)
ReputationUpdated(agent_id, new_reputation)
```

## Testnet Demo Mapping

The backend (`server/`) produces real values when configured and clearly-labeled
simulations otherwise:

- `deploy_hash` — real `casper-js-sdk` deploy hash when `CASPER_*` env is set, else `[sim]`.
- `x402_proof_hash` — real facilitator proof when `CASPER_X402_FACILITATOR_URL` is set, else `[sim]`.
- `service_id`, `task_result_hash` — always real (derived from the run).
- `reputation_delta` — applied via `update_reputation` once the contract is deployed.

Deploy the Odra contract (see `odra-router/README.md`), then set
`CASPER_ROUTER_CONTRACT_HASH` so `record_payment` is called for real.
