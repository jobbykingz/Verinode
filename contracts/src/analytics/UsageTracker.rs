use soroban_sdk::{Env, Address, Symbol, vec, Vec};

pub fn track_usage(env: &Env, user: Address, function_name: Symbol, data_size: u32) {
    // Emit a usage event that the backend can pick up
    // event topics: ["usage", user, function_name]
    // event data: [timestamp, data_size]
    env.events().publish(
        (Symbol::new(env, "usage"), user, function_name),
        vec![env, env.ledger().timestamp().into(), data_size.into()]
    );
}

pub fn track_call(env: &Env, function_name: Symbol) {
    // track a simple call without user attribution for general metrics
    env.events().publish(
        (Symbol::new(env, "metric"), Symbol::new(env, "call_count"), function_name),
        env.ledger().timestamp()
    );
}
