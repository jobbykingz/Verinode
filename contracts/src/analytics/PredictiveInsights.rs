use soroban_sdk::{Env, Symbol, Address, vec, Vec};

pub fn record_prediction_data(env: &Env, user: Address, pattern_mask: u8, frequency: u32) {
    // Record behavioral patterns observed on-chain to feed predictive models off-chain
    // pattern_mask: 1 (burst), 2 (periodic), 4 (random)
    env.events().publish(
        (Symbol::new(env, "prediction_source"), user),
        vec![env, env.ledger().timestamp().into(), (pattern_mask as u32).into(), frequency.into()]
    );
}

pub fn get_insight_score(env: &Env, historical_data: Vec<u64>) -> u32 {
    // Simple heuristic-based insight in-contract
    // E.g. if the last 3 timestamps are close, return a "high-load" score
    if historical_data.len() < 3 { return 0; }
    
    let last = historical_data.get(0).unwrap();
    let first = historical_data.get(historical_data.len()-1).unwrap();
    let duration = last - first;
    
    // Simple load score (0-100)
    100 - (duration / 100).min(100) as u32
}
