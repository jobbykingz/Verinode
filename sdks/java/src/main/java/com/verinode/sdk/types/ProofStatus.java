package com.verinode.sdk.types;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Enumeration of proof statuses.
 */
public enum ProofStatus {
    /**
     * Proof is pending verification.
     */
    PENDING("pending"),
    
    /**
     * Proof has been verified.
     */
    VERIFIED("verified"),
    
    /**
     * Proof has been rejected.
     */
    REJECTED("rejected"),
    
    /**
     * Proof has expired.
     */
    EXPIRED("expired");
    
    private final String value;
    
    ProofStatus(String value) {
        this.value = value;
    }
    
    /**
     * Gets the string value of the status.
     * 
     * @return the string value
     */
    @JsonValue
    public String getValue() {
        return value;
    }
    
    @Override
    public String toString() {
        return value;
    }
    
    /**
     * Gets the status from string value.
     * 
     * @param value the string value
     * @return the corresponding status
     * @throws IllegalArgumentException if value is invalid
     */
    public static ProofStatus fromValue(String value) {
        for (ProofStatus status : values()) {
            if (status.value.equals(value)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Invalid status: " + value);
    }
}
