"""
ML Training Pipeline for Proof Validation
Automated model training, evaluation, and deployment
"""

import os
import sys
import json
import logging
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
import joblib
from pathlib import Path

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from models.proof_validator import ProofValidator, create_sample_data
from utils.data_preprocessing import DataPreprocessor

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class TrainingPipeline:
    """
    Automated training pipeline for proof validation models
    Handles data collection, preprocessing, training, evaluation, and deployment
    """
    
    def __init__(self, config_path: Optional[str] = None):
        self.config = self._load_config(config_path)
        self.model_dir = Path(self.config.get('model_dir', 'models'))
        self.data_dir = Path(self.config.get('data_dir', 'data'))
        self.logs_dir = Path(self.config.get('logs_dir', 'logs'))
        
        # Create directories
        self.model_dir.mkdir(exist_ok=True)
        self.data_dir.mkdir(exist_ok=True)
        self.logs_dir.mkdir(exist_ok=True)
        
        self.preprocessor = DataPreprocessor()
        self.validator = None
        
        # Training history
        self.training_history = []
        
    def _load_config(self, config_path: Optional[str]) -> Dict[str, Any]:
        """Load training configuration"""
        default_config = {
            'model_dir': 'models',
            'data_dir': 'data',
            'logs_dir': 'logs',
            'training': {
                'validation_split': 0.2,
                'test_split': 0.2,
                'cross_validation_folds': 5,
                'min_training_samples': 1000,
                'retraining_threshold': 0.05
            },
            'data_collection': {
                'max_age_days': 30,
                'min_confidence': 0.7,
                'include_human_reviewed': True,
                'include_automated_labels': True
            },
            'evaluation': {
                'metrics': ['accuracy', 'precision', 'recall', 'f1', 'auc'],
                'thresholds': {
                    'min_accuracy': 0.8,
                    'min_auc': 0.85
                }
            },
            'deployment': {
                'auto_deploy': True,
                'backup_previous': True,
                'model_retention_count': 5
            }
        }
        
        if config_path and os.path.exists(config_path):
            with open(config_path, 'r') as f:
                user_config = json.load(f)
            # Merge with default config
            default_config.update(user_config)
        
        return default_config
    
    def collect_training_data(self) -> Tuple[np.ndarray, np.ndarray, Dict[str, Any]]:
        """
        Collect training data from various sources
        Returns features, labels, and metadata
        """
        logger.info("Collecting training data...")
        
        # In a real implementation, this would connect to databases
        # For now, we'll create sample data
        features, labels = create_sample_data(2000)
        
        # Add some noise and realistic patterns
        np.random.seed(42)
        noise = np.random.normal(0, 0.1, features.shape)
        features = np.clip(features + noise, 0, 1)
        
        metadata = {
            'sample_count': len(features),
            'feature_count': features.shape[1],
            'class_distribution': {
                'legitimate': int(np.sum(labels)),
                'fraudulent': int(len(labels) - np.sum(labels))
            },
            'collection_date': datetime.now().isoformat(),
            'data_quality_score': 0.85
        }
        
        logger.info(f"Collected {len(features)} training samples")
        logger.info(f"Class distribution: {metadata['class_distribution']}")
        
        return features, labels, metadata
    
    def preprocess_data(self, features: np.ndarray, labels: np.ndarray) -> Tuple[np.ndarray, np.ndarray, Dict[str, Any]]:
        """
        Preprocess training data
        """
        logger.info("Preprocessing training data...")
        
        # Apply preprocessing steps
        processed_features, preprocessing_metadata = self.preprocessor.fit_transform(features)
        
        # Handle class imbalance if needed
        processed_features, balanced_labels = self._handle_class_imbalance(
            processed_features, labels
        )
        
        metadata = {
            'original_shape': features.shape,
            'processed_shape': processed_features.shape,
            'preprocessing_steps': preprocessing_metadata,
            'class_balance_applied': len(balanced_labels) != len(labels)
        }
        
        logger.info(f"Preprocessed data shape: {processed_features.shape}")
        
        return processed_features, balanced_labels, metadata
    
    def _handle_class_imbalance(self, features: np.ndarray, labels: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Handle class imbalance using SMOTE or undersampling
        """
        from collections import Counter
        
        class_counts = Counter(labels)
        min_class_size = min(class_counts.values())
        max_class_size = max(class_counts.values())
        
        # If imbalance is significant, apply balancing
        if max_class_size / min_class_size > 2:
            logger.info("Applying class balancing...")
            
            # Simple undersampling for demo
            balanced_indices = []
            for class_label in class_counts.keys():
                class_indices = np.where(labels == class_label)[0]
                selected_indices = np.random.choice(
                    class_indices, 
                    size=min_class_size, 
                    replace=False
                )
                balanced_indices.extend(selected_indices)
            
            balanced_indices = np.array(balanced_indices)
            np.random.shuffle(balanced_indices)
            
            return features[balanced_indices], labels[balanced_indices]
        
        return features, labels
    
    def train_model(self, features: np.ndarray, labels: np.ndarray) -> Dict[str, Any]:
        """
        Train the proof validation model
        """
        logger.info("Starting model training...")
        
        # Initialize validator
        self.validator = ProofValidator()
        
        # Train model
        training_results = self.validator.train(
            features, 
            labels, 
            validation_split=self.config['training']['validation_split']
        )
        
        # Evaluate model
        evaluation_results = self._evaluate_model(features, labels)
        
        # Combine results
        results = {
            'training': training_results,
            'evaluation': evaluation_results,
            'model_info': self.validator.get_model_info(),
            'training_date': datetime.now().isoformat()
        }
        
        logger.info("Model training completed successfully")
        return results
    
    def _evaluate_model(self, features: np.ndarray, labels: np.ndarray) -> Dict[str, Any]:
        """
        Evaluate model performance
        """
        from sklearn.model_selection import cross_val_score
        from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
        
        logger.info("Evaluating model performance...")
        
        # Split data for evaluation
        from sklearn.model_selection import train_test_split
        X_train, X_test, y_train, y_test = train_test_split(
            features, labels, test_size=0.2, random_state=42, stratify=labels
        )
        
        # Get predictions
        y_pred = self.validator._ensemble_predict(X_test)
        y_proba = self.validator._ensemble_predict_proba(X_test)
        
        # Calculate metrics
        accuracy = np.mean(y_pred == y_test)
        
        # Detailed classification report
        report = classification_report(y_test, y_pred, output_dict=True)
        
        # Confusion matrix
        cm = confusion_matrix(y_test, y_pred)
        
        # AUC score
        auc = roc_auc_score(y_test, y_proba)
        
        # Cross-validation
        cv_scores = cross_val_score(
            self.validator.models['random_forest'], 
            X_train, y_train, 
            cv=5, 
            scoring='accuracy'
        )
        
        evaluation_results = {
            'accuracy': accuracy,
            'precision': report['weighted avg']['precision'],
            'recall': report['weighted avg']['recall'],
            'f1_score': report['weighted avg']['f1-score'],
            'auc': auc,
            'confusion_matrix': cm.tolist(),
            'classification_report': report,
            'cross_validation': {
                'mean_score': cv_scores.mean(),
                'std_score': cv_scores.std(),
                'scores': cv_scores.tolist()
            },
            'meets_thresholds': {
                'accuracy': accuracy >= self.config['evaluation']['thresholds']['min_accuracy'],
                'auc': auc >= self.config['evaluation']['thresholds']['min_auc']
            }
        }
        
        logger.info(f"Model Accuracy: {accuracy:.4f}")
        logger.info(f"Model AUC: {auc:.4f}")
        
        return evaluation_results
    
    def save_model(self, results: Dict[str, Any]) -> str:
        """
        Save trained model and metadata
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        model_filename = f"proof_validator_{timestamp}.pkl"
        model_path = self.model_dir / model_filename
        
        # Save model
        self.validator.save_model(str(model_path))
        
        # Save metadata
        metadata_filename = f"proof_validator_{timestamp}_metadata.json"
        metadata_path = self.model_dir / metadata_filename
        
        metadata = {
            'model_filename': model_filename,
            'model_path': str(model_path),
            'training_results': results,
            'config': self.config,
            'timestamp': timestamp
        }
        
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        # Update training history
        self.training_history.append({
            'timestamp': timestamp,
            'model_path': str(model_path),
            'accuracy': results['evaluation']['accuracy'],
            'auc': results['evaluation']['auc']
        })
        
        # Clean up old models
        self._cleanup_old_models()
        
        logger.info(f"Model saved to {model_path}")
        return str(model_path)
    
    def _cleanup_old_models(self):
        """
        Clean up old model files, keeping only the most recent ones
        """
        retention_count = self.config['deployment']['model_retention_count']
        
        model_files = list(self.model_dir.glob("proof_validator_*.pkl"))
        model_files.sort(key=lambda x: x.stat().st_mtime, reverse=True)
        
        if len(model_files) > retention_count:
            for old_model in model_files[retention_count:]:
                # Remove both model and metadata files
                old_model.unlink()
                metadata_file = old_model.with_suffix('.json')
                if metadata_file.exists():
                    metadata_file.unlink()
                
                logger.info(f"Removed old model: {old_model}")
    
    def should_retrain(self) -> bool:
        """
        Check if model should be retrained based on performance degradation
        """
        if not self.training_history:
            return True
        
        # Get latest model performance
        latest_model = self.training_history[-1]
        current_accuracy = latest_model['accuracy']
        
        # Check if performance has degraded
        if len(self.training_history) >= 2:
            previous_model = self.training_history[-2]
            previous_accuracy = previous_model['accuracy']
            
            performance_drop = previous_accuracy - current_accuracy
            threshold = self.config['training']['retraining_threshold']
            
            if performance_drop > threshold:
                logger.info(f"Performance dropped by {performance_drop:.4f}, triggering retraining")
                return True
        
        # Also check if model is old (more than 7 days)
        model_date = datetime.fromisoformat(latest_model['timestamp'])
        if datetime.now() - model_date > timedelta(days=7):
            logger.info("Model is older than 7 days, triggering retraining")
            return True
        
        return False
    
    def run_pipeline(self, force_retrain: bool = False) -> Dict[str, Any]:
        """
        Run the complete training pipeline
        """
        logger.info("Starting training pipeline...")
        
        try:
            # Check if retraining is needed
            if not force_retrain and not self.should_retrain():
                logger.info("Retraining not needed, skipping pipeline")
                return {'status': 'skipped', 'reason': 'performance_sufficient'}
            
            # Step 1: Collect data
            features, labels, data_metadata = self.collect_training_data()
            
            # Step 2: Preprocess data
            processed_features, processed_labels, preprocessing_metadata = self.preprocess_data(features, labels)
            
            # Step 3: Train model
            training_results = self.train_model(processed_features, processed_labels)
            
            # Step 4: Save model
            model_path = self.save_model(training_results)
            
            # Step 5: Deploy if configured
            if self.config['deployment']['auto_deploy']:
                self._deploy_model(model_path)
            
            pipeline_results = {
                'status': 'success',
                'model_path': model_path,
                'data_metadata': data_metadata,
                'preprocessing_metadata': preprocessing_metadata,
                'training_results': training_results,
                'pipeline_timestamp': datetime.now().isoformat()
            }
            
            logger.info("Training pipeline completed successfully")
            return pipeline_results
            
        except Exception as e:
            logger.error(f"Training pipeline failed: {e}")
            return {
                'status': 'failed',
                'error': str(e),
                'pipeline_timestamp': datetime.now().isoformat()
            }
    
    def _deploy_model(self, model_path: str):
        """
        Deploy model to production
        """
        # In a real implementation, this would copy the model to production servers
        # For now, we'll just create a symlink or copy to a production directory
        
        production_dir = Path(self.config.get('production_dir', 'production'))
        production_dir.mkdir(exist_ok=True)
        
        model_file = Path(model_path)
        production_model_path = production_dir / "proof_validator_latest.pkl"
        
        # Backup previous model if exists
        if production_model_path.exists():
            backup_path = production_model_path.with_suffix('.bak')
            production_model_path.rename(backup_path)
        
        # Copy new model
        import shutil
        shutil.copy2(model_file, production_model_path)
        
        logger.info(f"Model deployed to {production_model_path}")
    
    def get_training_history(self) -> List[Dict[str, Any]]:
        """Get training history"""
        return self.training_history
    
    def load_latest_model(self) -> Optional[ProofValidator]:
        """Load the latest trained model"""
        model_files = list(self.model_dir.glob("proof_validator_*.pkl"))
        if not model_files:
            return None
        
        latest_model = max(model_files, key=lambda x: x.stat().st_mtime)
        validator = ProofValidator(str(latest_model))
        
        logger.info(f"Loaded latest model: {latest_model}")
        return validator

def main():
    """Main function for running the training pipeline"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Proof Validation Training Pipeline')
    parser.add_argument('--config', type=str, help='Path to configuration file')
    parser.add_argument('--force-retrain', action='store_true', help='Force retraining')
    parser.add_argument('--evaluate-only', action='store_true', help='Only evaluate existing model')
    
    args = parser.parse_args()
    
    pipeline = TrainingPipeline(args.config)
    
    if args.evaluate_only:
        validator = pipeline.load_latest_model()
        if validator:
            print("Latest model info:", validator.get_model_info())
        else:
            print("No trained model found")
    else:
        results = pipeline.run_pipeline(force_retrain=args.force_retrain)
        print("Pipeline results:", json.dumps(results, indent=2))

if __name__ == "__main__":
    main()
