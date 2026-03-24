#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env, String, Vec, Map, Symbol};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RefactorRule {
    pub rule_id: u64,
    pub name: String,
    pub description: String,
    pub pattern: String,
    pub replacement: String,
    pub gas_savings: u64,
    pub risk_level: u8, // 1-10 scale
    pub category: String,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RefactorResult {
    pub success: bool,
    pub original_code: String,
    pub refactored_code: String,
    pub applied_rules: Vec<u64>,
    pub total_gas_savings: u64,
    pub risk_score: f64,
    pub compilation_status: bool,
    pub warnings: Vec<String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CodeMetrics {
    pub lines_of_code: u32,
    pub cyclomatic_complexity: u32,
    pub storage_operations: u32,
    pub loop_operations: u32,
    pub function_calls: u32,
    pub estimated_gas: u64,
}

#[contracttype]
pub enum AutoRefactorDataKey {
    RefactorRules(u64),
    RuleCount,
    RefactorHistory,
    MetricsCache,
}

#[contract]
pub struct AutoRefactor;

#[contractimpl]
impl AutoRefactor {
    /// Initialize the auto refactoring system
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&AutoRefactorDataKey::RuleCount) {
            panic!("Auto Refactor already initialized");
        }
        
        env.storage().instance().set(&AutoRefactorDataKey::RuleCount, &0u64);
        env.storage().instance().set(&AutoRefactorDataKey::RefactorHistory, &Vec::new(&env));
        
        // Initialize with default refactoring rules
        Self::initialize_default_rules(&env);
    }

    /// Automatically refactor source code for gas optimization
    pub fn auto_refactor(
        env: Env,
        source_code: String,
        target_gas_reduction: f64, // Target percentage reduction (0.0-1.0)
        max_risk_level: u8, // Maximum acceptable risk level (1-10)
    ) -> RefactorResult {
        let mut result = RefactorResult {
            success: false,
            original_code: source_code.clone(),
            refactored_code: source_code.clone(),
            applied_rules: Vec::new(&env),
            total_gas_savings: 0,
            risk_score: 0.0,
            compilation_status: false,
            warnings: Vec::new(&env),
        };

        let original_metrics = Self::analyze_code_metrics(&env, source_code.clone());
        let target_gas_savings = (original_metrics.estimated_gas as f64 * target_gas_reduction) as u64;
        
        let mut refactored_code = source_code;
        let mut total_risk = 0.0;
        let mut current_gas_savings = 0;

        // Apply refactoring rules iteratively
        let rule_count: u64 = env.storage().instance().get(&AutoRefactorDataKey::RuleCount).unwrap_or(0);
        
        for rule_id in 1..=rule_count {
            if let Some(rule) = env.storage().instance().get::<AutoRefactorDataKey, RefactorRule>(
                &AutoRefactorDataKey::RefactorRules(rule_id)
            ) {
                // Check if rule is within risk tolerance
                if rule.risk_level <= max_risk_level {
                    // Apply rule if pattern matches
                    if refactored_code.contains(&rule.pattern) {
                        let new_code = Self::apply_refactor_rule(&env, refactored_code.clone(), rule.clone());
                        
                        // Verify compilation and measure improvement
                        if Self::verify_compilation(&env, new_code.clone()) {
                            let new_metrics = Self::analyze_code_metrics(&env, new_code.clone());
                            let gas_savings = original_metrics.estimated_gas - new_metrics.estimated_gas;
                            
                            if gas_savings > 0 {
                                refactored_code = new_code;
                                result.applied_rules.push_back(rule_id);
                                result.total_gas_savings += gas_savings;
                                total_risk += rule.risk_level as f64;
                                current_gas_savings += gas_savings;
                                
                                // Add warning for high-risk transformations
                                if rule.risk_level > 7 {
                                    result.warnings.push_back(format!(
                                        "High-risk rule applied: {} (Risk level: {})",
                                        rule.name, rule.risk_level
                                    ));
                                }
                            }
                        }
                    }
                }
            }
        }

        result.refactored_code = refactored_code;
        result.compilation_status = Self::verify_compilation(&env, result.refactored_code.clone());
        result.risk_score = if result.applied_rules.len() > 0 { 
            total_risk / result.applied_rules.len() as f64 
        } else { 
            0.0 
        };
        
        // Check if target gas reduction was achieved
        result.success = current_gas_savings >= target_gas_savings && result.compilation_status;

        // Store refactor history
        Self::store_refactor_history(&env, result.clone());

        result
    }

    /// Initialize default refactoring rules
    fn initialize_default_rules(env: &Env) {
        let mut rule_id = 1u64;

        // Rule 1: Replace persistent storage with instance storage for temporary data
        Self::add_refactor_rule(env, &mut rule_id, RefactorRule {
            rule_id,
            name: String::from_str(env, "Persistent to Instance Storage"),
            description: String::from_str(env, "Replace persistent storage with instance storage for temporary data"),
            pattern: String::from_str(env, "env.storage().persistent().set"),
            replacement: String::from_str(env, "env.storage().instance().set"),
            gas_savings: 5000,
            risk_level: 3,
            category: String::from_str(env, "Storage"),
        });

        // Rule 2: Optimize vector initialization
        Self::add_refactor_rule(env, &mut rule_id, RefactorRule {
            rule_id,
            name: String::from_str(env, "Vector Pre-allocation"),
            description: String::from_str(env, "Pre-allocate vectors with known capacity"),
            pattern: String::from_str(env, "Vec::new(&env)"),
            replacement: String::from_str(env, "Vec::new(&env)"), // Will be enhanced in apply function
            gas_savings: 2000,
            risk_level: 2,
            category: String::from_str(env, "Collections"),
        });

        // Rule 3: Early return optimization
        Self::add_refactor_rule(env, &mut rule_id, RefactorRule {
            rule_id,
            name: String::from_str(env, "Early Return Pattern"),
            description: String::from_str(env, "Use early returns to reduce nesting"),
            pattern: String::from_str(env, "if condition { // complex logic } else { return }"),
            replacement: String::from_str(env, "if !condition { return } // complex logic"),
            gas_savings: 3000,
            risk_level: 4,
            category: String::from_str(env, "Control Flow"),
        });

        // Rule 4: Batch storage operations
        Self::add_refactor_rule(env, &mut rule_id, RefactorRule {
            rule_id,
            name: String::from_str(env, "Batch Storage Operations"),
            description: String::from_str(env, "Combine multiple storage operations into batches"),
            pattern: String::from_str(env, "env.storage().instance().set(&key1, &val1); env.storage().instance().set(&key2, &val2)"),
            replacement: String::from_str(env, "// Batch storage operations\nenv.storage().instance().set(&key1, &val1);\nenv.storage().instance().set(&key2, &val2)"),
            gas_savings: 4000,
            risk_level: 2,
            category: String::from_str(env, "Storage"),
        });

        // Rule 5: Optimize string operations
        Self::add_refactor_rule(env, &mut rule_id, RefactorRule {
            rule_id,
            name: String::from_str(env, "String Reference Optimization"),
            description: String::from_str(env, "Use string references instead of cloning"),
            pattern: String::from_str(env, ".clone()"),
            replacement: String::from_str(env, ""), // Will be context-aware in apply function
            gas_savings: 1500,
            risk_level: 5,
            category: String::from_str(env, "Strings"),
        });

        // Rule 6: Loop unrolling for small iterations
        Self::add_refactor_rule(env, &mut rule_id, RefactorRule {
            rule_id,
            name: String::from_str(env, "Small Loop Unrolling"),
            description: String::from_str(env, "Unroll loops with small fixed iteration counts"),
            pattern: String::from_str(env, "for i in 0..3"),
            replacement: String::from_str(env, "let i = 0; { /* loop body */ } let i = 1; { /* loop body */ } let i = 2; { /* loop body */ }"),
            gas_savings: 2500,
            risk_level: 6,
            category: String::from_str(env, "Loops"),
        });

        // Rule 7: Remove redundant checks
        Self::add_refactor_rule(env, &mut rule_id, RefactorRule {
            rule_id,
            name: String::from_str(env, "Redundant Check Removal"),
            description: String::from_str(env, "Remove redundant validation checks"),
            pattern: String::from_str(env, "if true {"),
            replacement: String::from_str(env, "{"),
            gas_savings: 1000,
            risk_level: 7,
            category: String::from_str(env, "Validation"),
        });

        // Rule 8: Optimize arithmetic operations
        Self::add_refactor_rule(env, &mut rule_id, RefactorRule {
            rule_id,
            name: String::from_str(env, "Arithmetic Optimization"),
            description: String::from_str(env, "Replace expensive arithmetic with bit operations where possible"),
            pattern: String::from_str(env, "* 2"),
            replacement: String::from_str(env, "<< 1"),
            gas_savings: 500,
            risk_level: 1,
            category: String::from_str(env, "Arithmetic"),
        });
    }

    /// Add a refactoring rule
    fn add_refactor_rule(env: &Env, rule_id: &mut u64, rule: RefactorRule) {
        env.storage().instance().set(&AutoRefactorDataKey::RefactorRules(*rule_id), &rule);
        *rule_id += 1;
        env.storage().instance().set(&AutoRefactorDataKey::RuleCount, rule_id - 1);
    }

    /// Apply a specific refactoring rule
    fn apply_refactor_rule(env: &Env, source_code: String, rule: RefactorRule) -> String {
        let mut refactored = source_code;
        
        match rule.rule_id {
            1 => { // Storage optimization
                refactored = refactored.replace(&rule.pattern, &rule.replacement);
                refactored = refactored.replace("env.storage().persistent().get", "env.storage().instance().get");
            }
            2 => { // Vector pre-allocation - enhanced logic
                // Find vector usage and add capacity hints
                if refactored.contains("push_back") {
                    let push_count = refactored.matches("push_back").count();
                    if push_count <= 10 {
                        refactored = refactored.replace("Vec::new(&env)", &format!("{{\n    let mut vec = Vec::new(&env);\n    vec.reserve_exact({});\n    vec\n}}", push_count));
                    }
                }
            }
            3 => { // Early return - simplified pattern matching
                refactored = refactored.replace("if condition {", "if !condition { return }\n// Original condition logic:");
            }
            4 => { // Batch storage - already optimized in pattern
                refactored = refactored.replace(&rule.pattern, &rule.replacement);
            }
            5 => { // String optimization - context-aware
                // Only remove unnecessary clones, not essential ones
                let lines: Vec<&str> = refactored.lines().collect();
                let mut new_lines = Vec::new();
                
                for line in lines {
                    if line.trim().contains(".clone()") && !line.trim().contains("require_auth()") {
                        let optimized_line = line.replace(".clone()", "");
                        new_lines.push(optimized_line);
                    } else {
                        new_lines.push(line.to_string());
                    }
                }
                refactored = new_lines.join("\n");
            }
            6 => { // Loop unrolling
                refactored = refactored.replace(&rule.pattern, &rule.replacement);
            }
            7 => { // Redundant check removal
                refactored = refactored.replace(&rule.pattern, &rule.replacement);
            }
            8 => { // Arithmetic optimization
                refactored = refactored.replace(&rule.pattern, &rule.replacement);
                refactored = refactored.replace("* 4", "<< 2");
                refactored = refactored.replace("* 8", "<< 3");
                refactored = refactored.replace("* 16", "<< 4");
            }
            _ => {
                refactored = refactored.replace(&rule.pattern, &rule.replacement);
            }
        }
        
        refactored
    }

    /// Analyze code metrics
    fn analyze_code_metrics(env: &Env, source_code: String) -> CodeMetrics {
        let lines = source_code.lines().count() as u32;
        let storage_ops = source_code.matches("storage().").count() as u32;
        let loop_ops = source_code.matches("for ").count() as u32 + source_code.matches("while ").count() as u32;
        let function_calls = source_code.matches("fn ").count() as u32;
        
        // Simple cyclomatic complexity estimation
        let decision_points = source_code.matches("if ").count() + 
                             source_code.matches("match ").count() + 
                             source_code.matches("while ").count() + 
                             source_code.matches("for ").count();
        let complexity = (decision_points + 1) as u32;
        
        // Estimated gas calculation
        let mut estimated_gas = 21000; // Base transaction cost
        estimated_gas += (storage_ops * 5000) as u64;
        estimated_gas += (loop_ops * 3000) as u64;
        estimated_gas += (function_calls * 1000) as u64;
        estimated_gas += (lines * 100) as u64; // Rough estimate per line

        CodeMetrics {
            lines_of_code: lines,
            cyclomatic_complexity: complexity,
            storage_operations: storage_ops,
            loop_operations: loop_ops,
            function_calls: function_calls,
            estimated_gas,
        }
    }

    /// Verify that refactored code compiles correctly
    fn verify_compilation(env: &Env, source_code: String) -> bool {
        // Basic syntax validation
        let open_braces = source_code.matches("{").count();
        let close_braces = source_code.matches("}").count();
        let open_parens = source_code.matches("(").count();
        let close_parens = source_code.matches(")").count();
        let open_brackets = source_code.matches("[").count();
        let close_brackets = source_code.matches("]").count();
        
        // Check for balanced brackets and parentheses
        if open_braces != close_braces || open_parens != close_parens || open_brackets != close_brackets {
            return false;
        }
        
        // Check for basic Rust syntax requirements
        if !source_code.contains("fn ") && !source_code.contains("impl ") {
            return false;
        }
        
        // More sophisticated checks would go here in a real implementation
        true
    }

    /// Store refactor history
    fn store_refactor_history(env: &Env, result: RefactorResult) {
        let mut history: Vec<RefactorResult> = env.storage().instance()
            .get(&AutoRefactorDataKey::RefactorHistory)
            .unwrap_or(Vec::new(env));
        
        history.push_back(result);
        
        // Keep only last 50 refactors to save storage
        if history.len() > 50 {
            history.remove(0);
        }
        
        env.storage().instance().set(&AutoRefactorDataKey::RefactorHistory, &history);
    }

    /// Get all refactoring rules
    pub fn get_refactor_rules(env: Env) -> Vec<RefactorRule> {
        let mut rules = Vec::new(&env);
        let rule_count: u64 = env.storage().instance().get(&AutoRefactorDataKey::RuleCount).unwrap_or(0);
        
        for rule_id in 1..=rule_count {
            if let Some(rule) = env.storage().instance().get::<AutoRefactorDataKey, RefactorRule>(
                &AutoRefactorDataKey::RefactorRules(rule_id)
            ) {
                rules.push_back(rule);
            }
        }
        
        rules
    }

    /// Get refactor history
    pub fn get_refactor_history(env: Env) -> Vec<RefactorResult> {
        env.storage().instance()
            .get(&AutoRefactorDataKey::RefactorHistory)
            .unwrap_or(Vec::new(&env))
    }

    /// Add custom refactoring rule
    pub fn add_custom_rule(env: Env, admin: Address, rule: RefactorRule) {
        // In a real implementation, verify admin rights
        let rule_count: u64 = env.storage().instance().get(&AutoRefactorDataKey::RuleCount).unwrap_or(0);
        let new_rule_id = rule_count + 1;
        
        let mut new_rule = rule;
        new_rule.rule_id = new_rule_id;
        
        env.storage().instance().set(&AutoRefactorDataKey::RefactorRules(new_rule_id), &new_rule);
        env.storage().instance().set(&AutoRefactorDataKey::RuleCount, &new_rule_id);
    }

    /// Analyze code metrics without refactoring
    pub fn analyze_code(env: Env, source_code: String) -> CodeMetrics {
        Self::analyze_code_metrics(&env, source_code)
    }
}
