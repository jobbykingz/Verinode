#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env, String, Vec, Map, U256, u128, i128};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AnalyticsData {
    pub data_id: u64,
    pub timestamp: u64,
    pub metric_type: MetricType,
    pub value: u128,
    pub chain_id: u32,
    pub token_address: Option<Address>,
    pub user_address: Option<Address>,
    pub metadata: Bytes,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MetricType {
    Volume,
    Transactions,
    Fees,
    Users,
    Liquidity,
    GasUsage,
    SuccessRate,
    AverageFee,
    PeakVolume,
    ActiveUsers,
    TVL, // Total Value Locked
    APR, // Annual Percentage Rate
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TimeSeriesData {
    pub series_id: u64,
    pub metric_type: MetricType,
    pub time_interval: TimeInterval,
    pub data_points: Vec<DataPoint>,
    pub start_time: u64,
    pub end_time: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DataPoint {
    pub timestamp: u64,
    pub value: u128,
    pub count: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum TimeInterval {
    Minute,
    Hour,
    Day,
    Week,
    Month,
    Year,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ChainAnalytics {
    pub chain_id: u32,
    pub total_volume: u128,
    pub total_transactions: u64,
    pub total_fees: u128,
    pub active_users: u64,
    pub average_transaction_size: u128,
    pub success_rate: u32,
    pub gas_efficiency: u32,
    pub last_updated: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenAnalytics {
    pub token_address: Address,
    pub total_volume: u128,
    pub total_transactions: u64,
    pub current_price: u128,
    pub price_change_24h: i128,
    pub liquidity: u128,
    pub holders: u64,
    pub last_updated: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UserAnalytics {
    pub user_address: Address,
    pub total_transactions: u64,
    pub total_volume: u128,
    pub total_fees_paid: u128,
    pub first_transaction: u64,
    pub last_transaction: u64,
    pub most_used_chain: u32,
    pub most_used_token: Address,
    pub loyalty_score: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PerformanceMetrics {
    pub metrics_id: u64,
    pub timestamp: u64,
    pub gas_per_transaction: u64,
    pub transaction_time: u64,
    pub success_rate: u32,
    pub error_rate: u32,
    pub throughput: u64,
    pub latency_p50: u64,
    pub latency_p95: u64,
    pub latency_p99: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Report {
    pub report_id: u64,
    pub report_type: ReportType,
    pub start_time: u64,
    pub end_time: u64,
    pub data: Bytes,
    pub generated_at: u64,
    pub generated_by: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ReportType {
    Daily,
    Weekly,
    Monthly,
    Quarterly,
    Yearly,
    Custom,
}

#[contracttype]
pub enum AnalyticsDataKey {
    AnalyticsData(u64),
    TimeSeries(u64),
    ChainAnalytics(u32),
    TokenAnalytics(Address),
    UserAnalytics(Address),
    PerformanceMetrics(u64),
    Report(u64),
    DataCount,
    SeriesCount,
    ReportCount,
    Admin,
}

#[contract]
pub struct BridgeAnalytics;

#[contractimpl]
impl BridgeAnalytics {
    /// Initialize the bridge analytics module
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&AnalyticsDataKey::Admin) {
            panic!("Contract already initialized");
        }
        
        env.storage().instance().set(&AnalyticsDataKey::Admin, &admin);
        env.storage().instance().set(&AnalyticsDataKey::DataCount, &0u64);
        env.storage().instance().set(&AnalyticsDataKey::SeriesCount, &0u64);
        env.storage().instance().set(&AnalyticsDataKey::ReportCount, &0u64);
    }

    /// Record analytics data point
    pub fn record_data_point(
        env: Env,
        metric_type: MetricType,
        value: u128,
        chain_id: u32,
        token_address: Option<Address>,
        user_address: Option<Address>,
        metadata: Bytes,
    ) -> u64 {
        let count: u64 = env.storage().instance().get(&AnalyticsDataKey::DataCount).unwrap_or(0);
        let data_id = count + 1;
        
        let analytics_data = AnalyticsData {
            data_id,
            timestamp: env.ledger().timestamp(),
            metric_type: metric_type.clone(),
            value,
            chain_id,
            token_address,
            user_address,
            metadata: metadata.clone(),
        };
        
        env.storage().instance().set(&AnalyticsDataKey::AnalyticsData(data_id), &analytics_data);
        env.storage().instance().set(&AnalyticsDataKey::DataCount, &data_id);
        
        // Update aggregated analytics
        Self::update_aggregated_analytics(env.clone(), &analytics_data);
        
        data_id
    }

    /// Update aggregated analytics based on new data point
    fn update_aggregated_analytics(env: Env, data: &AnalyticsData) {
        match data.metric_type {
            MetricType::Volume | MetricType::Transactions | MetricType::Fees => {
                Self::update_chain_analytics(env.clone(), data);
            },
            MetricType::Users => {
                Self::update_user_analytics(env.clone(), data);
            },
            _ => {}
        }
    }

    /// Update chain analytics
    fn update_chain_analytics(env: Env, data: &AnalyticsData) {
        let mut chain_analytics: ChainAnalytics = env.storage().instance()
            .get(&AnalyticsDataKey::ChainAnalytics(data.chain_id))
            .unwrap_or(ChainAnalytics {
                chain_id: data.chain_id,
                total_volume: 0u128,
                total_transactions: 0u64,
                total_fees: 0u128,
                active_users: 0u64,
                average_transaction_size: 0u128,
                success_rate: 100u32,
                gas_efficiency: 100u32,
                last_updated: env.ledger().timestamp(),
            });
        
        match data.metric_type {
            MetricType::Volume => {
                chain_analytics.total_volume += data.value;
                if chain_analytics.total_transactions > 0 {
                    chain_analytics.average_transaction_size = chain_analytics.total_volume / chain_analytics.total_transactions as u128;
                }
            },
            MetricType::Transactions => {
                chain_analytics.total_transactions += data.value as u64;
                if chain_analytics.total_transactions > 0 {
                    chain_analytics.average_transaction_size = chain_analytics.total_volume / chain_analytics.total_transactions as u128;
                }
            },
            MetricType::Fees => {
                chain_analytics.total_fees += data.value;
            },
            _ => {}
        }
        
        chain_analytics.last_updated = env.ledger().timestamp();
        env.storage().instance().set(&AnalyticsDataKey::ChainAnalytics(data.chain_id), &chain_analytics);
    }

    /// Update user analytics
    fn update_user_analytics(env: Env, data: &AnalyticsData) {
        if let Some(user_address) = &data.user_address {
            let mut user_analytics: UserAnalytics = env.storage().instance()
                .get(&AnalyticsDataKey::UserAnalytics(user_address.clone()))
                .unwrap_or(UserAnalytics {
                    user_address: user_address.clone(),
                    total_transactions: 0u64,
                    total_volume: 0u128,
                    total_fees_paid: 0u128,
                    first_transaction: env.ledger().timestamp(),
                    last_transaction: env.ledger().timestamp(),
                    most_used_chain: data.chain_id,
                    most_used_token: data.token_address.clone().unwrap_or_else(|| Address::from_string(&String::from_str(&env, "0x0000000000000000000000000000000000000000"))),
                    loyalty_score: 0u32,
                });
            
            match data.metric_type {
                MetricType::Transactions => {
                    user_analytics.total_transactions += data.value as u64;
                    user_analytics.last_transaction = env.ledger().timestamp();
                    user_analytics.most_used_chain = data.chain_id;
                },
                MetricType::Volume => {
                    user_analytics.total_volume += data.value;
                },
                MetricType::Fees => {
                    user_analytics.total_fees_paid += data.value;
                },
                _ => {}
            }
            
            // Calculate loyalty score based on activity
            user_analytics.loyalty_score = Self::calculate_loyalty_score(&user_analytics);
            
            env.storage().instance().set(&AnalyticsDataKey::UserAnalytics(user_address.clone()), &user_analytics);
        }
    }

    /// Calculate loyalty score for user
    fn calculate_loyalty_score(user_analytics: &UserAnalytics) -> u32 {
        let transaction_score = (user_analytics.total_transactions / 10).min(50) as u32; // Max 50 points
        let volume_score = ((user_analytics.total_volume / 1000000) as u32).min(30); // Max 30 points
        let activity_score = if user_analytics.total_transactions > 100 { 20 } else { 0 }; // Max 20 points
        
        transaction_score + volume_score + activity_score
    }

    /// Create time series data
    pub fn create_time_series(
        env: Env,
        metric_type: MetricType,
        time_interval: TimeInterval,
        start_time: u64,
        end_time: u64,
    ) -> u64 {
        let count: u64 = env.storage().instance().get(&AnalyticsDataKey::SeriesCount).unwrap_or(0);
        let series_id = count + 1;
        
        let time_series = TimeSeriesData {
            series_id,
            metric_type,
            time_interval,
            data_points: Vec::new(&env),
            start_time,
            end_time,
        };
        
        env.storage().instance().set(&AnalyticsDataKey::TimeSeries(series_id), &time_series);
        env.storage().instance().set(&AnalyticsDataKey::SeriesCount, &series_id);
        
        series_id
    }

    /// Add data point to time series
    pub fn add_data_point_to_series(
        env: Env,
        series_id: u64,
        timestamp: u64,
        value: u128,
        count: u64,
    ) {
        let mut time_series: TimeSeriesData = env.storage().instance()
            .get(&AnalyticsDataKey::TimeSeries(series_id))
            .unwrap_or_else(|| panic!("Time series not found"));
        
        let data_point = DataPoint {
            timestamp,
            value,
            count,
        };
        
        time_series.data_points.push_back(data_point);
        env.storage().instance().set(&AnalyticsDataKey::TimeSeries(series_id), &time_series);
    }

    /// Record performance metrics
    pub fn record_performance_metrics(
        env: Env,
        gas_per_transaction: u64,
        transaction_time: u64,
        success_rate: u32,
        error_rate: u32,
        throughput: u64,
        latency_p50: u64,
        latency_p95: u64,
        latency_p99: u64,
    ) -> u64 {
        let count: u64 = env.storage().instance().get(&AnalyticsDataKey::DataCount).unwrap_or(0);
        let metrics_id = count + 1;
        
        let metrics = PerformanceMetrics {
            metrics_id,
            timestamp: env.ledger().timestamp(),
            gas_per_transaction,
            transaction_time,
            success_rate,
            error_rate,
            throughput,
            latency_p50,
            latency_p95,
            latency_p99,
        };
        
        env.storage().instance().set(&AnalyticsDataKey::PerformanceMetrics(metrics_id), &metrics);
        env.storage().instance().set(&AnalyticsDataKey::DataCount, &metrics_id);
        
        metrics_id
    }

    /// Generate report
    pub fn generate_report(
        env: Env,
        report_type: ReportType,
        start_time: u64,
        end_time: u64,
        generated_by: Address,
    ) -> u64 {
        generated_by.require_auth();
        
        let count: u64 = env.storage().instance().get(&AnalyticsDataKey::ReportCount).unwrap_or(0);
        let report_id = count + 1;
        
        // Generate report data (simplified - in production, this would be more comprehensive)
        let report_data = Self::generate_report_data(env.clone(), report_type.clone(), start_time, end_time);
        
        let report = Report {
            report_id,
            report_type,
            start_time,
            end_time,
            data: report_data,
            generated_at: env.ledger().timestamp(),
            generated_by,
        };
        
        env.storage().instance().set(&AnalyticsDataKey::Report(report_id), &report);
        env.storage().instance().set(&AnalyticsDataKey::ReportCount, &report_id);
        
        report_id
    }

    /// Generate report data based on type and time range
    fn generate_report_data(env: Env, report_type: ReportType, start_time: u64, end_time: u64) -> Bytes {
        let mut report_data = Vec::new(&env);
        
        // Add basic metrics
        let total_volume = Self::get_total_volume_in_range(env.clone(), start_time, end_time);
        let total_transactions = Self::get_total_transactions_in_range(env.clone(), start_time, end_time);
        let total_fees = Self::get_total_fees_in_range(env.clone(), start_time, end_time);
        
        report_data.extend_from_slice(&total_volume.to_be_bytes());
        report_data.extend_from_slice(&total_transactions.to_be_bytes());
        report_data.extend_from_slice(&total_fees.to_be_bytes());
        
        Bytes::from_slice(&env, &report_data)
    }

    /// Get total volume in time range
    fn get_total_volume_in_range(env: Env, start_time: u64, end_time: u64) -> u128 {
        let count: u64 = env.storage().instance().get(&AnalyticsDataKey::DataCount).unwrap_or(0);
        let mut total_volume = 0u128;
        
        for i in 1..=count {
            if let Some(data) = env.storage().instance().get::<AnalyticsDataKey, AnalyticsData>(&AnalyticsDataKey::AnalyticsData(i)) {
                if data.metric_type == MetricType::Volume && 
                   data.timestamp >= start_time && 
                   data.timestamp <= end_time {
                    total_volume += data.value;
                }
            }
        }
        
        total_volume
    }

    /// Get total transactions in time range
    fn get_total_transactions_in_range(env: Env, start_time: u64, end_time: u64) -> u128 {
        let count: u64 = env.storage().instance().get(&AnalyticsDataKey::DataCount).unwrap_or(0);
        let mut total_transactions = 0u128;
        
        for i in 1..=count {
            if let Some(data) = env.storage().instance().get::<AnalyticsDataKey, AnalyticsData>(&AnalyticsDataKey::AnalyticsData(i)) {
                if data.metric_type == MetricType::Transactions && 
                   data.timestamp >= start_time && 
                   data.timestamp <= end_time {
                    total_transactions += data.value;
                }
            }
        }
        
        total_transactions
    }

    /// Get total fees in time range
    fn get_total_fees_in_range(env: Env, start_time: u64, end_time: u64) -> u128 {
        let count: u64 = env.storage().instance().get(&AnalyticsDataKey::DataCount).unwrap_or(0);
        let mut total_fees = 0u128;
        
        for i in 1..=count {
            if let Some(data) = env.storage().instance().get::<AnalyticsDataKey, AnalyticsData>(&AnalyticsDataKey::AnalyticsData(i)) {
                if data.metric_type == MetricType::Fees && 
                   data.timestamp >= start_time && 
                   data.timestamp <= end_time {
                    total_fees += data.value;
                }
            }
        }
        
        total_fees
    }

    /// Get analytics data point
    pub fn get_analytics_data(env: Env, data_id: u64) -> AnalyticsData {
        env.storage().instance()
            .get(&AnalyticsDataKey::AnalyticsData(data_id))
            .unwrap_or_else(|| panic!("Analytics data not found"))
    }

    /// Get time series data
    pub fn get_time_series(env: Env, series_id: u64) -> TimeSeriesData {
        env.storage().instance()
            .get(&AnalyticsDataKey::TimeSeries(series_id))
            .unwrap_or_else(|| panic!("Time series not found"))
    }

    /// Get chain analytics
    pub fn get_chain_analytics(env: Env, chain_id: u32) -> ChainAnalytics {
        env.storage().instance()
            .get(&AnalyticsDataKey::ChainAnalytics(chain_id))
            .unwrap_or_else(|| panic!("Chain analytics not found"))
    }

    /// Get user analytics
    pub fn get_user_analytics(env: Env, user_address: Address) -> UserAnalytics {
        env.storage().instance()
            .get(&AnalyticsDataKey::UserAnalytics(user_address))
            .unwrap_or_else(|| panic!("User analytics not found"))
    }

    /// Get performance metrics
    pub fn get_performance_metrics(env: Env, metrics_id: u64) -> PerformanceMetrics {
        env.storage().instance()
            .get(&AnalyticsDataKey::PerformanceMetrics(metrics_id))
            .unwrap_or_else(|| panic!("Performance metrics not found"))
    }

    /// Get report
    pub fn get_report(env: Env, report_id: u64) -> Report {
        env.storage().instance()
            .get(&AnalyticsDataKey::Report(report_id))
            .unwrap_or_else(|| panic!("Report not found"))
    }

    /// Get data count
    pub fn get_data_count(env: Env) -> u64 {
        env.storage().instance().get(&AnalyticsDataKey::DataCount).unwrap_or(0)
    }

    /// Get admin address
    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&AnalyticsDataKey::Admin).unwrap()
    }
}
