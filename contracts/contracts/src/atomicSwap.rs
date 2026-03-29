#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env, String, Vec, Map, U256};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AtomicSwap {
    pub swap_id: u64,
    pub initiator: Address,
    pub participant: Address,
    pub source_chain: u32,
    pub target_chain: u32,
    pub source_asset: Bytes,
    pub target_asset: Bytes,
    pub source_amount: U256,
    pub target_amount: U256,
    pub secret_hash: Bytes,
    pub secret: Option<Bytes>,
    pub status: SwapStatus,
    pub timeout: u64,
    pub created_at: u64,
    pub completed_at: Option<u64>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SwapStatus {
    Initiated,
    Funded,
    Redeemed,
    Refunded,
    Expired,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SwapProposal {
    pub proposal_id: u64,
    pub proposer: Address,
    pub proposed_swap: AtomicSwap,
    pub signature: Bytes,
    pub created_at: u64,
}

#[contracttype]
pub enum SwapDataKey {
    AtomicSwap(u64),
    SwapProposal(u64),
    SwapCount,
    ProposalCount,
    ActiveSwaps,
    Admin,
}

#[contract]
pub struct AtomicSwapContract;

#[contractimpl]
impl AtomicSwapContract {
    /// Initialize the atomic swap contract
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&SwapDataKey::Admin) {
            panic!("Contract already initialized");
        }
        
        env.storage().instance().set(&SwapDataKey::Admin, &admin);
        env.storage().instance().set(&SwapDataKey::SwapCount, &0u64);
        env.storage().instance().set(&SwapDataKey::ProposalCount, &0u64);
        env.storage().instance().set(&SwapDataKey::ActiveSwaps, &Vec::new(&env));
    }

    /// Initiate atomic swap
    pub fn initiate_swap(
        env: Env,
        participant: Address,
        source_chain: u32,
        target_chain: u32,
        source_asset: Bytes,
        target_asset: Bytes,
        source_amount: U256,
        target_amount: U256,
        secret_hash: Bytes,
        timeout: u64,
        initiator: Address,
    ) -> u64 {
        initiator.require_auth();
        
        let count: u64 = env.storage().instance().get(&SwapDataKey::SwapCount).unwrap_or(0);
        let swap_id = count + 1;
        
        let swap = AtomicSwap {
            swap_id,
            initiator: initiator.clone(),
            participant: participant.clone(),
            source_chain,
            target_chain,
            source_asset: source_asset.clone(),
            target_asset: target_asset.clone(),
            source_amount,
            target_amount,
            secret_hash: secret_hash.clone(),
            secret: None,
            status: SwapStatus::Initiated,
            timeout,
            created_at: env.ledger().timestamp(),
            completed_at: None,
        };
        
        env.storage().instance().set(&SwapDataKey::AtomicSwap(swap_id), &swap);
        env.storage().instance().set(&SwapDataKey::SwapCount, &swap_id);
        
        // Add to active swaps
        let mut active_swaps: Vec<u64> = env.storage().instance()
            .get(&SwapDataKey::ActiveSwaps)
            .unwrap_or(Vec::new(&env));
        active_swaps.push_back(swap_id);
        env.storage().instance().set(&SwapDataKey::ActiveSwaps, &active_swaps);
        
        swap_id
    }

    /// Fund atomic swap
    pub fn fund_swap(env: Env, swap_id: u64, funder: Address) -> bool {
        funder.require_auth();
        
        let mut swap: AtomicSwap = env.storage().instance()
            .get(&SwapDataKey::AtomicSwap(swap_id))
            .unwrap_or_else(|| panic!("Swap not found"));
        
        if swap.status != SwapStatus::Initiated {
            panic!("Swap not in initiated state");
        }
        
        if funder != swap.initiator {
            panic!("Only initiator can fund swap");
        }
        
        if env.ledger().timestamp() > swap.timeout {
            panic!("Swap has expired");
        }
        
        swap.status = SwapStatus::Funded;
        env.storage().instance().set(&SwapDataKey::AtomicSwap(swap_id), &swap);
        
        true
    }

    /// Redeem atomic swap with secret
    pub fn redeem_swap(env: Env, swap_id: u64, secret: Bytes, redeemer: Address) -> bool {
        redeemer.require_auth();
        
        let mut swap: AtomicSwap = env.storage().instance()
            .get(&SwapDataKey::AtomicSwap(swap_id))
            .unwrap_or_else(|| panic!("Swap not found"));
        
        if swap.status != SwapStatus::Funded {
            panic!("Swap not funded");
        }
        
        if redeemer != swap.participant {
            panic!("Only participant can redeem swap");
        }
        
        if env.ledger().timestamp() > swap.timeout {
            panic!("Swap has expired");
        }
        
        // Verify secret hash matches
        let computed_hash = Self::compute_secret_hash(env.clone(), secret.clone());
        if computed_hash != swap.secret_hash {
            panic!("Invalid secret");
        }
        
        swap.secret = Some(secret.clone());
        swap.status = SwapStatus::Redeemed;
        swap.completed_at = Some(env.ledger().timestamp());
        
        env.storage().instance().set(&SwapDataKey::AtomicSwap(swap_id), &swap);
        
        // Remove from active swaps
        Self::remove_from_active_swaps(env.clone(), swap_id);
        
        true
    }

    /// Refund atomic swap after timeout
    pub fn refund_swap(env: Env, swap_id: u64, refunder: Address) -> bool {
        refunder.require_auth();
        
        let mut swap: AtomicSwap = env.storage().instance()
            .get(&SwapDataKey::AtomicSwap(swap_id))
            .unwrap_or_else(|| panic!("Swap not found"));
        
        if swap.status != SwapStatus::Funded {
            panic!("Swap not funded");
        }
        
        if refunder != swap.initiator {
            panic!("Only initiator can refund swap");
        }
        
        if env.ledger().timestamp() <= swap.timeout {
            panic!("Swap has not expired yet");
        }
        
        swap.status = SwapStatus::Refunded;
        swap.completed_at = Some(env.ledger().timestamp());
        
        env.storage().instance().set(&SwapDataKey::AtomicSwap(swap_id), &swap);
        
        // Remove from active swaps
        Self::remove_from_active_swaps(env.clone(), swap_id);
        
        true
    }

    /// Create swap proposal
    pub fn create_proposal(
        env: Env,
        proposed_swap: AtomicSwap,
        signature: Bytes,
        proposer: Address,
    ) -> u64 {
        proposer.require_auth();
        
        let count: u64 = env.storage().instance().get(&SwapDataKey::ProposalCount).unwrap_or(0);
        let proposal_id = count + 1;
        
        let proposal = SwapProposal {
            proposal_id,
            proposer: proposer.clone(),
            proposed_swap: proposed_swap.clone(),
            signature: signature.clone(),
            created_at: env.ledger().timestamp(),
        };
        
        env.storage().instance().set(&SwapDataKey::SwapProposal(proposal_id), &proposal);
        env.storage().instance().set(&SwapDataKey::ProposalCount, &proposal_id);
        
        proposal_id
    }

    /// Accept swap proposal
    pub fn accept_proposal(env: Env, proposal_id: u64, accepter: Address) -> u64 {
        accepter.require_auth();
        
        let proposal: SwapProposal = env.storage().instance()
            .get(&SwapDataKey::SwapProposal(proposal_id))
            .unwrap_or_else(|| panic!("Proposal not found"));
        
        if accepter != proposal.proposed_swap.participant {
            panic!("Only intended participant can accept proposal");
        }
        
        // Create actual swap from proposal
        let swap_id = Self::initiate_swap(
            env.clone(),
            proposal.proposed_swap.participant,
            proposal.proposed_swap.source_chain,
            proposal.proposed_swap.target_chain,
            proposal.proposed_swap.source_asset,
            proposal.proposed_swap.target_asset,
            proposal.proposed_swap.source_amount,
            proposal.proposed_swap.target_amount,
            proposal.proposed_swap.secret_hash,
            proposal.proposed_swap.timeout,
            proposal.proposed_swap.initiator,
        );
        
        swap_id
    }

    /// Get atomic swap details
    pub fn get_swap(env: Env, swap_id: u64) -> AtomicSwap {
        env.storage().instance()
            .get(&SwapDataKey::AtomicSwap(swap_id))
            .unwrap_or_else(|| panic!("Swap not found"))
    }

    /// Get swap proposal
    pub fn get_proposal(env: Env, proposal_id: u64) -> SwapProposal {
        env.storage().instance()
            .get(&SwapDataKey::SwapProposal(proposal_id))
            .unwrap_or_else(|| panic!("Proposal not found"))
    }

    /// Get active swaps
    pub fn get_active_swaps(env: Env) -> Vec<u64> {
        env.storage().instance()
            .get(&SwapDataKey::ActiveSwaps)
            .unwrap_or(Vec::new(&env))
    }

    /// Get swaps for user
    pub fn get_user_swaps(env: Env, user: Address) -> Vec<AtomicSwap> {
        let count: u64 = env.storage().instance().get(&SwapDataKey::SwapCount).unwrap_or(0);
        let mut user_swaps = Vec::new(&env);
        
        for i in 1..=count {
            if let Some(swap) = env.storage().instance().get::<SwapDataKey, AtomicSwap>(&SwapDataKey::AtomicSwap(i)) {
                if swap.initiator == user || swap.participant == user {
                    user_swaps.push_back(swap);
                }
            }
        }
        
        user_swaps
    }

    /// Check swap status
    pub fn get_swap_status(env: Env, swap_id: u64) -> SwapStatus {
        let swap: AtomicSwap = env.storage().instance()
            .get(&SwapDataKey::AtomicSwap(swap_id))
            .unwrap_or_else(|| panic!("Swap not found"));
        swap.status
    }

    /// Expire swaps that have timed out
    pub fn expire_swaps(env: Env) -> Vec<u64> {
        let active_swaps = Self::get_active_swaps(env.clone());
        let mut expired_swaps = Vec::new(&env);
        let current_time = env.ledger().timestamp();
        
        for i in 0..active_swaps.len() {
            let swap_id = active_swaps.get(i).unwrap();
            let swap: AtomicSwap = env.storage().instance()
                .get(&SwapDataKey::AtomicSwap(*swap_id))
                .unwrap();
            
            if current_time > swap.timeout && swap.status == SwapStatus::Funded {
                let mut updated_swap = swap;
                updated_swap.status = SwapStatus::Expired;
                updated_swap.completed_at = Some(current_time);
                
                env.storage().instance().set(&SwapDataKey::AtomicSwap(*swap_id), &updated_swap);
                expired_swaps.push_back(*swap_id);
            }
        }
        
        // Remove expired swaps from active list
        for i in 0..expired_swaps.len() {
            Self::remove_from_active_swaps(env.clone(), *expired_swaps.get(i).unwrap());
        }
        
        expired_swaps
    }

    /// Compute secret hash (simplified)
    fn compute_secret_hash(env: Env, secret: Bytes) -> Bytes {
        // Simplified hash computation
        // In practice, use proper cryptographic hash function like SHA256
        let mut hash = Bytes::new(&env);
        if secret.len() > 0 {
            hash = secret.slice(0..min(secret.len(), 32));
        }
        hash
    }

    /// Remove swap from active swaps list
    fn remove_from_active_swaps(env: Env, swap_id: u64) {
        let mut active_swaps: Vec<u64> = env.storage().instance()
            .get(&SwapDataKey::ActiveSwaps)
            .unwrap_or(Vec::new(&env));
        
        let mut new_active = Vec::new(&env);
        for i in 0..active_swaps.len() {
            let id = active_swaps.get(i).unwrap();
            if *id != swap_id {
                new_active.push_back(*id);
            }
        }
        
        env.storage().instance().set(&SwapDataKey::ActiveSwaps, &new_active);
    }

    /// Get admin address
    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&SwapDataKey::Admin).unwrap()
    }

    /// Get total swap count
    pub fn get_swap_count(env: Env) -> u64 {
        env.storage().instance().get(&SwapDataKey::SwapCount).unwrap_or(0)
    }

    /// Get total proposal count
    pub fn get_proposal_count(env: Env) -> u64 {
        env.storage().instance().get(&SwapDataKey::ProposalCount).unwrap_or(0)
    }
}

fn min(a: u32, b: u32) -> u32 {
    if a < b { a } else { b }
}
