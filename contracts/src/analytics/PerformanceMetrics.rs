use soroban_sdk::{Env, Symbol, vec};

pub fn record_performance_metric(env: &Env, function_name: Symbol, latency_ms: u64, result: Symbol) {
    // Record internal execution metadata
    // result: "success", "error", "timeout"
    env.events().publish(
        (Symbol::new(env, "performance"), function_name, result),
        vec![env, env.ledger().timestamp().into(), latency_ms.into()]
    );
}

pub fn record_throughput_metric(env: &Env, unit: Symbol, count: u64) {
    // Recorded for high-level monitoring (throughput per ledger)
    // unit: "txs", "bytes", "proofs"
    env.events().publish(
        (Symbol::new(env, "throughput"), unit),
        vec![env, env.ledger().timestamp().into(), count.into()]
    );
}
