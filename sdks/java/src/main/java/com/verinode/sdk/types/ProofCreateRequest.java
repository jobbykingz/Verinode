package com.verinode.sdk.types;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonFormat;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Request object for creating a new proof.
 */
public class ProofCreateRequest {
    
    @JsonProperty("title")
    private String title;
    
    @JsonProperty("description")
    private String description;
    
    @JsonProperty("metadata")
    private Map<String, Object> metadata;
    
    @JsonProperty("attachments")
    private List<String> attachments;
    
    @JsonProperty("tags")
    private List<String> tags;
    
    @JsonProperty("expires_at")
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
    private LocalDateTime expiresAt;
    
    /**
     * Default constructor.
     */
    public ProofCreateRequest() {
    }
    
    /**
     * Constructor with required fields.
     * 
     * @param title the proof title
     */
    public ProofCreateRequest(String title) {
        this.title = title;
    }
    
    // Getters and setters
    
    public String getTitle() {
        return title;
    }
    
    public void setTitle(String title) {
        this.title = title;
    }
    
    public String getDescription() {
        return description;
    }
    
    public void setDescription(String description) {
        this.description = description;
    }
    
    public Map<String, Object> getMetadata() {
        return metadata;
    }
    
    public void setMetadata(Map<String, Object> metadata) {
        this.metadata = metadata;
    }
    
    public List<String> getAttachments() {
        return attachments;
    }
    
    public void setAttachments(List<String> attachments) {
        this.attachments = attachments;
    }
    
    public List<String> getTags() {
        return tags;
    }
    
    public void setTags(List<String> tags) {
        this.tags = tags;
    }
    
    public LocalDateTime getExpiresAt() {
        return expiresAt;
    }
    
    public void setExpiresAt(LocalDateTime expiresAt) {
        this.expiresAt = expiresAt;
    }
    
    /**
     * Builder class for ProofCreateRequest.
     */
    public static class Builder {
        private final ProofCreateRequest request = new ProofCreateRequest();
        
        public Builder(String title) {
            request.setTitle(title);
        }
        
        public Builder description(String description) {
            request.setDescription(description);
            return this;
        }
        
        public Builder metadata(Map<String, Object> metadata) {
            request.setMetadata(metadata);
            return this;
        }
        
        public Builder attachments(List<String> attachments) {
            request.setAttachments(attachments);
            return this;
        }
        
        public Builder tags(List<String> tags) {
            request.setTags(tags);
            return this;
        }
        
        public Builder expiresAt(LocalDateTime expiresAt) {
            request.setExpiresAt(expiresAt);
            return this;
        }
        
        public ProofCreateRequest build() {
            return request;
        }
    }
}
