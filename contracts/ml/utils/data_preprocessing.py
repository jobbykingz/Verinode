"""
Data preprocessing utilities for ML training
Handles feature engineering, scaling, and data quality checks
"""

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler, MinMaxScaler, RobustScaler
from sklearn.feature_selection import SelectKBest, f_classif
from sklearn.decomposition import PCA
from typing import Dict, List, Any, Tuple, Optional
import logging

logger = logging.getLogger(__name__)

class DataPreprocessor:
    """
    Data preprocessing pipeline for proof validation ML models
    Handles feature engineering, scaling, and quality checks
    """
    
    def __init__(self):
        self.scaler = StandardScaler()
        self.feature_selector = None
        self.pca = None
        self.feature_names = [
            'hashComplexity',
            'timestampAnomaly', 
            'issuerReputation',
            'contentSimilarity',
            'networkActivity',
            'geographicAnomaly',
            'frequencyPattern',
            'sizeAnomaly'
        ]
        self.preprocessing_metadata = {}
        
    def fit_transform(self, features: np.ndarray) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Fit preprocessing pipeline and transform data
        """
        metadata = {
            'original_shape': features.shape,
            'preprocessing_steps': []
        }
        
        # Step 1: Data quality check
        features, quality_metadata = self._check_data_quality(features)
        metadata['data_quality'] = quality_metadata
        metadata['preprocessing_steps'].append('data_quality_check')
        
        # Step 2: Feature engineering
        features, engineering_metadata = self._engineer_features(features)
        metadata['feature_engineering'] = engineering_metadata
        metadata['preprocessing_steps'].append('feature_engineering')
        
        # Step 3: Handle missing values
        features, missing_metadata = self._handle_missing_values(features)
        metadata['missing_values'] = missing_metadata
        metadata['preprocessing_steps'].append('missing_values')
        
        # Step 4: Feature scaling
        features, scaling_metadata = self._scale_features(features)
        metadata['scaling'] = scaling_metadata
        metadata['preprocessing_steps'].append('feature_scaling')
        
        # Step 5: Feature selection (optional)
        if features.shape[1] > 10:  # Only if we have many features
            features, selection_metadata = self._select_features(features)
            metadata['feature_selection'] = selection_metadata
            metadata['preprocessing_steps'].append('feature_selection')
        
        metadata['final_shape'] = features.shape
        self.preprocessing_metadata = metadata
        
        logger.info(f"Preprocessing completed: {metadata['original_shape']} -> {metadata['final_shape']}")
        
        return features, metadata
    
    def transform(self, features: np.ndarray) -> np.ndarray:
        """
        Transform new data using fitted preprocessing pipeline
        """
        # Apply same preprocessing steps as fit_transform
        features, _ = self._check_data_quality(features)
        features, _ = self._engineer_features(features)
        features, _ = self._handle_missing_values(features)
        features = self._apply_scaling(features)
        
        if self.feature_selector:
            features = self.feature_selector.transform(features)
        
        if self.pca:
            features = self.pca.transform(features)
        
        return features
    
    def _check_data_quality(self, features: np.ndarray) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Check data quality and perform basic cleaning
        """
        metadata = {
            'total_samples': len(features),
            'total_features': features.shape[1] if len(features.shape) > 1 else 1,
            'missing_values': int(np.sum(np.isnan(features))),
            'infinite_values': int(np.sum(np.isinf(features))),
            'outliers_detected': 0,
            'cleaned_samples': 0
        }
        
        # Handle infinite values
        features = np.where(np.isinf(features), np.nan, features)
        
        # Handle missing values (temporary, will be handled properly later)
        features = np.where(np.isnan(features), 0.0, features)
        
        # Detect outliers using IQR method
        if len(features.shape) > 1:
            for i in range(features.shape[1]):
                Q1 = np.percentile(features[:, i], 25)
                Q3 = np.percentile(features[:, i], 75)
                IQR = Q3 - Q1
                lower_bound = Q1 - 1.5 * IQR
                upper_bound = Q3 + 1.5 * IQR
                
                outliers = np.where((features[:, i] < lower_bound) | (features[:, i] > upper_bound))[0]
                metadata['outliers_detected'] += len(outliers)
                
                # Cap outliers
                features[:, i] = np.clip(features[:, i], lower_bound, upper_bound)
        
        logger.info(f"Data quality check: {metadata['missing_values']} missing, {metadata['outliers_detected']} outliers")
        
        return features, metadata
    
    def _engineer_features(self, features: np.ndarray) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Engineer additional features from existing ones
        """
        if len(features.shape) == 1:
            features = features.reshape(1, -1)
        
        original_features = features.copy()
        engineered_features = []
        
        # Feature interactions
        # 1. Reputation * Similarity (trust score)
        if features.shape[1] >= 4:
            trust_score = features[:, 2] * features[:, 3]  # issuerReputation * contentSimilarity
            engineered_features.append(trust_score.reshape(-1, 1))
        
        # 2. Anomaly combination score
        if features.shape[1] >= 7:
            anomaly_features = features[:, [1, 4, 5, 6]]  # timestamp, network, geographic, frequency
            anomaly_score = np.mean(anomaly_features, axis=1)
            engineered_features.append(anomaly_score.reshape(-1, 1))
        
        # 3. Risk ratio (anomaly / reputation)
        if features.shape[1] >= 3:
            risk_ratio = features[:, 1] / (features[:, 2] + 1e-8)  # timestampAnomaly / issuerReputation
            risk_ratio = np.clip(risk_ratio, 0, 10)  # Cap extreme values
            engineered_features.append(risk_ratio.reshape(-1, 1))
        
        # 4. Content complexity score
        if features.shape[1] >= 8:
            complexity_score = features[:, 0] * features[:, 7]  # hashComplexity * sizeAnomaly
            engineered_features.append(complexity_score.reshape(-1, 1))
        
        # 5. Behavioral consistency (inverse of frequency pattern)
        if features.shape[1] >= 7:
            behavioral_consistency = 1 - features[:, 6]  # 1 - frequencyPattern
            engineered_features.append(behavioral_consistency.reshape(-1, 1))
        
        # Combine original and engineered features
        if engineered_features:
            engineered_array = np.hstack(engineered_features)
            features = np.hstack([features, engineered_array])
        
        metadata = {
            'original_feature_count': original_features.shape[1],
            'engineered_feature_count': len(engineered_features),
            'total_feature_count': features.shape[1],
            'engineered_features': [
                'trust_score',
                'anomaly_combination', 
                'risk_ratio',
                'content_complexity',
                'behavioral_consistency'
            ][:len(engineered_features)]
        }
        
        logger.info(f"Feature engineering: {metadata['original_feature_count']} -> {metadata['total_feature_count']} features")
        
        return features, metadata
    
    def _handle_missing_values(self, features: np.ndarray) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Handle missing values using appropriate strategies
        """
        metadata = {
            'missing_before': int(np.sum(np.isnan(features))),
            'missing_after': 0,
            'imputation_strategy': 'median'
        }
        
        # Use median imputation for each feature
        if len(features.shape) > 1:
            for i in range(features.shape[1]):
                feature_col = features[:, i]
                missing_mask = np.isnan(feature_col)
                
                if np.any(missing_mask):
                    median_val = np.nanmedian(feature_col)
                    features[missing_mask, i] = median_val
        
        metadata['missing_after'] = int(np.sum(np.isnan(features)))
        
        logger.info(f"Missing values handled: {metadata['missing_before']} -> {metadata['missing_after']}")
        
        return features, metadata
    
    def _scale_features(self, features: np.ndarray) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Scale features using appropriate scaling method
        """
        metadata = {
            'scaling_method': 'standard',
            'feature_means': [],
            'feature_stds': []
        }
        
        # Fit scaler and transform features
        scaled_features = self.scaler.fit_transform(features)
        
        # Store scaling parameters for later use
        metadata['feature_means'] = self.scaler.mean_.tolist()
        metadata['feature_stds'] = self.scaler.scale_.tolist()
        
        logger.info(f"Features scaled using {metadata['scaling_method']} scaling")
        
        return scaled_features, metadata
    
    def _apply_scaling(self, features: np.ndarray) -> np.ndarray:
        """
        Apply previously fitted scaling to new data
        """
        return self.scaler.transform(features)
    
    def _select_features(self, features: np.ndarray, k: int = 10) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Select most important features using statistical methods
        """
        metadata = {
            'selection_method': 'univariate_selection',
            'original_features': features.shape[1],
            'selected_features': k,
            'feature_scores': []
        }
        
        # Use SelectKBest with f_classif
        self.feature_selector = SelectKBest(score_func=f_classif, k=k)
        selected_features = self.feature_selector.fit_transform(features, np.zeros(len(features)))  # Dummy labels
        
        metadata['feature_scores'] = self.feature_selector.scores_.tolist()
        
        logger.info(f"Feature selection: {metadata['original_features']} -> {metadata['selected_features']} features")
        
        return selected_features, metadata
    
    def create_derived_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Create derived features from raw data
        """
        df_derived = df.copy()
        
        # Time-based features
        if 'timestamp' in df.columns:
            df_derived['hour_of_day'] = pd.to_datetime(df['timestamp']).dt.hour
            df_derived['day_of_week'] = pd.to_datetime(df['timestamp']).dt.dayofweek
            df_derived['is_weekend'] = df_derived['day_of_week'].isin([5, 6]).astype(int)
        
        # Issuer behavior features
        if 'issuerAddress' in df.columns:
            # Count of proofs per issuer
            issuer_counts = df['issuerAddress'].value_counts()
            df_derived['issuer_proof_count'] = df['issuerAddress'].map(issuer_counts)
            
            # Issuer reputation score (based on historical performance)
            if 'riskLevel' in df.columns:
                issuer_success_rate = df.groupby('issuerAddress')['riskLevel'].apply(
                    lambda x: (x == 'low').mean()
                )
                df_derived['issuer_success_rate'] = df['issuerAddress'].map(issuer_success_rate)
        
        # Content-based features
        if 'eventData' in df.columns:
            # Content length
            df_derived['content_length'] = df['eventData'].astype(str).str.len()
            
            # Content complexity (number of unique characters)
            df_derived['content_complexity'] = df['eventData'].astype(str).apply(
                lambda x: len(set(str(x))) / len(str(x)) if len(str(x)) > 0 else 0
            )
        
        # Network features
        if 'ipfsCid' in df.columns:
            # Has IPFS storage
            df_derived['has_ipfs'] = (~df['ipfsCid'].isna()).astype(int)
        
        return df_derived
    
    def detect_anomalies(self, features: np.ndarray, method: str = 'isolation_forest') -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Detect anomalies in the feature space
        """
        from sklearn.ensemble import IsolationForest
        from sklearn.svm import OneClassSVM
        
        metadata = {
            'method': method,
            'anomalies_detected': 0,
            'anomaly_scores': []
        }
        
        if method == 'isolation_forest':
            detector = IsolationForest(contamination=0.1, random_state=42)
        elif method == 'one_class_svm':
            detector = OneClassSVM(nu=0.1)
        else:
            raise ValueError(f"Unknown anomaly detection method: {method}")
        
        anomaly_labels = detector.fit_predict(features)
        anomaly_scores = detector.decision_function(features)
        
        metadata['anomalies_detected'] = int(np.sum(anomaly_labels == -1))
        metadata['anomaly_scores'] = anomaly_scores.tolist()
        
        logger.info(f"Anomaly detection ({method}): {metadata['anomalies_detected']} anomalies found")
        
        return anomaly_labels, metadata
    
    def validate_features(self, features: np.ndarray) -> Dict[str, Any]:
        """
        Validate feature quality and consistency
        """
        validation_results = {
            'is_valid': True,
            'issues': [],
            'warnings': [],
            'statistics': {}
        }
        
        # Check for NaN values
        nan_count = np.sum(np.isnan(features))
        if nan_count > 0:
            validation_results['issues'].append(f"Found {nan_count} NaN values")
            validation_results['is_valid'] = False
        
        # Check for infinite values
        inf_count = np.sum(np.isinf(features))
        if inf_count > 0:
            validation_results['issues'].append(f"Found {inf_count} infinite values")
            validation_results['is_valid'] = False
        
        # Check feature ranges
        if len(features.shape) > 1:
            for i in range(features.shape[1]):
                feature_col = features[:, i]
                feature_min, feature_max = np.min(feature_col), np.max(feature_col)
                
                if feature_min == feature_max:
                    validation_results['warnings'].append(f"Feature {i} has constant value")
                
                validation_results['statistics'][f'feature_{i}'] = {
                    'min': float(feature_min),
                    'max': float(feature_max),
                    'mean': float(np.mean(feature_col)),
                    'std': float(np.std(feature_col))
                }
        
        return validation_results
    
    def get_preprocessing_info(self) -> Dict[str, Any]:
        """
        Get information about the preprocessing pipeline
        """
        return {
            'feature_names': self.feature_names,
            'scaler_type': type(self.scaler).__name__,
            'has_feature_selector': self.feature_selector is not None,
            'has_pca': self.pca is not None,
            'preprocessing_metadata': self.preprocessing_metadata
        }

# Utility functions for data preprocessing
def load_and_preprocess_data(data_path: str, target_column: str = 'label') -> Tuple[np.ndarray, np.ndarray, DataPreprocessor]:
    """
    Load and preprocess data from file
    """
    import pandas as pd
    
    # Load data
    if data_path.endswith('.csv'):
        df = pd.read_csv(data_path)
    elif data_path.endswith('.json'):
        df = pd.read_json(data_path)
    else:
        raise ValueError("Unsupported file format. Use CSV or JSON.")
    
    # Separate features and target
    feature_columns = [col for col in df.columns if col != target_column]
    features = df[feature_columns].values
    labels = df[target_column].values if target_column in df.columns else None
    
    # Preprocess features
    preprocessor = DataPreprocessor()
    processed_features, metadata = preprocessor.fit_transform(features)
    
    return processed_features, labels, preprocessor

def create_feature_importance_report(feature_names: List[str], importance_scores: np.ndarray) -> Dict[str, Any]:
    """
    Create a feature importance report
    """
    importance_df = pd.DataFrame({
        'feature': feature_names,
        'importance': importance_scores
    }).sort_values('importance', ascending=False)
    
    return {
        'ranked_features': importance_df.to_dict('records'),
        'top_5_features': importance_df.head(5)['feature'].tolist(),
        'cumulative_importance': np.cumsum(importance_df.sort_values(ascending=False)).tolist(),
        'total_importance': float(np.sum(importance_scores))
    }
