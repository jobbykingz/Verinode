"""
ML Cache Prediction Module

This module provides machine learning models for predicting cache access patterns,
optimizing cache strategies, and improving cache performance.
"""

import numpy as np
import pandas as pd
import pickle
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional, Any
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from scipy import stats
from scipy.signal import find_peaks
import warnings
warnings.filterwarnings('ignore')

class CachePredictionModel:
    """
    Advanced ML model for cache access prediction and optimization
    """
    
    def __init__(self, model_path: str = None):
        self.model_path = model_path or "cache_prediction_model.pkl"
        self.access_classifier = RandomForestClassifier(n_estimators=100, random_state=42)
        self.time_regressor = GradientBoostingRegressor(n_estimators=100, random_state=42)
        self.ttl_regressor = GradientBoostingRegressor(n_estimators=50, random_state=42)
        self.scaler = StandardScaler()
        self.label_encoders = {}
        self.feature_columns = []
        self.is_trained = False
        self.model_metrics = {
            'accuracy': 0.0,
            'precision': 0.0,
            'recall': 0.0,
            'f1_score': 0.0,
            'training_loss': 0.0,
            'validation_loss': 0.0,
            'model_version': '1.0.0',
            'last_trained': None,
            'training_data_size': 0,
            'validation_data_size': 0
        }
        
    def extract_features(self, access_data: Dict[str, Any]) -> np.ndarray:
        """
        Extract features from access data for ML prediction
        
        Args:
            access_data: Dictionary containing access information
            
        Returns:
            Feature array for ML model
        """
        features = []
        
        # Time-based features
        now = datetime.now()
        if 'timestamp' in access_data:
            timestamp = access_data['timestamp']
            if isinstance(timestamp, str):
                timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        else:
            timestamp = now
            
        hour = timestamp.hour
        day_of_week = timestamp.weekday()
        day_of_month = timestamp.day
        month = timestamp.month
        is_weekend = 1 if day_of_week >= 5 else 0
        
        features.extend([hour, day_of_week, day_of_month, month, is_weekend])
        
        # Key-based features
        key = access_data.get('key', '')
        key_length = len(key)
        key_parts = len(key.split(':'))
        has_numbers = 1 if any(c.isdigit() for c in key) else 0
        has_letters = 1 if any(c.isalpha() for c in key) else 0
        has_special_chars = 1 if any(not c.isalnum() and c != ':' for c in key) else 0
        
        features.extend([key_length, key_parts, has_numbers, has_letters, has_special_chars])
        
        # Frequency features
        access_count = access_data.get('access_count', 1)
        avg_access_interval = access_data.get('avg_access_interval', 3600)
        recent_access_count = access_data.get('recent_access_count', 1)
        
        features.extend([access_count, avg_access_interval, recent_access_count])
        
        # Pattern features
        hourly_pattern = access_data.get('hourly_pattern', [0] * 24)
        weekly_pattern = access_data.get('weekly_pattern', [0] * 7)
        
        # Pattern statistics
        hourly_variance = np.var(hourly_pattern) if hourly_pattern else 0
        hourly_max = max(hourly_pattern) if hourly_pattern else 0
        weekly_variance = np.var(weekly_pattern) if weekly_pattern else 0
        weekly_max = max(weekly_pattern) if weekly_pattern else 0
        
        features.extend([hourly_variance, hourly_max, weekly_variance, weekly_max])
        
        # Historical performance features
        hit_rate = access_data.get('hit_rate', 0.5)
        avg_response_time = access_data.get('avg_response_time', 100)
        size = access_data.get('size', 1024)
        ttl = access_data.get('ttl', 3600)
        
        features.extend([hit_rate, avg_response_time, size, ttl])
        
        # Seasonal features
        seasonal_trend = access_data.get('seasonal_trend', 'none')
        seasonal_encoded = self._encode_categorical('seasonal_trend', seasonal_trend)
        features.append(seasonal_encoded)
        
        # Correlation features
        correlation = access_data.get('correlation', 0.5)
        confidence = access_data.get('confidence', 0.5)
        
        features.extend([correlation, confidence])
        
        return np.array(features)
    
    def _encode_categorical(self, feature_name: str, value: str) -> float:
        """Encode categorical features"""
        if feature_name not in self.label_encoders:
            self.label_encoders[feature_name] = LabelEncoder()
            # Fit with common values
            common_values = ['none', 'daily', 'weekly', 'monthly', 'yearly']
            self.label_encoders[feature_name].fit(common_values)
        
        try:
            return float(self.label_encoders[feature_name].transform([value])[0])
        except ValueError:
            # Handle unseen values
            return 0.0
    
    def train(self, training_data: List[Dict[str, Any]], validation_split: float = 0.2) -> Dict[str, float]:
        """
        Train the ML models with provided data
        
        Args:
            training_data: List of training examples
            validation_split: Fraction of data to use for validation
            
        Returns:
            Training metrics
        """
        if len(training_data) < 100:
            raise ValueError("Insufficient training data. Need at least 100 samples.")
        
        # Prepare features and targets
        X = []
        y_access = []  # Will access happen (binary)
        y_time = []    # Time until next access
        y_ttl = []     # Optimal TTL
        
        for data in training_data:
            features = self.extract_features(data)
            X.append(features)
            
            # Extract targets
            y_access.append(data.get('will_access', 0))
            y_time.append(data.get('time_to_next_access', 3600))
            y_ttl.append(data.get('optimal_ttl', 3600))
        
        X = np.array(X)
        y_access = np.array(y_access)
        y_time = np.array(y_time)
        y_ttl = np.array(y_ttl)
        
        # Split data
        X_train, X_val, y_access_train, y_access_val, y_time_train, y_time_val, \
        y_ttl_train, y_ttl_val = train_test_split(
            X, y_access, y_time, y_ttl, test_size=validation_split, random_state=42
        )
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_val_scaled = self.scaler.transform(X_val)
        
        # Train access classifier
        self.access_classifier.fit(X_train_scaled, y_access_train)
        access_pred = self.access_classifier.predict(X_val_scaled)
        access_proba = self.access_classifier.predict_proba(X_val_scaled)[:, 1]
        
        # Train time regressor
        self.time_regressor.fit(X_train_scaled, y_time_train)
        time_pred = self.time_regressor.predict(X_val_scaled)
        
        # Train TTL regressor
        self.ttl_regressor.fit(X_train_scaled, y_ttl_train)
        ttl_pred = self.ttl_regressor.predict(X_val_scaled)
        
        # Calculate metrics
        accuracy = accuracy_score(y_access_val, access_pred)
        precision = precision_score(y_access_val, access_pred, average='weighted', zero_division=0)
        recall = recall_score(y_access_val, access_pred, average='weighted', zero_division=0)
        f1 = f1_score(y_access_val, access_pred, average='weighted', zero_division=0)
        
        # Calculate regression losses
        time_mse = np.mean((y_time_val - time_pred) ** 2)
        ttl_mse = np.mean((y_ttl_val - ttl_pred) ** 2)
        
        # Update model metrics
        self.model_metrics.update({
            'accuracy': accuracy,
            'precision': precision,
            'recall': recall,
            'f1_score': f1,
            'training_loss': (time_mse + ttl_mse) / 2,
            'validation_loss': (time_mse + ttl_mse) / 2,
            'model_version': f"v{int(time.time())}",
            'last_trained': datetime.now().isoformat(),
            'training_data_size': len(X_train),
            'validation_data_size': len(X_val)
        })
        
        self.feature_columns = [f"feature_{i}" for i in range(X.shape[1])]
        self.is_trained = True
        
        return self.model_metrics
    
    def predict(self, access_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Make predictions for cache access
        
        Args:
            access_data: Dictionary containing access information
            
        Returns:
            Prediction results
        """
        if not self.is_trained:
            # Return default predictions if model is not trained
            return {
                'probability': 0.5,
                'next_access': (datetime.now() + timedelta(hours=1)).isoformat(),
                'confidence': 0.5,
                'recommended_ttl': 3600,
                'recommended_priority': 5,
                'risk_level': 'medium'
            }
        
        features = self.extract_features(access_data)
        features_scaled = self.scaler.transform([features])
        
        # Predict access probability
        access_proba = self.access_classifier.predict_proba(features_scaled)[0]
        probability = float(access_proba[1]) if len(access_proba) > 1 else float(access_proba[0])
        
        # Predict time to next access
        time_to_next = self.time_regressor.predict(features_scaled)[0]
        next_access_time = datetime.now() + timedelta(seconds=float(time_to_next))
        
        # Predict optimal TTL
        optimal_ttl = self.ttl_regressor.predict(features_scaled)[0]
        recommended_ttl = max(300, min(86400, float(optimal_ttl)))  # Clamp between 5 min and 24 hours
        
        # Calculate confidence
        confidence = max(0.1, min(0.95, probability))
        
        # Determine risk level
        if confidence < 0.3:
            risk_level = 'high'
        elif confidence < 0.7:
            risk_level = 'medium'
        else:
            risk_level = 'low'
        
        # Calculate recommended priority
        access_count = access_data.get('access_count', 1)
        size = access_data.get('size', 1024)
        base_priority = 5
        
        if access_count > 50:
            base_priority += 2
        elif access_count < 5:
            base_priority -= 2
            
        if size < 1024:
            base_priority += 1
        elif size > 10240:
            base_priority -= 1
            
        recommended_priority = max(1, min(10, base_priority))
        
        return {
            'probability': probability,
            'next_access': next_access_time.isoformat(),
            'confidence': confidence,
            'recommended_ttl': int(recommended_ttl),
            'recommended_priority': recommended_priority,
            'risk_level': risk_level
        }
    
    def predict_batch(self, batch_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Make batch predictions for multiple access data points
        
        Args:
            batch_data: List of access data dictionaries
            
        Returns:
            List of prediction results
        """
        return [self.predict(data) for data in batch_data]
    
    def get_feature_importance(self) -> Dict[str, float]:
        """
        Get feature importance from the trained model
        
        Returns:
            Dictionary mapping feature names to importance scores
        """
        if not self.is_trained:
            return {}
        
        importance = self.access_classifier.feature_importances_
        feature_names = self.feature_columns
        
        return dict(zip(feature_names, importance))
    
    def save_model(self, path: str = None) -> bool:
        """
        Save the trained model to disk
        
        Args:
            path: Path to save the model
            
        Returns:
            Success status
        """
        save_path = path or self.model_path
        
        try:
            model_data = {
                'access_classifier': self.access_classifier,
                'time_regressor': self.time_regressor,
                'ttl_regressor': self.ttl_regressor,
                'scaler': self.scaler,
                'label_encoders': self.label_encoders,
                'feature_columns': self.feature_columns,
                'model_metrics': self.model_metrics,
                'is_trained': self.is_trained
            }
            
            with open(save_path, 'wb') as f:
                pickle.dump(model_data, f)
            
            return True
        except Exception as e:
            print(f"Error saving model: {e}")
            return False
    
    def load_model(self, path: str = None) -> bool:
        """
        Load a trained model from disk
        
        Args:
            path: Path to load the model from
            
        Returns:
            Success status
        """
        load_path = path or self.model_path
        
        try:
            with open(load_path, 'rb') as f:
                model_data = pickle.load(f)
            
            self.access_classifier = model_data['access_classifier']
            self.time_regressor = model_data['time_regressor']
            self.ttl_regressor = model_data['ttl_regressor']
            self.scaler = model_data['scaler']
            self.label_encoders = model_data['label_encoders']
            self.feature_columns = model_data['feature_columns']
            self.model_metrics = model_data['model_metrics']
            self.is_trained = model_data['is_trained']
            
            return True
        except Exception as e:
            print(f"Error loading model: {e}")
            return False
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get current model metrics"""
        return self.model_metrics.copy()


class CachePatternAnalyzer:
    """
    Advanced pattern analysis for cache optimization
    """
    
    def __init__(self):
        self.patterns = {}
        self.anomalies = []
        self.seasonal_patterns = {}
        
    def detect_access_patterns(self, access_history: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Detect patterns in access history
        
        Args:
            access_history: List of access events
            
        Returns:
            Dictionary containing detected patterns
        """
        if not access_history:
            return {}
        
        # Convert to DataFrame for analysis
        df = pd.DataFrame(access_history)
        
        # Ensure timestamp is datetime
        if 'timestamp' in df.columns:
            df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        patterns = {
            'hourly_patterns': self._analyze_hourly_patterns(df),
            'weekly_patterns': self._analyze_weekly_patterns(df),
            'seasonal_patterns': self._detect_seasonal_patterns(df),
            'frequency_patterns': self._analyze_frequency_patterns(df),
            'correlation_patterns': self._analyze_correlation_patterns(df),
            'anomalies': self._detect_anomalies(df)
        }
        
        return patterns
    
    def _analyze_hourly_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze hourly access patterns"""
        if 'timestamp' not in df.columns:
            return {}
        
        df['hour'] = df['timestamp'].dt.hour
        hourly_counts = df.groupby('hour').size()
        
        # Find peak hours
        peaks, properties = find_peaks(hourly_counts, height=hourly_counts.mean())
        
        return {
            'distribution': hourly_counts.to_dict(),
            'peak_hours': peaks.tolist() if len(peaks) > 0 else [],
            'peak_heights': properties['peak_heights'].tolist() if 'peak_heights' in properties else [],
            'variance': float(hourly_counts.var()),
            'entropy': self._calculate_entropy(hourly_counts.values)
        }
    
    def _analyze_weekly_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze weekly access patterns"""
        if 'timestamp' not in df.columns:
            return {}
        
        df['day_of_week'] = df['timestamp'].dt.dayofweek
        weekly_counts = df.groupby('day_of_week').size()
        
        # Find peak days
        peaks, properties = find_peaks(weekly_counts, height=weekly_counts.mean())
        
        return {
            'distribution': weekly_counts.to_dict(),
            'peak_days': peaks.tolist() if len(peaks) > 0 else [],
            'peak_heights': properties['peak_heights'].tolist() if 'peak_heights' in properties else [],
            'variance': float(weekly_counts.var()),
            'entropy': self._calculate_entropy(weekly_counts.values)
        }
    
    def _detect_seasonal_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Detect seasonal patterns using autocorrelation"""
        if 'timestamp' not in df.columns:
            return {}
        
        # Create time series of access counts
        df.set_index('timestamp', inplace=True)
        hourly_counts = df.resample('H').size().fillna(0)
        
        # Calculate autocorrelation for different lags
        lags = [24, 168, 720]  # Daily, weekly, monthly
        seasonal_patterns = {}
        
        for lag in lags:
            autocorr = hourly_counts.autocorr(lag=lag)
            if not np.isnan(autocorr):
                seasonal_patterns[f'lag_{lag}'] = {
                    'autocorrelation': float(autocorr),
                    'strength': abs(float(autocorr)),
                    'period_hours': lag
                }
        
        return seasonal_patterns
    
    def _analyze_frequency_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze frequency patterns"""
        if 'key' not in df.columns:
            return {}
        
        key_counts = df['key'].value_counts()
        
        return {
            'top_keys': key_counts.head(10).to_dict(),
            'frequency_distribution': {
                'mean': float(key_counts.mean()),
                'median': float(key_counts.median()),
                'std': float(key_counts.std()),
                'min': int(key_counts.min()),
                'max': int(key_counts.max())
            },
            'long_tail_ratio': float((key_counts <= key_counts.quantile(0.9)).sum() / len(key_counts))
        }
    
    def _analyze_correlation_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze correlation between different keys"""
        if 'key' not in df.columns:
            return {}
        
        # Create co-occurrence matrix
        key_sets = df.groupby(df['timestamp'].dt.floor('H'))['key'].apply(set)
        
        correlations = {}
        keys = list(df['key'].unique())
        
        for i, key1 in enumerate(keys[:10]):  # Limit to top 10 keys for performance
            for key2 in keys[i+1:11]:
                co_occurrence = sum(1 for key_set in key_sets if key1 in key_set and key2 in key_set)
                total_occurrences = sum(1 for key_set in key_sets if key1 in key_set or key2 in key_set)
                
                if total_occurrences > 0:
                    correlation = co_occurrence / total_occurrences
                    correlations[f"{key1}_{key2}"] = float(correlation)
        
        return correlations
    
    def _detect_anomalies(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Detect anomalies in access patterns"""
        anomalies = []
        
        if 'timestamp' not in df.columns or 'key' not in df.columns:
            return anomalies
        
        # Detect frequency anomalies
        key_counts = df['key'].value_counts()
        mean_count = key_counts.mean()
        std_count = key_counts.std()
        
        for key, count in key_counts.items():
            z_score = (count - mean_count) / std_count if std_count > 0 else 0
            if abs(z_score) > 2:  # More than 2 standard deviations
                anomalies.append({
                    'type': 'frequency',
                    'key': key,
                    'value': count,
                    'expected': mean_count,
                    'z_score': float(z_score),
                    'severity': 'high' if abs(z_score) > 3 else 'medium'
                })
        
        # Detect time-based anomalies
        hourly_counts = df.groupby(df['timestamp'].dt.hour).size()
        hourly_mean = hourly_counts.mean()
        hourly_std = hourly_counts.std()
        
        for hour, count in hourly_counts.items():
            z_score = (count - hourly_mean) / hourly_std if hourly_std > 0 else 0
            if abs(z_score) > 2:
                anomalies.append({
                    'type': 'temporal',
                    'key': f'hour_{hour}',
                    'value': count,
                    'expected': hourly_mean,
                    'z_score': float(z_score),
                    'severity': 'high' if abs(z_score) > 3 else 'medium'
                })
        
        return anomalies
    
    def _calculate_entropy(self, values: np.ndarray) -> float:
        """Calculate entropy of a distribution"""
        values = values[values > 0]  # Remove zero values
        if len(values) == 0:
            return 0.0
        
        probabilities = values / values.sum()
        entropy = -np.sum(probabilities * np.log2(probabilities + 1e-10))
        return float(entropy)


# Main function for running as module
def main():
    """Main function for running the cache prediction module"""
    import sys
    import argparse
    
    parser = argparse.ArgumentParser(description='ML Cache Prediction Module')
    parser.add_argument('--mode', choices=['train', 'predict', 'analyze'], required=True,
                       help='Operation mode')
    parser.add_argument('--model-path', default='cache_prediction_model.pkl',
                       help='Path to save/load model')
    parser.add_argument('--data-path', help='Path to training data file')
    parser.add_argument('--input', help='Input data for prediction')
    
    args = parser.parse_args()
    
    if args.mode == 'train':
        if not args.data_path:
            print("Error: --data-path required for training")
            sys.exit(1)
        
        # Load training data
        try:
            with open(args.data_path, 'r') as f:
                training_data = json.load(f)
        except Exception as e:
            print(f"Error loading training data: {e}")
            sys.exit(1)
        
        # Train model
        model = CachePredictionModel(args.model_path)
        metrics = model.train(training_data)
        
        print("Training completed!")
        print(f"Accuracy: {metrics['accuracy']:.4f}")
        print(f"Precision: {metrics['precision']:.4f}")
        print(f"Recall: {metrics['recall']:.4f}")
        print(f"F1 Score: {metrics['f1_score']:.4f}")
        
        # Save model
        if model.save_model(args.model_path):
            print(f"Model saved to {args.model_path}")
        else:
            print("Failed to save model")
    
    elif args.mode == 'predict':
        if not args.input:
            print("Error: --input required for prediction")
            sys.exit(1)
        
        # Load input data
        try:
            input_data = json.loads(args.input)
        except Exception as e:
            print(f"Error parsing input data: {e}")
            sys.exit(1)
        
        # Load model and predict
        model = CachePredictionModel(args.model_path)
        if not model.load_model(args.model_path):
            print("Failed to load model")
            sys.exit(1)
        
        if isinstance(input_data, list):
            predictions = model.predict_batch(input_data)
        else:
            predictions = [model.predict(input_data)]
        
        print(json.dumps(predictions, indent=2))
    
    elif args.mode == 'analyze':
        if not args.data_path:
            print("Error: --data-path required for analysis")
            sys.exit(1)
        
        # Load data
        try:
            with open(args.data_path, 'r') as f:
                access_history = json.load(f)
        except Exception as e:
            print(f"Error loading data: {e}")
            sys.exit(1)
        
        # Analyze patterns
        analyzer = CachePatternAnalyzer()
        patterns = analyzer.detect_access_patterns(access_history)
        
        print(json.dumps(patterns, indent=2))


if __name__ == '__main__':
    main()
