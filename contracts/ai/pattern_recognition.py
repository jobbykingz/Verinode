#!/usr/bin/env python3
"""
Advanced Pattern Recognition for Gas Optimization

This module uses machine learning and static analysis to identify
gas optimization patterns in Soroban smart contracts.
"""

import ast
import re
import json
import numpy as np
from typing import List, Dict, Tuple, Optional, Any, Set
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict, Counter
import networkx as nx
from sklearn.cluster import DBSCAN
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import pickle
import os

class PatternType(Enum):
    INEFFICIENT_STORAGE = "inefficient_storage"
    STORAGE_IN_LOOP = "storage_in_loop"
    REPEATED_COMPUTATION = "repeated_computation"
    INEFFICIENT_VECTOR = "inefficient_vector"
    EXCESSIVE_AUTH = "excessive_auth"
    REDUNDANT_CHECKS = "redundant_checks"
    MAGIC_NUMBERS = "magic_numbers"
    UNNECESSARY_CLONES = "unnecessary_clones"
    MISSING_CACHE = "missing_cache"
    SUBOPTIMAL_ALGORITHM = "suboptimal_algorithm"
    UNUSED_VARIABLES = "unused_variables"
    DEEP_NESTING = "deep_nesting"
    LARGE_FUNCTIONS = "large_functions"

class Severity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class Confidence(Enum):
    VERY_LOW = 0.1
    LOW = 0.3
    MEDIUM = 0.5
    HIGH = 0.7
    VERY_HIGH = 0.9

@dataclass
class CodePattern:
    """Represents a detected code pattern"""
    pattern_type: PatternType
    severity: Severity
    confidence: Confidence
    description: str
    line_numbers: List[int]
    code_snippets: List[str]
    optimization_suggestion: str
    estimated_gas_savings: int
    implementation_complexity: str

@dataclass
class FunctionMetrics:
    """Metrics for a function"""
    name: str
    line_count: int
    cyclomatic_complexity: int
    nesting_depth: int
    storage_operations: int
    loop_count: int
    conditional_count: int
    auth_operations: int
    allocation_count: int
    crypto_operations: int
    parameter_count: int
    return_statements: int

@dataclass
class PatternCluster:
    """Cluster of similar patterns"""
    cluster_id: int
    pattern_type: PatternType
    patterns: List[CodePattern]
    common_characteristics: Dict[str, Any]
    optimization_strategy: str

class ASTAnalyzer:
    """Analyzes Abstract Syntax Tree for patterns"""
    
    def __init__(self):
        self.function_metrics = {}
        self.call_graph = nx.DiGraph()
        self.data_flow_graph = nx.DiGraph()
    
    def analyze_code(self, code: str) -> Dict[str, Any]:
        """Analyze code and extract metrics"""
        try:
            # For Rust code, we'll use regex-based analysis since AST parsing is complex
            return self.analyze_rust_code(code)
        except Exception as e:
            print(f"Error analyzing code: {e}")
            return {}
    
    def analyze_rust_code(self, code: str) -> Dict[str, Any]:
        """Analyze Rust code using regex and heuristics"""
        lines = code.split('\n')
        functions = self.extract_functions(code)
        
        analysis = {
            'functions': {},
            'total_metrics': self.calculate_total_metrics(code),
            'patterns': [],
            'complexity_distribution': [],
            'security_issues': []
        }
        
        for func_name, func_code in functions.items():
            metrics = self.calculate_function_metrics(func_name, func_code)
            analysis['functions'][func_name] = metrics
            
            # Add to complexity distribution
            analysis['complexity_distribution'].append({
                'function': func_name,
                'complexity': metrics.cyclomatic_complexity
            })
        
        return analysis
    
    def extract_functions(self, code: str) -> Dict[str, str]:
        """Extract functions from code"""
        functions = {}
        lines = code.split('\n')
        current_function = None
        function_lines = []
        brace_count = 0
        
        for line in lines:
            # Check for function definition
            if re.match(r'\s*(pub\s+)?fn\s+\w+', line):
                if current_function:
                    functions[current_function] = '\n'.join(function_lines)
                
                func_match = re.search(r'fn\s+(\w+)', line)
                current_function = func_match.group(1) if func_match else f"function_{len(functions)}"
                function_lines = [line]
                brace_count = line.count('{') - line.count('}')
                continue
            
            if current_function:
                function_lines.append(line)
                brace_count += line.count('{') - line.count('}')
                
                if brace_count == 0:
                    functions[current_function] = '\n'.join(function_lines)
                    current_function = None
                    function_lines = []
        
        if current_function and function_lines:
            functions[current_function] = '\n'.join(function_lines)
        
        return functions
    
    def calculate_function_metrics(self, func_name: str, func_code: str) -> FunctionMetrics:
        """Calculate metrics for a function"""
        lines = func_code.split('\n')
        
        # Basic metrics
        line_count = len([l for l in lines if l.strip()])
        cyclomatic_complexity = self.calculate_cyclomatic_complexity(func_code)
        nesting_depth = self.calculate_nesting_depth(func_code)
        
        # Operation counts
        storage_operations = func_code.count('env.storage()')
        loop_count = func_code.count('for ') + func_code.count('while ')
        conditional_count = func_code.count('if ') + func_code.count('match ')
        auth_operations = func_code.count('require_auth()')
        allocation_count = func_code.count('Vec::new') + func_code.count('String::new')
        crypto_operations = func_code.count('hash') + func_code.count('verify') + func_code.count('sign')
        
        # Parameter and return analysis
        param_match = re.search(r'fn\s+\w+\(([^)]*)\)', func_code)
        parameter_count = len(param_match.group(1).split(',')) if param_match and param_match.group(1).strip() else 0
        return_statements = func_code.count('return ') + func_code.count('-> ')
        
        return FunctionMetrics(
            name=func_name,
            line_count=line_count,
            cyclomatic_complexity=cyclomatic_complexity,
            nesting_depth=nesting_depth,
            storage_operations=storage_operations,
            loop_count=loop_count,
            conditional_count=conditional_count,
            auth_operations=auth_operations,
            allocation_count=allocation_count,
            crypto_operations=crypto_operations,
            parameter_count=parameter_count,
            return_statements=return_statements
        )
    
    def calculate_cyclomatic_complexity(self, code: str) -> int:
        """Calculate cyclomatic complexity"""
        complexity = 1  # Base complexity
        complexity += code.count('if ')
        complexity += code.count('for ')
        complexity += code.count('while ')
        complexity += code.count('match ')
        complexity += code.count('case ')
        complexity += code.count('&&') + code.count('||')
        return complexity
    
    def calculate_nesting_depth(self, code: str) -> int:
        """Calculate maximum nesting depth"""
        max_depth = 0
        current_depth = 0
        
        for line in code.split('\n'):
            stripped = line.strip()
            if any(stripped.startswith(keyword) for keyword in ['if ', 'for ', 'while ', 'match']):
                current_depth += 1
                max_depth = max(max_depth, current_depth)
            elif stripped == '}' and current_depth > 0:
                current_depth -= 1
        
        return max_depth
    
    def calculate_total_metrics(self, code: str) -> Dict[str, int]:
        """Calculate total metrics for the entire code"""
        return {
            'total_lines': len([l for l in code.split('\n') if l.strip()]),
            'total_functions': len(re.findall(r'\bfn\s+\w+', code)),
            'total_storage_ops': code.count('env.storage()'),
            'total_loops': code.count('for ') + code.count('while '),
            'total_conditionals': code.count('if ') + code.count('match '),
            'total_auth_ops': code.count('require_auth()'),
            'total_allocations': code.count('Vec::new') + code.count('String::new'),
            'total_crypto_ops': code.count('hash') + code.count('verify') + code.count('sign'),
        }

class PatternMatcher:
    """Matches code patterns using various techniques"""
    
    def __init__(self):
        self.patterns = self.initialize_patterns()
        self.ml_model = None
        self.vectorizer = TfidfVectorizer(max_features=1000)
    
    def initialize_patterns(self) -> Dict[PatternType, Dict[str, Any]]:
        """Initialize pattern definitions"""
        return {
            PatternType.INEFFICIENT_STORAGE: {
                'regex_patterns': [
                    r'env\.storage\(\)\.instance\(\)\.set',
                    r'env\.storage\(\)\.instance\(\)\.get',
                ],
                'threshold': 3,
                'severity': Severity.HIGH,
                'confidence': Confidence.HIGH,
                'description': 'Multiple storage operations detected',
                'suggestion': 'Batch storage operations or use persistent storage',
                'estimated_savings': 3000
            },
            PatternType.STORAGE_IN_LOOP: {
                'regex_patterns': [
                    r'for.*\{[^}]*env\.storage\(\)',
                    r'while.*\{[^}]*env\.storage\(\)',
                ],
                'threshold': 1,
                'severity': Severity.CRITICAL,
                'confidence': Confidence.VERY_HIGH,
                'description': 'Storage operations inside loops detected',
                'suggestion': 'Cache storage values before loops',
                'estimated_savings': 5000
            },
            PatternType.REPEATED_COMPUTATION: {
                'regex_patterns': [
                    r'env\.ledger\(\)\.timestamp\(\)',
                    r'env\.ledger\(\)\.seq\(\)',
                    r'env\.ledger\(\)\.version\(\)',
                ],
                'threshold': 2,
                'severity': Severity.MEDIUM,
                'confidence': Confidence.HIGH,
                'description': 'Repeated expensive computations detected',
                'suggestion': 'Cache computed values in variables',
                'estimated_savings': 2000
            },
            PatternType.INEFFICIENT_VECTOR: {
                'regex_patterns': [
                    r'Vec::new.*push_back',
                    r'vec!\[.*\].*push',
                ],
                'threshold': 2,
                'severity': Severity.MEDIUM,
                'confidence': Confidence.MEDIUM,
                'description': 'Inefficient vector operations detected',
                'suggestion': 'Use Vec::with_capacity for pre-allocation',
                'estimated_savings': 1500
            },
            PatternType.EXCESSIVE_AUTH: {
                'regex_patterns': [
                    r'require_auth\(\).*require_auth\(\)',
                ],
                'threshold': 3,
                'severity': Severity.MEDIUM,
                'confidence': Confidence.MEDIUM,
                'description': 'Multiple authorization checks detected',
                'suggestion': 'Batch authorization checks',
                'estimated_savings': 2500
            },
            PatternType.REDUNDANT_CHECKS: {
                'regex_patterns': [
                    r'if true',
                    r'if false',
                    r'if \w+ == true',
                    r'if \w+ == false',
                ],
                'threshold': 1,
                'severity': Severity.LOW,
                'confidence': Confidence.VERY_HIGH,
                'description': 'Redundant conditional checks detected',
                'suggestion': 'Remove redundant checks',
                'estimated_savings': 500
            },
            PatternType.MAGIC_NUMBERS: {
                'regex_patterns': [
                    r'\b(10|100|1000|10000)\b',
                    r'\b(0x[0-9a-fA-F]+)\b',
                ],
                'threshold': 3,
                'severity': Severity.LOW,
                'confidence': Confidence.MEDIUM,
                'description': 'Magic numbers detected',
                'suggestion': 'Replace with named constants',
                'estimated_savings': 100
            },
            PatternType.UNNECESSARY_CLONES: {
                'regex_patterns': [
                    r'\.clone\(\).*\.clone\(\)',
                    r'\.clone\(\)\s*$',
                ],
                'threshold': 2,
                'severity': Severity.MEDIUM,
                'confidence': Confidence.MEDIUM,
                'description': 'Unnecessary cloning detected',
                'suggestion': 'Remove unnecessary clones or use references',
                'estimated_savings': 1000
            },
            PatternType.DEEP_NESTING: {
                'threshold': 4,
                'severity': Severity.HIGH,
                'confidence': Confidence.HIGH,
                'description': 'Deep nesting detected',
                'suggestion': 'Refactor to reduce nesting depth',
                'estimated_savings': 2000
            },
            PatternType.LARGE_FUNCTIONS: {
                'threshold': 50,
                'severity': Severity.MEDIUM,
                'confidence': Confidence.MEDIUM,
                'description': 'Large function detected',
                'suggestion': 'Break function into smaller functions',
                'estimated_savings': 1500
            }
        }
    
    def find_patterns(self, code: str, analysis_result: Dict[str, Any]) -> List[CodePattern]:
        """Find all patterns in code"""
        patterns = []
        lines = code.split('\n')
        
        # Regex-based pattern matching
        for pattern_type, pattern_config in self.patterns.items():
            if pattern_type in [PatternType.DEEP_NESTING, PatternType.LARGE_FUNCTIONS]:
                # These require metric analysis
                pattern = self.find_metric_based_pattern(pattern_type, pattern_config, analysis_result, lines)
                if pattern:
                    patterns.append(pattern)
            else:
                # Regex-based patterns
                found_patterns = self.find_regex_patterns(pattern_type, pattern_config, lines)
                patterns.extend(found_patterns)
        
        # ML-based pattern detection
        ml_patterns = self.find_ml_patterns(code, analysis_result)
        patterns.extend(ml_patterns)
        
        return patterns
    
    def find_regex_patterns(self, pattern_type: PatternType, config: Dict[str, Any], lines: List[str]) -> List[CodePattern]:
        """Find patterns using regex matching"""
        patterns = []
        regex_patterns = config.get('regex_patterns', [])
        threshold = config.get('threshold', 1)
        
        for pattern in regex_patterns:
            matches = []
            for line_num, line in enumerate(lines, 1):
                if re.search(pattern, line):
                    matches.append((line_num, line.strip()))
            
            if len(matches) >= threshold:
                code_pattern = CodePattern(
                    pattern_type=pattern_type,
                    severity=config['severity'],
                    confidence=config['confidence'],
                    description=config['description'],
                    line_numbers=[match[0] for match in matches],
                    code_snippets=[match[1] for match in matches],
                    optimization_suggestion=config['suggestion'],
                    estimated_gas_savings=config['estimated_savings'] * len(matches),
                    implementation_complexity=self.assess_complexity(pattern_type)
                )
                patterns.append(code_pattern)
        
        return patterns
    
    def find_metric_based_pattern(self, pattern_type: PatternType, config: Dict[str, Any], 
                                 analysis_result: Dict[str, Any], lines: List[str]) -> Optional[CodePattern]:
        """Find patterns based on code metrics"""
        threshold = config.get('threshold', 1)
        
        if pattern_type == PatternType.DEEP_NESTING:
            # Check for deep nesting in functions
            for func_name, metrics in analysis_result.get('functions', {}).items():
                if metrics.nesting_depth >= threshold:
                    return CodePattern(
                        pattern_type=pattern_type,
                        severity=config['severity'],
                        confidence=config['confidence'],
                        description=f"Deep nesting in function {func_name}",
                        line_numbers=[],
                        code_snippets=[f"Function {func_name} has nesting depth of {metrics.nesting_depth}"],
                        optimization_suggestion=config['suggestion'],
                        estimated_gas_savings=config['estimated_savings'],
                        implementation_complexity="moderate"
                    )
        
        elif pattern_type == PatternType.LARGE_FUNCTIONS:
            # Check for large functions
            for func_name, metrics in analysis_result.get('functions', {}).items():
                if metrics.line_count >= threshold:
                    return CodePattern(
                        pattern_type=pattern_type,
                        severity=config['severity'],
                        confidence=config['confidence'],
                        description=f"Large function {func_name}",
                        line_numbers=[],
                        code_snippets=[f"Function {func_name} has {metrics.line_count} lines"],
                        optimization_suggestion=config['suggestion'],
                        estimated_gas_savings=config['estimated_savings'],
                        implementation_complexity="moderate"
                    )
        
        return None
    
    def find_ml_patterns(self, code: str, analysis_result: Dict[str, Any]) -> List[CodePattern]:
        """Find patterns using machine learning"""
        patterns = []
        
        # Analyze function complexity distribution
        complexity_dist = analysis_result.get('complexity_distribution', [])
        if complexity_dist:
            complexities = [item['complexity'] for item in complexity_dist]
            avg_complexity = np.mean(complexities)
            
            # Find outliers (functions with unusually high complexity)
            for item in complexity_dist:
                if item['complexity'] > avg_complexity * 2:
                    patterns.append(CodePattern(
                        pattern_type=PatternType.SUBOPTIMAL_ALGORITHM,
                        severity=Severity.MEDIUM,
                        confidence=Confidence.MEDIUM,
                        description=f"Function {item['function']} has unusually high complexity",
                        line_numbers=[],
                        code_snippets=[f"Complexity: {item['complexity']} (average: {avg_complexity:.1f})"],
                        optimization_suggestion="Review algorithm efficiency",
                        estimated_gas_savings=3000,
                        implementation_complexity="complex"
                    ))
        
        return patterns
    
    def assess_complexity(self, pattern_type: PatternType) -> str:
        """Assess implementation complexity for pattern type"""
        complexity_map = {
            PatternType.REDUNDANT_CHECKS: "trivial",
            PatternType.MAGIC_NUMBERS: "simple",
            PatternType.REPEATED_COMPUTATION: "simple",
            PatternType.INEFFICIENT_VECTOR: "simple",
            PatternType.EXCESSIVE_AUTH: "moderate",
            PatternType.UNNECESSARY_CLONES: "moderate",
            PatternType.INEFFICIENT_STORAGE: "moderate",
            PatternType.STORAGE_IN_LOOP: "moderate",
            PatternType.DEEP_NESTING: "moderate",
            PatternType.LARGE_FUNCTIONS: "moderate",
            PatternType.SUBOPTIMAL_ALGORITHM: "complex",
        }
        return complexity_map.get(pattern_type, "moderate")

class PatternClusterer:
    """Clusters similar patterns for analysis"""
    
    def __init__(self):
        self.clustering_algorithm = DBSCAN(eps=0.3, min_samples=2)
    
    def cluster_patterns(self, patterns: List[CodePattern]) -> List[PatternCluster]:
        """Cluster similar patterns"""
        if len(patterns) < 2:
            return []
        
        # Group patterns by type first
        type_groups = defaultdict(list)
        for pattern in patterns:
            type_groups[pattern.pattern_type].append(pattern)
        
        clusters = []
        cluster_id = 0
        
        for pattern_type, type_patterns in type_groups.items():
            if len(type_patterns) >= 2:
                # Create cluster for this pattern type
                cluster = self.create_cluster(cluster_id, pattern_type, type_patterns)
                clusters.append(cluster)
                cluster_id += 1
        
        return clusters
    
    def create_cluster(self, cluster_id: int, pattern_type: PatternType, patterns: List[CodePattern]) -> PatternCluster:
        """Create a pattern cluster"""
        # Analyze common characteristics
        total_savings = sum(p.estimated_gas_savings for p in patterns)
        avg_confidence = np.mean([p.confidence.value for p in patterns])
        common_lines = set()
        for pattern in patterns:
            common_lines.update(pattern.line_numbers)
        
        # Determine optimization strategy
        strategy = self.determine_strategy(pattern_type, patterns)
        
        return PatternCluster(
            cluster_id=cluster_id,
            pattern_type=pattern_type,
            patterns=patterns,
            common_characteristics={
                'total_patterns': len(patterns),
                'total_savings': total_savings,
                'average_confidence': avg_confidence,
                'affected_lines': list(common_lines),
                'severity_distribution': self.get_severity_distribution(patterns)
            },
            optimization_strategy=strategy
        )
    
    def determine_strategy(self, pattern_type: PatternType, patterns: List[CodePattern]) -> str:
        """Determine optimization strategy for cluster"""
        strategies = {
            PatternType.INEFFICIENT_STORAGE: "Implement storage batching and use persistent storage for long-term data",
            PatternType.STORAGE_IN_LOOP: "Cache storage values before loops and minimize storage operations in iterations",
            PatternType.REPEATED_COMPUTATION: "Implement caching mechanism for expensive computations",
            PatternType.INEFFICIENT_VECTOR: "Pre-allocate memory and use appropriate data structures",
            PatternType.EXCESSIVE_AUTH: "Batch authorization checks and implement role-based access control",
            PatternType.REDUNDANT_CHECKS: "Remove redundant conditions and simplify logic",
            PatternType.MAGIC_NUMBERS: "Replace with named constants and configuration values",
            PatternType.UNNECESSARY_CLONES: "Use references and avoid unnecessary memory copies",
            PatternType.DEEP_NESTING: "Refactor to reduce nesting depth and improve readability",
            PatternType.LARGE_FUNCTIONS: "Break down into smaller, focused functions",
            PatternType.SUBOPTIMAL_ALGORITHM: "Review and replace with more efficient algorithms",
        }
        return strategies.get(pattern_type, "Review and optimize based on specific patterns")
    
    def get_severity_distribution(self, patterns: List[CodePattern]) -> Dict[str, int]:
        """Get distribution of severities in patterns"""
        distribution = Counter()
        for pattern in patterns:
            distribution[pattern.severity.value] += 1
        return dict(distribution)

class AdvancedPatternRecognizer:
    """Advanced pattern recognition system"""
    
    def __init__(self):
        self.ast_analyzer = ASTAnalyzer()
        self.pattern_matcher = PatternMatcher()
        self.clusterer = PatternClusterer()
        self.pattern_history = []
        self.learning_data = []
    
    def analyze_contract(self, contract_code: str) -> Dict[str, Any]:
        """Perform comprehensive pattern analysis"""
        print("Performing advanced pattern recognition...")
        
        # AST analysis
        analysis_result = self.ast_analyzer.analyze_code(contract_code)
        
        # Pattern matching
        patterns = self.pattern_matcher.find_patterns(contract_code, analysis_result)
        
        # Pattern clustering
        clusters = self.clusterer.cluster_patterns(patterns)
        
        # Generate insights
        insights = self.generate_insights(patterns, clusters, analysis_result)
        
        # Store in history
        self.pattern_history.append({
            'timestamp': self.get_timestamp(),
            'patterns': patterns,
            'clusters': clusters,
            'analysis_result': analysis_result,
            'insights': insights
        })
        
        return {
            'analysis_result': analysis_result,
            'patterns': patterns,
            'clusters': clusters,
            'insights': insights,
            'summary': self.generate_summary(patterns, clusters)
        }
    
    def generate_insights(self, patterns: List[CodePattern], clusters: List[PatternCluster], 
                        analysis_result: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate insights from pattern analysis"""
        insights = []
        
        # High-impact patterns
        high_impact_patterns = [p for p in patterns if p.estimated_gas_savings > 3000]
        if high_impact_patterns:
            insights.append({
                'type': 'high_impact',
                'message': f"Found {len(high_impact_patterns)} high-impact optimization opportunities",
                'patterns': high_impact_patterns,
                'potential_savings': sum(p.estimated_gas_savings for p in high_impact_patterns)
            })
        
        # Critical severity patterns
        critical_patterns = [p for p in patterns if p.severity == Severity.CRITICAL]
        if critical_patterns:
            insights.append({
                'type': 'critical',
                'message': f"Found {len(critical_patterns)} critical issues requiring immediate attention",
                'patterns': critical_patterns,
                'recommendation': "Address these patterns first as they have the highest impact"
            })
        
        # Pattern clusters analysis
        if clusters:
            insights.append({
                'type': 'clusters',
                'message': f"Identified {len(clusters)} pattern clusters for systematic optimization",
                'clusters': clusters,
                'recommendation': "Address patterns in clusters for comprehensive improvements"
            })
        
        # Complexity analysis
        functions = analysis_result.get('functions', {})
        complex_functions = [f for f in functions.values() if f.cyclomatic_complexity > 10]
        if complex_functions:
            insights.append({
                'type': 'complexity',
                'message': f"Found {len(complex_functions)} functions with high complexity",
                'functions': [f.name for f in complex_functions],
                'recommendation': "Consider refactoring complex functions to improve maintainability and gas efficiency"
            })
        
        return insights
    
    def generate_summary(self, patterns: List[CodePattern], clusters: List[PatternCluster]) -> Dict[str, Any]:
        """Generate summary of pattern analysis"""
        total_savings = sum(p.estimated_gas_savings for p in patterns)
        severity_counts = Counter(p.severity.value for p in patterns)
        confidence_avg = np.mean([p.confidence.value for p in patterns]) if patterns else 0
        
        return {
            'total_patterns': len(patterns),
            'total_clusters': len(clusters),
            'total_potential_savings': total_savings,
            'severity_distribution': dict(severity_counts),
            'average_confidence': confidence_avg,
            'high_priority_patterns': len([p for p in patterns if p.severity in [Severity.HIGH, Severity.CRITICAL]]),
            'optimization_recommendations': self.get_top_recommendations(patterns)
        }
    
    def get_top_recommendations(self, patterns: List[CodePattern]) -> List[str]:
        """Get top optimization recommendations"""
        # Sort patterns by estimated savings
        sorted_patterns = sorted(patterns, key=lambda p: p.estimated_gas_savings, reverse=True)
        
        recommendations = []
        for pattern in sorted_patterns[:5]:  # Top 5 recommendations
            recommendations.append(
                f"{pattern.pattern_type.value}: {pattern.optimization_suggestion} "
                f"(Estimated savings: {pattern.estimated_gas_savings:,} gas)"
            )
        
        return recommendations
    
    def get_timestamp(self) -> int:
        """Get current timestamp"""
        import time
        return int(time.time())
    
    def save_analysis(self, filepath: str, analysis_result: Dict[str, Any]):
        """Save analysis results to file"""
        # Convert enums to strings for JSON serialization
        serializable_result = self.make_serializable(analysis_result)
        
        with open(filepath, 'w') as f:
            json.dump(serializable_result, f, indent=2)
        
        print(f"Analysis results saved to {filepath}")
    
    def make_serializable(self, obj: Any) -> Any:
        """Convert objects to JSON-serializable format"""
        if isinstance(obj, dict):
            return {k: self.make_serializable(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self.make_serializable(item) for item in obj]
        elif isinstance(obj, (PatternType, Severity, Confidence)):
            return obj.value
        elif hasattr(obj, '__dict__'):
            return self.make_serializable(obj.__dict__)
        else:
            return obj
    
    def load_analysis(self, filepath: str) -> Optional[Dict[str, Any]]:
        """Load analysis results from file"""
        if os.path.exists(filepath):
            with open(filepath, 'r') as f:
                return json.load(f)
        return None
    
    def generate_pattern_report(self, analysis_result: Dict[str, Any]) -> str:
        """Generate detailed pattern report"""
        report = []
        report.append("# Advanced Pattern Recognition Report\n")
        
        # Summary
        summary = analysis_result.get('summary', {})
        report.append("## Summary\n")
        report.append(f"- Total Patterns Found: {summary.get('total_patterns', 0)}\n")
        report.append(f"- Pattern Clusters: {summary.get('total_clusters', 0)}\n")
        report.append(f"- Potential Gas Savings: {summary.get('total_potential_savings', 0):,}\n")
        report.append(f"- High Priority Patterns: {summary.get('high_priority_patterns', 0)}\n\n")
        
        # Insights
        insights = analysis_result.get('insights', [])
        if insights:
            report.append("## Key Insights\n")
            for insight in insights:
                report.append(f"### {insight['type'].title()}\n")
                report.append(f"{insight['message']}\n")
                if 'recommendation' in insight:
                    report.append(f"**Recommendation:** {insight['recommendation']}\n")
                report.append("\n")
        
        # Pattern clusters
        clusters = analysis_result.get('clusters', [])
        if clusters:
            report.append("## Pattern Clusters\n")
            for cluster in clusters:
                report.append(f"### Cluster {cluster.cluster_id}: {cluster.pattern_type.value.title()}\n")
                report.append(f"**Patterns:** {len(cluster.patterns)}\n")
                report.append(f"**Total Savings:** {cluster.common_characteristics['total_savings']:,}\n")
                report.append(f"**Strategy:** {cluster.optimization_strategy}\n\n")
        
        # Top recommendations
        recommendations = summary.get('optimization_recommendations', [])
        if recommendations:
            report.append("## Top Optimization Recommendations\n")
            for i, rec in enumerate(recommendations, 1):
                report.append(f"{i}. {rec}\n")
            report.append("\n")
        
        return ''.join(report)

def main():
    """Main function for testing pattern recognition"""
    # Sample contract code
    sample_contract = '''
    pub fn complex_function(env: Env, data: Vec<Bytes>) -> Vec<Bytes> {
        let mut results = Vec::new(&env);
        
        for i in 0..data.len() {
            let timestamp = env.ledger().timestamp();
            let proof = env.storage().instance().get(&DataKey::Proof(i as u64));
            
            if let Some(p) = proof {
                if p.verified == true {
                    if p.timestamp > timestamp - 86400 {
                        results.push_back(p.event_data.clone());
                        env.storage().instance().set(&DataKey::Result(i as u64), &timestamp);
                    }
                }
            }
            
            for j in 0..10 {
                let temp = env.ledger().timestamp();
                if temp > 0 {
                    results.push_back(data[i].clone());
                }
            }
        }
        
        results
    }
    '''
    
    # Initialize pattern recognizer
    recognizer = AdvancedPatternRecognizer()
    
    # Analyze contract
    result = recognizer.analyze_contract(sample_contract)
    
    # Generate report
    report = recognizer.generate_pattern_report(result)
    print(report)
    
    # Save results
    recognizer.save_analysis('pattern_analysis.json', result)
    
    with open('pattern_report.md', 'w') as f:
        f.write(report)
    
    print("\nPattern recognition complete!")
    print("Results saved to pattern_analysis.json and pattern_report.md")

if __name__ == "__main__":
    main()
