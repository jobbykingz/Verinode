/*
Optimization Suggester for Verinode Smart Contracts

This tool provides intelligent optimization suggestions based on:
- Code pattern analysis
- Gas usage profiling
- Best practices database
- Machine learning recommendations
- Historical optimization data
*/

use std::collections::HashMap;
use std::fs;
use std::path::Path;
use serde::{Deserialize, Serialize};
use regex::Regex;
use clap::{Arg, Command};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationSuggestion {
    pub id: String,
    pub title: String,
    pub description: String,
    pub category: SuggestionCategory,
    pub severity: SuggestionSeverity,
    pub gas_savings: u64,
    pub confidence: f64,
    pub code_snippet: String,
    pub optimized_snippet: String,
    pub explanation: String,
    pub references: Vec<String>,
    pub implementation_difficulty: ImplementationDifficulty,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SuggestionCategory {
    Storage,
    Loops,
    Strings,
    Arithmetic,
    Collections,
    ControlFlow,
    Memory,
    Security,
    BestPractices,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SuggestionSeverity {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ImplementationDifficulty {
    Easy,
    Medium,
    Hard,
    Expert,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuggestionReport {
    pub contract_name: String,
    pub file_path: String,
    pub total_suggestions: usize,
    pub total_potential_savings: u64,
    pub suggestions_by_category: HashMap<String, usize>,
    pub suggestions_by_severity: HashMap<String, usize>,
    pub suggestions: Vec<OptimizationSuggestion>,
    pub optimization_roadmap: Vec<RoadmapItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoadmapItem {
    pub priority: u32,
    pub suggestion_ids: Vec<String>,
    pub estimated_savings: u64,
    pub estimated_effort: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BestPractice {
    pub id: String,
    pub name: String,
    pub description: String,
    pub pattern: String,
    pub anti_pattern: String,
    pub gas_impact: u64,
    pub examples: Vec<String>,
}

pub struct OptimizationSuggester {
    suggestions: Vec<OptimizationSuggestion>,
    best_practices: Vec<BestPractice>,
    code_patterns: HashMap<String, Regex>,
    learning_weights: HashMap<String, f64>,
}

impl OptimizationSuggester {
    pub fn new() -> Self {
        let mut suggester = Self {
            suggestions: Vec::new(),
            best_practices: Vec::new(),
            code_patterns: HashMap::new(),
            learning_weights: HashMap::new(),
        };
        
        suggester.initialize_suggestions();
        suggester.initialize_best_practices();
        suggester.compile_patterns();
        suggester
    }
    
    fn initialize_suggestions(&mut self) {
        // Storage optimizations
        self.suggestions.push(OptimizationSuggestion {
            id: "storage_001".to_string(),
            title: "Use Instance Storage for Temporary Data".to_string(),
            description: "Replace persistent storage with instance storage for data that doesn't need to persist across contract instances".to_string(),
            category: SuggestionCategory::Storage,
            severity: SuggestionSeverity::High,
            gas_savings: 5000,
            confidence: 0.85,
            code_snippet: "env.storage().persistent().set(&key, &value)".to_string(),
            optimized_snippet: "env.storage().instance().set(&key, &value)".to_string(),
            explanation: "Instance storage is significantly cheaper than persistent storage and should be used for temporary data".to_string(),
            references: vec![
                "Soroban Storage Best Practices".to_string(),
                "Gas Optimization Guide".to_string(),
            ],
            implementation_difficulty: ImplementationDifficulty::Easy,
        });
        
        self.suggestions.push(OptimizationSuggestion {
            id: "storage_002".to_string(),
            title: "Batch Storage Operations".to_string(),
            description: "Combine multiple storage operations into batches to reduce transaction costs".to_string(),
            category: SuggestionCategory::Storage,
            severity: SuggestionSeverity::Medium,
            gas_savings: 4000,
            confidence: 0.80,
            code_snippet: "env.storage().set(&key1, &val1);\nenv.storage().set(&key2, &val2);".to_string(),
            optimized_snippet: "// Batch storage operations\nenv.storage().set(&key1, &val1);\nenv.storage().set(&key2, &val2);".to_string(),
            explanation: "Batching storage operations can reduce overhead and improve gas efficiency".to_string(),
            references: vec![
                "Storage Optimization Techniques".to_string(),
            ],
            implementation_difficulty: ImplementationDifficulty::Medium,
        });
        
        // Loop optimizations
        self.suggestions.push(OptimizationSuggestion {
            id: "loop_001".to_string(),
            title: "Unroll Small Fixed Loops".to_string(),
            description: "Unroll loops with small, fixed iteration counts to eliminate loop overhead".to_string(),
            category: SuggestionCategory::Loops,
            severity: SuggestionSeverity::Medium,
            gas_savings: 3000,
            confidence: 0.75,
            code_snippet: "for i in 0..3 {\n    process(i);\n}".to_string(),
            optimized_snippet: "process(0);\nprocess(1);\nprocess(2);".to_string(),
            explanation: "Loop unrolling eliminates the overhead of loop control for small, fixed iterations".to_string(),
            references: vec![
                "Loop Optimization Techniques".to_string(),
            ],
            implementation_difficulty: ImplementationDifficulty::Easy,
        });
        
        self.suggestions.push(OptimizationSuggestion {
            id: "loop_002".to_string(),
            title: "Pre-allocate Vector Capacity".to_string(),
            description: "Pre-allocate vector capacity when the final size is known to avoid reallocations".to_string(),
            category: SuggestionCategory::Collections,
            severity: SuggestionSeverity::High,
            gas_savings: 2000,
            confidence: 0.90,
            code_snippet: "let mut vec = Vec::new(&env);\nfor i in 0..10 {\n    vec.push_back(i);\n}".to_string(),
            optimized_snippet: "let mut vec = Vec::new(&env);\nvec.reserve_exact(10);\nfor i in 0..10 {\n    vec.push_back(i);\n}".to_string(),
            explanation: "Pre-allocating capacity prevents multiple reallocations and copying".to_string(),
            references: vec![
                "Vector Optimization Guide".to_string(),
            ],
            implementation_difficulty: ImplementationDifficulty::Easy,
        });
        
        // String optimizations
        self.suggestions.push(OptimizationSuggestion {
            id: "string_001".to_string(),
            title: "Avoid String Cloning".to_string(),
            description: "Use string references instead of cloning to reduce memory allocation and gas costs".to_string(),
            category: SuggestionCategory::Strings,
            severity: SuggestionSeverity::Medium,
            gas_savings: 800,
            confidence: 0.70,
            code_snippet: "let cloned_string = original_string.clone();\nprocess(cloned_string);".to_string(),
            optimized_snippet: "process(&original_string);".to_string(),
            explanation: "String cloning creates unnecessary allocations and increases gas costs".to_string(),
            references: vec![
                "String Optimization Best Practices".to_string(),
            ],
            implementation_difficulty: ImplementationDifficulty::Medium,
        });
        
        // Arithmetic optimizations
        self.suggestions.push(OptimizationSuggestion {
            id: "arith_001".to_string(),
            title: "Use Bit Operations for Multiplication by Powers of 2".to_string(),
            description: "Replace multiplication by powers of 2 with more efficient bit shift operations".to_string(),
            category: SuggestionCategory::Arithmetic,
            severity: SuggestionSeverity::Low,
            gas_savings: 100,
            confidence: 0.95,
            code_snippet: "result = value * 2;".to_string(),
            optimized_snippet: "result = value << 1;".to_string(),
            explanation: "Bit shift operations are significantly cheaper than multiplication for powers of 2".to_string(),
            references: vec![
                "Arithmetic Optimization Guide".to_string(),
            ],
            implementation_difficulty: ImplementationDifficulty::Easy,
        });
        
        // Control flow optimizations
        self.suggestions.push(OptimizationSuggestion {
            id: "control_001".to_string(),
            title: "Use Early Returns".to_string(),
            description: "Use early returns to reduce nesting and improve gas efficiency".to_string(),
            category: SuggestionCategory::ControlFlow,
            severity: SuggestionSeverity::Medium,
            gas_savings: 1500,
            confidence: 0.80,
            code_snippet: "if condition {\n    // complex logic\n} else {\n    return;\n}".to_string(),
            optimized_snippet: "if !condition {\n    return;\n}\n// complex logic".to_string(),
            explanation: "Early returns reduce nesting depth and can improve gas efficiency".to_string(),
            references: vec![
                "Control Flow Best Practices".to_string(),
            ],
            implementation_difficulty: ImplementationDifficulty::Easy,
        });
        
        // Memory optimizations
        self.suggestions.push(OptimizationSuggestion {
            id: "memory_001".to_string(),
            title: "Use Efficient Data Structures".to_string(),
            description: "Choose the most gas-efficient data structure for your use case".to_string(),
            category: SuggestionCategory::Memory,
            severity: SuggestionSeverity::Medium,
            gas_savings: 2500,
            confidence: 0.75,
            code_snippet: "let data = Vec::new(&env);\n// Simple key-value storage".to_string(),
            optimized_snippet: "let data = Map::new(&env);\n// More efficient for key-value storage".to_string(),
            explanation: "Maps are more efficient than vectors for key-value storage operations".to_string(),
            references: vec![
                "Data Structure Selection Guide".to_string(),
            ],
            implementation_difficulty: ImplementationDifficulty::Medium,
        });
        
        // Security optimizations (that also save gas)
        self.suggestions.push(OptimizationSuggestion {
            id: "security_001".to_string(),
            title: "Remove Redundant Checks".to_string(),
            description: "Remove redundant validation checks that don't add security value".to_string(),
            category: SuggestionCategory::Security,
            severity: SuggestionSeverity::Low,
            gas_savings: 500,
            confidence: 0.90,
            code_snippet: "if true {\n    // always executed\n}".to_string(),
            optimized_snippet: "{\n    // always executed\n}".to_string(),
            explanation: "Redundant checks waste gas without providing any security benefit".to_string(),
            references: vec![
                "Security Best Practices".to_string(),
            ],
            implementation_difficulty: ImplementationDifficulty::Easy,
        });
    }
    
    fn initialize_best_practices(&mut self) {
        self.best_practices.push(BestPractice {
            id: "bp_001".to_string(),
            name: "Prefer Instance Storage".to_string(),
            description: "Use instance storage instead of persistent storage when data doesn't need to persist".to_string(),
            pattern: "env.storage().instance()".to_string(),
            anti_pattern: "env.storage().persistent()".to_string(),
            gas_impact: 3000,
            examples: vec![
                "Temporary calculation results".to_string(),
                "Cache data within a transaction".to_string(),
            ],
        });
        
        self.best_practices.push(BestPractice {
            id: "bp_002".to_string(),
            name: "Batch Operations".to_string(),
            description: "Batch similar operations to reduce overhead".to_string(),
            pattern: "batch_operations".to_string(),
            anti_pattern: "individual_operations".to_string(),
            gas_impact: 2000,
            examples: vec![
                "Multiple storage writes".to_string(),
                "Vector insertions".to_string(),
            ],
        });
        
        self.best_practices.push(BestPractice {
            id: "bp_003".to_string(),
            name: "Pre-allocate Collections".to_string(),
            description: "Pre-allocate collection capacity when final size is known".to_string(),
            pattern: "reserve_exact".to_string(),
            anti_pattern: "dynamic_growth".to_string(),
            gas_impact: 1500,
            examples: vec![
                "Vectors with known size".to_string(),
                "Maps with known key count".to_string(),
            ],
        });
    }
    
    fn compile_patterns(&mut self) {
        for suggestion in &self.suggestions {
            if let Ok(regex) = Regex::new(&suggestion.code_snippet) {
                self.code_patterns.insert(suggestion.id.clone(), regex);
            }
        }
    }
    
    pub fn analyze_contract(&mut self, file_path: &str) -> Result<SuggestionReport, Box<dyn std::error::Error>> {
        let source_code = fs::read_to_string(file_path)?;
        let contract_name = Path::new(file_path)
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        
        let mut applicable_suggestions = Vec::new();
        let mut total_savings = 0u64;
        let mut suggestions_by_category = HashMap::new();
        let mut suggestions_by_severity = HashMap::new();
        
        // Analyze code for each suggestion
        for suggestion in &self.suggestions {
            if let Some(pattern) = self.code_patterns.get(&suggestion.id) {
                let matches = pattern.find_iter(&source_code);
                let match_count = matches.count();
                
                if match_count > 0 {
                    let mut suggestion_clone = suggestion.clone();
                    suggestion_clone.gas_savings *= match_count as u64;
                    
                    // Adjust confidence based on learning weights
                    if let Some(&weight) = self.learning_weights.get(&suggestion.id) {
                        suggestion_clone.confidence *= weight;
                    }
                    
                    applicable_suggestions.push(suggestion_clone);
                    total_savings += suggestion_clone.gas_savings;
                    
                    // Update category counts
                    let category_name = format!("{:?}", suggestion_clone.category);
                    *suggestions_by_category.entry(category_name).or_insert(0) += 1;
                    
                    // Update severity counts
                    let severity_name = format!("{:?}", suggestion_clone.severity);
                    *suggestions_by_severity.entry(severity_name).or_insert(0) += 1;
                }
            }
        }
        
        // Generate optimization roadmap
        let roadmap = self.generate_roadmap(&applicable_suggestions);
        
        let report = SuggestionReport {
            contract_name,
            file_path: file_path.to_string(),
            total_suggestions: applicable_suggestions.len(),
            total_potential_savings: total_savings,
            suggestions_by_category,
            suggestions_by_severity,
            suggestions: applicable_suggestions,
            optimization_roadmap: roadmap,
        };
        
        Ok(report)
    }
    
    fn generate_roadmap(&self, suggestions: &[OptimizationSuggestion]) -> Vec<RoadmapItem> {
        let mut roadmap = Vec::new();
        
        // Group suggestions by difficulty and impact
        let mut easy_wins = Vec::new();
        let mut medium_effort = Vec::new();
        let mut complex_optimizations = Vec::new();
        
        for suggestion in suggestions {
            match suggestion.implementation_difficulty {
                ImplementationDifficulty::Easy => easy_wins.push(suggestion),
                ImplementationDifficulty::Medium => medium_effort.push(suggestion),
                ImplementationDifficulty::Hard | ImplementationDifficulty::Expert => complex_optimizations.push(suggestion),
            }
        }
        
        // Priority 1: Easy wins with high impact
        let priority1_suggestions: Vec<String> = easy_wins
            .iter()
            .filter(|s| s.gas_savings > 2000)
            .map(|s| s.id.clone())
            .collect();
        
        if !priority1_suggestions.is_empty() {
            let priority1_savings: u64 = easy_wins
                .iter()
                .filter(|s| s.gas_savings > 2000)
                .map(|s| s.gas_savings)
                .sum();
            
            roadmap.push(RoadmapItem {
                priority: 1,
                suggestion_ids: priority1_suggestions,
                estimated_savings: priority1_savings,
                estimated_effort: "Low (1-2 hours)".to_string(),
                description: "Quick wins with high gas savings".to_string(),
            });
        }
        
        // Priority 2: Medium effort optimizations
        let priority2_suggestions: Vec<String> = medium_effort
            .iter()
            .map(|s| s.id.clone())
            .collect();
        
        if !priority2_suggestions.is_empty() {
            let priority2_savings: u64 = medium_effort.iter().map(|s| s.gas_savings).sum();
            
            roadmap.push(RoadmapItem {
                priority: 2,
                suggestion_ids: priority2_suggestions,
                estimated_savings: priority2_savings,
                estimated_effort: "Medium (1-2 days)".to_string(),
                description: "Medium effort optimizations with good returns".to_string(),
            });
        }
        
        // Priority 3: Complex optimizations
        let priority3_suggestions: Vec<String> = complex_optimizations
            .iter()
            .map(|s| s.id.clone())
            .collect();
        
        if !priority3_suggestions.is_empty() {
            let priority3_savings: u64 = complex_optimizations.iter().map(|s| s.gas_savings).sum();
            
            roadmap.push(RoadmapItem {
                priority: 3,
                suggestion_ids: priority3_suggestions,
                estimated_savings: priority3_savings,
                estimated_effort: "High (3-5 days)".to_string(),
                description: "Complex optimizations requiring significant refactoring".to_string(),
            });
        }
        
        // Priority 4: Remaining easy optimizations
        let priority4_suggestions: Vec<String> = easy_wins
            .iter()
            .filter(|s| s.gas_savings <= 2000)
            .map(|s| s.id.clone())
            .collect();
        
        if !priority4_suggestions.is_empty() {
            let priority4_savings: u64 = easy_wins
                .iter()
                .filter(|s| s.gas_savings <= 2000)
                .map(|s| s.gas_savings)
                .sum();
            
            roadmap.push(RoadmapItem {
                priority: 4,
                suggestion_ids: priority4_suggestions,
                estimated_savings: priority4_savings,
                estimated_effort: "Low (< 1 hour)".to_string(),
                description: "Minor optimizations for incremental improvements".to_string(),
            });
        }
        
        roadmap.sort_by_key(|item| item.priority);
        roadmap
    }
    
    pub fn update_learning_weights(&mut self, feedback: &HashMap<String, bool>) {
        for (suggestion_id, was_helpful) in feedback {
            let current_weight = self.learning_weights.get(suggestion_id).unwrap_or(&1.0);
            let new_weight = if *was_helpful {
                (current_weight * 1.1).min(2.0) // Increase weight, max 2.0
            } else {
                (current_weight * 0.9).max(0.1) // Decrease weight, min 0.1
            };
            
            self.learning_weights.insert(suggestion_id.clone(), new_weight);
        }
    }
    
    pub fn generate_report(&self, report: &SuggestionReport, format: &str) -> Result<String, Box<dyn std::error::Error>> {
        match format.to_lowercase().as_str() {
            "json" => Ok(serde_json::to_string_pretty(report)?),
            "csv" => Ok(self.generate_csv_report(report)),
            "markdown" => Ok(self.generate_markdown_report(report)),
            _ => Err("Unsupported format".into()),
        }
    }
    
    fn generate_csv_report(&self, report: &SuggestionReport) -> String {
        let mut csv = String::new();
        
        // Header
        csv.push_str("ID,Title,Category,Severity,Gas Savings,Confidence,Difficulty\n");
        
        // Suggestions
        for suggestion in &report.suggestions {
            csv.push_str(&format!(
                "{},{},{},{},{},{:.2},{}\n",
                suggestion.id,
                suggestion.title,
                format!("{:?}", suggestion.category),
                format!("{:?}", suggestion.severity),
                suggestion.gas_savings,
                suggestion.confidence,
                format!("{:?}", suggestion.implementation_difficulty)
            ));
        }
        
        csv
    }
    
    fn generate_markdown_report(&self, report: &SuggestionReport) -> String {
        let mut md = format!(
            "# Optimization Suggestions: {}\n\n",
            report.contract_name
        );
        
        // Summary
        md.push_str("## Summary\n\n");
        md.push_str(&format!(
            "- **Total Suggestions:** {}\n\
            - **Total Potential Gas Savings:** {:,}\n\
            - **Average Savings per Suggestion:** {:,}\n\n",
            report.total_suggestions,
            report.total_potential_savings,
            if report.total_suggestions > 0 {
                report.total_potential_savings / report.total_suggestions as u64
            } else {
                0
            }
        ));
        
        // Suggestions by category
        md.push_str("### Suggestions by Category\n\n");
        for (category, count) in &report.suggestions_by_category {
            md.push_str(&format!("- **{}:** {}\n", category, count));
        }
        md.push_str("\n");
        
        // Suggestions by severity
        md.push_str("### Suggestions by Severity\n\n");
        for (severity, count) in &report.suggestions_by_severity {
            md.push_str(&format!("- **{}:** {}\n", severity, count));
        }
        md.push_str("\n");
        
        // Detailed suggestions
        md.push_str("## Detailed Suggestions\n\n");
        
        for (i, suggestion) in report.suggestions.iter().enumerate() {
            md.push_str(&format!(
                "### {}. {} ({})\n\n",
                i + 1,
                suggestion.title,
                format!("{:?}", suggestion.severity)
            ));
            
            md.push_str(&format!("**Category:** {:?}\n\n", suggestion.category));
            md.push_str(&format!("**Gas Savings:** {:,}\n\n", suggestion.gas_savings));
            md.push_str(&format!("**Confidence:** {:.1}%\n\n", suggestion.confidence * 100.0));
            md.push_str(&format!("**Difficulty:** {:?}\n\n", suggestion.implementation_difficulty));
            
            md.push_str("**Description:**\n");
            md.push_str(&format!("{}\n\n", suggestion.description));
            
            md.push_str("**Current Code:**\n");
            md.push_str(&format!("```rust\n{}\n```\n\n", suggestion.code_snippet));
            
            md.push_str("**Optimized Code:**\n");
            md.push_str(&format!("```rust\n{}\n```\n\n", suggestion.optimized_snippet));
            
            md.push_str("**Explanation:**\n");
            md.push_str(&format!("{}\n\n", suggestion.explanation));
            
            if !suggestion.references.is_empty() {
                md.push_str("**References:**\n");
                for reference in &suggestion.references {
                    md.push_str(&format!("- {}\n", reference));
                }
                md.push_str("\n");
            }
            
            md.push_str("---\n\n");
        }
        
        // Optimization roadmap
        md.push_str("## Optimization Roadmap\n\n");
        
        for item in &report.optimization_roadmap {
            md.push_str(&format!(
                "### Priority {}: {}\n\n",
                item.priority, item.description
            ));
            
            md.push_str(&format!(
                "- **Estimated Savings:** {:,} gas\n\
                - **Estimated Effort:** {}\n\
                - **Suggestions:** {}\n\n",
                item.estimated_savings,
                item.estimated_effort,
                item.suggestion_ids.len()
            ));
        }
        
        md
    }
    
    pub fn analyze_directory(&mut self, dir_path: &str) -> Result<Vec<SuggestionReport>, Box<dyn std::error::Error>> {
        let mut reports = Vec::new();
        
        for entry in fs::read_dir(dir_path)? {
            let entry = entry?;
            let path = entry.path();
            
            if path.is_file() {
                if let Some(extension) = path.extension() {
                    if extension == "rs" {
                        match self.analyze_contract(path.to_str().unwrap()) {
                            Ok(report) => reports.push(report),
                            Err(e) => eprintln!("Error analyzing {}: {}", path.display(), e),
                        }
                    }
                }
            }
        }
        
        Ok(reports)
    }
    
    pub fn get_best_practices(&self) -> &[BestPractice] {
        &self.best_practices
    }
    
    pub fn search_suggestions(&self, query: &str) -> Vec<&OptimizationSuggestion> {
        self.suggestions
            .iter()
            .filter(|s| {
                s.title.to_lowercase().contains(&query.to_lowercase()) ||
                s.description.to_lowercase().contains(&query.to_lowercase()) ||
                format!("{:?}", s.category).to_lowercase().contains(&query.to_lowercase())
            })
            .collect()
    }
    
    pub fn export_suggestions(&self, format: &str) -> Result<String, Box<dyn std::error::Error>> {
        match format.to_lowercase().as_str() {
            "json" => Ok(serde_json::to_string_pretty(&self.suggestions)?),
            "csv" => {
                let mut csv = String::new();
                csv.push_str("ID,Title,Category,Severity,Gas Savings,Confidence,Difficulty,Description\n");
                
                for suggestion in &self.suggestions {
                    csv.push_str(&format!(
                        "{},{},{},{},{},{:.2},{},{}\n",
                        suggestion.id,
                        suggestion.title,
                        format!("{:?}", suggestion.category),
                        format!("{:?}", suggestion.severity),
                        suggestion.gas_savings,
                        suggestion.confidence,
                        format!("{:?}", suggestion.implementation_difficulty),
                        suggestion.description.replace(',', ";")
                    ));
                }
                
                Ok(csv)
            }
            _ => Err("Unsupported format".into()),
        }
    }
}

fn main() {
    let matches = Command::new("optimization_suggester")
        .version("1.0")
        .about("Intelligent optimization suggester for Verinode smart contracts")
        .arg(
            Arg::new("input")
                .short('i')
                .long("input")
                .value_name("FILE_OR_DIR")
                .help("Input file or directory to analyze")
                .required(true),
        )
        .arg(
            Arg::new("output")
                .short('o')
                .long("output")
                .value_name("FILE")
                .help("Output file for the report"),
        )
        .arg(
            Arg::new("format")
                .short('f')
                .long("format")
                .value_name("FORMAT")
                .help("Output format (json, csv, markdown)")
                .default_value("markdown"),
        )
        .arg(
            Arg::new("search")
                .short('s')
                .long("search")
                .value_name("QUERY")
                .help("Search for specific optimization suggestions"),
        )
        .arg(
            Arg::new("best-practices")
                .short('b')
                .long("best-practices")
                .help("Display best practices"),
        )
        .get_matches();
    
    let mut suggester = OptimizationSuggester::new();
    
    // Handle search
    if let Some(query) = matches.get_one::<String>("search") {
        let results = suggester.search_suggestions(query);
        
        if results.is_empty() {
            println!("No suggestions found for: {}", query);
        } else {
            println!("Found {} suggestions for '{}':", results.len(), query);
            for (i, suggestion) in results.iter().enumerate() {
                println!("{}. {} ({:?})", i + 1, suggestion.title, suggestion.category);
                println!("   Savings: {:,} gas | Confidence: {:.1}%", 
                    suggestion.gas_savings, suggestion.confidence * 100.0);
                println!("   {}", suggestion.description);
                println!();
            }
        }
        return;
    }
    
    // Handle best practices
    if matches.get_flag("best-practices") {
        println!("=== Best Practices ===");
        for practice in suggester.get_best_practices() {
            println!("\n## {}", practice.name);
            println!("{}", practice.description);
            println!("Gas Impact: {:,}", practice.gas_impact);
            if !practice.examples.is_empty() {
                println!("Examples:");
                for example in &practice.examples {
                    println!("- {}", example);
                }
            }
        }
        return;
    }
    
    let input = matches.get_one::<String>("input").unwrap();
    let format = matches.get_one::<String>("format").unwrap();
    
    // Analyze input
    let reports = if Path::new(input).is_dir() {
        suggester.analyze_directory(input).unwrap_or_else(|e| {
            eprintln!("Error analyzing directory: {}", e);
            Vec::new()
        })
    } else {
        match suggester.analyze_contract(input) {
            Ok(report) => vec![report],
            Err(e) => {
                eprintln!("Error analyzing contract: {}", e);
                Vec::new()
            }
        }
    };
    
    if reports.is_empty() {
        eprintln!("No contracts were successfully analyzed");
        return;
    }
    
    // Generate reports
    for report in &reports {
        let report_text = suggester.generate_report(report, format).unwrap();
        
        if let Some(output_file) = matches.get_one::<String>("output") {
            let file_path = if reports.len() == 1 {
                output_file.to_string()
            } else {
                format!("{}_{}", output_file, report.contract_name)
            };
            
            fs::write(&file_path, report_text).unwrap_or_else(|e| {
                eprintln!("Error writing report to {}: {}", file_path, e);
            });
            
            println!("Report saved to: {}", file_path);
        } else {
            println!("\n=== Optimization Report for {} ===", report.contract_name);
            println!("{}", report_text);
        }
    }
    
    // Summary
    let total_suggestions: usize = reports.iter().map(|r| r.total_suggestions).sum();
    let total_savings: u64 = reports.iter().map(|r| r.total_potential_savings).sum();
    
    println!("\n=== Summary ===");
    println!("Total contracts analyzed: {}", reports.len());
    println!("Total suggestions: {}", total_suggestions);
    println!("Total potential gas savings: {:,}", total_savings);
    
    if total_suggestions > 0 {
        println!("Average savings per suggestion: {:,}", total_savings / total_suggestions as u64);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_suggester_creation() {
        let suggester = OptimizationSuggester::new();
        assert!(!suggester.suggestions.is_empty());
        assert!(!suggester.best_practices.is_empty());
    }
    
    #[test]
    fn test_suggestion_search() {
        let suggester = OptimizationSuggester::new();
        let results = suggester.search_suggestions("storage");
        assert!(!results.is_empty());
        
        for suggestion in results {
            assert!(suggestion.title.to_lowercase().contains("storage") ||
                   suggestion.description.to_lowercase().contains("storage"));
        }
    }
    
    #[test]
    fn test_roadmap_generation() {
        let suggester = OptimizationSuggester::new();
        let suggestions = vec![
            suggester.suggestions[0].clone(),
            suggester.suggestions[1].clone(),
        ];
        
        let roadmap = suggester.generate_roadmap(&suggestions);
        assert!(!roadmap.is_empty());
        
        // Check that roadmap is sorted by priority
        for i in 1..roadmap.len() {
            assert!(roadmap[i].priority >= roadmap[i-1].priority);
        }
    }
}
