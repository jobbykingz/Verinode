package com.verinode.sdk.exception;

/**
 * Enumeration of error codes for the Verinode SDK.
 */
public enum ErrorCode {
    /**
     * General API error.
     */
    API_ERROR("API_ERROR"),
    
    /**
     * Authentication error.
     */
    AUTH_ERROR("AUTH_ERROR"),
    
    /**
     * Validation error.
     */
    VALIDATION_ERROR("VALIDATION_ERROR"),
    
    /**
     * Network error.
     */
    NETWORK_ERROR("NETWORK_ERROR"),
    
    /**
     * Wallet error.
     */
    WALLET_ERROR("WALLET_ERROR"),
    
    /**
     * Proof error.
     */
    PROOF_ERROR("PROOF_ERROR"),
    
    /**
     * Verification error.
     */
    VERIFICATION_ERROR("VERIFICATION_ERROR"),
    
    /**
     * Subscription error.
     */
    SUBSCRIPTION_ERROR("SUBSCRIPTION_ERROR");
    
    private final String value;
    
    ErrorCode(String value) {
        this.value = value;
    }
    
    /**
     * Gets the string value of the error code.
     * 
     * @return the string value
     */
    public String getValue() {
        return value;
    }
    
    @Override
    public String toString() {
        return value;
    }
}
