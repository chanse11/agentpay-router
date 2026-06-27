//! AgentPay Router settlement contract for Casper, written with the Odra framework.
//!
//! It stores autonomous-agent identities, paid services, and x402 payment
//! receipts, and tracks per-agent reputation. The off-chain router (see
//! ../../server) calls `record_payment` after a successful x402 settlement so
//! any other agent can verify the receipt on-chain before trusting a result.

use odra::casper_types::U512;
use odra::prelude::*;

/// A registered autonomous agent identity.
#[odra::odra_type]
pub struct Agent {
    pub public_key: String,
    pub service_url: String,
    pub metadata_hash: String,
    pub reputation: u64,
    pub created_at: u64,
}

/// A paid service offered by an agent.
#[odra::odra_type]
pub struct Service {
    pub agent_id: String,
    pub price_motes: U512,
    pub description_hash: String,
    pub active: bool,
}

/// An x402 payment receipt linking a payment proof to a service result.
#[odra::odra_type]
pub struct PaymentReceipt {
    pub from_agent: String,
    pub to_agent: String,
    pub service_id: String,
    pub amount_motes: U512,
    pub x402_proof_hash: String,
    pub task_result_hash: String,
    pub timestamp: u64,
}

#[odra::event]
pub struct AgentRegistered {
    pub agent_id: String,
    pub public_key: String,
}

#[odra::event]
pub struct ServiceRegistered {
    pub service_id: String,
    pub agent_id: String,
    pub price_motes: U512,
}

#[odra::event]
pub struct PaymentRecorded {
    pub receipt_id: String,
    pub from_agent: String,
    pub to_agent: String,
    pub service_id: String,
    pub amount_motes: U512,
}

#[odra::event]
pub struct TaskResultRecorded {
    pub receipt_id: String,
    pub task_result_hash: String,
}

#[odra::event]
pub struct ReputationUpdated {
    pub agent_id: String,
    pub new_reputation: u64,
}

/// Errors returned by the contract.
#[odra::odra_error]
pub enum Error {
    AgentAlreadyExists = 1,
    AgentNotFound = 2,
    ServiceAlreadyExists = 3,
    ReceiptAlreadyExists = 4,
    ReceiptNotFound = 5,
}

#[odra::module]
pub struct AgentPayRouter {
    agents: Mapping<String, Agent>,
    services: Mapping<String, Service>,
    receipts: Mapping<String, PaymentReceipt>,
    receipt_count: Var<u64>,
}

#[odra::module]
impl AgentPayRouter {
    /// Register an autonomous agent identity.
    pub fn register_agent(
        &mut self,
        agent_id: String,
        public_key: String,
        service_url: String,
        metadata_hash: String,
    ) {
        if self.agents.get(&agent_id).is_some() {
            self.env().revert(Error::AgentAlreadyExists);
        }
        let now = self.env().get_block_time();
        self.agents.set(
            &agent_id,
            Agent {
                public_key: public_key.clone(),
                service_url,
                metadata_hash,
                reputation: 50, // neutral starting reputation
                created_at: now,
            },
        );
        self.env().emit_event(AgentRegistered { agent_id, public_key });
    }

    /// Register a paid service offered by an agent.
    pub fn register_service(
        &mut self,
        service_id: String,
        agent_id: String,
        price_motes: U512,
        description_hash: String,
    ) {
        if self.agents.get(&agent_id).is_none() {
            self.env().revert(Error::AgentNotFound);
        }
        if self.services.get(&service_id).is_some() {
            self.env().revert(Error::ServiceAlreadyExists);
        }
        self.services.set(
            &service_id,
            Service {
                agent_id: agent_id.clone(),
                price_motes,
                description_hash,
                active: true,
            },
        );
        self.env().emit_event(ServiceRegistered { service_id, agent_id, price_motes });
    }

    /// Record an x402-settled payment. Called by the router after the
    /// facilitator confirms settlement.
    pub fn record_payment(
        &mut self,
        receipt_id: String,
        from_agent: String,
        to_agent: String,
        service_id: String,
        amount_motes: U512,
        x402_proof_hash: String,
        task_result_hash: String,
    ) {
        if self.receipts.get(&receipt_id).is_some() {
            self.env().revert(Error::ReceiptAlreadyExists);
        }
        let now = self.env().get_block_time();
        self.receipts.set(
            &receipt_id,
            PaymentReceipt {
                from_agent: from_agent.clone(),
                to_agent: to_agent.clone(),
                service_id: service_id.clone(),
                amount_motes,
                x402_proof_hash,
                task_result_hash,
                timestamp: now,
            },
        );
        self.receipt_count.set(self.receipt_count.get_or_default() + 1);
        self.env().emit_event(PaymentRecorded {
            receipt_id,
            from_agent,
            to_agent,
            service_id,
            amount_motes,
        });
    }

    /// Attach a task result hash to an existing receipt.
    pub fn record_task_result(&mut self, receipt_id: String, task_result_hash: String) {
        let mut receipt = match self.receipts.get(&receipt_id) {
            Some(r) => r,
            None => self.env().revert(Error::ReceiptNotFound),
        };
        receipt.task_result_hash = task_result_hash.clone();
        self.receipts.set(&receipt_id, receipt);
        self.env().emit_event(TaskResultRecorded { receipt_id, task_result_hash });
    }

    /// Update an agent's reputation after verified delivery.
    pub fn update_reputation(&mut self, agent_id: String, delta: i64) {
        let mut agent = match self.agents.get(&agent_id) {
            Some(a) => a,
            None => self.env().revert(Error::AgentNotFound),
        };
        let current = agent.reputation as i64;
        let updated = (current + delta).clamp(0, 100) as u64;
        agent.reputation = updated;
        self.agents.set(&agent_id, agent);
        self.env().emit_event(ReputationUpdated { agent_id, new_reputation: updated });
    }

    // ---- read-only views ----

    pub fn get_agent(&self, agent_id: String) -> Option<Agent> {
        self.agents.get(&agent_id)
    }

    pub fn get_service(&self, service_id: String) -> Option<Service> {
        self.services.get(&service_id)
    }

    pub fn get_receipt(&self, receipt_id: String) -> Option<PaymentReceipt> {
        self.receipts.get(&receipt_id)
    }

    pub fn get_reputation(&self, agent_id: String) -> u64 {
        self.agents.get(&agent_id).map(|a| a.reputation).unwrap_or(0)
    }

    pub fn total_receipts(&self) -> u64 {
        self.receipt_count.get_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn records_payment_and_updates_reputation() {
        let env = odra_test::env();
        let mut router = AgentPayRouter::deploy(&env, NoArgs);

        router.register_agent(
            "data-agent".into(),
            "01abc".into(),
            "https://data.agent".into(),
            "meta".into(),
        );
        router.register_service(
            "svc-yield-oracle".into(),
            "data-agent".into(),
            U512::from(7_500_000_000u64),
            "desc".into(),
        );

        router.record_payment(
            "rcpt-1".into(),
            "research-agent".into(),
            "data-agent".into(),
            "svc-yield-oracle".into(),
            U512::from(7_500_000_000u64),
            "x402proof".into(),
            "resulthash".into(),
        );

        assert_eq!(router.total_receipts(), 1);
        assert!(router.get_receipt("rcpt-1".into()).is_some());

        router.update_reputation("data-agent".into(), 3);
        assert_eq!(router.get_reputation("data-agent".into()), 53);
    }
}
