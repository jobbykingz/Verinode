//! Configuration management for the Verinode SDK.

use serde::{Deserialize, Serialize};
use std::time::Duration;
use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum NetworkType {
    #[serde(rename = "mainnet")]
    Mainnet,
    #[serde(rename = "testnet")]
    Testnet,
}

impl Default for NetworkType {
    fn default() -> Self {
        NetworkType::Mainnet
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// API endpoint URL
    pub api_endpoint: String,
    
    /// Network type
    pub network: NetworkType,
    
    /// API key for authentication
    pub api_key: Option<String>,
    
    /// Timeout for API requests
    pub timeout: Duration,
    
    /// Maximum number of retry attempts
    pub max_retries: u32,
    
    /// Delay between retries
    pub retry_delay: Duration,
    
    /// Backoff multiplier for retries
    pub backoff_multiplier: f64,
    
    /// Wallet auto-connect setting
    pub wallet_auto_connect: bool,
    
    /// Supported wallet providers
    pub supported_wallets: Vec<String>,
    
    /// Logging enabled
    pub logging_enabled: bool,
    
    /// Log level
    pub log_level: String,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            api_endpoint: "https://api.verinode.com".to_string(),
            network: NetworkType::Mainnet,
            api_key: None,
            timeout: Duration::from_secs(10),
            max_retries: 3,
            retry_delay: Duration::from_secs(1),
            backoff_multiplier: 2.0,
            wallet_auto_connect: false,
            supported_wallets: vec![
                "stellar".to_string(),
                "albedo".to_string(),
                "freighter".to_string(),
            ],
            logging_enabled: false,
            log_level: "INFO".to_string(),
        }
    }
}

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("Invalid API endpoint: {0}")]
    InvalidEndpoint(String),
    
    #[error("Invalid network: {0}")]
    InvalidNetwork(String),
    
    #[error("Invalid timeout: {0}")]
    InvalidTimeout(String),
    
    #[error("Invalid max retries: {0}")]
    InvalidMaxRetries(String),
    
    #[error("Invalid retry delay: {0}")]
    InvalidRetryDelay(String),
    
    #[error("Invalid backoff multiplier: {0}")]
    InvalidBackoffMultiplier(String),
}

impl Config {
    pub fn builder() -> ConfigBuilder {
        ConfigBuilder::new()
    }
    
    pub fn validate(&self) -> Result<(), ConfigError> {
        if self.api_endpoint.is_empty() {
            return Err(ConfigError::InvalidEndpoint("API endpoint cannot be empty".to_string()));
        }
        
        if !self.api_endpoint.starts_with("http://") && !self.api_endpoint.starts_with("https://") {
            return Err(ConfigError::InvalidEndpoint("API endpoint must start with http:// or https://".to_string()));
        }
        
        if self.timeout.as_secs() == 0 {
            return Err(ConfigError::InvalidTimeout("Timeout must be positive".to_string()));
        }
        
        if self.max_retries > 10 {
            return Err(ConfigError::InvalidMaxRetries("Max retries should not exceed 10".to_string()));
        }
        
        if self.retry_delay.as_secs() == 0 {
            return Err(ConfigError::InvalidRetryDelay("Retry delay must be positive".to_string()));
        }
        
        if self.backoff_multiplier <= 1.0 {
            return Err(ConfigError::InvalidBackoffMultiplier("Backoff multiplier must be greater than 1.0".to_string()));
        }
        
        Ok(())
    }
    
    pub fn from_env() -> Result<Self, ConfigError> {
        let mut config = Config::default();
        
        if let Ok(endpoint) = std::env::var("VERINODE_API_ENDPOINT") {
            config.api_endpoint = endpoint;
        }
        
        if let Ok(network) = std::env::var("VERINODE_NETWORK") {
            config.network = match network.as_str() {
                "mainnet" => NetworkType::Mainnet,
                "testnet" => NetworkType::Testnet,
                _ => return Err(ConfigError::InvalidNetwork(network)),
            };
        }
        
        if let Ok(api_key) = std::env::var("VERINODE_API_KEY") {
            config.api_key = Some(api_key);
        }
        
        if let Ok(timeout) = std::env::var("VERINODE_TIMEOUT") {
            if let Ok(secs) = timeout.parse::<u64>() {
                config.timeout = Duration::from_millis(secs);
            }
        }
        
        if let Ok(max_retries) = std::env::var("VERINODE_MAX_RETRIES") {
            if let Ok(retries) = max_retries.parse::<u32>() {
                config.max_retries = retries;
            }
        }
        
        if let Ok(retry_delay) = std::env::var("VERINODE_RETRY_DELAY") {
            if let Ok(millis) = retry_delay.parse::<u64>() {
                config.retry_delay = Duration::from_millis(millis);
            }
        }
        
        if let Ok(backoff) = std::env::var("VERINODE_BACKOFF_MULTIPLIER") {
            if let Ok(mult) = backoff.parse::<f64>() {
                config.backoff_multiplier = mult;
            }
        }
        
        if let Ok(auto_connect) = std::env::var("VERINODE_WALLET_AUTO_CONNECT") {
            config.wallet_auto_connect = auto_connect.parse().unwrap_or(false);
        }
        
        if let Ok(logging) = std::env::var("VERINODE_LOGGING_ENABLED") {
            config.logging_enabled = logging.parse().unwrap_or(false);
        }
        
        if let Ok(log_level) = std::env::var("VERINODE_LOG_LEVEL") {
            config.log_level = log_level;
        }
        
        config.validate()?;
        Ok(config)
    }
}

pub struct ConfigBuilder {
    config: Config,
}

impl ConfigBuilder {
    pub fn new() -> Self {
        Self {
            config: Config::default(),
        }
    }
    
    pub fn api_endpoint(mut self, endpoint: impl Into<String>) -> Self {
        self.config.api_endpoint = endpoint.into();
        self
    }
    
    pub fn network(mut self, network: NetworkType) -> Self {
        self.config.network = network;
        self
    }
    
    pub fn api_key(mut self, api_key: impl Into<String>) -> Self {
        self.config.api_key = Some(api_key.into());
        self
    }
    
    pub fn timeout(mut self, timeout: Duration) -> Self {
        self.config.timeout = timeout;
        self
    }
    
    pub fn max_retries(mut self, max_retries: u32) -> Self {
        self.config.max_retries = max_retries;
        self
    }
    
    pub fn retry_delay(mut self, retry_delay: Duration) -> Self {
        self.config.retry_delay = retry_delay;
        self
    }
    
    pub fn backoff_multiplier(mut self, backoff_multiplier: f64) -> Self {
        self.config.backoff_multiplier = backoff_multiplier;
        self
    }
    
    pub fn wallet_auto_connect(mut self, auto_connect: bool) -> Self {
        self.config.wallet_auto_connect = auto_connect;
        self
    }
    
    pub fn supported_wallets(mut self, wallets: Vec<String>) -> Self {
        self.config.supported_wallets = wallets;
        self
    }
    
    pub fn logging_enabled(mut self, enabled: bool) -> Self {
        self.config.logging_enabled = enabled;
        self
    }
    
    pub fn log_level(mut self, level: impl Into<String>) -> Self {
        self.config.log_level = level.into();
        self
    }
    
    pub fn build(self) -> Result<Config, ConfigError> {
        self.config.validate()?;
        Ok(self.config)
    }
}

impl Default for ConfigBuilder {
    fn default() -> Self {
        Self::new()
    }
}
