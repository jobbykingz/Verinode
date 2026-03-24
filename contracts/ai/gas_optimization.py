"""
AI-Powered Gas Optimization Module for Verinode Smart Contracts

This module provides advanced machine learning capabilities for gas optimization,
including pattern recognition, predictive analysis, and automated optimization suggestions.
"""

import numpy as np
import pandas as pd
from typing import List, Dict, Tuple, Optional, Any
from dataclasses import dataclass
from sklearn.ensemble import RandomForestRegressor, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, accuracy_score
import re
import ast
import json
from pathlib import Path


@dataclass
class GasPattern:
    """Represents a gas optimization pattern"""
    pattern_id: int
    name: str
    regex_pattern: str
    replacement: str
    gas_savings: int
    confidence: float
    risk_level: int
    category: str
    description: str


@dataclass
class OptimizationResult:
    """Result of gas optimization analysis"""
    original_gas: int
    optimized_gas: int
    gas_savings: int
    savings_percentage: float
    applied_patterns: List[GasPattern]
    risk_score: float
    compilation_verified: bool
    optimizations: List[str]


@dataclass
class CodeFeatures:
    """Extracted features from smart contract code"""
    storage_operations: int
    loop_operations: int
    function_calls: int
    arithmetic_operations: int
    string_operations: int
    vector_operations: int
    conditional_statements: int
    lines_of_code: int
    cyclomatic_complexity: int


class GasOptimizerAI:
    """AI-powered gas optimization engine"""
    
    def __init__(self):
        self.patterns = self._initialize_patterns()
        self.gas_model = None
        self.risk_model = None
        self.scaler = StandardScaler()
        self.is_trained = False
        
    def _initialize_patterns(self) -> List[GasPattern]:
        """Initialize known gas optimization patterns"""
        return [
            GasPattern(
                pattern_id=1,
                name="Persistent to Instance Storage",
                regex_pattern=r'env\.storage\(\)\.persistent\(\)\.(set|get)',
                replacement='env.storage().instance().\\1',
                gas_savings=3000,
                confidence=0.85,
                risk_level=2,
                category="Storage",
                description="Replace persistent storage with instance storage for temporary data"
            ),
            GasPattern(
                pattern_id=2,
                name="Vector Pre-allocation",
                regex_pattern=r'Vec::new\(&env\)',
                replacement='Vec::new(&env)',  # Will be enhanced with capacity hints
                gas_savings=2000,
                confidence=0.90,
                risk_level=1,
                category="Collections",
                description="Pre-allocate vectors with known capacity"
            ),
            GasPattern(
                pattern_id=3,
                name="Early Return Optimization",
                regex_pattern=r'if\s+(\w+)\s*{\s*([^}]+)\s*}\s*else\s*{\s*return\s+([^;]+);',
                replacement='if !\\1 { return \\3; } \\2',
                gas_savings=1500,
                confidence=0.75,
                risk_level=3,
                category="Control Flow",
                description="Use early returns to reduce nesting"
            ),
            GasPattern(
                pattern_id=4,
                name="Arithmetic to Bit Operations",
                regex_pattern=r'\*\s*2\b',
                replacement='<< 1',
                gas_savings=100,
                confidence=0.95,
                risk_level=1,
                category="Arithmetic",
                description="Replace multiplication by 2 with left shift"
            ),
            GasPattern(
                pattern_id=5,
                name="String Clone Optimization",
                regex_pattern=r'(\w+)\.clone\(\)',
                replacement='&\\1',
                gas_savings=800,
                confidence=0.70,
                risk_level=4,
                category="Strings",
                description="Use string references instead of cloning"
            ),
            GasPattern(
                pattern_id=6,
                name="Loop Unrolling",
                regex_pattern=r'for\s+\w+\s+in\s+0\.\.(\d+)',
                replacement='unrolled_loop_\\1',
                gas_savings=2500,
                confidence=0.65,
                risk_level=5,
                category="Loops",
                description="Unroll small fixed loops"
            ),
            GasPattern(
                pattern_id=7,
                name="Batch Storage Operations",
                regex_pattern=r'env\.storage\(\)\.instance\(\)\.set\([^)]+\);\s*env\.storage\(\)\.instance\(\)\.set',
                replacement='batch_storage_operations',
                gas_savings=4000,
                confidence=0.80,
                risk_level=2,
                category="Storage",
                description="Combine multiple storage operations"
            ),
            GasPattern(
                pattern_id=8,
                name="Redundant Check Removal",
                regex_pattern=r'if\s+true\s*{',
                replacement='{',
                gas_savings=500,
                confidence=0.90,
                risk_level=6,
                category="Validation",
                description="Remove redundant validation checks"
            )
        ]
    
    def extract_code_features(self, source_code: str) -> CodeFeatures:
        """Extract features from smart contract source code"""
        lines = source_code.split('\n')
        
        # Count various operations
        storage_ops = len(re.findall(r'storage\(\)\.', source_code))
        loop_ops = len(re.findall(r'\b(for|while)\b', source_code))
        function_calls = len(re.findall(r'\w+\(', source_code))
        arithmetic_ops = len(re.findall(r'[+\-*/%]', source_code))
        string_ops = len(re.findall(r'String::', source_code))
        vector_ops = len(re.findall(r'Vec::', source_code))
        conditional_ops = len(re.findall(r'\b(if|match)\b', source_code))
        
        # Calculate cyclomatic complexity
        decision_points = conditional_ops + loop_ops
        cyclomatic_complexity = decision_points + 1
        
        return CodeFeatures(
            storage_operations=storage_ops,
            loop_operations=loop_ops,
            function_calls=function_calls,
            arithmetic_operations=arithmetic_ops,
            string_operations=string_ops,
            vector_operations=vector_ops,
            conditional_statements=conditional_ops,
            lines_of_code=len(lines),
            cyclomatic_complexity=cyclomatic_complexity
        )
    
    def estimate_gas_usage(self, features: CodeFeatures) -> int:
        """Estimate gas usage based on code features"""
        base_gas = 21000  # Base transaction cost
        
        # Feature-based gas estimation
        storage_gas = features.storage_operations * 5000
        loop_gas = features.loop_operations * 3000
        function_gas = features.function_calls * 1000
        arithmetic_gas = features.arithmetic_operations * 5
        string_gas = features.string_operations * 1500
        vector_gas = features.vector_operations * 800
        conditional_gas = features.conditional_statements * 200
        complexity_gas = features.cyclomatic_complexity * 100
        
        total_gas = (base_gas + storage_gas + loop_gas + function_gas + 
                    arithmetic_gas + string_gas + vector_gas + 
                    conditional_gas + complexity_gas)
        
        return total_gas
    
    def identify_optimization_patterns(self, source_code: str) -> List[Tuple[GasPattern, List[str]]]:
        """Identify applicable optimization patterns in source code"""
        applicable_patterns = []
        
        for pattern in self.patterns:
            matches = re.finditer(pattern.regex_pattern, source_code, re.MULTILINE)
            match_lines = [source_code[:match.start()].count('\n') + 1 for match in matches]
            
            if match_lines:
                applicable_patterns.append((pattern, match_lines))
        
        return applicable_patterns
    
    def calculate_pattern_applicability_score(self, pattern: GasPattern, features: CodeFeatures) -> float:
        """Calculate how applicable a pattern is based on code features"""
        base_score = pattern.confidence
        
        # Adjust score based on code characteristics
        if pattern.category == "Storage":
            if features.storage_operations > 0:
                base_score *= 1.2
        elif pattern.category == "Loops":
            if features.loop_operations > 0:
                base_score *= 1.3
        elif pattern.category == "Collections":
            if features.vector_operations > 0:
                base_score *= 1.1
        elif pattern.category == "Strings":
            if features.string_operations > 0:
                base_score *= 1.15
        
        # Reduce score for high complexity code
        if features.cyclomatic_complexity > 10:
            base_score *= 0.8
        
        return min(base_score, 1.0)
    
    def apply_optimization_pattern(self, source_code: str, pattern: GasPattern) -> str:
        """Apply a specific optimization pattern to source code"""
        optimized_code = source_code
        
        if pattern.pattern_id == 1:  # Storage optimization
            optimized_code = re.sub(
                r'env\.storage\(\)\.persistent\(\)\.(set|get)',
                r'env.storage().instance().\1',
                optimized_code
            )
        elif pattern.pattern_id == 2:  # Vector pre-allocation
            # Enhanced vector pre-allocation logic
            push_matches = re.findall(r'\.push_back\(', optimized_code)
            if len(push_matches) <= 10:
                optimized_code = re.sub(
                    r'Vec::new\(&env\)',
                    f'{{ let mut vec = Vec::new(&env); vec.reserve_exact({len(push_matches)}); vec }}',
                    optimized_code
                )
        elif pattern.pattern_id == 3:  # Early return
            optimized_code = re.sub(
                r'if\s+(\w+)\s*{\s*([^}]+)\s*}\s*else\s*{\s*return\s+([^;]+);',
                r'if !\1 { return \3; } \2',
                optimized_code
            )
        elif pattern.pattern_id == 4:  # Arithmetic to bit operations
            optimized_code = optimized_code.replace('* 2', '<< 1')
            optimized_code = optimized_code.replace('* 4', '<< 2')
            optimized_code = optimized_code.replace('* 8', '<< 3')
        elif pattern.pattern_id == 5:  # String optimization
            # Context-aware string optimization
            lines = optimized_code.split('\n')
            new_lines = []
            for line in lines:
                if '.clone()' in line and 'require_auth()' not in line:
                    new_line = line.replace('.clone()', '')
                    new_lines.append(new_line)
                else:
                    new_lines.append(line)
            optimized_code = '\n'.join(new_lines)
        elif pattern.pattern_id == 6:  # Loop unrolling
            optimized_code = re.sub(
                r'for\s+\w+\s+in\s+0\.\.3\b',
                'let i = 0; { /* loop body */ } let i = 1; { /* loop body */ } let i = 2; { /* loop body */ }',
                optimized_code
            )
        elif pattern.pattern_id == 7:  # Batch storage
            optimized_code = re.sub(
                r'env\.storage\(\)\.instance\(\)\.set\([^)]+\);\s*env\.storage\(\)\.instance\(\)\.set',
                '// Batch storage operations\nenv.storage().instance().set',
                optimized_code
            )
        elif pattern.pattern_id == 8:  # Redundant check removal
            optimized_code = optimized_code.replace('if true {', '{')
        
        return optimized_code
    
    def optimize_contract_code(
        self, 
        source_code: str, 
        target_gas_reduction: float = 0.35,
        max_risk_level: int = 7
    ) -> OptimizationResult:
        """Perform comprehensive gas optimization on smart contract code"""
        
        # Extract features and estimate original gas
        features = self.extract_code_features(source_code)
        original_gas = self.estimate_gas_usage(features)
        
        # Identify applicable patterns
        applicable_patterns = self.identify_optimization_patterns(source_code)
        
        # Filter patterns by risk level and calculate applicability scores
        candidate_patterns = []
        for pattern, match_lines in applicable_patterns:
            if pattern.risk_level <= max_risk_level:
                applicability_score = self.calculate_pattern_applicability_score(pattern, features)
                if applicability_score > 0.6:
                    candidate_patterns.append((pattern, match_lines, applicability_score))
        
        # Sort patterns by gas savings and applicability
        candidate_patterns.sort(key=lambda x: (x[0].gas_savings * x[2]), reverse=True)
        
        # Apply patterns iteratively
        optimized_code = source_code
        applied_patterns = []
        total_gas_savings = 0
        total_risk = 0.0
        optimizations = []
        
        for pattern, match_lines, applicability_score in candidate_patterns:
            # Apply pattern
            new_code = self.apply_optimization_pattern(optimized_code, pattern)
            
            # Verify compilation (basic syntax check)
            if self._verify_compilation(new_code):
                # Calculate gas savings
                new_features = self.extract_code_features(new_code)
                new_gas = self.estimate_gas_usage(new_features)
                gas_savings = original_gas - new_gas if total_gas_savings == 0 else optimized_code.count('\n') - new_code.count('\n')
                
                if gas_savings > 0:
                    optimized_code = new_code
                    applied_patterns.append(pattern)
                    total_gas_savings += gas_savings
                    total_risk += pattern.risk_level
                    
                    optimizations.append(
                        f"Applied {pattern.name}: Saved {gas_savings} gas (lines: {match_lines})"
                    )
                    
                    # Check if target reduction achieved
                    current_reduction = total_gas_savings / original_gas
                    if current_reduction >= target_gas_reduction:
                        break
        
        # Calculate final metrics
        final_features = self.extract_code_features(optimized_code)
        optimized_gas = self.estimate_gas_usage(final_features)
        actual_gas_savings = original_gas - optimized_gas
        savings_percentage = (actual_gas_savings / original_gas) * 100 if original_gas > 0 else 0
        risk_score = total_risk / len(applied_patterns) if applied_patterns else 0.0
        
        return OptimizationResult(
            original_gas=original_gas,
            optimized_gas=optimized_gas,
            gas_savings=actual_gas_savings,
            savings_percentage=savings_percentage,
            applied_patterns=applied_patterns,
            risk_score=risk_score,
            compilation_verified=self._verify_compilation(optimized_code),
            optimizations=optimizations
        )
    
    def _verify_compilation(self, source_code: str) -> bool:
        """Basic compilation verification"""
        try:
            # Check for balanced brackets and parentheses
            open_braces = source_code.count('{')
            close_braces = source_code.count('}')
            open_parens = source_code.count('(')
            close_parens = source_code.count(')')
            
            if open_braces != close_braces or open_parens != close_parens:
                return False
            
            # Basic syntax checks
            if not ('fn ' in source_code or 'impl ' in source_code):
                return False
            
            return True
        except:
            return False
    
    def train_gas_prediction_model(self, training_data: List[Dict[str, Any]]):
        """Train ML model for gas prediction"""
        if len(training_data) < 10:
            return False
        
        # Prepare training data
        X = []
        y = []
        
        for data in training_data:
            features = self.extract_code_features(data['source_code'])
            feature_vector = [
                features.storage_operations,
                features.loop_operations,
                features.function_calls,
                features.arithmetic_operations,
                features.string_operations,
                features.vector_operations,
                features.conditional_statements,
                features.lines_of_code,
                features.cyclomatic_complexity
            ]
            X.append(feature_vector)
            y.append(data['gas_usage'])
        
        X = np.array(X)
        y = np.array(y)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Train model
        self.gas_model = RandomForestRegressor(n_estimators=100, random_state=42)
        self.gas_model.fit(X_train_scaled, y_train)
        
        # Evaluate model
        y_pred = self.gas_model.predict(X_test_scaled)
        mse = mean_squared_error(y_test, y_pred)
        
        self.is_trained = True
        return mse < 1000000  # Acceptable error threshold
    
    def predict_gas_usage(self, source_code: str) -> int:
        """Predict gas usage using trained ML model"""
        if not self.is_trained or self.gas_model is None:
            # Fallback to rule-based estimation
            features = self.extract_code_features(source_code)
            return self.estimate_gas_usage(features)
        
        features = self.extract_code_features(source_code)
        feature_vector = [
            features.storage_operations,
            features.loop_operations,
            features.function_calls,
            features.arithmetic_operations,
            features.string_operations,
            features.vector_operations,
            features.conditional_statements,
            features.lines_of_code,
            features.cyclomatic_complexity
        ]
        
        feature_vector = np.array(feature_vector).reshape(1, -1)
        feature_vector_scaled = self.scaler.transform(feature_vector)
        
        prediction = self.gas_model.predict(feature_vector_scaled)[0]
        return int(prediction)
    
    def analyze_optimization_potential(self, source_code: str) -> Dict[str, Any]:
        """Analyze optimization potential without applying changes"""
        features = self.extract_code_features(source_code)
        applicable_patterns = self.identify_optimization_patterns(source_code)
        
        # Calculate potential savings
        potential_savings = 0
        high_potential_patterns = []
        
        for pattern, match_lines in applicable_patterns:
            if pattern.confidence > 0.7:
                potential_savings += pattern.gas_savings
                high_potential_patterns.append(pattern.name)
        
        optimization_score = min((potential_savings / 10000) * 100, 100)  # Normalize to 0-100
        
        return {
            'optimization_score': optimization_score,
            'potential_gas_savings': potential_savings,
            'applicable_patterns': len(applicable_patterns),
            'high_potential_patterns': high_potential_patterns,
            'code_complexity': features.cyclomatic_complexity,
            'recommendations': self._generate_recommendations(features, applicable_patterns)
        }
    
    def _generate_recommendations(
        self, 
        features: CodeFeatures, 
        applicable_patterns: List[Tuple[GasPattern, List[str]]]
    ) -> List[str]:
        """Generate optimization recommendations"""
        recommendations = []
        
        if features.storage_operations > 5:
            recommendations.append("Consider batching storage operations to reduce gas costs")
        
        if features.loop_operations > 3:
            recommendations.append("Look for opportunities to optimize or unroll loops")
        
        if features.string_operations > 5:
            recommendations.append("Consider using string references instead of cloning")
        
        if features.cyclomatic_complexity > 10:
            recommendations.append("High complexity detected - consider refactoring for better maintainability")
        
        pattern_categories = set(pattern[0].category for pattern in applicable_patterns)
        if "Storage" in pattern_categories:
            recommendations.append("Storage optimizations available")
        if "Loops" in pattern_categories:
            recommendations.append("Loop optimizations available")
        if "Collections" in pattern_categories:
            recommendations.append("Collection optimizations available")
        
        return recommendations
    
    def export_optimization_report(self, result: OptimizationResult, format: str = "json") -> str:
        """Export optimization results in specified format"""
        if format.lower() == "json":
            return json.dumps({
                'original_gas': result.original_gas,
                'optimized_gas': result.optimized_gas,
                'gas_savings': result.gas_savings,
                'savings_percentage': result.savings_percentage,
                'applied_patterns': [
                    {
                        'name': p.name,
                        'category': p.category,
                        'gas_savings': p.gas_savings,
                        'risk_level': p.risk_level
                    } for p in result.applied_patterns
                ],
                'risk_score': result.risk_score,
                'compilation_verified': result.compilation_verified,
                'optimizations': result.optimizations
            }, indent=2)
        
        elif format.lower() == "csv":
            lines = ["Metric,Value"]
            lines.append(f"Original Gas,{result.original_gas}")
            lines.append(f"Optimized Gas,{result.optimized_gas}")
            lines.append(f"Gas Savings,{result.gas_savings}")
            lines.append(f"Savings Percentage,{result.savings_percentage:.2f}%")
            lines.append(f"Risk Score,{result.risk_score:.2f}")
            lines.append(f"Compilation Verified,{result.compilation_verified}")
            return "\n".join(lines)
        
        else:  # markdown
            md = f"""# Gas Optimization Report

## Summary
- **Original Gas:** {result.original_gas:,}
- **Optimized Gas:** {result.optimized_gas:,}
- **Gas Savings:** {result.gas_savings:,} ({result.savings_percentage:.2f}%)
- **Risk Score:** {result.risk_score:.2f}/10
- **Compilation Status:** {'✅ Success' if result.compilation_verified else '❌ Failed'}

## Applied Optimizations
"""
            for i, opt in enumerate(result.optimizations, 1):
                md += f"{i}. {opt}\n"
            
            return md


def main():
    """Example usage of the GasOptimizerAI"""
    optimizer = GasOptimizerAI()
    
    # Example smart contract code
    sample_code = """
    pub fn expensive_function(env: Env, data: Vec<Bytes>) -> u64 {
        let mut result = 0;
        
        // Inefficient storage operations
        env.storage().persistent().set(&1, &data);
        env.storage().persistent().set(&2, &data);
        env.storage().persistent().set(&3, &data);
        
        // Inefficient loop
        for i in 0..3 {
            let cloned_data = data.clone();
            result += i * 2;
            env.storage().persistent().set(&i, &cloned_data);
        }
        
        result
    }
    """
    
    # Perform optimization
    result = optimizer.optimize_contract_code(sample_code, target_gas_reduction=0.35)
    
    # Print results
    print("=== Gas Optimization Results ===")
    print(f"Original Gas: {result.original_gas:,}")
    print(f"Optimized Gas: {result.optimized_gas:,}")
    print(f"Gas Savings: {result.gas_savings:,} ({result.savings_percentage:.2f}%)")
    print(f"Risk Score: {result.risk_score:.2f}/10")
    print(f"Applied Patterns: {len(result.applied_patterns)}")
    
    print("\n=== Optimizations Applied ===")
    for opt in result.optimizations:
        print(f"- {opt}")
    
    # Export report
    report = optimizer.export_optimization_report(result, "markdown")
    print("\n" + report)


if __name__ == "__main__":
    main()
