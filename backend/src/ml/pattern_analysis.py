"""
Advanced Pattern Analysis Module for Cache Optimization

This module provides sophisticated pattern analysis capabilities including:
- Time series analysis and seasonal pattern detection
- Anomaly detection using statistical methods
- Correlation analysis between cache keys
- Trend analysis and forecasting
- Pattern clustering and classification
"""

import numpy as np
import pandas as pd
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional, Any, Union
from sklearn.cluster import KMeans, DBSCAN
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score
from scipy import stats
from scipy.signal import find_peaks, periodogram
from scipy.fft import fft, fftfreq
from statsmodels.tsa.seasonal import seasonal_decompose
from statsmodels.tsa.stattools import adfuller, acf, pacf
from statsmodels.tsa.arima.model import ARIMA
import warnings
warnings.filterwarnings('ignore')

class PatternAnalyzer:
    """
    Advanced pattern analyzer for cache access patterns
    """
    
    def __init__(self):
        self.scaler = StandardScaler()
        self.pca = PCA(n_components=0.95)  # Keep 95% variance
        self.patterns_cache = {}
        self.anomaly_threshold = 2.0  # Standard deviations
        
    def analyze_access_patterns(self, access_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Comprehensive analysis of cache access patterns
        
        Args:
            access_data: List of access events with timestamps and metadata
            
        Returns:
            Dictionary containing all pattern analysis results
        """
        if not access_data:
            return {'error': 'No access data provided'}
        
        # Convert to DataFrame
        df = pd.DataFrame(access_data)
        
        # Ensure timestamp is datetime
        if 'timestamp' in df.columns:
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            df = df.sort_values('timestamp')
        
        results = {
            'temporal_patterns': self._analyze_temporal_patterns(df),
            'frequency_patterns': self._analyze_frequency_patterns(df),
            'seasonal_patterns': self._analyze_seasonal_patterns(df),
            'correlation_patterns': self._analyze_correlation_patterns(df),
            'anomaly_detection': self._detect_anomalies(df),
            'trend_analysis': self._analyze_trends(df),
            'pattern_clustering': self._cluster_patterns(df),
            'forecasting': self._forecast_patterns(df),
            'insights': self._generate_insights(df)
        }
        
        return results
    
    def _analyze_temporal_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze temporal access patterns"""
        if 'timestamp' not in df.columns:
            return {}
        
        # Extract time components
        df['hour'] = df['timestamp'].dt.hour
        df['day_of_week'] = df['timestamp'].dt.dayofweek
        df['day_of_month'] = df['timestamp'].dt.day
        df['month'] = df['timestamp'].dt.month
        df['quarter'] = df['timestamp'].dt.quarter
        
        # Hourly patterns
        hourly_counts = df.groupby('hour').size()
        hourly_stats = {
            'distribution': hourly_counts.to_dict(),
            'peak_hour': int(hourly_counts.idxmax()),
            'peak_count': int(hourly_counts.max()),
            'valley_hour': int(hourly_counts.idxmin()),
            'valley_count': int(hourly_counts.min()),
            'variance': float(hourly_counts.var()),
            'entropy': self._calculate_entropy(hourly_counts.values),
            'peaks': self._find_peaks(hourly_counts.values)
        }
        
        # Weekly patterns
        weekly_counts = df.groupby('day_of_week').size()
        weekly_stats = {
            'distribution': weekly_counts.to_dict(),
            'peak_day': int(weekly_counts.idxmax()),
            'peak_count': int(weekly_counts.max()),
            'valley_day': int(weekly_counts.idxmin()),
            'valley_count': int(weekly_counts.min()),
            'variance': float(weekly_counts.var()),
            'entropy': self._calculate_entropy(weekly_counts.values),
            'weekend_ratio': float(weekly_counts[5:].sum() / weekly_counts.sum())
        }
        
        # Monthly patterns
        monthly_counts = df.groupby('month').size()
        monthly_stats = {
            'distribution': monthly_counts.to_dict(),
            'peak_month': int(monthly_counts.idxmax()) if len(monthly_counts) > 0 else 1,
            'peak_count': int(monthly_counts.max()) if len(monthly_counts) > 0 else 0,
            'variance': float(monthly_counts.var()) if len(monthly_counts) > 1 else 0.0,
            'entropy': self._calculate_entropy(monthly_counts.values) if len(monthly_counts) > 0 else 0.0
        }
        
        return {
            'hourly': hourly_stats,
            'weekly': weekly_stats,
            'monthly': monthly_stats,
            'time_series_stats': self._calculate_time_series_stats(df)
        }
    
    def _analyze_frequency_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze frequency patterns of cache keys"""
        if 'key' not in df.columns:
            return {}
        
        # Key frequency analysis
        key_counts = df['key'].value_counts()
        
        # Statistical measures
        frequency_stats = {
            'total_unique_keys': len(key_counts),
            'total_accesses': len(df),
            'mean_frequency': float(key_counts.mean()),
            'median_frequency': float(key_counts.median()),
            'std_frequency': float(key_counts.std()),
            'min_frequency': int(key_counts.min()),
            'max_frequency': int(key_counts.max()),
            'top_keys': key_counts.head(10).to_dict(),
            'bottom_keys': key_counts.tail(5).to_dict(),
            'frequency_distribution': {
                'quartiles': {
                    'q1': float(key_counts.quantile(0.25)),
                    'q2': float(key_counts.quantile(0.5)),
                    'q3': float(key_counts.quantile(0.75))
                },
                'percentiles': {
                    'p90': float(key_counts.quantile(0.9)),
                    'p95': float(key_counts.quantile(0.95)),
                    'p99': float(key_counts.quantile(0.99))
                }
            }
        }
        
        # Long tail analysis
        cumulative_sum = key_counts.sort_values(ascending=False).cumsum()
        total_sum = cumulative_sum.iloc[-1]
        pareto_80 = (cumulative_sum <= 0.8 * total_sum).sum()
        pareto_20 = (cumulative_sum <= 0.2 * total_sum).sum()
        
        long_tail_analysis = {
            'pareto_80_keys': int(pareto_80),
            'pareto_20_keys': int(pareto_20),
            'pareto_ratio': float(pareto_80 / len(key_counts)),
            'long_tail_ratio': float((key_counts <= key_counts.quantile(0.1)).sum() / len(key_counts))
        }
        
        # Access pattern classification
        pattern_classes = self._classify_access_patterns(key_counts)
        
        return {
            'frequency_stats': frequency_stats,
            'long_tail_analysis': long_tail_analysis,
            'pattern_classes': pattern_classes
        }
    
    def _analyze_seasonal_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze seasonal patterns using time series decomposition"""
        if 'timestamp' not in df.columns:
            return {}
        
        # Create time series
        df.set_index('timestamp', inplace=True)
        hourly_series = df.resample('H').size().fillna(0)
        
        if len(hourly_series) < 24:  # Need at least 24 hours for meaningful analysis
            return {}
        
        seasonal_patterns = {}
        
        # Daily seasonality (24-hour cycle)
        daily_pattern = self._extract_seasonal_pattern(hourly_series, period=24)
        if daily_pattern:
            seasonal_patterns['daily'] = daily_pattern
        
        # Weekly seasonality (7-day cycle)
        if len(hourly_series) >= 168:  # At least 1 week
            weekly_pattern = self._extract_seasonal_pattern(hourly_series, period=168)
            if weekly_pattern:
                seasonal_patterns['weekly'] = weekly_pattern
        
        # Monthly seasonality (approximately 30-day cycle)
        if len(hourly_series) >= 720:  # At least 30 days
            monthly_pattern = self._extract_seasonal_pattern(hourly_series, period=720)
            if monthly_pattern:
                seasonal_patterns['monthly'] = monthly_pattern
        
        # FFT-based frequency analysis
        fft_analysis = self._perform_fft_analysis(hourly_series)
        
        # Autocorrelation analysis
        autocorr_analysis = self._perform_autocorrelation_analysis(hourly_series)
        
        return {
            'seasonal_patterns': seasonal_patterns,
            'fft_analysis': fft_analysis,
            'autocorrelation': autocorr_analysis,
            'stationarity_test': self._test_stationarity(hourly_series)
        }
    
    def _analyze_correlation_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze correlation patterns between different cache keys"""
        if 'key' not in df.columns or 'timestamp' not in df.columns:
            return {}
        
        # Create co-occurrence matrix
        df['time_window'] = df['timestamp'].dt.floor('H')  # Hourly windows
        co_occurrence = df.groupby('time_window')['key'].apply(
            lambda x: list(set(x))
        ).tolist()
        
        # Calculate pairwise correlations
        all_keys = list(df['key'].unique())
        correlations = {}
        
        # Limit to top 20 keys for performance
        top_keys = df['key'].value_counts().head(20).index.tolist()
        
        for i, key1 in enumerate(top_keys):
            for key2 in top_keys[i+1:]:
                correlation = self._calculate_pairwise_correlation(co_occurrence, key1, key2)
                if correlation > 0.1:  # Only include meaningful correlations
                    correlations[f"{key1}_{key2}"] = {
                        'correlation': float(correlation),
                        'strength': self._classify_correlation_strength(correlation),
                        'key1': key1,
                        'key2': key2
                    }
        
        # Find correlated clusters
        correlation_clusters = self._find_correlation_clusters(correlations, top_keys)
        
        return {
            'pairwise_correlations': correlations,
            'correlation_clusters': correlation_clusters,
            'correlation_summary': self._summarize_correlations(correlations)
        }
    
    def _detect_anomalies(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Detect anomalies in access patterns"""
        anomalies = {
            'frequency_anomalies': [],
            'temporal_anomalies': [],
            'volume_anomalies': [],
            'pattern_anomalies': []
        }
        
        # Frequency anomalies
        if 'key' in df.columns:
            key_counts = df['key'].value_counts()
            frequency_anomalies = self._detect_statistical_anomalies(
                key_counts, 'frequency', 'key'
            )
            anomalies['frequency_anomalies'] = frequency_anomalies
        
        # Temporal anomalies
        if 'timestamp' in df.columns:
            df['hour'] = df['timestamp'].dt.hour
            hourly_counts = df.groupby('hour').size()
            temporal_anomalies = self._detect_statistical_anomalies(
                hourly_counts, 'temporal', 'hour'
            )
            anomalies['temporal_anomalies'] = temporal_anomalies
        
        # Volume anomalies (if size information available)
        if 'size' in df.columns:
            volume_stats = df.groupby(df['timestamp'].dt.date)['size'].sum()
            volume_anomalies = self._detect_statistical_anomalies(
                volume_stats, 'volume', 'date'
            )
            anomalies['volume_anomalies'] = volume_anomalies
        
        # Pattern anomalies (sudden changes in patterns)
        if 'timestamp' in df.columns:
            pattern_anomalies = self._detect_pattern_anomalies(df)
            anomalies['pattern_anomalies'] = pattern_anomalies
        
        # Summary
        total_anomalies = sum(len(anomalies[key]) for key in anomalies)
        anomalies['summary'] = {
            'total_anomalies': total_anomalies,
            'anomaly_rate': float(total_anomalies / len(df)) if len(df) > 0 else 0.0,
            'severity_distribution': self._calculate_severity_distribution(anomalies)
        }
        
        return anomalies
    
    def _analyze_trends(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze trends in access patterns"""
        if 'timestamp' not in df.columns:
            return {}
        
        # Create time series
        df.set_index('timestamp', inplace=True)
        daily_series = df.resample('D').size().fillna(0)
        
        if len(daily_series) < 7:  # Need at least 7 days
            return {}
        
        trends = {}
        
        # Overall trend analysis
        trend_analysis = self._analyze_trend_direction(daily_series)
        trends['overall'] = trend_analysis
        
        # Key-specific trends (top 10 keys)
        if 'key' in df.columns:
            top_keys = df['key'].value_counts().head(10).index.tolist()
            key_trends = {}
            
            for key in top_keys:
                key_data = df[df['key'] == key].resample('D').size().fillna(0)
                if len(key_data) >= 7:
                    key_trends[key] = self._analyze_trend_direction(key_data)
            
            trends['key_specific'] = key_trends
        
        # Trend forecasting
        forecasts = {}
        for name, series in [('overall', daily_series)] + list(trends.get('key_specific', {}).items()):
            if isinstance(series, dict) and 'data' in series:
                forecast = self._forecast_trend(series['data'])
                forecasts[name] = forecast
        
        return {
            'trends': trends,
            'forecasts': forecasts,
            'trend_summary': self._summarize_trends(trends)
        }
    
    def _cluster_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Cluster similar access patterns"""
        if 'key' not in df.columns:
            return {}
        
        # Create feature matrix for clustering
        features = self._extract_clustering_features(df)
        
        if len(features) < 2:
            return {}
        
        # Standardize features
        features_scaled = self.scaler.fit_transform(features)
        
        # Determine optimal number of clusters
        optimal_clusters = self._determine_optimal_clusters(features_scaled)
        
        # Perform clustering
        kmeans = KMeans(n_clusters=optimal_clusters, random_state=42)
        cluster_labels = kmeans.fit_predict(features_scaled)
        
        # Analyze clusters
        clusters = {}
        keys = list(df['key'].unique())
        
        for i in range(optimal_clusters):
            cluster_keys = [keys[j] for j in range(len(keys)) if cluster_labels[j] == i]
            cluster_features = features_scaled[cluster_labels == i]
            
            clusters[f'cluster_{i}'] = {
                'keys': cluster_keys,
                'size': len(cluster_keys),
                'centroid': kmeans.cluster_centers_[i].tolist(),
                'characteristics': self._describe_cluster_characteristics(cluster_keys, df)
            }
        
        # Evaluate clustering quality
        silhouette_avg = silhouette_score(features_scaled, cluster_labels)
        
        return {
            'clusters': clusters,
            'optimal_clusters': optimal_clusters,
            'silhouette_score': float(silhouette_avg),
            'clustering_quality': self._evaluate_clustering_quality(silhouette_avg)
        }
    
    def _forecast_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Forecast future access patterns"""
        if 'timestamp' not in df.columns:
            return {}
        
        # Create time series
        df.set_index('timestamp', inplace=True)
        hourly_series = df.resample('H').size().fillna(0)
        
        if len(hourly_series) < 168:  # Need at least 1 week
            return {}
        
        forecasts = {}
        
        # Overall forecast
        overall_forecast = self._forecast_time_series(hourly_series)
        forecasts['overall'] = overall_forecast
        
        # Key-specific forecasts (top 5 keys)
        if 'key' in df.columns:
            top_keys = df['key'].value_counts().head(5).index.tolist()
            key_forecasts = {}
            
            for key in top_keys:
                key_series = df[df['key'] == key].resample('H').size().fillna(0)
                if len(key_series) >= 168:
                    key_forecasts[key] = self._forecast_time_series(key_series)
            
            forecasts['key_specific'] = key_forecasts
        
        return forecasts
    
    def _generate_insights(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Generate actionable insights from pattern analysis"""
        insights = []
        
        # Performance insights
        if 'key' in df.columns:
            key_counts = df['key'].value_counts()
            
            # Hot keys insight
            hot_keys = key_counts[key_counts > key_counts.quantile(0.95)]
            if len(hot_keys) > 0:
                insights.append({
                    'type': 'performance',
                    'severity': 'warning',
                    'title': 'Hot Keys Detected',
                    'description': f'Found {len(hot_keys)} keys in the 95th percentile of access frequency',
                    'recommendation': 'Consider implementing dedicated cache for these keys',
                    'data': {'hot_keys': hot_keys.head(5).to_dict()}
                })
        
        # Temporal insights
        if 'timestamp' in df.columns:
            df['hour'] = df['timestamp'].dt.hour
            hourly_counts = df.groupby('hour').size()
            
            # Peak hours insight
            peak_hours = hourly_counts[hourly_counts > hourly_counts.quantile(0.8)]
            if len(peak_hours) > 0:
                insights.append({
                    'type': 'temporal',
                    'severity': 'info',
                    'title': 'Peak Access Hours',
                    'description': f'Peak access hours: {peak_hours.index.tolist()}',
                    'recommendation': 'Consider cache warming during these hours',
                    'data': {'peak_hours': peak_hours.to_dict()}
                })
        
        # Pattern insights
        if len(df) > 100:
            # Check for patterns
            pattern_strength = self._calculate_pattern_strength(df)
            if pattern_strength > 0.7:
                insights.append({
                    'type': 'pattern',
                    'severity': 'info',
                    'title': 'Strong Access Patterns',
                    'description': f'Detected strong patterns with strength {pattern_strength:.2f}',
                    'recommendation': 'Leverage patterns for cache optimization',
                    'data': {'pattern_strength': pattern_strength}
                })
        
        return insights
    
    # Helper methods
    
    def _calculate_entropy(self, values: np.ndarray) -> float:
        """Calculate entropy of a distribution"""
        values = values[values > 0]
        if len(values) == 0:
            return 0.0
        
        probabilities = values / values.sum()
        entropy = -np.sum(probabilities * np.log2(probabilities + 1e-10))
        return float(entropy)
    
    def _find_peaks(self, values: np.ndarray) -> List[Dict[str, Any]]:
        """Find peaks in time series data"""
        if len(values) < 3:
            return []
        
        peaks, properties = find_peaks(values, height=np.mean(values))
        
        result = []
        for i, peak in enumerate(peaks):
            result.append({
                'index': int(peak),
                'value': float(values[peak]),
                'height': float(properties['peak_heights'][i]) if 'peak_heights' in properties else 0.0
            })
        
        return result
    
    def _calculate_time_series_stats(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Calculate basic time series statistics"""
        if 'timestamp' not in df.columns:
            return {}
        
        time_diffs = df['timestamp'].diff().dt.total_seconds().dropna()
        
        return {
            'total_duration_hours': float((df['timestamp'].max() - df['timestamp'].min()).total_seconds() / 3600),
            'avg_interval_seconds': float(time_diffs.mean()),
            'median_interval_seconds': float(time_diffs.median()),
            'std_interval_seconds': float(time_diffs.std()),
            'access_rate_per_hour': float(len(df) / ((df['timestamp'].max() - df['timestamp'].min()).total_seconds() / 3600))
        }
    
    def _classify_access_patterns(self, key_counts: pd.Series) -> Dict[str, Any]:
        """Classify access patterns into categories"""
        patterns = {
            'hot': [],
            'warm': [],
            'cold': [],
            'intermittent': []
        }
        
        q75 = key_counts.quantile(0.75)
        q25 = key_counts.quantile(0.25)
        
        for key, count in key_counts.items():
            if count > q75:
                patterns['hot'].append({'key': key, 'count': int(count)})
            elif count > q25:
                patterns['warm'].append({'key': key, 'count': int(count)})
            elif count > 1:
                patterns['cold'].append({'key': key, 'count': int(count)})
            else:
                patterns['intermittent'].append({'key': key, 'count': int(count)})
        
        return patterns
    
    def _extract_seasonal_pattern(self, series: pd.Series, period: int) -> Optional[Dict[str, Any]]:
        """Extract seasonal pattern using STL decomposition"""
        try:
            decomposition = seasonal_decompose(series, period=period, extrapolate_trend='freq')
            
            seasonal = decomposition.seasonal
            trend = decomposition.trend
            residual = decomposition.resid
            
            # Calculate pattern strength
            seasonal_strength = 1 - (residual.var() / series.var())
            
            return {
                'period': period,
                'seasonal_strength': float(seasonal_strength),
                'trend_strength': float(1 - (residual.var() / trend.var())) if trend.var() > 0 else 0.0,
                'seasonal_pattern': seasonal.iloc[:period].tolist(),
                'dominant_seasonality': self._identify_dominant_seasonality(seasonal.iloc[:period])
            }
        except Exception as e:
            return None
    
    def _perform_fft_analysis(self, series: pd.Series) -> Dict[str, Any]:
        """Perform FFT analysis to find dominant frequencies"""
        try:
            values = series.values
            fft_values = fft(values)
            frequencies = fftfreq(len(values))
            
            # Get power spectrum
            power = np.abs(fft_values) ** 2
            
            # Find dominant frequencies
            positive_freq_idx = frequencies > 0
            dominant_freqs = frequencies[positive_freq_idx]
            dominant_power = power[positive_freq_idx]
            
            # Get top 5 frequencies
            top_indices = np.argsort(dominant_power)[-5:][::-1]
            
            result = {
                'dominant_frequencies': [
                    {
                        'frequency': float(dominant_freqs[i]),
                        'power': float(dominant_power[i]),
                        'period_hours': float(1 / dominant_freqs[i]) if dominant_freqs[i] > 0 else float('inf')
                    }
                    for i in top_indices
                ],
                'total_power': float(np.sum(dominant_power)),
                'spectral_entropy': self._calculate_entropy(dominant_power)
            }
            
            return result
        except Exception as e:
            return {}
    
    def _perform_autocorrelation_analysis(self, series: pd.Series) -> Dict[str, Any]:
        """Perform autocorrelation analysis"""
        try:
            # Calculate autocorrelation
            autocorr_values = acf(series, nlags=min(168, len(series)//2), fft=True)
            
            # Find significant autocorrelations
            significant_lags = []
            for lag, acf_val in enumerate(autocorr_values):
                if abs(acf_val) > 0.3:  # Threshold for significance
                    significant_lags.append({
                        'lag': lag,
                        'autocorrelation': float(acf_val)
                    })
            
            return {
                'autocorrelation_values': autocorr_values.tolist(),
                'significant_lags': significant_lags,
                'max_autocorrelation': float(np.max(np.abs(autocorr_values[1:]))),  # Exclude lag 0
                'autocorrelation_decay': self._calculate_autocorrelation_decay(autocorr_values)
            }
        except Exception as e:
            return {}
    
    def _test_stationarity(self, series: pd.Series) -> Dict[str, Any]:
        """Test for stationarity using Augmented Dickey-Fuller test"""
        try:
            result = adfuller(series.dropna())
            
            return {
                'adf_statistic': float(result[0]),
                'p_value': float(result[1]),
                'critical_values': {
                    '1%': float(result[4]['1%']),
                    '5%': float(result[4]['5%']),
                    '10%': float(result[4]['10%'])
                },
                'is_stationary': float(result[1]) < 0.05
            }
        except Exception as e:
            return {}
    
    def _calculate_pairwise_correlation(self, co_occurrence: List[List[str]], key1: str, key2: str) -> float:
        """Calculate correlation between two keys based on co-occurrence"""
        key1_windows = sum(1 for window in co_occurrence if key1 in window)
        key2_windows = sum(1 for window in co_occurrence if key2 in window)
        co_occurrence_windows = sum(1 for window in co_occurrence if key1 in window and key2 in window)
        
        total_windows = len(co_occurrence)
        
        if total_windows == 0:
            return 0.0
        
        # Calculate pointwise correlation
        p1 = key1_windows / total_windows
        p2 = key2_windows / total_windows
        p12 = co_occurrence_windows / total_windows
        
        if p1 == 0 or p2 == 0:
            return 0.0
        
        correlation = (p12 - p1 * p2) / np.sqrt(p1 * (1 - p1) * p2 * (1 - p2))
        return correlation
    
    def _classify_correlation_strength(self, correlation: float) -> str:
        """Classify correlation strength"""
        abs_corr = abs(correlation)
        if abs_corr > 0.8:
            return 'very_strong'
        elif abs_corr > 0.6:
            return 'strong'
        elif abs_corr > 0.4:
            return 'moderate'
        elif abs_corr > 0.2:
            return 'weak'
        else:
            return 'very_weak'
    
    def _find_correlation_clusters(self, correlations: Dict[str, Any], keys: List[str]) -> List[Dict[str, Any]]:
        """Find clusters of correlated keys"""
        # Build correlation matrix
        n = len(keys)
        corr_matrix = np.zeros((n, n))
        
        for i, key1 in enumerate(keys):
            for j, key2 in enumerate(keys):
                if i < j:
                    corr_key = f"{key1}_{key2}"
                    reverse_corr_key = f"{key2}_{key1}"
                    correlation = correlations.get(corr_key, {}).get('correlation', 
                                    correlations.get(reverse_corr_key, {}).get('correlation', 0))
                    corr_matrix[i][j] = correlation
                    corr_matrix[j][i] = correlation
        
        # Use clustering to find groups
        clustering = DBSCAN(eps=0.5, min_samples=2).fit(corr_matrix)
        labels = clustering.labels_
        
        clusters = []
        for cluster_id in set(labels):
            if cluster_id != -1:  # Exclude noise points
                cluster_keys = [keys[i] for i in range(n) if labels[i] == cluster_id]
                clusters.append({
                    'cluster_id': int(cluster_id),
                    'keys': cluster_keys,
                    'size': len(cluster_keys)
                })
        
        return clusters
    
    def _summarize_correlations(self, correlations: Dict[str, Any]) -> Dict[str, Any]:
        """Summarize correlation analysis"""
        if not correlations:
            return {}
        
        correlation_values = [corr['correlation'] for corr in correlations.values()]
        
        return {
            'total_correlations': len(correlations),
            'mean_correlation': float(np.mean(correlation_values)),
            'median_correlation': float(np.median(correlation_values)),
            'std_correlation': float(np.std(correlation_values)),
            'strong_correlations': len([c for c in correlation_values if abs(c) > 0.7]),
            'moderate_correlations': len([c for c in correlation_values if 0.3 < abs(c) <= 0.7]),
            'weak_correlations': len([c for c in correlation_values if abs(c) <= 0.3])
        }
    
    def _detect_statistical_anomalies(self, data: pd.Series, anomaly_type: str, key_name: str) -> List[Dict[str, Any]]:
        """Detect statistical anomalies using z-score method"""
        anomalies = []
        
        if len(data) < 3:
            return anomalies
        
        mean_val = data.mean()
        std_val = data.std()
        
        if std_val == 0:
            return anomalies
        
        for index, value in data.items():
            z_score = (value - mean_val) / std_val
            
            if abs(z_score) > self.anomaly_threshold:
                severity = 'critical' if abs(z_score) > 3 else 'high' if abs(z_score) > 2.5 else 'medium'
                
                anomalies.append({
                    'type': anomaly_type,
                    key_name: str(index),
                    'value': float(value),
                    'expected': float(mean_val),
                    'z_score': float(z_score),
                    'severity': severity,
                    'deviation_percent': float(abs(z_score) * 100 / mean_val) if mean_val != 0 else 0.0
                })
        
        return anomalies
    
    def _detect_pattern_anomalies(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Detect pattern anomalies using change point detection"""
        anomalies = []
        
        if 'timestamp' not in df.columns:
            return anomalies
        
        # Create hourly time series
        df.set_index('timestamp', inplace=True)
        hourly_series = df.resample('H').size().fillna(0)
        
        if len(hourly_series) < 24:
            return anomalies
        
        # Simple change point detection using rolling statistics
        rolling_mean = hourly_series.rolling(window=12, center=True).mean()
        rolling_std = hourly_series.rolling(window=12, center=True).std()
        
        # Find significant deviations from rolling mean
        for timestamp, value in hourly_series.items():
            if pd.notna(rolling_mean[timestamp]) and pd.notna(rolling_std[timestamp]):
                z_score = (value - rolling_mean[timestamp]) / rolling_std[timestamp]
                
                if abs(z_score) > 2.5:
                    anomalies.append({
                        'type': 'pattern',
                        'timestamp': timestamp.isoformat(),
                        'value': float(value),
                        'expected': float(rolling_mean[timestamp]),
                        'z_score': float(z_score),
                        'severity': 'high' if abs(z_score) > 3 else 'medium'
                    })
        
        return anomalies
    
    def _calculate_severity_distribution(self, anomalies: Dict[str, Any]) -> Dict[str, int]:
        """Calculate distribution of anomaly severities"""
        distribution = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0}
        
        for anomaly_list in anomalies.values():
            if isinstance(anomaly_list, list):
                for anomaly in anomaly_list:
                    if isinstance(anomaly, dict) and 'severity' in anomaly:
                        severity = anomaly['severity']
                        if severity in distribution:
                            distribution[severity] += 1
        
        return distribution
    
    def _analyze_trend_direction(self, series: pd.Series) -> Dict[str, Any]:
        """Analyze trend direction and strength"""
        if len(series) < 3:
            return {}
        
        # Linear regression for trend
        x = np.arange(len(series))
        y = series.values
        
        # Remove NaN values
        mask = ~np.isnan(y)
        x_clean = x[mask]
        y_clean = y[mask]
        
        if len(x_clean) < 3:
            return {}
        
        slope, intercept, r_value, p_value, std_err = stats.linregress(x_clean, y_clean)
        
        # Determine trend direction
        if p_value < 0.05:  # Significant trend
            if slope > 0:
                direction = 'increasing'
            else:
                direction = 'decreasing'
        else:
            direction = 'stable'
        
        # Calculate trend strength
        trend_strength = abs(r_value)
        
        return {
            'direction': direction,
            'slope': float(slope),
            'intercept': float(intercept),
            'r_squared': float(r_value ** 2),
            'p_value': float(p_value),
            'trend_strength': float(trend_strength),
            'data': series.tolist()
        }
    
    def _forecast_trend(self, series: pd.Series, periods: int = 24) -> Dict[str, Any]:
        """Simple trend forecasting"""
        if len(series) < 10:
            return {}
        
        try:
            # Use ARIMA for forecasting
            model = ARIMA(series, order=(1, 1, 1))
            fitted_model = model.fit()
            forecast = fitted_model.forecast(steps=periods)
            
            # Calculate confidence intervals
            forecast_ci = fitted_model.get_forecast(steps=periods).conf_int()
            
            return {
                'forecast': forecast.tolist(),
                'confidence_intervals': forecast_ci.values.tolist(),
                'model_aic': float(fitted_model.aic),
                'model_bic': float(fitted_model.bic)
            }
        except Exception as e:
            # Fallback to simple linear extrapolation
            x = np.arange(len(series))
            y = series.values
            
            mask = ~np.isnan(y)
            x_clean = x[mask]
            y_clean = y[mask]
            
            if len(x_clean) < 3:
                return {}
            
            slope, intercept = np.polyfit(x_clean, y_clean, 1)
            future_x = np.arange(len(series), len(series) + periods)
            forecast = slope * future_x + intercept
            
            return {
                'forecast': forecast.tolist(),
                'method': 'linear_extrapolation',
                'slope': float(slope),
                'intercept': float(intercept)
            }
    
    def _summarize_trends(self, trends: Dict[str, Any]) -> Dict[str, Any]:
        """Summarize trend analysis"""
        if not trends:
            return {}
        
        trend_directions = []
        trend_strengths = []
        
        for name, trend_data in trends.items():
            if isinstance(trend_data, dict) and 'direction' in trend_data:
                trend_directions.append(trend_data['direction'])
                if 'trend_strength' in trend_data:
                    trend_strengths.append(trend_data['trend_strength'])
        
        direction_counts = {direction: trend_directions.count(direction) for direction in set(trend_directions)}
        avg_strength = np.mean(trend_strengths) if trend_strengths else 0.0
        
        return {
            'trend_directions': direction_counts,
            'average_trend_strength': float(avg_strength),
            'dominant_direction': max(direction_counts, key=direction_counts.get) if direction_counts else 'stable'
        }
    
    def _extract_clustering_features(self, df: pd.DataFrame) -> np.ndarray:
        """Extract features for clustering analysis"""
        features = []
        
        if 'key' not in df.columns:
            return np.array([])
        
        for key in df['key'].unique():
            key_data = df[df['key'] == key]
            
            # Extract features for this key
            feature_vector = []
            
            # Frequency features
            feature_vector.append(len(key_data))  # Total accesses
            
            # Temporal features
            if 'timestamp' in key_data.columns:
                time_span = (key_data['timestamp'].max() - key_data['timestamp'].min()).total_seconds() / 3600
                feature_vector.append(time_span)  # Time span in hours
                feature_vector.append(len(key_data) / max(time_span, 1))  # Access rate per hour
                
                # Hour distribution
                hourly_dist = key_data['timestamp'].dt.hour.value_counts(normalize=True).reindex(range(24), fill_value=0)
                feature_vector.extend(hourly_dist.values)
            else:
                feature_vector.extend([0, 0] + [0] * 24)
            
            # Size features (if available)
            if 'size' in key_data.columns:
                feature_vector.append(key_data['size'].mean())
                feature_vector.append(key_data['size'].std())
            else:
                feature_vector.extend([0, 0])
            
            features.append(feature_vector)
        
        return np.array(features)
    
    def _determine_optimal_clusters(self, features: np.ndarray) -> int:
        """Determine optimal number of clusters using elbow method"""
        if len(features) < 2:
            return 1
        
        max_clusters = min(8, len(features) // 2)
        inertias = []
        
        for k in range(1, max_clusters + 1):
            kmeans = KMeans(n_clusters=k, random_state=42)
            kmeans.fit(features)
            inertias.append(kmeans.inertia_)
        
        # Find elbow point
        if len(inertias) < 3:
            return 1
        
        # Calculate second derivative
        diffs = np.diff(inertias)
        second_diffs = np.diff(diffs)
        
        if len(second_diffs) > 0:
            elbow_idx = np.argmax(second_diffs) + 2  # +2 because of double diff
            return min(elbow_idx, max_clusters)
        
        return 2
    
    def _describe_cluster_characteristics(self, keys: List[str], df: pd.DataFrame) -> Dict[str, Any]:
        """Describe characteristics of a cluster"""
        cluster_data = df[df['key'].isin(keys)]
        
        characteristics = {
            'total_accesses': len(cluster_data),
            'unique_keys': len(keys),
            'avg_accesses_per_key': len(cluster_data) / len(keys) if keys else 0,
            'access_pattern': 'unknown'
        }
        
        # Determine access pattern
        if 'timestamp' in cluster_data.columns:
            cluster_data['hour'] = cluster_data['timestamp'].dt.hour
            hourly_dist = cluster_data['hour'].value_counts(normalize=True)
            
            if len(hourly_dist) == 1:
                characteristics['access_pattern'] = 'single_hour'
            elif hourly_dist.std() < 0.1:
                characteristics['access_pattern'] = 'uniform'
            else:
                characteristics['access_pattern'] = 'variable'
        
        return characteristics
    
    def _evaluate_clustering_quality(self, silhouette_score: float) -> str:
        """Evaluate clustering quality based on silhouette score"""
        if silhouette_score > 0.7:
            return 'excellent'
        elif silhouette_score > 0.5:
            return 'good'
        elif silhouette_score > 0.25:
            return 'fair'
        else:
            return 'poor'
    
    def _forecast_time_series(self, series: pd.Series, periods: int = 24) -> Dict[str, Any]:
        """Forecast time series using ARIMA"""
        if len(series) < 50:
            return {}
        
        try:
            # Fit ARIMA model
            model = ARIMA(series, order=(1, 1, 1))
            fitted_model = model.fit()
            
            # Make forecast
            forecast = fitted_model.forecast(steps=periods)
            forecast_ci = fitted_model.get_forecast(steps=periods).conf_int()
            
            return {
                'forecast': forecast.tolist(),
                'confidence_intervals': forecast_ci.values.tolist(),
                'model_aic': float(fitted_model.aic),
                'model_bic': float(fitted_model.bic),
                'forecast_period': periods
            }
        except Exception as e:
            return {}
    
    def _calculate_pattern_strength(self, df: pd.DataFrame) -> float:
        """Calculate overall pattern strength"""
        if 'timestamp' not in df.columns:
            return 0.0
        
        # Create hourly series
        hourly_series = df.set_index('timestamp').resample('H').size().fillna(0)
        
        if len(hourly_series) < 24:
            return 0.0
        
        # Calculate pattern strength using variance
        variance = hourly_series.var()
        mean_val = hourly_series.mean()
        
        if mean_val == 0:
            return 0.0
        
        # Coefficient of variation as pattern strength indicator
        cv = np.sqrt(variance) / mean_val
        
        # Normalize to 0-1 range
        return min(cv / 2, 1.0)
    
    def _identify_dominant_seasonality(self, seasonal_pattern: np.ndarray) -> str:
        """Identify dominant seasonality type"""
        if len(seasonal_pattern) < 4:
            return 'unknown'
        
        # Check for different patterns
        peaks, _ = find_peaks(seasonal_pattern)
        
        if len(peaks) == 1:
            return 'single_peak'
        elif len(peaks) == 2:
            return 'dual_peak'
        elif len(peaks) > 2:
            return 'multi_peak'
        else:
            return 'no_clear_pattern'
    
    def _calculate_autocorrelation_decay(self, autocorr_values: np.ndarray) -> float:
        """Calculate autocorrelation decay rate"""
        if len(autocorr_values) < 3:
            return 0.0
        
        # Calculate decay using exponential fit
        x = np.arange(len(autocorr_values))
        y = np.abs(autocorr_values)
        
        # Simple exponential decay approximation
        decay_rate = -np.log(y[1] / y[0]) if y[0] > 0 and y[1] > 0 else 0.0
        
        return float(decay_rate)


# Main function for running as module
def main():
    """Main function for running the pattern analysis module"""
    import sys
    import argparse
    
    parser = argparse.ArgumentParser(description='Advanced Pattern Analysis Module')
    parser.add_argument('--mode', choices=['analyze', 'cluster', 'forecast'], required=True,
                       help='Operation mode')
    parser.add_argument('--data-path', required=True, help='Path to data file')
    parser.add_argument('--output-path', help='Path to save results')
    
    args = parser.parse_args()
    
    # Load data
    try:
        with open(args.data_path, 'r') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error loading data: {e}")
        sys.exit(1)
    
    # Initialize analyzer
    analyzer = PatternAnalyzer()
    
    # Perform analysis
    if args.mode == 'analyze':
        results = analyzer.analyze_access_patterns(data)
    elif args.mode == 'cluster':
        results = analyzer._cluster_patterns(pd.DataFrame(data))
    elif args.mode == 'forecast':
        results = analyzer._forecast_patterns(pd.DataFrame(data))
    else:
        results = {}
    
    # Save or output results
    if args.output_path:
        with open(args.output_path, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        print(f"Results saved to {args.output_path}")
    else:
        print(json.dumps(results, indent=2, default=str))


if __name__ == '__main__':
    main()
