package com.verinode.sdk.config;

/**
 * Represents the network type for the Verinode SDK.
 */
public enum NetworkType {
    /**
     * Main network for production use.
     */
    MAINNET("mainnet"),
    
    /**
     * Test network for development and testing.
     */
    TESTNET("testnet");
    
    private final String value;
    
    NetworkType(String value) {
        this.value = value;
    }
    
    /**
     * Gets the string value of the network type.
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
