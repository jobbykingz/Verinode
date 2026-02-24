"""
Proof Validator ML Model
Uses ensemble methods for fraud detection and proof validation
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, IsolationForest
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
import joblib
import logging
from typing import Dict, List, Tuple, Any, Optional
import json
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ProofValidator:
    """
    Ensemble model for proof validation and fraud detection
    Combines multiple ML models for robust prediction
    """
    
    def __init__(self, model_path: Optional[str] = None):
        self.feature_columns = [
            'hashComplexity',
            'timestampAnomaly', 
            'issuerReputation',
            'contentSimilarity',
            'networkActivity',
            'geographicAnomaly',
            'frequencyPattern',
            'sizeAnomaly'
        ]
        
        self.scaler = StandardScaler()
        self.models = {}
        self.feature_importance = {}
        self.model_metadata = {
            'version': '1.0.0',
            'trained_at': None,
            'accuracy': 0.0,
            'auc': 0.0,
            'feature_importance': {}
        }
        
        if model_path:
            self.load_model(model_path)
        else:
            self._initialize_models()
    
    def _initialize_models(self):
        """Initialize individual models in the ensemble"""
        self.models = {
            'random_forest': RandomForestClassifier(
                n_estimators=100,
                max_depth=10,
                random_state=42,
                n_jobs=-1
            ),
            'gradient_boosting': GradientBoostingClassifier(
                n_estimators=100,
                learning_rate=0.1,
                max_depth=6,
                random_state=42
            ),
            'logistic_regression': LogisticRegression(
                random_state=42,
                max_iter=1000
            ),
            'isolation_forest': IsolationForest(
                contamination=0.1,
                random_state=42
            )
        }
    
    def preprocess_features(self, features: Dict[str, float]) -> np.ndarray:
        """
        Preprocess input features for prediction
        """
        try:
            # Convert to DataFrame for consistent processing
            feature_df = pd.DataFrame([features])
            
            # Ensure all required features are present
            for col in self.feature_columns:
                if col not in feature_df.columns:
                    feature_df[col] = 0.0  # Default value
            
            # Select and order features
            feature_array = feature_df[self.feature_columns].values
            
            # Scale features if scaler is fitted
            if hasattr(self.scaler, 'mean_'):
                feature_array = self.scaler.transform(feature_array)
            
            return feature_array
            
        except Exception as e:
            logger.error(f"Feature preprocessing failed: {e}")
            raise
    
    def predict(self, features: Dict[str, float]) -> Dict[str, Any]:
        """
        Make prediction on input features
        Returns ensemble prediction with confidence scores
        """
        try:
            # Preprocess features
            X = self.preprocess_features(features)
            
            # Get predictions from all models
            predictions = {}
            confidences = {}
            
            for name, model in self.models.items():
                if name == 'isolation_forest':
                    # Isolation Forest returns anomaly scores (-1 for anomalies, 1 for normal)
                    pred = model.predict(X)[0]
                    score = model.decision_function(X)[0]
                    # Convert to probability-like score
                    prob = 1 / (1 + np.exp(-score))
                    predictions[name] = 1 if pred == 1 else 0
                    confidences[name] = prob
                else:
                    # Classification models
                    prob = model.predict_proba(X)[0]
                    predictions[name] = np.argmax(prob)
                    confidences[name] = np.max(prob)
            
            # Ensemble prediction (weighted average)
            weights = {
                'random_forest': 0.3,
                'gradient_boosting': 0.3,
                'logistic_regression': 0.2,
                'isolation_forest': 0.2
            }
            
            ensemble_score = sum(confidences[name] * weights[name] for name in self.models.keys())
            ensemble_prediction = 1 if ensemble_score > 0.5 else 0
            
            # Calculate risk level
            risk_level = self._calculate_risk_level(ensemble_score)
            
            # Generate explainability
            explainability = self._generate_explainability(features, ensemble_score)
            
            return {
                'prediction': ensemble_prediction,
                'confidence': ensemble_score,
                'risk_level': risk_level,
                'individual_predictions': predictions,
                'individual_confidences': confidences,
                'explainability': explainability,
                'model_version': self.model_metadata['version']
            }
            
        except Exception as e:
            logger.error(f"Prediction failed: {e}")
            raise
    
    def _calculate_risk_level(self, confidence: float) -> str:
        """Calculate risk level based on confidence score"""
        if confidence >= 0.8:
            return 'low'
        elif confidence >= 0.6:
            return 'medium'
        elif confidence >= 0.4:
            return 'high'
        else:
            return 'critical'
    
    def _generate_explainability(self, features: Dict[str, float], confidence: float) -> Dict[str, Any]:
        """Generate explainability for the prediction"""
        # Feature contributions (simplified SHAP-like explanation)
        contributions = {}
        for feature, value in features.items():
            # Simple contribution calculation based on feature value
            if feature in ['issuerReputation', 'contentSimilarity']:
                # Higher values contribute positively
                contributions[feature] = value * 0.1
            else:
                # Higher values contribute negatively (anomaly indicators)
                contributions[feature] = -value * 0.1
        
        # Sort by absolute contribution
        sorted_contributions = sorted(
            contributions.items(), 
            key=lambda x: abs(x[1]), 
            reverse=True
        )
        
        primary_reasons = []
        for feature, contribution in sorted_contributions[:3]:
            if contribution > 0.05:
                primary_reasons.append(f"High {feature} indicates legitimacy")
            elif contribution < -0.05:
                primary_reasons.append(f"High {feature} indicates suspicious activity")
        
        return {
            'feature_contributions': dict(sorted_contributions),
            'primary_reasons': primary_reasons,
            'confidence_factors': {
                'feature_consistency': self._check_feature_consistency(features),
                'pattern_recognition': self._analyze_patterns(features),
                'historical_similarity': np.random.uniform(0.6, 0.9)  # Mock similarity
            }
        }
    
    def _check_feature_consistency(self, features: Dict[str, float]) -> float:
        """Check if features are consistent with legitimate patterns"""
        # Simple consistency check
        consistency_score = 0.0
        
        # Issuer reputation should be high for legitimate proofs
        if features.get('issuerReputation', 0) > 0.7:
            consistency_score += 0.3
        
        # Low anomaly scores indicate consistency
        anomaly_features = ['timestampAnomaly', 'networkActivity', 'frequencyPattern']
        for feature in anomaly_features:
            if features.get(feature, 1) < 0.3:
                consistency_score += 0.2
        
        return min(consistency_score, 1.0)
    
    def _analyze_patterns(self, features: Dict[str, float]) -> float:
        """Analyze patterns in the features"""
        # Mock pattern analysis
        pattern_score = 0.5
        
        # Check for suspicious patterns
        if features.get('frequencyPattern', 0) > 0.7:
            pattern_score -= 0.2  # Regular pattern suggests automation
        
        if features.get('timestampAnomaly', 0) > 0.7:
            pattern_score -= 0.2  # Unusual timing
        
        if features.get('hashComplexity', 0) < 0.2:
            pattern_score -= 0.1  # Simple hash might indicate manipulation
        
        return max(0, min(1, pattern_score))
    
    def train(self, X: np.ndarray, y: np.ndarray, validation_split: float = 0.2) -> Dict[str, Any]:
        """
        Train the ensemble model
        """
        try:
            # Split data
            X_train, X_val, y_train, y_val = train_test_split(
                X, y, test_size=validation_split, random_state=42, stratify=y
            )
            
            # Fit scaler
            X_train_scaled = self.scaler.fit_transform(X_train)
            X_val_scaled = self.scaler.transform(X_val)
            
            # Train individual models
            training_results = {}
            
            for name, model in self.models.items():
                logger.info(f"Training {name}...")
                
                if name == 'isolation_forest':
                    # For isolation forest, use all data (unsupervised)
                    model.fit(X_train_scaled)
                    # Convert predictions to binary labels
                    train_pred = model.predict(X_train_scaled)
                    train_pred = np.where(train_pred == 1, 1, 0)
                    val_pred = model.predict(X_val_scaled)
                    val_pred = np.where(val_pred == 1, 1, 0)
                else:
                    # For supervised models
                    model.fit(X_train_scaled, y_train)
                    train_pred = model.predict(X_train_scaled)
                    val_pred = model.predict(X_val_scaled)
                
                # Calculate metrics
                train_accuracy = np.mean(train_pred == y_train)
                val_accuracy = np.mean(val_pred == y_val)
                
                training_results[name] = {
                    'train_accuracy': train_accuracy,
                    'val_accuracy': val_accuracy
                }
                
                logger.info(f"{name} - Train Acc: {train_accuracy:.4f}, Val Acc: {val_accuracy:.4f}")
            
            # Calculate ensemble metrics
            ensemble_train_pred = self._ensemble_predict(X_train_scaled)
            ensemble_val_pred = self._ensemble_predict(X_val_scaled)
            
            ensemble_train_acc = np.mean(ensemble_train_pred == y_train)
            ensemble_val_acc = np.mean(ensemble_val_pred == y_val)
            
            # Calculate AUC
            ensemble_val_proba = self._ensemble_predict_proba(X_val_scaled)
            auc_score = roc_auc_score(y_val, ensemble_val_proba)
            
            # Update feature importance
            self._update_feature_importance()
            
            # Update metadata
            self.model_metadata.update({
                'trained_at': datetime.now().isoformat(),
                'accuracy': ensemble_val_acc,
                'auc': auc_score,
                'feature_importance': self.feature_importance,
                'training_results': training_results
            })
            
            logger.info(f"Ensemble - Train Acc: {ensemble_train_acc:.4f}, Val Acc: {ensemble_val_acc:.4f}, AUC: {auc_score:.4f}")
            
            return {
                'ensemble_accuracy': ensemble_val_acc,
                'ensemble_auc': auc_score,
                'individual_results': training_results,
                'feature_importance': self.feature_importance
            }
            
        except Exception as e:
            logger.error(f"Training failed: {e}")
            raise
    
    def _ensemble_predict(self, X: np.ndarray) -> np.ndarray:
        """Make ensemble predictions"""
        predictions = []
        
        for name, model in self.models.items():
            if name == 'isolation_forest':
                pred = model.predict(X)
                pred = np.where(pred == 1, 1, 0)
            else:
                pred = model.predict(X)
            predictions.append(pred)
        
        # Majority voting
        predictions = np.array(predictions)
        ensemble_pred = np.apply_along_axis(lambda x: np.bincount(x).argmax(), axis=0, predictions)
        
        return ensemble_pred
    
    def _ensemble_predict_proba(self, X: np.ndarray) -> np.ndarray:
        """Get ensemble probability predictions"""
        probabilities = []
        
        for name, model in self.models.items():
            if name == 'isolation_forest':
                # Convert decision function to probability
                score = model.decision_function(X)
                prob = 1 / (1 + np.exp(-score))
                probabilities.append(prob)
            else:
                prob = model.predict_proba(X)[:, 1]  # Probability of class 1
                probabilities.append(prob)
        
        # Average probabilities
        ensemble_proba = np.mean(probabilities, axis=0)
        
        return ensemble_proba
    
    def _update_feature_importance(self):
        """Update feature importance from trained models"""
        importance_scores = {}
        
        for name, model in self.models.items():
            if hasattr(model, 'feature_importances_'):
                importance_scores[name] = model.feature_importances_
        
        # Average importance across models
        if importance_scores:
            avg_importance = np.mean(list(importance_scores.values()), axis=0)
            self.feature_importance = dict(zip(self.feature_columns, avg_importance))
    
    def save_model(self, path: str):
        """Save the trained model"""
        model_data = {
            'models': self.models,
            'scaler': self.scaler,
            'feature_columns': self.feature_columns,
            'feature_importance': self.feature_importance,
            'metadata': self.model_metadata
        }
        
        joblib.dump(model_data, path)
        logger.info(f"Model saved to {path}")
    
    def load_model(self, path: str):
        """Load a trained model"""
        try:
            model_data = joblib.load(path)
            
            self.models = model_data['models']
            self.scaler = model_data['scaler']
            self.feature_columns = model_data['feature_columns']
            self.feature_importance = model_data['feature_importance']
            self.model_metadata = model_data['metadata']
            
            logger.info(f"Model loaded from {path}")
            
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get model information and metadata"""
        return {
            'metadata': self.model_metadata,
            'feature_columns': self.feature_columns,
            'feature_importance': self.feature_importance,
            'models': list(self.models.keys())
        }

# Utility functions for model management
def create_sample_data(n_samples: int = 1000) -> Tuple[np.ndarray, np.ndarray]:
    """Create sample training data for testing"""
    np.random.seed(42)
    
    # Generate features
    features = np.random.rand(n_samples, 8)
    
    # Create labels based on feature patterns
    labels = np.zeros(n_samples)
    
    # Simple rule-based labeling for demo
    for i in range(n_samples):
        # High reputation and low anomalies = legitimate (1)
        if features[i, 2] > 0.7 and features[i, 1] < 0.3 and features[i, 4] < 0.3:
            labels[i] = 1
        # Low reputation or high anomalies = fraudulent (0)
        elif features[i, 2] < 0.3 or features[i, 1] > 0.7 or features[i, 4] > 0.7:
            labels[i] = 0
        else:
            labels[i] = np.random.choice([0, 1])
    
    return features, labels

if __name__ == "__main__":
    # Example usage
    validator = ProofValidator()
    
    # Create sample data
    X, y = create_sample_data(1000)
    
    # Train model
    training_results = validator.train(X, y)
    print("Training Results:", training_results)
    
    # Make prediction
    sample_features = {
        'hashComplexity': 0.8,
        'timestampAnomaly': 0.2,
        'issuerReputation': 0.9,
        'contentSimilarity': 0.7,
        'networkActivity': 0.1,
        'geographicAnomaly': 0.3,
        'frequencyPattern': 0.2,
        'sizeAnomaly': 0.4
    }
    
    prediction = validator.predict(sample_features)
    print("Prediction:", prediction)
    
    # Save model
    validator.save_model('proof_validator_model.pkl')
