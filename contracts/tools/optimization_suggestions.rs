use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::process::Command;
use serde::{Deserialize, Serialize};
use clap::{App, Arg, SubCommand};
use regex::Regex;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct OptimizationSuggestion {
    id: String,
    title: String,
    description: String,
    category: String,
    priority: String,
    estimated_savings: u32,
    implementation_difficulty: String,
    code_example: String,
    file_path: String,
    line_number: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
struct FileAnalysis {
    file_path: String,
    suggestions: Vec<OptimizationSuggestion>,
    total_potential_savings: u32,
}

#[derive(Debug, Serialize, Deserialize)]
struct ProjectAnalysis {
    project_path: String,
    files: Vec<FileAnalysis>,
    summary: AnalysisSummary,
    generated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct AnalysisSummary {
    total_files: usize,
    total_suggestions: usize,
    high_priority_suggestions: usize,
    total_potential_savings: u32,
    categories: HashMap<String, u32>,
}

struct OptimizationAnalyzer {
    project_path: String,
    output_path: String,
}

impl OptimizationAnalyzer {
    fn new(project_path: String, output_path: String) -> Self {
        Self {
            project_path,
            output_path,
        }
    }

    fn analyze_project(&self) -> Result<ProjectAnalysis, Box<dyn std::error::Error>> {
        println!("Analyzing project for optimization opportunities...");
        
        let rust_files = self.discover_rust_files()?;
        let mut file_analyses = Vec::new();
        
        for file_path in rust_files {
            println!("Analyzing: {}", file_path);
            match self.analyze_file(&file_path) {
                Ok(analysis) => file_analyses.push(analysis),
                Err(e) => eprintln!("Failed to analyze {}: {}", file_path, e),
            }
        }
        
        let summary = self.generate_summary(&file_analyses);
        
        Ok(ProjectAnalysis {
            project_path: self.project_path.clone(),
            files: file_analyses,
            summary,
            generated_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    fn discover_rust_files(&self) -> Result<Vec<String>, Box<dyn std::error::Error>> {
        let mut rust_files = Vec::new();
        let src_path = Path::new(&self.project_path).join("src");
        
        if src_path.exists() {
            for entry in fs::read_dir(&src_path)? {
                let entry = entry?;
                let path = entry.path();
                
                if path.is_file() && path.extension().map_or(false, |ext| ext == "rs") {
                    if let Some(path_str) = path.to_str() {
                        rust_files.push(path_str.to_string());
                    }
                }
            }
        }
        
        Ok(rust_files)
    }

    fn analyze_file(&self, file_path: &str) -> Result<FileAnalysis, Box<dyn std::error::Error>> {
        let content = fs::read_to_string(file_path)?;
        let mut suggestions = Vec::new();
        
        suggestions.extend(self.analyze_storage_patterns(file_path, &content)?);
        suggestions.extend(self.analyze_loop_patterns(file_path, &content)?);
        suggestions.extend(self.analyze_call_patterns(file_path, &content)?);
        suggestions.extend(self.analyze_struct_patterns(file_path, &content)?);
        suggestions.extend(self.analyze_function_patterns(file_path, &content)?);
        
        let total_potential_savings = suggestions.iter().map(|s| s.estimated_savings).sum();
        
        Ok(FileAnalysis {
            file_path: file_path.to_string(),
            suggestions,
            total_potential_savings,
        })
    }

    fn analyze_storage_patterns(&self, file_path: &str, content: &str) -> Result<Vec<OptimizationSuggestion>, Box<dyn std::error::Error>> {
        let mut suggestions = Vec::new();
        let lines: Vec<&str> = content.lines().collect();
        
        for (i, line) in lines.iter().enumerate() {
            if line.contains("struct") && line.contains("{") {
                let struct_content = self.extract_struct_content(content, i)?;
                if self.has_unpackable_struct(&struct_content) {
                    suggestions.push(OptimizationSuggestion {
                        id: format!("storage_pack_{}", i),
                        title: "Optimize struct packing".to_string(),
                        description: "This struct can be optimized by packing fields to reduce storage slots".to_string(),
                        category: "Storage".to_string(),
                        priority: "High".to_string(),
                        estimated_savings: 15,
                        implementation_difficulty: "Medium".to_string(),
                        code_example: self.generate_packing_example(&struct_content),
                        file_path: file_path.to_string(),
                        line_number: Some(i as u32),
                    });
                }
            }
            
            if line.contains("Vec<") && line.contains("storage") {
                suggestions.push(OptimizationSuggestion {
                    id: format!("array_to_mapping_{}", i),
                    title: "Consider using Map instead of Vec".to_string(),
                    description: "For large datasets, Map is more gas-efficient than Vec for storage".to_string(),
                    category: "Storage".to_string(),
                    priority: "Medium".to_string(),
                    estimated_savings: 20,
                    implementation_difficulty: "Medium".to_string(),
                    code_example: "Replace: Vec<Address>\nWith: Map<Address, bool>".to_string(),
                    file_path: file_path.to_string(),
                    line_number: Some(i as u32),
                });
            }
        }
        
        Ok(suggestions)
    }

    fn analyze_loop_patterns(&self, file_path: &str, content: &str) -> Result<Vec<OptimizationSuggestion>, Box<dyn std::error::Error>> {
        let mut suggestions = Vec::new();
        let lines: Vec<&str> = content.lines().collect();
        
        for (i, line) in lines.iter().enumerate() {
            if line.contains("for") && line.contains("in") {
                let loop_content = self.extract_loop_content(content, i)?;
                
                if self.has_redundant_calculations(&loop_content) {
                    suggestions.push(OptimizationSuggestion {
                        id: format!("redundant_calc_{}", i),
                        title: "Eliminate redundant calculations in loop".to_string(),
                        description: "Move calculations outside the loop when possible".to_string(),
                        category: "Loop".to_string(),
                        priority: "High".to_string(),
                        estimated_savings: 25,
                        implementation_difficulty: "Easy".to_string(),
                        code_example: "Move expensive calculations outside the loop body".to_string(),
                        file_path: file_path.to_string(),
                        line_number: Some(i as u32),
                    });
                }
                
                if self.has_repeated_array_access(&loop_content) {
                    suggestions.push(OptimizationSuggestion {
                        id: format!("cache_access_{}", i),
                        title: "Cache array access in loop".to_string(),
                        description: "Store array elements in variables when accessed multiple times".to_string(),
                        category: "Loop".to_string(),
                        priority: "Medium".to_string(),
                        estimated_savings: 15,
                        implementation_difficulty: "Easy".to_string(),
                        code_example: "let value = array[i]; // Cache the access".to_string(),
                        file_path: file_path.to_string(),
                        line_number: Some(i as u32),
                    });
                }
            }
        }
        
        Ok(suggestions)
    }

    fn analyze_call_patterns(&self, file_path: &str, content: &str) -> Result<Vec<OptimizationSuggestion>, Box<dyn std::error::Error>> {
        let mut suggestions = Vec::new();
        let lines: Vec<&str> = content.lines().collect();
        
        for (i, line) in lines.iter().enumerate() {
            if line.contains("invoke_contract") || line.contains("call") {
                suggestions.push(OptimizationSuggestion {
                    id: format!("call_optimization_{}", i),
                    title: "Optimize external calls".to_string(),
                    description: "Consider batching external calls or implementing caching".to_string(),
                    category: "Call".to_string(),
                    priority: "Medium".to_string(),
                    estimated_savings: 18,
                    implementation_difficulty: "Medium".to_string(),
                    code_example: "Batch multiple calls into a single operation when possible".to_string(),
                    file_path: file_path.to_string(),
                    line_number: Some(i as u32),
                });
            }
        }
        
        Ok(suggestions)
    }

    fn analyze_struct_patterns(&self, file_path: &str, content: &str) -> Result<Vec<OptimizationSuggestion>, Box<dyn std::error::Error>> {
        let mut suggestions = Vec::new();
        let lines: Vec<&str> = content.lines().collect();
        
        for (i, line) in lines.iter().enumerate() {
            if line.contains("struct") && !line.contains("Optimized") {
                suggestions.push(OptimizationSuggestion {
                    id: format!("struct_optimization_{}", i),
                    title: "Review struct efficiency".to_string(),
                    description: "Consider if this struct can be optimized for gas usage".to_string(),
                    category: "Struct".to_string(),
                    priority: "Low".to_string(),
                    estimated_savings: 10,
                    implementation_difficulty: "Medium".to_string(),
                    code_example: "Review field ordering and types for optimal packing".to_string(),
                    file_path: file_path.to_string(),
                    line_number: Some(i as u32),
                });
            }
        }
        
        Ok(suggestions)
    }

    fn analyze_function_patterns(&self, file_path: &str, content: &str) -> Result<Vec<OptimizationSuggestion>, Box<dyn std::error::Error>> {
        let mut suggestions = Vec::new();
        let lines: Vec<&str> = content.lines().collect();
        
        for (i, line) in lines.iter().enumerate() {
            if line.contains("pub fn") {
                let function_content = self.extract_function_content(content, i)?;
                
                if self.function_is_too_long(&function_content) {
                    suggestions.push(OptimizationSuggestion {
                        id: format!("function_length_{}", i),
                        title: "Consider function decomposition".to_string(),
                        description: "Long functions can be optimized by breaking them into smaller parts".to_string(),
                        category: "Function".to_string(),
                        priority: "Low".to_string(),
                        estimated_savings: 8,
                        implementation_difficulty: "Medium".to_string(),
                        code_example: "Break large functions into smaller, focused functions".to_string(),
                        file_path: file_path.to_string(),
                        line_number: Some(i as u32),
                    });
                }
                
                if self.has_early_termination_opportunity(&function_content) {
                    suggestions.push(OptimizationSuggestion {
                        id: format!("early_termination_{}", i),
                        title: "Add early termination conditions".to_string(),
                        description: "Early returns can save gas in certain conditions".to_string(),
                        category: "Function".to_string(),
                        priority: "Medium".to_string(),
                        estimated_savings: 12,
                        implementation_difficulty: "Easy".to_string(),
                        code_example: "Add early return conditions to avoid unnecessary computation".to_string(),
                        file_path: file_path.to_string(),
                        line_number: Some(i as u32),
                    });
                }
            }
        }
        
        Ok(suggestions)
    }

    fn extract_struct_content(&self, content: &str, start_line: usize) -> Result<String, Box<dyn std::error::Error>> {
        let lines: Vec<&str> = content.lines().collect();
        let mut struct_lines = Vec::new();
        let mut brace_count = 0;
        let mut in_struct = false;
        
        for (i, line) in lines.iter().enumerate() {
            if i >= start_line {
                if line.contains("struct") && !in_struct {
                    in_struct = true;
                }
                
                if in_struct {
                    struct_lines.push(*line);
                    brace_count += line.matches("{").count();
                    brace_count -= line.matches("}").count();
                    
                    if brace_count == 0 && line.contains("}") {
                        break;
                    }
                }
            }
        }
        
        Ok(struct_lines.join("\n"))
    }

    fn extract_loop_content(&self, content: &str, start_line: usize) -> Result<String, Box<dyn std::error::Error>> {
        let lines: Vec<&str> = content.lines().collect();
        let mut loop_lines = Vec::new();
        let mut brace_count = 0;
        let mut in_loop = false;
        
        for (i, line) in lines.iter().enumerate() {
            if i >= start_line {
                if line.contains("for") && line.contains("{") && !in_loop {
                    in_loop = true;
                }
                
                if in_loop {
                    loop_lines.push(*line);
                    brace_count += line.matches("{").count();
                    brace_count -= line.matches("}").count();
                    
                    if brace_count == 0 && line.contains("}") {
                        break;
                    }
                }
            }
        }
        
        Ok(loop_lines.join("\n"))
    }

    fn extract_function_content(&self, content: &str, start_line: usize) -> Result<String, Box<dyn std::error::Error>> {
        let lines: Vec<&str> = content.lines().collect();
        let mut func_lines = Vec::new();
        let mut brace_count = 0;
        let mut in_func = false;
        
        for (i, line) in lines.iter().enumerate() {
            if i >= start_line {
                if line.contains("pub fn") && !in_func {
                    in_func = true;
                }
                
                if in_func {
                    func_lines.push(*line);
                    brace_count += line.matches("{").count();
                    brace_count -= line.matches("}").count();
                    
                    if brace_count == 0 && line.contains("}") {
                        break;
                    }
                }
            }
        }
        
        Ok(func_lines.join("\n"))
    }

    fn has_unpackable_struct(&self, struct_content: &str) -> bool {
        struct_content.contains("u32") && struct_content.contains("bool") && struct_content.contains("u8")
    }

    fn has_redundant_calculations(&self, loop_content: &str) -> bool {
        let calc_pattern = Regex::new(r"\w+\s*\*\s*\w+\s*\*\s*\w+").unwrap();
        calc_pattern.find_iter(loop_content).count() > 1
    }

    fn has_repeated_array_access(&self, loop_content: &str) -> bool {
        let array_pattern = Regex::new(r"\w+\[\w+\]").unwrap();
        let accesses: Vec<_> = array_pattern.find_iter(loop_content).collect();
        accesses.len() > 2
    }

    fn function_is_too_long(&self, function_content: &str) -> bool {
        function_content.lines().count() > 50
    }

    fn has_early_termination_opportunity(&self, function_content: &str) -> bool {
        function_content.contains("if") && function_content.contains("return") == false
    }

    fn generate_packing_example(&self, struct_content: &str) -> String {
        format!(
            "Original:\n{}\n\nOptimized:\nstruct OptimizedExample {{\n    packed_data: u64,  // Combines multiple fields\n    extended_data: Map<Symbol, u64>,\n}}",
            struct_content
        )
    }

    fn generate_summary(&self, file_analyses: &[FileAnalysis]) -> AnalysisSummary {
        let total_files = file_analyses.len();
        let total_suggestions: usize = file_analyses.iter().map(|f| f.suggestions.len()).sum();
        let high_priority_suggestions: usize = file_analyses.iter()
            .flat_map(|f| f.suggestions.iter())
            .filter(|s| s.priority == "High")
            .count();
        let total_potential_savings: u32 = file_analyses.iter().map(|f| f.total_potential_savings).sum();
        
        let mut categories = HashMap::new();
        for analysis in file_analyses {
            for suggestion in &analysis.suggestions {
                *categories.entry(suggestion.category.clone()).or_insert(0) += 1;
            }
        }
        
        AnalysisSummary {
            total_files,
            total_suggestions,
            high_priority_suggestions,
            total_potential_savings,
            categories,
        }
    }

    fn save_analysis(&self, analysis: &ProjectAnalysis) -> Result<(), Box<dyn std::error::Error>> {
        fs::create_dir_all(&self.output_path)?;
        
        let json_path = Path::new(&self.output_path).join("optimization_analysis.json");
        let json_content = serde_json::to_string_pretty(analysis)?;
        fs::write(&json_path, json_content)?;
        
        self.generate_markdown_report(analysis)?;
        
        println!("Optimization analysis saved to: {}", json_path.display());
        Ok(())
    }

    fn generate_markdown_report(&self, analysis: &ProjectAnalysis) -> Result<(), Box<dyn std::error::Error>> {
        let mut markdown = String::new();
        
        markdown.push_str("# Optimization Suggestions Report\n\n");
        markdown.push_str(&format!("Generated: {}\n\n", analysis.generated_at));
        
        markdown.push_str("## Summary\n\n");
        markdown.push_str(&format!("- **Total Files**: {}\n", analysis.summary.total_files));
        markdown.push_str(&format!("- **Total Suggestions**: {}\n", analysis.summary.total_suggestions));
        markdown.push_str(&format!("- **High Priority**: {}\n", analysis.summary.high_priority_suggestions));
        markdown.push_str(&format!("- **Potential Savings**: {}%\n\n", analysis.summary.total_potential_savings));
        
        markdown.push_str("### Categories\n\n");
        for (category, count) in &analysis.summary.categories {
            markdown.push_str(&format!("- **{}**: {} suggestions\n", category, count));
        }
        markdown.push_str("\n");
        
        markdown.push_str("## High Priority Suggestions\n\n");
        for file_analysis in &analysis.files {
            let high_priority: Vec<_> = file_analysis.suggestions.iter()
                .filter(|s| s.priority == "High")
                .collect();
            
            if !high_priority.is_empty() {
                markdown.push_str(&format!("### {}\n\n", file_analysis.file_path));
                
                for suggestion in high_priority {
                    markdown.push_str(&format!("#### {}\n\n", suggestion.title));
                    markdown.push_str(&format!("**Description**: {}\n\n", suggestion.description));
                    markdown.push_str(&format!("**Estimated Savings**: {}%\n\n", suggestion.estimated_savings));
                    markdown.push_str(&format!("**Difficulty**: {}\n\n", suggestion.implementation_difficulty));
                    if let Some(line) = suggestion.line_number {
                        markdown.push_str(&format!("**Line**: {}\n\n", line));
                    }
                    markdown.push_str(&format!("**Example**:\n```rust\n{}\n```\n\n", suggestion.code_example));
                }
            }
        }
        
        let markdown_path = Path::new(&self.output_path).join("optimization_suggestions.md");
        fs::write(markdown_path, markdown)?;
        
        println!("Markdown report saved to: {}", markdown_path.display());
        Ok(())
    }

    fn generate_fix_script(&self, analysis: &ProjectAnalysis) -> Result<(), Box<dyn std::error::Error>> {
        let mut script = String::new();
        script.push_str("#!/bin/bash\n");
        script.push_str("# Auto-generated optimization fix script\n\n");
        
        for file_analysis in &analysis.files {
            for suggestion in &file_analysis.suggestions {
                if suggestion.priority == "High" {
                    script.push_str(&format!("# Fix for: {}\n", suggestion.title));
                    script.push_str(&format!("# File: {}\n", file_analysis.file_path));
                    if let Some(line) = suggestion.line_number {
                        script.push_str(&format!("# Line: {}\n", line));
                    }
                    script.push_str(&format!("# Description: {}\n", suggestion.description));
                    script.push_str(&format!("# Example: {}\n", suggestion.code_example));
                    script.push_str("echo \"Manual fix required for the above suggestion\"\n\n");
                }
            }
        }
        
        let script_path = Path::new(&self.output_path).join("apply_optimizations.sh");
        fs::write(script_path, script)?;
        
        println!("Fix script generated");
        Ok(())
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let matches = App::new("Optimization Suggestions")
        .version("1.0")
        .about("Analyzes code and provides optimization suggestions")
        .arg(Arg::with_name("project")
            .short("p")
            .long("project")
            .value_name("PATH")
            .help("Path to project directory")
            .default_value("./src"))
        .arg(Arg::with_name("output")
            .short("o")
            .long("output")
            .value_name("PATH")
            .help("Output directory for reports")
            .default_value("./optimization_reports"))
        .subcommand(SubCommand::with_name("analyze")
            .about("Run optimization analysis"))
        .subcommand(SubCommand::with_name("generate-fixes")
            .about("Generate fix script"))
        .get_matches();

    let project_path = matches.value_of("project").unwrap().to_string();
    let output_path = matches.value_of("output").unwrap().to_string();

    let analyzer = OptimizationAnalyzer::new(project_path, output_path);

    match matches.subcommand() {
        ("analyze", Some(_)) => {
            let analysis = analyzer.analyze_project()?;
            analyzer.save_analysis(&analysis)?;
            
            if analysis.summary.high_priority_suggestions > 0 {
                println!("Found {} high priority optimization opportunities", analysis.summary.high_priority_suggestions);
            } else {
                println!("No high priority optimizations found. Code looks good!");
            }
        }
        ("generate-fixes", Some(_)) => {
            let analysis = analyzer.analyze_project()?;
            analyzer.generate_fix_script(&analysis)?;
        }
        _ => {
            println!("Use 'analyze' or 'generate-fixes' subcommand");
        }
    }

    Ok(())
}
