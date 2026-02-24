"""
Tests for the Proof Validator ML model
"""

import unittest
import numpy as np
import pandas as pd
from unittest.mock import Mock, patch
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.proof_validator import ProofValidator, create_sample_data


class TestProofValidator(unittest.TestCase):
    """Test cases for ProofValidator class"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.validator = ProofValidator()
        self.sample_features = {
            'hashComplexity': 0.8,
            'timestampAnomaly': 0.2,
            'issuerReputation': 0.9,
            'contentSimilarity': 0.7,
            'networkActivity': 0.1,
            'geographicAnomaly': 0.3,
            'frequencyPattern': 0.2,
            'sizeAnomaly': 0.4
        }
    
    def test_initialization(self):
        """Test validator initialization"""
        self.assertEqual(len(self.validator.feature_columns), 8)
        self.assertEqual(self.validator.model_metadata['version'], '1.0.0')
        self.assertEqual(len(self.validator.models), 4)  # 4 models in ensemble
    
    def test_preprocess_features(self):
        """Test feature preprocessing"""
        processed = self.validator.preprocess_features(self.sample_features)
        
        self.assertIsInstance(processed, np.ndarray)
        self.assertEqual(processed.shape, (1, 8))  # 1 sample, 8 features
        
        # Check that all values are numeric
        self.assertTrue(np.all(np.isfinite(processed)))
    
    def test_predict(self):
        """Test prediction functionality"""
        result = self.validator.predict(self.sample_features)
        
        # Check result structure
        required_keys = ['prediction', 'confidence', 'risk_level', 'individual_predictions', 
                        'individual_confidences', 'explainability', 'model_version']
        for key in required_keys:
            self.assertIn(key, result)
        
        # Check value ranges
        self.assertIn(result['prediction'], [0, 1])
        self.assertGreaterEqual(result['confidence'], 0)
        self.assertLessEqual(result['confidence'], 1)
        self.assertIn(result['risk_level'], ['low', 'medium', 'high', 'critical'])
        
        # Check individual predictions
        self.assertEqual(len(result['individual_predictions']), 4)
        self.assertEqual(len(result['individual_confidences']), 4)
    
    def test_risk_level_calculation(self):
        """Test risk level calculation"""
        test_cases = [
            (0.9, 'low'),
            (0.7, 'medium'),
            (0.5, 'high'),
            (0.2, 'critical')
        ]
        
        for score, expected_risk in test_cases:
            risk = self.validator._calculate_risk_level(score)
            self.assertEqual(risk, expected_risk)
    
    def test_explainability_generation(self):
        """Test explainability generation"""
        explainability = self.validator._generate_explainability(self.sample_features, 0.8)
        
        required_keys = ['feature_contributions', 'primary_reasons', 'confidence_factors']
        for key in required_keys:
            self.assertIn(key, explainability)
        
        # Check feature contributions
        self.assertIsInstance(explainability['feature_contributions'], dict)
        self.assertEqual(len(explainability['feature_contributions']), 8)
        
        # Check primary reasons
        self.assertIsInstance(explainability['primary_reasons'], list)
        
        # Check confidence factors
        self.assertIsInstance(explainability['confidence_factors'], dict)
        self.assertIn('feature_consistency', explainability['confidence_factors'])
        self.assertIn('pattern_recognition', explainability['confidence_factors'])
    
    def test_feature_consistency_check(self):
        """Test feature consistency checking"""
        # High consistency features
        consistent_features = {
            'issuerReputation': 0.9,
            'timestampAnomaly': 0.1,
            'networkActivity': 0.2,
            'geographicAnomaly': 0.1,
            'frequencyPattern': 0.1
        }
        
        consistency = self.validator._check_feature_consistency(consistent_features)
        self.assertGreater(consistency, 0.5)
        
        # Low consistency features
        inconsistent_features = {
            'issuerReputation': 0.1,
            'timestampAnomaly': 0.9,
            'networkActivity': 0.8,
            'geographicAnomaly': 0.7,
            'frequencyPattern': 0.9
        }
        
        consistency = self.validator._check_feature_consistency(inconsistent_features)
        self.assertLess(consistency, 0.5)
    
    def test_pattern_analysis(self):
        """Test pattern analysis"""
        # Normal patterns
        normal_features = {
            'frequencyPattern': 0.2,
            'timestampAnomaly': 0.1,
            'hashComplexity': 0.8
        }
        
        pattern_score = self.validator._analyze_patterns(normal_features)
        self.assertGreater(pattern_score, 0.5)
        
        # Suspicious patterns
        suspicious_features = {
            'frequencyPattern': 0.9,
            'timestampAnomaly': 0.8,
            'hashComplexity': 0.1
        }
        
        pattern_score = self.validator._analyze_patterns(suspicious_features)
        self.assertLess(pattern_score, 0.5)
    
    @patch('models.proof_validator.ValidationScore.count_documents')
    def test_training(self, mock_count):
        """Test model training"""
        # Mock database responses
        mock_count.return_value = 100
        
        # Create sample data
        X, y = create_sample_data(100)
        
        # Train model
        results = self.validator.train(X, y)
        
        # Check results structure
        required_keys = ['ensemble_accuracy', 'ensemble_auc', 'individual_results', 'feature_importance']
        for key in required_keys:
            self.assertIn(key, results)
        
        # Check metric ranges
        self.assertGreaterEqual(results['ensemble_accuracy'], 0)
        self.assertLessEqual(results['ensemble_accuracy'], 1)
        self.assertGreaterEqual(results['ensemble_auc'], 0)
        self.assertLessEqual(results['ensemble_auc'], 1)
        
        # Check feature importance
        self.assertIsInstance(results['feature_importance'], dict)
        self.assertEqual(len(results['feature_importance']), 8)
    
    def test_model_saving_loading(self):
        """Test model saving and loading"""
        # Create and train a model
        X, y = create_sample_data(50)
        self.validator.train(X, y)
        
        # Save model
        model_path = 'test_model.pkl'
        self.validator.save_model(model_path)
        
        # Load model
        new_validator = ProofValidator(model_path)
        
        # Check that loaded model has same properties
        self.assertEqual(new_validator.model_metadata['version'], self.validator.model_metadata['version'])
        self.assertEqual(len(new_validator.models), len(self.validator.models))
        
        # Clean up
        if os.path.exists(model_path):
            os.remove(model_path)
    
    def test_get_model_info(self):
        """Test model info retrieval"""
        info = self.validator.get_model_info()
        
        required_keys = ['metadata', 'feature_columns', 'feature_importance', 'models']
        for key in required_keys:
            self.assertIn(key, info)
        
        self.assertEqual(len(info['feature_columns']), 8)
        self.assertEqual(len(info['models']), 4)


class TestSampleData(unittest.TestCase):
    """Test cases for sample data generation"""
    
    def test_create_sample_data(self):
        """Test sample data creation"""
        X, y = create_sample_data(100)
        
        # Check shapes
        self.assertEqual(X.shape, (100, 8))
        self.assertEqual(y.shape, (100,))
        
        # Check data types
        self.assertTrue(np.issubdtype(X.dtype, np.floating))
        self.assertTrue(np.issubdtype(y.dtype, np.integer))
        
        # Check value ranges
        self.assertGreaterEqual(np.min(X), 0)
        self.assertLessEqual(np.max(X), 1)
        self.assertTrue(np.all(np.isin(y, [0, 1])))
        
        # Check label distribution
        unique_labels = np.unique(y)
        self.assertEqual(len(unique_labels), 2)
        self.assertIn(0, unique_labels)
        self.assertIn(1, unique_labels)


class TestModelIntegration(unittest.TestCase):
    """Integration tests for the complete ML pipeline"""
    
    def setUp(self):
        """Set up integration test fixtures"""
        self.validator = ProofValidator()
    
    def test_end_to_end_prediction(self):
        """Test complete prediction pipeline"""
        # Test with various feature combinations
        test_cases = [
            {
                'features': {
                    'hashComplexity': 0.9,
                    'timestampAnomaly': 0.1,
                    'issuerReputation': 0.95,
                    'contentSimilarity': 0.8,
                    'networkActivity': 0.05,
                    'geographicAnomaly': 0.2,
                    'frequencyPattern': 0.1,
                    'sizeAnomaly': 0.3
                },
                'expected_risk': 'low'
            },
            {
                'features': {
                    'hashComplexity': 0.1,
                    'timestampAnomaly': 0.9,
                    'issuerReputation': 0.1,
                    'contentSimilarity': 0.2,
                    'networkActivity': 0.9,
                    'geographicAnomaly': 0.8,
                    'frequencyPattern': 0.9,
                    'sizeAnomaly': 0.9
                },
                'expected_risk': 'critical'
            }
        ]
        
        for case in test_cases:
            with self.subTest(case=case):
                result = self.validator.predict(case['features'])
                
                # Check that prediction is reasonable
                self.assertIn(result['prediction'], [0, 1])
                self.assertGreaterEqual(result['confidence'], 0)
                self.assertLessEqual(result['confidence'], 1)
                
                # For extreme cases, risk level should match expectations
                if case['expected_risk'] in ['low', 'critical']:
                    self.assertEqual(result['risk_level'], case['expected_risk'])
    
    def test_batch_predictions(self):
        """Test batch prediction functionality"""
        # Create multiple test cases
        test_features = [
            {
                'hashComplexity': 0.8,
                'timestampAnomaly': 0.2,
                'issuerReputation': 0.9,
                'contentSimilarity': 0.7,
                'networkActivity': 0.1,
                'geographicAnomaly': 0.3,
                'frequencyPattern': 0.2,
                'sizeAnomaly': 0.4
            },
            {
                'hashComplexity': 0.2,
                'timestampAnomaly': 0.8,
                'issuerReputation': 0.3,
                'contentSimilarity': 0.4,
                'networkActivity': 0.7,
                'geographicAnomaly': 0.6,
                'frequencyPattern': 0.8,
                'sizeAnomaly': 0.9
            }
        ]
        
        results = []
        for features in test_features:
            result = self.validator.predict(features)
            results.append(result)
        
        # Check that we got results for all cases
        self.assertEqual(len(results), len(test_features))
        
        # Check that results are different (different inputs should give different outputs)
        self.assertNotEqual(results[0]['risk_level'], results[1]['risk_level'])
    
    def test_model_robustness(self):
        """Test model robustness with edge cases"""
        edge_cases = [
            # All zeros
            {feature: 0.0 for feature in self.validator.feature_columns},
            # All ones
            {feature: 1.0 for feature in self.validator.feature_columns},
            # Mixed extreme values
            {
                'hashComplexity': 1.0,
                'timestampAnomaly': 0.0,
                'issuerReputation': 1.0,
                'contentSimilarity': 0.0,
                'networkActivity': 1.0,
                'geographicAnomaly': 0.0,
                'frequencyPattern': 1.0,
                'sizeAnomaly': 0.0
            }
        ]
        
        for case in edge_cases:
            with self.subTest(case=case):
                # Should not raise any exceptions
                result = self.validator.predict(case)
                
                # Should still produce valid output
                self.assertIn(result['prediction'], [0, 1])
                self.assertGreaterEqual(result['confidence'], 0)
                self.assertLessEqual(result['confidence'], 1)
                self.assertIn(result['risk_level'], ['low', 'medium', 'high', 'critical'])


if __name__ == '__main__':
    unittest.main()
