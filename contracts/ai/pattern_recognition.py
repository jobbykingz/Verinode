"""
Pattern Recognition Module for Smart Contract Gas Optimization

This module uses advanced machine learning techniques to recognize gas optimization patterns
in smart contract code, learn from historical data, and provide intelligent suggestions.
"""

import numpy as np
import pandas as pd
from typing import List, Dict, Tuple, Optional, Any, Set
from dataclasses import dataclass, field
from collections import defaultdict, Counter
import re
import ast
import json
from pathlib import Path
import hashlib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.metrics.pairwise import cosine_similarity
import networkx as nx
from difflib import SequenceMatcher


@dataclass
class CodePattern:
    """Represents a recognized code pattern"""
    pattern_id: str
    name: str
    category: str
    regex_pattern: str
    code_snippet: str
    frequency: int
    gas_impact: int
    confidence: float
    complexity_score: float
    examples: List[str] = field(default_factory=list)
    optimization_suggestions: List[str] = field(default_factory=list)


@dataclass
class PatternMatch:
    """Represents a pattern match in code"""
    pattern: CodePattern
    start_line: int
    end_line: int
    matched_code: str
    confidence: float
    context: str
    gas_savings_potential: int


@dataclass
class PatternCluster:
    """Represents a cluster of similar patterns"""
    cluster_id: int
    patterns: List[CodePattern]
    centroid_pattern: str
    similarity_score: float
    common_optimizations: List[str]


@dataclass
class LearningMetrics:
    """Metrics for pattern learning system"""
    total_patterns_learned: int
    successful_optimizations: int
    accuracy_score: float
    false_positive_rate: float
    average_gas_savings: float
    learning_rate: float


class PatternRecognitionEngine:
    """Advanced pattern recognition engine for gas optimization"""
    
    def __init__(self):
        self.patterns = []
        self.pattern_history = []
        self.vectorizer = TfidfVectorizer(
            max_features=1000,
            ngram_range=(2, 4),
            stop_words=None,
            analyzer='word'
        )
        self.scaler = StandardScaler()
        self.is_trained = False
        self.pattern_graph = nx.DiGraph()
        self.learning_metrics = LearningMetrics(
            total_patterns_learned=0,
            successful_optimizations=0,
            accuracy_score=0.0,
            false_positive_rate=0.0,
            average_gas_savings=0.0,
            learning_rate=0.1
        )
        
        # Initialize with known patterns
        self._initialize_base_patterns()
    
    def _initialize_base_patterns(self):
        """Initialize with known gas optimization patterns"""
        base_patterns = [
            {
                'name': 'Inefficient Storage Pattern',
                'category': 'Storage',
                'regex': r'env\.storage\(\)\.persistent\(\)\.(set|get)\([^)]+\)',
                'gas_impact': 5000,
                'confidence': 0.85,
                'snippet': 'env.storage().persistent().set(&key, &value)'
            },
            {
                'name': 'Unoptimized Loop Pattern',
                'category': 'Loops',
                'regex': r'for\s+\w+\s+in\s+0\.\.\d+.*?{.*?push_back',
                'gas_impact': 3000,
                'confidence': 0.75,
                'snippet': 'for i in 0..n { vec.push_back(item) }'
            },
            {
                'name': 'String Cloning Pattern',
                'category': 'Strings',
                'regex': r'\w+\.clone\(\)',
                'gas_impact': 800,
                'confidence': 0.70,
                'snippet': 'let cloned = original.clone()'
            },
            {
                'name': 'Redundant Computation Pattern',
                'category': 'Computation',
                'regex': r'(\w+\s*[\+\-\*/]\s*\w+).*?\1',
                'gas_impact': 1500,
                'confidence': 0.80,
                'snippet': 'result = a + b; // Later: result = a + b'
            },
            {
                'name': 'Inefficient Vector Usage',
                'category': 'Collections',
                'regex': r'Vec::new\(&env\).*?reserve_exact',
                'gas_impact': 2000,
                'confidence': 0.90,
                'snippet': 'let mut vec = Vec::new(&env); vec.push_back(item)'
            },
            {
                'name': 'Nested Conditional Pattern',
                'category': 'Control Flow',
                'regex': r'if\s+.*?{.*?if\s+.*?{.*?}',
                'gas_impact': 1200,
                'confidence': 0.65,
                'snippet': 'if condition1 { if condition2 { ... } }'
            },
            {
                'name': 'Multiple Storage Writes',
                'category': 'Storage',
                'regex': r'storage\(\)\.instance\(\)\.set[^;]+;.*?storage\(\)\.instance\(\)\.set',
                'gas_impact': 4000,
                'confidence': 0.80,
                'snippet': 'storage.set(&k1, &v1); storage.set(&k2, &v2)'
            },
            {
                'name': 'Arithmetic Inefficiency',
                'category': 'Arithmetic',
                'regex': r'\*\s*2\b|\*\s*4\b|\*\s*8\b',
                'gas_impact': 100,
                'confidence': 0.95,
                'snippet': 'result = value * 2'
            }
        ]
        
        for i, pattern_data in enumerate(base_patterns):
            pattern = CodePattern(
                pattern_id=f"base_{i}",
                name=pattern_data['name'],
                category=pattern_data['category'],
                regex_pattern=pattern_data['regex'],
                code_snippet=pattern_data['snippet'],
                frequency=0,
                gas_impact=pattern_data['gas_impact'],
                confidence=pattern_data['confidence'],
                complexity_score=0.5,
                optimization_suggestions=self._get_optimization_suggestions(pattern_data['category'])
            )
            self.patterns.append(pattern)
    
    def _get_optimization_suggestions(self, category: str) -> List[str]:
        """Get optimization suggestions for a pattern category"""
        suggestions = {
            'Storage': [
                'Use instance storage for temporary data',
                'Batch multiple storage operations',
                'Consider using events instead of storage for logs'
            ],
            'Loops': [
                'Unroll small fixed loops',
                'Pre-allocate collection capacity',
                'Use iterators instead of index-based loops'
            ],
            'Strings': [
                'Use string references instead of cloning',
                'Consider using Bytes for binary data',
                'Avoid unnecessary string concatenations'
            ],
            'Computation': [
                'Cache expensive computations',
                'Use bit operations where possible',
                'Pre-compute constant values'
            ],
            'Collections': [
                'Pre-allocate with known capacity',
                'Use appropriate data structures',
                'Avoid unnecessary clones'
            ],
            'Control Flow': [
                'Use early returns',
                'Reduce nesting levels',
                'Combine similar conditions'
            ],
            'Arithmetic': [
                'Use bit operations for multiplication/division by powers of 2',
                'Cache arithmetic results',
                'Use checked arithmetic where needed'
            ]
        }
        return suggestions.get(category, ['Review for optimization opportunities'])
    
    def extract_code_features(self, source_code: str) -> Dict[str, Any]:
        """Extract comprehensive features from source code"""
        lines = source_code.split('\n')
        
        # Basic metrics
        features = {
            'line_count': len(lines),
            'char_count': len(source_code),
            'function_count': len(re.findall(r'\bfn\s+\w+', source_code)),
            'loop_count': len(re.findall(r'\b(for|while)\b', source_code)),
            'if_count': len(re.findall(r'\bif\b', source_code)),
            'match_count': len(re.findall(r'\bmatch\b', source_code)),
            'storage_ops': len(re.findall(r'storage\(\)', source_code)),
            'vector_ops': len(re.findall(r'Vec::', source_code)),
            'string_ops': len(re.findall(r'String::', source_code)),
            'clone_ops': len(re.findall(r'\.clone\(\)', source_code)),
            'arithmetic_ops': len(re.findall(r'[+\-*/%]', source_code)),
            'bit_ops': len(re.findall(r'[&|^<<>>]', source_code)),
            'function_calls': len(re.findall(r'\w+\(', source_code)),
        }
        
        # Complexity metrics
        features['cyclomatic_complexity'] = (
            features['if_count'] + 
            features['loop_count'] + 
            features['match_count'] + 1
        )
        
        # Code density
        features['code_density'] = features['char_count'] / max(features['line_count'], 1)
        
        # Pattern density
        features['pattern_density'] = (
            features['storage_ops'] + 
            features['loop_count'] + 
            features['clone_ops']
        ) / max(features['line_count'], 1)
        
        return features
    
    def tokenize_code(self, source_code: str) -> List[str]:
        """Tokenize source code for pattern matching"""
        # Remove comments and strings
        code = re.sub(r'//.*?\n', '\n', source_code)
        code = re.sub(r'/\*.*?\*/', '', code, flags=re.DOTALL)
        code = re.sub(r'"[^"]*"', 'STRING', code)
        code = re.sub(r"'[^']*'", 'STRING', code)
        
        # Extract tokens
        tokens = re.findall(r'\b\w+\b|[{}()\[\];,+\-*/%&|^<>=!~]', code)
        return tokens
    
    def calculate_pattern_similarity(self, pattern1: str, pattern2: str) -> float:
        """Calculate similarity between two code patterns"""
        # Tokenize both patterns
        tokens1 = self.tokenize_code(pattern1)
        tokens2 = self.tokenize_code(pattern2)
        
        # Calculate Jaccard similarity
        set1 = set(tokens1)
        set2 = set(tokens2)
        
        intersection = len(set1.intersection(set2))
        union = len(set1.union(set2))
        
        if union == 0:
            return 0.0
        
        jaccard_similarity = intersection / union
        
        # Calculate sequence similarity
        seq_similarity = SequenceMatcher(None, tokens1, tokens2).ratio()
        
        # Combine similarities
        return (jaccard_similarity * 0.6 + seq_similarity * 0.4)
    
    def discover_patterns(self, source_code: str) -> List[PatternMatch]:
        """Discover patterns in source code"""
        matches = []
        lines = source_code.split('\n')
        
        for pattern in self.patterns:
            try:
                regex_matches = list(re.finditer(
                    pattern.regex_pattern, 
                    source_code, 
                    re.MULTILINE | re.DOTALL
                ))
                
                for match in regex_matches:
                    start_line = source_code[:match.start()].count('\n')
                    end_line = source_code[:match.end()].count('\n')
                    matched_code = match.group()
                    
                    # Extract context (surrounding lines)
                    context_start = max(0, start_line - 2)
                    context_end = min(len(lines), end_line + 3)
                    context = '\n'.join(lines[context_start:context_end])
                    
                    # Calculate confidence based on context
                    confidence = self._calculate_match_confidence(
                        pattern, matched_code, context
                    )
                    
                    # Calculate gas savings potential
                    gas_savings = self._calculate_gas_savings_potential(
                        pattern, matched_code, context
                    )
                    
                    pattern_match = PatternMatch(
                        pattern=pattern,
                        start_line=start_line,
                        end_line=end_line,
                        matched_code=matched_code,
                        confidence=confidence,
                        context=context,
                        gas_savings_potential=gas_savings
                    )
                    
                    matches.append(pattern_match)
                    
            except re.error:
                # Skip invalid regex patterns
                continue
        
        return matches
    
    def _calculate_match_confidence(
        self, 
        pattern: CodePattern, 
        matched_code: str, 
        context: str
    ) -> float:
        """Calculate confidence score for a pattern match"""
        base_confidence = pattern.confidence
        
        # Adjust based on code similarity
        similarity = self.calculate_pattern_similarity(pattern.code_snippet, matched_code)
        adjusted_confidence = base_confidence * (0.5 + 0.5 * similarity)
        
        # Adjust based on context
        context_features = self.extract_code_features(context)
        
        # High complexity reduces confidence
        if context_features['cyclomatic_complexity'] > 10:
            adjusted_confidence *= 0.8
        
        # Many operations increase confidence
        if context_features['pattern_density'] > 0.1:
            adjusted_confidence *= 1.1
        
        return min(adjusted_confidence, 1.0)
    
    def _calculate_gas_savings_potential(
        self, 
        pattern: CodePattern, 
        matched_code: str, 
        context: str
    ) -> int:
        """Calculate potential gas savings for a pattern match"""
        base_savings = pattern.gas_impact
        
        # Adjust based on context complexity
        context_features = self.extract_code_features(context)
        
        # More operations = more potential savings
        complexity_multiplier = 1.0 + (context_features['pattern_density'] * 2)
        
        # Adjust for loop patterns
        if pattern.category == 'Loops':
            loop_iterations = len(re.findall(r'push_back|set', context))
            base_savings *= min(loop_iterations, 5)
        
        return int(base_savings * complexity_multiplier)
    
    def cluster_similar_patterns(self, min_similarity: float = 0.7) -> List[PatternCluster]:
        """Cluster similar patterns for analysis"""
        if len(self.patterns) < 2:
            return []
        
        # Create similarity matrix
        similarity_matrix = np.zeros((len(self.patterns), len(self.patterns)))
        
        for i, pattern1 in enumerate(self.patterns):
            for j, pattern2 in enumerate(self.patterns):
                if i != j:
                    similarity = self.calculate_pattern_similarity(
                        pattern1.code_snippet, 
                        pattern2.code_snippet
                    )
                    similarity_matrix[i][j] = similarity
        
        # Perform clustering
        clustering = KMeans(n_clusters=min(5, len(self.patterns)), random_state=42)
        
        # Convert similarity to distance for clustering
        distance_matrix = 1 - similarity_matrix
        np.fill_diagonal(distance_matrix, 0)
        
        try:
            cluster_labels = clustering.fit_predict(distance_matrix)
        except:
            # Fallback if clustering fails
            cluster_labels = [0] * len(self.patterns)
        
        # Create clusters
        clusters = defaultdict(list)
        for i, label in enumerate(cluster_labels):
            clusters[label].append(self.patterns[i])
        
        # Build PatternCluster objects
        pattern_clusters = []
        for cluster_id, patterns_in_cluster in clusters.items():
            if len(patterns_in_cluster) > 1:
                # Find centroid pattern
                centroid_idx = np.argmax([similarity_matrix[i].sum() for i in range(len(patterns))])
                centroid_pattern = self.patterns[centroid_idx].code_snippet
                
                # Calculate average similarity
                similarities = []
                for pattern in patterns_in_cluster:
                    sim = self.calculate_pattern_similarity(
                        centroid_pattern, 
                        pattern.code_snippet
                    )
                    similarities.append(sim)
                
                avg_similarity = np.mean(similarities)
                
                # Find common optimizations
                all_suggestions = []
                for pattern in patterns_in_cluster:
                    all_suggestions.extend(pattern.optimization_suggestions)
                
                common_suggestions = list(set(
                    suggestion for suggestion in all_suggestions 
                    if all_suggestions.count(suggestion) > 1
                ))
                
                cluster = PatternCluster(
                    cluster_id=cluster_id,
                    patterns=patterns_in_cluster,
                    centroid_pattern=centroid_pattern,
                    similarity_score=avg_similarity,
                    common_optimizations=common_suggestions
                )
                pattern_clusters.append(cluster)
        
        return pattern_clusters
    
    def learn_from_feedback(
        self, 
        pattern_matches: List[PatternMatch], 
        feedback: Dict[str, bool],
        actual_gas_savings: Dict[str, int]
    ):
        """Learn from user feedback and actual results"""
        for match in pattern_matches:
            pattern_id = match.pattern.pattern_id
            
            if pattern_id in feedback:
                # Update pattern confidence based on feedback
                if feedback[pattern_id]:
                    # Positive feedback
                    match.pattern.confidence = min(
                        match.pattern.confidence + self.learning_metrics.learning_rate,
                        1.0
                    )
                    self.learning_metrics.successful_optimizations += 1
                else:
                    # Negative feedback
                    match.pattern.confidence = max(
                        match.pattern.confidence - self.learning_metrics.learning_rate,
                        0.1
                    )
                
                # Update frequency
                match.pattern.frequency += 1
                
                # Update gas impact if actual data available
                if pattern_id in actual_gas_savings:
                    actual_savings = actual_gas_savings[pattern_id]
                    # Weighted average update
                    weight = 0.3
                    match.pattern.gas_impact = int(
                        (1 - weight) * match.pattern.gas_impact + 
                        weight * actual_savings
                    )
        
        # Update learning metrics
        self._update_learning_metrics()
    
    def _update_learning_metrics(self):
        """Update learning system metrics"""
        if len(self.patterns) > 0:
            self.learning_metrics.total_patterns_learned = len(self.patterns)
            
            # Calculate average confidence
            avg_confidence = np.mean([p.confidence for p in self.patterns])
            self.learning_metrics.accuracy_score = avg_confidence
            
            # Calculate average gas savings
            avg_savings = np.mean([p.gas_impact for p in self.patterns])
            self.learning_metrics.average_gas_savings = avg_savings
            
            # Estimate false positive rate (simplified)
            low_confidence_patterns = [p for p in self.patterns if p.confidence < 0.5]
            self.learning_metrics.false_positive_rate = len(low_confidence_patterns) / len(self.patterns)
    
    def discover_new_patterns(
        self, 
        source_codes: List[str], 
        min_frequency: int = 3
    ) -> List[CodePattern]:
        """Discover new patterns from multiple source codes"""
        # Extract all code snippets
        all_snippets = []
        for code in source_codes:
            lines = code.split('\n')
            
            # Extract function bodies
            function_matches = re.finditer(
                r'fn\s+\w+\([^)]*\)\s*->\s*\w+\s*{(.*?)}',
                code,
                re.DOTALL
            )
            
            for match in function_matches:
                function_body = match.group(1).strip()
                if len(function_body) > 20:  # Minimum length
                    all_snippets.append(function_body)
        
        # Find common patterns using TF-IDF
        if len(all_snippets) < min_frequency:
            return []
        
        # Create TF-IDF matrix
        try:
            tfidf_matrix = self.vectorizer.fit_transform(all_snippets)
            
            # Find similar code snippets
            similarity_matrix = cosine_similarity(tfidf_matrix)
            
            # Cluster similar snippets
            n_clusters = min(10, len(all_snippets) // min_frequency)
            clustering = KMeans(n_clusters=n_clusters, random_state=42)
            cluster_labels = clustering.fit_predict(similarity_matrix)
            
            # Extract patterns from clusters
            new_patterns = []
            for cluster_id in range(n_clusters):
                cluster_snippets = [
                    all_snippets[i] for i in range(len(all_snippets))
                    if cluster_labels[i] == cluster_id
                ]
                
                if len(cluster_snippets) >= min_frequency:
                    # Create pattern from cluster
                    pattern = self._create_pattern_from_cluster(
                        cluster_snippets, 
                        cluster_id
                    )
                    if pattern:
                        new_patterns.append(pattern)
            
            return new_patterns
            
        except Exception as e:
            print(f"Error discovering patterns: {e}")
            return []
    
    def _create_pattern_from_cluster(
        self, 
        snippets: List[str], 
        cluster_id: int
    ) -> Optional[CodePattern]:
        """Create a pattern from a cluster of similar code snippets"""
        if len(snippets) == 0:
            return None
        
        # Find common elements
        all_tokens = []
        for snippet in snippets:
            tokens = self.tokenize_code(snippet)
            all_tokens.extend(tokens)
        
        # Find most common tokens
        token_counts = Counter(all_tokens)
        common_tokens = [token for token, count in token_counts.most_common(10)]
        
        # Create regex pattern from common tokens
        if len(common_tokens) >= 3:
            # Build regex pattern (simplified)
            pattern_regex = r'\b(?:' + '|'.join(common_tokens[:5]) + r')\b'
            
            # Estimate gas impact based on complexity
            avg_length = np.mean([len(snippet) for snippet in snippets])
            gas_impact = int(avg_length * 2)  # Rough estimate
            
            # Calculate complexity score
            complexity = min(len(common_tokens) / 10, 1.0)
            
            pattern = CodePattern(
                pattern_id=f"discovered_{cluster_id}",
                name=f"Discovered Pattern {cluster_id}",
                category="Discovered",
                regex_pattern=pattern_regex,
                code_snippet=snippets[0][:100] + "..." if len(snippets[0]) > 100 else snippets[0],
                frequency=len(snippets),
                gas_impact=gas_impact,
                confidence=0.6,  # Lower confidence for discovered patterns
                complexity_score=complexity,
                examples=snippets[:3],  # Keep first 3 examples
                optimization_suggestions=["Review this pattern for optimization opportunities"]
            )
            
            return pattern
        
        return None
    
    def analyze_pattern_trends(self) -> Dict[str, Any]:
        """Analyze trends in pattern usage and effectiveness"""
        if len(self.patterns) == 0:
            return {}
        
        # Category distribution
        category_counts = Counter([p.category for p in self.patterns])
        
        # Gas impact distribution
        gas_impacts = [p.gas_impact for p in self.patterns]
        
        # Confidence distribution
        confidences = [p.confidence for p in self.patterns]
        
        # Frequency distribution
        frequencies = [p.frequency for p in self.patterns]
        
        trends = {
            'category_distribution': dict(category_counts),
            'total_patterns': len(self.patterns),
            'avg_gas_impact': np.mean(gas_impacts),
            'avg_confidence': np.mean(confidences),
            'avg_frequency': np.mean(frequencies),
            'high_impact_patterns': len([p for p in self.patterns if p.gas_impact > 3000]),
            'high_confidence_patterns': len([p for p in self.patterns if p.confidence > 0.8]),
            'learning_metrics': {
                'total_patterns_learned': self.learning_metrics.total_patterns_learned,
                'successful_optimizations': self.learning_metrics.successful_optimizations,
                'accuracy_score': self.learning_metrics.accuracy_score,
                'false_positive_rate': self.learning_metrics.false_positive_rate,
                'average_gas_savings': self.learning_metrics.average_gas_savings
            }
        }
        
        return trends
    
    def export_patterns(self, format: str = "json") -> str:
        """Export patterns in specified format"""
        pattern_data = []
        for pattern in self.patterns:
            pattern_dict = {
                'pattern_id': pattern.pattern_id,
                'name': pattern.name,
                'category': pattern.category,
                'regex_pattern': pattern.regex_pattern,
                'code_snippet': pattern.code_snippet,
                'frequency': pattern.frequency,
                'gas_impact': pattern.gas_impact,
                'confidence': pattern.confidence,
                'complexity_score': pattern.complexity_score,
                'optimization_suggestions': pattern.optimization_suggestions
            }
            pattern_data.append(pattern_dict)
        
        if format.lower() == "json":
            return json.dumps(pattern_data, indent=2)
        elif format.lower() == "csv":
            if not pattern_data:
                return ""
            
            # Get all keys
            keys = pattern_data[0].keys()
            
            # Create CSV
            lines = [",".join(keys)]
            for pattern in pattern_data:
                values = [str(pattern.get(key, "")) for key in keys]
                lines.append(",".join(values))
            
            return "\n".join(lines)
        else:
            return json.dumps(pattern_data, indent=2)


def main():
    """Example usage of the PatternRecognitionEngine"""
    engine = PatternRecognitionEngine()
    
    # Example smart contract code
    sample_code = """
    pub fn inefficient_function(env: Env, data: Vec<Bytes>) -> u64 {
        let mut result = 0;
        
        // Inefficient storage operations
        env.storage().persistent().set(&1, &data);
        env.storage().persistent().set(&2, &data);
        
        // Inefficient loop
        for i in 0..3 {
            let cloned_data = data.clone();
            result += i * 2;
            env.storage().persistent().set(&i, &cloned_data);
        }
        
        // Redundant computation
        let expensive = data.len() * 2;
        let result2 = data.len() * 2;
        
        result + expensive + result2
    }
    """
    
    # Discover patterns
    patterns = engine.discover_patterns(sample_code)
    
    print("=== Discovered Patterns ===")
    for i, match in enumerate(patterns, 1):
        print(f"{i}. {match.pattern.name}")
        print(f"   Category: {match.pattern.category}")
        print(f"   Lines: {match.start_line}-{match.end_line}")
        print(f"   Confidence: {match.confidence:.2f}")
        print(f"   Gas Savings Potential: {match.gas_savings_potential}")
        print(f"   Code: {match.matched_code[:80]}...")
        print()
    
    # Analyze trends
    trends = engine.analyze_pattern_trends()
    print("=== Pattern Trends ===")
    print(f"Total Patterns: {trends['total_patterns']}")
    print(f"Average Gas Impact: {trends['avg_gas_impact']:.0f}")
    print(f"Average Confidence: {trends['avg_confidence']:.2f}")
    print(f"Category Distribution: {trends['category_distribution']}")
    
    # Simulate learning from feedback
    feedback = {
        patterns[0].pattern.pattern_id: True,
        patterns[1].pattern.pattern_id: False,
    }
    
    actual_savings = {
        patterns[0].pattern.pattern_id: 4500,
        patterns[1].pattern.pattern_id: 2000,
    }
    
    engine.learn_from_feedback(patterns, feedback, actual_savings)
    
    print("\n=== After Learning ===")
    updated_metrics = engine.analyze_pattern_trends()['learning_metrics']
    print(f"Successful Optimizations: {updated_metrics['successful_optimizations']}")
    print(f"Accuracy Score: {updated_metrics['accuracy_score']:.2f}")


if __name__ == "__main__":
    main()
