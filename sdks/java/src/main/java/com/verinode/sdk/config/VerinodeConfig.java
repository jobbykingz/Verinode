package com.verinode.sdk.config;

import com.verinode.sdk.exception.VerinodeException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.util.Arrays;
import java.util.List;

/**
 * Configuration class for the Verinode SDK.
 * 
 * <p>This class holds all configuration options for the SDK including
 * API endpoints, authentication settings, timeouts, and logging preferences.</p>
 */
public class VerinodeConfig {
    
    private static final Logger logger = LoggerFactory.getLogger(VerinodeConfig.class);
    
    // API configuration
    private String apiEndpoint = "https://api.verinode.com";
    private NetworkType network = NetworkType.MAINNET;
    private String apiKey;
    
    // Request configuration
    private Duration timeout = Duration.ofSeconds(10);
    private int maxRetries = 3;
    private Duration retryDelay = Duration.ofSeconds(1);
    private double backoffMultiplier = 2.0;
    
    // Wallet configuration
    private boolean walletAutoConnect = false;
    private List<String> supportedWallets = Arrays.asList("stellar", "albedo", "freighter");
    
    // Logging configuration
    private boolean loggingEnabled = false;
    private String logLevel = "INFO";
    private Logger customLogger;
    
    /**
     * Default constructor.
     */
    public VerinodeConfig() {
    }
    
    /**
     * Creates a new configuration builder.
     * 
     * @return a new builder instance
     */
    public static Builder builder() {
        return new Builder();
    }
    
    /**
     * Gets the default configuration.
     * 
     * @return the default configuration
     */
    public static VerinodeConfig defaultConfig() {
        return new Builder().build();
    }
    
    /**
     * Creates configuration from environment variables.
     * 
     * @return the configuration
     * @throws VerinodeException if configuration is invalid
     */
    public static VerinodeConfig fromEnv() throws VerinodeException {
        Builder builder = new Builder();
        
        String endpoint = System.getenv("VERINODE_API_ENDPOINT");
        if (endpoint != null) {
            builder.apiEndpoint(endpoint);
        }
        
        String network = System.getenv("VERINODE_NETWORK");
        if (network != null) {
            builder.network(NetworkType.valueOf(network.toUpperCase()));
        }
        
        String apiKey = System.getenv("VERINODE_API_KEY");
        if (apiKey != null) {
            builder.apiKey(apiKey);
        }
        
        String timeout = System.getenv("VERINODE_TIMEOUT");
        if (timeout != null) {
            builder.timeout(Duration.ofMillis(Long.parseLong(timeout)));
        }
        
        String maxRetries = System.getenv("VERINODE_MAX_RETRIES");
        if (maxRetries != null) {
            builder.maxRetries(Integer.parseInt(maxRetries));
        }
        
        String retryDelay = System.getenv("VERINODE_RETRY_DELAY");
        if (retryDelay != null) {
            builder.retryDelay(Duration.ofMillis(Long.parseLong(retryDelay)));
        }
        
        String backoff = System.getenv("VERINODE_BACKOFF_MULTIPLIER");
        if (backoff != null) {
            builder.backoffMultiplier(Double.parseDouble(backoff));
        }
        
        String autoConnect = System.getenv("VERINODE_WALLET_AUTO_CONNECT");
        if (autoConnect != null) {
            builder.walletAutoConnect(Boolean.parseBoolean(autoConnect));
        }
        
        String logging = System.getenv("VERINODE_LOGGING_ENABLED");
        if (logging != null) {
            builder.loggingEnabled(Boolean.parseBoolean(logging));
        }
        
        String logLevel = System.getenv("VERINODE_LOG_LEVEL");
        if (logLevel != null) {
            builder.logLevel(logLevel);
        }
        
        return builder.build();
    }
    
    /**
     * Validates the configuration.
     * 
     * @return true if valid, false otherwise
     */
    public boolean isValid() {
        try {
            validate();
            return true;
        } catch (VerinodeException e) {
            return false;
        }
    }
    
    /**
     * Validates the configuration and throws an exception if invalid.
     * 
     * @throws VerinodeException if configuration is invalid
     */
    public void validate() throws VerinodeException {
        if (apiEndpoint == null || apiEndpoint.trim().isEmpty()) {
            throw new VerinodeException("API endpoint cannot be empty");
        }
        
        if (!apiEndpoint.startsWith("http://") && !apiEndpoint.startsWith("https://")) {
            throw new VerinodeException("API endpoint must start with http:// or https://");
        }
        
        if (timeout.isZero() || timeout.isNegative()) {
            throw new VerinodeException("Timeout must be positive");
        }
        
        if (maxRetries < 0 || maxRetries > 10) {
            throw new VerinodeException("Max retries must be between 0 and 10");
        }
        
        if (retryDelay.isZero() || retryDelay.isNegative()) {
            throw new VerinodeException("Retry delay must be positive");
        }
        
        if (backoffMultiplier <= 1.0) {
            throw new VerinodeException("Backoff multiplier must be greater than 1.0");
        }
    }
    
    // Getters and setters
    
    public String getApiEndpoint() {
        return apiEndpoint;
    }
    
    public void setApiEndpoint(String apiEndpoint) {
        this.apiEndpoint = apiEndpoint;
    }
    
    public NetworkType getNetwork() {
        return network;
    }
    
    public void setNetwork(NetworkType network) {
        this.network = network;
    }
    
    public String getApiKey() {
        return apiKey;
    }
    
    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }
    
    public Duration getTimeout() {
        return timeout;
    }
    
    public void setTimeout(Duration timeout) {
        this.timeout = timeout;
    }
    
    public int getMaxRetries() {
        return maxRetries;
    }
    
    public void setMaxRetries(int maxRetries) {
        this.maxRetries = maxRetries;
    }
    
    public Duration getRetryDelay() {
        return retryDelay;
    }
    
    public void setRetryDelay(Duration retryDelay) {
        this.retryDelay = retryDelay;
    }
    
    public double getBackoffMultiplier() {
        return backoffMultiplier;
    }
    
    public void setBackoffMultiplier(double backoffMultiplier) {
        this.backoffMultiplier = backoffMultiplier;
    }
    
    public boolean isWalletAutoConnect() {
        return walletAutoConnect;
    }
    
    public void setWalletAutoConnect(boolean walletAutoConnect) {
        this.walletAutoConnect = walletAutoConnect;
    }
    
    public List<String> getSupportedWallets() {
        return supportedWallets;
    }
    
    public void setSupportedWallets(List<String> supportedWallets) {
        this.supportedWallets = supportedWallets;
    }
    
    public boolean isLoggingEnabled() {
        return loggingEnabled;
    }
    
    public void setLoggingEnabled(boolean loggingEnabled) {
        this.loggingEnabled = loggingEnabled;
    }
    
    public String getLogLevel() {
        return logLevel;
    }
    
    public void setLogLevel(String logLevel) {
        this.logLevel = logLevel;
    }
    
    public Logger getLogger() {
        return customLogger != null ? customLogger : logger;
    }
    
    public void setLogger(Logger customLogger) {
        this.customLogger = customLogger;
    }
    
    /**
     * Builder class for VerinodeConfig.
     */
    public static class Builder {
        private final VerinodeConfig config = new VerinodeConfig();
        
        public Builder apiEndpoint(String apiEndpoint) {
            config.setApiEndpoint(apiEndpoint);
            return this;
        }
        
        public Builder network(NetworkType network) {
            config.setNetwork(network);
            return this;
        }
        
        public Builder apiKey(String apiKey) {
            config.setApiKey(apiKey);
            return this;
        }
        
        public Builder timeout(Duration timeout) {
            config.setTimeout(timeout);
            return this;
        }
        
        public Builder maxRetries(int maxRetries) {
            config.setMaxRetries(maxRetries);
            return this;
        }
        
        public Builder retryDelay(Duration retryDelay) {
            config.setRetryDelay(retryDelay);
            return this;
        }
        
        public Builder backoffMultiplier(double backoffMultiplier) {
            config.setBackoffMultiplier(backoffMultiplier);
            return this;
        }
        
        public Builder walletAutoConnect(boolean walletAutoConnect) {
            config.setWalletAutoConnect(walletAutoConnect);
            return this;
        }
        
        public Builder supportedWallets(List<String> supportedWallets) {
            config.setSupportedWallets(supportedWallets);
            return this;
        }
        
        public Builder loggingEnabled(boolean loggingEnabled) {
            config.setLoggingEnabled(loggingEnabled);
            return this;
        }
        
        public Builder logLevel(String logLevel) {
            config.setLogLevel(logLevel);
            return this;
        }
        
        public Builder logger(Logger logger) {
            config.setLogger(logger);
            return this;
        }
        
        public VerinodeConfig build() throws VerinodeException {
            config.validate();
            return config;
        }
    }
}
