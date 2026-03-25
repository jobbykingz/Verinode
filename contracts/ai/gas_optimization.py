#!/usr/bin/env python3
"""
AI-Powered Gas Optimization Suite for Soroban Smart Contracts

This module provides machine learning-based gas optimization suggestions
and automated refactoring capabilities for Soroban smart contracts.
"""

import ast
import re
import json
import numpy as np
from typing import List, Dict, Tuple, Optional, Any
from dataclasses import dataclass
from enum import Enum
from sklearn.ensemble import RandomForestRegressor
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import StandardScaler
import pickle
import os

class OptimizationType(Enum):
    STORAGE_OPTIMIZATION = "storage_optimization"
    LOOP_OPTIMIZATION = "loop_optimization"
    ARITHMETIC_OPTIMIZATION = "arithmetic_optimization"
    MEMORY_OPTIMIZATION = "memory_optimization"
    FUNCTION_INLINING = "function_inlining"
    CONSTANT_FOLDING = "constant_folding"
    DEAD_CODE_ELIMINATION = "dead_code_elimination"
    BATCH_OPERATIONS = "batch_operations"

class Complexity(Enum):
    TRIVIAL = "trivial"
    SIMPLE = "simple"
    MODERATE = "moderate"
    COMPLEX = "complex"
    EXPERT = "expert"

@dataclass
class OptimizationSuggestion:
    """Represents a gas optimization suggestion"""
    function_name: str
    optimization_type: OptimizationType
    current_gas_cost: int
    optimized_gas_cost: int
    savings_percentage: float
    description: str
    code_changes: List[str]
    confidence_score: float
    complexity: Complexity
    line_numbers: List[int]

@dataclass
class GasOptimizationResult:
    """Results of gas optimization analysis"""
    original_gas_cost: int
    optimized_gas_cost: int
    total_savings: int
    savings_percentage: float
    suggestions: List[OptimizationSuggestion]
    applied_optimizations: List[str]
    risk_assessment: str

class GasCostPredictor:
    """ML model for predicting gas costs"""
    
    def __init__(self):
        self.model = RandomForestRegressor(n_estimators=100, random_state=42)
        self.vectorizer = TfidfVectorizer(max_features=1000)
        self.scaler = StandardScaler()
        self.is_trained = False
        
    def extract_features(self, code: str) -> np.ndarray:
        """Extract features from code for gas prediction"""
        features = []
        
        # Basic code metrics
        lines = code.split('\n')
        features.append(len(lines))  # Number of lines
        features.append(len(code))    # Code length
        features.append(code.count('for'))  # Number of loops
        features.append(code.count('while'))  # Number of while loops
        features.append(code.count('if'))  # Number of conditionals
        features.append(code.count('env.storage()'))  # Storage operations
        features.append(code.count('require_auth()'))  # Auth operations
        features.append(code.count('Vec::new'))  # Vector allocations
        features.append(code.count('String::new'))  # String allocations
        
        # Complexity metrics
        features.append(self.calculate_cyclomatic_complexity(code))
        features.append(self.calculate_nested_depth(code))
        
        # Operation-specific metrics
        features.append(code.count('hash'))  # Hash operations
        features.append(code.count('verify'))  # Verification operations
        features.append(code.count('sign'))  # Signing operations
        features.append(code.count('publish'))  # Event emissions
        
        return np.array(features).reshape(1, -1)
    
    def calculate_cyclomatic_complexity(self, code: str) -> int:
        """Calculate cyclomatic complexity"""
        complexity = 1  # Base complexity
        complexity += code.count('if')
        complexity += code.count('for')
        complexity += code.count('while')
        complexity += code.count('match')
        complexity += code.count('case')
        return complexity
    
    def calculate_nested_depth(self, code: str) -> int:
        """Calculate maximum nesting depth"""
        max_depth = 0
        current_depth = 0
        
        for line in code.split('\n'):
            stripped = line.strip()
            if stripped.startswith('if') or stripped.startswith('for') or stripped.startswith('while'):
                current_depth += 1
                max_depth = max(max_depth, current_depth)
            elif stripped == '}' and current_depth > 0:
                current_depth -= 1
                
        return max_depth
    
    def train(self, training_data: List[Tuple[str, int]]):
        """Train the gas prediction model"""
        if len(training_data) < 10:
            print("Warning: Limited training data provided")
            return
        
        codes, gas_costs = zip(*training_data)
        
        # Extract features
        features = []
        for code in codes:
            feature_vector = self.extract_features(code)[0]
            features.append(feature_vector)
        
        X = np.array(features)
        y = np.array(gas_costs)
        
        # Train the model
        self.model.fit(X, y)
        self.is_trained = True
        print(f"Model trained with {len(training_data)} samples")
    
    def predict_gas_cost(self, code: str) -> int:
        """Predict gas cost for given code"""
        if not self.is_trained:
            # Fallback to heuristic estimation
            return self.estimate_gas_heuristic(code)
        
        features = self.extract_features(code)
        prediction = self.model.predict(features)[0]
        return max(0, int(prediction))
    
    def estimate_gas_heuristic(self, code: str) -> int:
        """Heuristic gas estimation when model is not trained"""
        base_cost = 10000
        
        # Add costs for different operations
        storage_ops = code.count('env.storage()')
        base_cost += storage_ops * 3000
        
        loops = code.count('for') + code.count('while')
        base_cost += loops * 2000
        
        conditionals = code.count('if')
        base_cost += conditionals * 500
        
        auth_ops = code.count('require_auth()')
        base_cost += auth_ops * 1500
        
        allocations = code.count('Vec::new') + code.count('String::new')
        base_cost += allocations * 800
        
        crypto_ops = code.count('hash') + code.count('verify') + code.count('sign')
        base_cost += crypto_ops * 8000
        
        return base_cost

class PatternRecognizer:
    """Recognizes gas optimization patterns in code"""
    
    def __init__(self):
        self.patterns = {
            'inefficient_storage': [
                r'env\.storage\(\)\.instance\(\)\.set',
                r'env\.storage\(\)\.instance\(\)\.get',
            ],
            'storage_in_loop': [
                r'for.*\{[^}]*env\.storage\(\)',
                r'while.*\{[^}]*env\.storage\(\)',
            ],
            'repeated_computation': [
                r'env\.ledger\(\)\.timestamp\(\)',
                r'env\.ledger\(\)\.seq\(\)',
            ],
            'inefficient_vector': [
                r'Vec::new.*push_back',
                r'vec!\[.*\].*push',
            ],
            'excessive_auth': [
                r'require_auth\(\).*require_auth\(\)',
            ],
            'redundant_checks': [
                r'if true',
                r'if false',
            ],
            'magic_numbers': [
                r'\b(100|1000|10000)\b',
            ],
            'unnecessary_clones': [
                r'\.clone\(\).*\.clone\(\)',
            ],
        }
    
    def find_patterns(self, code: str) -> Dict[str, List[Tuple[int, str]]]:
        """Find optimization patterns in code"""
        findings = {}
        lines = code.split('\n')
        
        for pattern_name, patterns in self.patterns.items():
            matches = []
            for line_num, line in enumerate(lines, 1):
                for pattern in patterns:
                    if re.search(pattern, line):
                        matches.append((line_num, line.strip()))
            
            if matches:
                findings[pattern_name] = matches
        
        return findings

class GasOptimizer:
    """Main gas optimization engine"""
    
    def __init__(self):
        self.predictor = GasCostPredictor()
        self.pattern_recognizer = PatternRecognizer()
        self.optimization_history = []
        
    def analyze_contract(self, contract_code: str, function_signatures: List[str]) -> GasOptimizationResult:
        """Analyze contract and generate optimization suggestions"""
        print("Analyzing contract for gas optimization opportunities...")
        
        # Extract individual functions
        functions = self.extract_functions(contract_code, function_signatures)
        
        # Analyze each function
        all_suggestions = []
        total_original_cost = 0
        total_optimized_cost = 0
        
        for func_name, func_code in functions.items():
            suggestions = self.analyze_function(func_name, func_code)
            all_suggestions.extend(suggestions)
            
            # Calculate costs
            original_cost = self.predictor.predict_gas_cost(func_code)
            optimized_code = self.apply_optimizations(func_code, suggestions)
            optimized_cost = self.predictor.predict_gas_cost(optimized_code)
            
            total_original_cost += original_cost
            total_optimized_cost += optimized_cost
        
        # Filter high-confidence suggestions
        high_confidence_suggestions = [
            s for s in all_suggestions if s.confidence_score > 0.7
        ]
        
        # Calculate overall metrics
        total_savings = total_original_cost - total_optimized_cost
        savings_percentage = (total_savings / total_original_cost * 100) if total_original_cost > 0 else 0
        
        applied_optimizations = [
            s.optimization_type.value for s in high_confidence_suggestions
        ]
        
        risk_assessment = self.assess_risk(high_confidence_suggestions)
        
        result = GasOptimizationResult(
            original_gas_cost=total_original_cost,
            optimized_gas_cost=total_optimized_cost,
            total_savings=total_savings,
            savings_percentage=savings_percentage,
            suggestions=high_confidence_suggestions,
            applied_optimizations=applied_optimizations,
            risk_assessment=risk_assessment
        )
        
        self.optimization_history.append(result)
        return result
    
    def extract_functions(self, contract_code: str, function_signatures: List[str]) -> Dict[str, str]:
        """Extract individual functions from contract code"""
        functions = {}
        
        for signature in function_signatures:
            func_code = self.extract_function_code(contract_code, signature)
            if func_code:
                functions[signature] = func_code
        
        return functions
    
    def extract_function_code(self, contract_code: str, function_name: str) -> Optional[str]:
        """Extract a specific function's code"""
        lines = contract_code.split('\n')
        function_lines = []
        in_function = False
        brace_count = 0
        
        for line in lines:
            if f'pub fn {function_name}' in line or f'fn {function_name}' in line:
                in_function = True
                function_lines.append(line)
                brace_count += line.count('{') - line.count('}')
                continue
            
            if in_function:
                function_lines.append(line)
                brace_count += line.count('{') - line.count('}')
                
                if brace_count == 0:
                    break
        
        return '\n'.join(function_lines) if function_lines else None
    
    def analyze_function(self, function_name: str, function_code: str) -> List[OptimizationSuggestion]:
        """Analyze a single function for optimization opportunities"""
        suggestions = []
        
        # Find patterns
        patterns = self.pattern_recognizer.find_patterns(function_code)
        
        # Generate suggestions based on patterns
        for pattern_name, matches in patterns.items():
            suggestion = self.create_suggestion_from_pattern(
                function_name, pattern_name, matches, function_code
            )
            if suggestion:
                suggestions.append(suggestion)
        
        # Additional ML-based suggestions
        ml_suggestions = self.generate_ml_suggestions(function_name, function_code)
        suggestions.extend(ml_suggestions)
        
        return suggestions
    
    def create_suggestion_from_pattern(
        self, 
        function_name: str, 
        pattern_name: str, 
        matches: List[Tuple[int, str]], 
        function_code: str
    ) -> Optional[OptimizationSuggestion]:
        """Create optimization suggestion from detected pattern"""
        current_cost = self.predictor.predict_gas_cost(function_code)
        
        if pattern_name == 'inefficient_storage':
            if len(matches) > 2:
                optimized_code = self.optimize_storage_operations(function_code)
                optimized_cost = self.predictor.predict_gas_cost(optimized_code)
                
                return OptimizationSuggestion(
                    function_name=function_name,
                    optimization_type=OptimizationType.STORAGE_OPTIMIZATION,
                    current_gas_cost=current_cost,
                    optimized_gas_cost=optimized_cost,
                    savings_percentage=(current_cost - optimized_cost) / current_cost * 100,
                    description="Batch storage operations to reduce gas costs",
                    code_changes=[
                        "Use persistent storage for long-term data",
                        "Batch multiple storage writes",
                        "Cache storage reads in loops"
                    ],
                    confidence_score=0.85,
                    complexity=Complexity.MODERATE,
                    line_numbers=[match[0] for match in matches]
                )
        
        elif pattern_name == 'storage_in_loop':
            optimized_code = self.optimize_storage_in_loops(function_code)
            optimized_cost = self.predictor.predict_gas_cost(optimized_code)
            
            return OptimizationSuggestion(
                function_name=function_name,
                optimization_type=OptimizationType.LOOP_OPTIMIZATION,
                current_gas_cost=current_cost,
                optimized_gas_cost=optimized_cost,
                savings_percentage=(current_cost - optimized_cost) / current_cost * 100,
                description="Cache storage values before loops to reduce gas costs",
                code_changes=[
                    "Pre-load storage values before loop",
                    "Use cached values in loop iterations",
                    "Minimize storage operations inside loops"
                ],
                confidence_score=0.9,
                complexity=Complexity.SIMPLE,
                line_numbers=[match[0] for match in matches]
            )
        
        elif pattern_name == 'repeated_computation':
            optimized_code = self.fold_constants(function_code)
            optimized_cost = self.predictor.predict_gas_cost(optimized_code)
            
            return OptimizationSuggestion(
                function_name=function_name,
                optimization_type=OptimizationType.CONSTANT_FOLDING,
                current_gas_cost=current_cost,
                optimized_gas_cost=optimized_cost,
                savings_percentage=(current_cost - optimized_cost) / current_cost * 100,
                description="Cache repeated computations to avoid redundant calculations",
                code_changes=[
                    "Store computed values in variables",
                    "Pre-compute constants",
                    "Use lazy evaluation patterns"
                ],
                confidence_score=0.95,
                complexity=Complexity.TRIVIAL,
                line_numbers=[match[0] for match in matches]
            )
        
        elif pattern_name == 'inefficient_vector':
            optimized_code = self.optimize_vector_operations(function_code)
            optimized_cost = self.predictor.predict_gas_cost(optimized_code)
            
            return OptimizationSuggestion(
                function_name=function_name,
                optimization_type=OptimizationType.MEMORY_OPTIMIZATION,
                current_gas_cost=current_cost,
                optimized_gas_cost=optimized_cost,
                savings_percentage=(current_cost - optimized_cost) / current_cost * 100,
                description="Pre-allocate vector capacity to reduce memory allocation costs",
                code_changes=[
                    "Use Vec::with_capacity when size is known",
                    "Pre-allocate memory for vectors",
                    "Consider using arrays for fixed-size collections"
                ],
                confidence_score=0.8,
                complexity=Complexity.SIMPLE,
                line_numbers=[match[0] for match in matches]
            )
        
        return None
    
    def generate_ml_suggestions(self, function_name: str, function_code: str) -> List[OptimizationSuggestion]:
        """Generate ML-based optimization suggestions"""
        suggestions = []
        current_cost = self.predictor.predict_gas_cost(function_code)
        
        # Analyze code characteristics for ML suggestions
        features = self.predictor.extract_features(function_code)[0]
        
        # Suggest function inlining for small functions
        if len(function_code.split('\n')) < 10 and features[2] == 0:  # No loops
            optimized_code = self.inline_functions(function_code)
            optimized_cost = self.predictor.predict_gas_cost(optimized_code)
            
            if optimized_cost < current_cost:
                suggestions.append(OptimizationSuggestion(
                    function_name=function_name,
                    optimization_type=OptimizationType.FUNCTION_INLINING,
                    current_gas_cost=current_cost,
                    optimized_gas_cost=optimized_cost,
                    savings_percentage=(current_cost - optimized_cost) / current_cost * 100,
                    description="Inline small functions to reduce call overhead",
                    code_changes=["Replace function calls with inline code"],
                    confidence_score=0.75,
                    complexity=Complexity.COMPLEX,
                    line_numbers=[]
                ))
        
        return suggestions
    
    def optimize_storage_operations(self, code: str) -> str:
        """Optimize storage operations"""
        optimized = code
        
        # Replace multiple individual sets with batched operations
        if optimized.count('env.storage().instance().set') > 2:
            optimized = re.sub(
                r'env\.storage\(\)\.instance\(\)\.set\([^)]+\);\s*env\.storage\(\)\.instance\(\)\.set\([^)]+\);',
                '// Batched storage operation\nlet batch_data = vec![(key1, value1), (key2, value2)];\nfor (key, value) in batch_data {\n    env.storage().instance().set(&key, &value);\n}',
                optimized
            )
        
        return optimized
    
    def optimize_storage_in_loops(self, code: str) -> str:
        """Optimize storage operations in loops"""
        optimized = code
        
        # Cache storage values before loops
        optimized = re.sub(
            r'for (\w+) in (\w+)\.\.\=(\w+) \{\s*if let Some\((\w+)\) = env\.storage\(\)\.instance\(\)\.get',
            r'// Cache storage values before loop\nlet cached_\4: Vec<Proof> = (1..=\3)\n    .filter_map(|i| env.storage().instance().get(&DataKey::Proof(i)))\n    .collect();\n\nfor \1 in cached_\4 {',
            optimized
        )
        
        return optimized
    
    def fold_constants(self, code: str) -> str:
        """Fold constant expressions"""
        optimized = code
        
        # Cache repeated timestamp calls
        if optimized.count('env.ledger().timestamp()') > 1:
            optimized = re.sub(
                r'let timestamp = env\.ledger\(\)\.timestamp\(\);',
                r'let timestamp = env.ledger().timestamp(); // Cached timestamp',
                optimized
            )
        
        return optimized
    
    def optimize_vector_operations(self, code: str) -> str:
        """Optimize vector operations"""
        optimized = code
        
        # Pre-allocate vector capacity
        optimized = optimized.replace(
            'let mut results = Vec::new(&env);',
            'let mut results = Vec::with_capacity(&env, estimated_size);'
        )
        
        return optimized
    
    def inline_functions(self, code: str) -> str:
        """Inline small functions"""
        # This is a simplified implementation
        # In practice, you'd need to parse the AST and inline properly
        return code
    
    def apply_optimizations(self, code: str, suggestions: List[OptimizationSuggestion]) -> str:
        """Apply optimization suggestions to code"""
        optimized = code
        
        for suggestion in suggestions:
            if suggestion.optimization_type == OptimizationType.STORAGE_OPTIMIZATION:
                optimized = self.optimize_storage_operations(optimized)
            elif suggestion.optimization_type == OptimizationType.LOOP_OPTIMIZATION:
                optimized = self.optimize_storage_in_loops(optimized)
            elif suggestion.optimization_type == OptimizationType.CONSTANT_FOLDING:
                optimized = self.fold_constants(optimized)
            elif suggestion.optimization_type == OptimizationType.MEMORY_OPTIMIZATION:
                optimized = self.optimize_vector_operations(optimized)
        
        return optimized
    
    def assess_risk(self, suggestions: List[OptimizationSuggestion]) -> str:
        """Assess the risk level of applying optimizations"""
        high_complexity = sum(1 for s in suggestions if s.complexity in [Complexity.COMPLEX, Complexity.EXPERT])
        total_suggestions = len(suggestions)
        
        if high_complexity > total_suggestions / 2:
            return "High"
        elif high_complexity > 0:
            return "Medium"
        else:
            return "Low"
    
    def generate_optimization_report(self, result: GasOptimizationResult) -> str:
        """Generate a detailed optimization report"""
        report = []
        report.append("# Gas Optimization Report\n")
        report.append(f"Original Gas Cost: {result.original_gas_cost:,}\n")
        report.append(f"Optimized Gas Cost: {result.optimized_gas_cost:,}\n")
        report.append(f"Total Savings: {result.total_savings:,} ({result.savings_percentage:.1f}%)\n")
        report.append(f"Risk Assessment: {result.risk_assessment}\n")
        report.append(f"Applied Optimizations: {len(result.applied_optimizations)}\n\n")
        
        report.append("## Optimization Suggestions\n")
        for i, suggestion in enumerate(result.suggestions, 1):
            report.append(f"### {i}. {suggestion.optimization_type.value.title()}\n")
            report.append(f"Function: {suggestion.function_name}\n")
            report.append(f"Current Cost: {suggestion.current_gas_cost:,}\n")
            report.append(f"Optimized Cost: {suggestion.optimized_gas_cost:,}\n")
            report.append(f"Savings: {suggestion.savings_percentage:.1f}%\n")
            report.append(f"Confidence: {suggestion.confidence_score:.1f}\n")
            report.append(f"Description: {suggestion.description}\n")
            report.append(f"Code Changes:\n")
            for change in suggestion.code_changes:
                report.append(f"  - {change}\n")
            report.append("\n")
        
        return ''.join(report)
    
    def save_model(self, filepath: str):
        """Save the trained model"""
        if self.predictor.is_trained:
            with open(filepath, 'wb') as f:
                pickle.dump(self.predictor, f)
            print(f"Model saved to {filepath}")
    
    def load_model(self, filepath: str):
        """Load a trained model"""
        if os.path.exists(filepath):
            with open(filepath, 'rb') as f:
                self.predictor = pickle.load(f)
            print(f"Model loaded from {filepath}")
        else:
            print(f"Model file {filepath} not found")

def main():
    """Main function for testing the gas optimizer"""
    # Sample contract code for testing
    sample_contract = '''
    pub fn expensive_function(env: Env, data: Vec<Bytes>) -> Vec<Bytes> {
        let mut results = Vec::new(&env);
        
        for i in 0..data.len() {
            let timestamp = env.ledger().timestamp();
            let proof = env.storage().instance().get(&DataKey::Proof(i as u64));
            
            if let Some(p) = proof {
                results.push_back(p.event_data.clone());
            }
            
            env.storage().instance().set(&DataKey::Result(i as u64), &timestamp);
        }
        
        results
    }
    '''
    
    # Initialize optimizer
    optimizer = GasOptimizer()
    
    # Analyze contract
    function_signatures = ["expensive_function"]
    result = optimizer.analyze_contract(sample_contract, function_signatures)
    
    # Generate report
    report = optimizer.generate_optimization_report(result)
    print(report)
    
    # Save results
    with open('optimization_report.md', 'w') as f:
        f.write(report)
    
    print("Optimization report saved to optimization_report.md")

if __name__ == "__main__":
    main()
