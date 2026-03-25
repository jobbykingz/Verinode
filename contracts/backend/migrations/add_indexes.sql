-- Database Index Migration for Verinode Performance Optimization
-- This script adds optimized indexes for improved query performance

-- IPFSContent Collection Indexes
-- Primary query patterns: findByOwner, findByCID, contentType searches
db.ipfscontents.createIndex({ "cid": 1 }, { 
    name: "idx_ipfscontents_cid",
    unique: true,
    background: true 
});

db.ipfscontents.createIndex({ "owner": 1, "createdAt": -1 }, { 
    name: "idx_ipfscontents_owner_created",
    background: true 
});

db.ipfscontents.createIndex({ "contentType": 1, "createdAt": -1 }, { 
    name: "idx_ipfscontents_contenttype_created",
    background: true 
});

db.ipfscontents.createIndex({ "tags": 1 }, { 
    name: "idx_ipfscontents_tags",
    background: true 
});

db.ipfscontents.createIndex({ "isPublic": 1, "createdAt": -1 }, { 
    name: "idx_ipfscontents_public_created",
    background: true,
    partialFilterExpression: { "isPublic": true }
});

db.ipfscontents.createIndex({ "pinnedBy": 1 }, { 
    name: "idx_ipfscontents_pinnedby",
    background: true,
    sparse: true
});

-- Compound index for common search patterns
db.ipfscontents.createIndex({ 
    "contentType": 1, 
    "isPublic": 1, 
    "createdAt": -1 
}, { 
    name: "idx_ipfscontents_search",
    background: true 
});

-- Text index for content search
db.ipfscontents.createIndex({ 
    "name": "text", 
    "description": "text", 
    "tags": "text" 
}, { 
    name: "idx_ipfscontents_text",
    default_language: "none",
    background: true 
});

-- CustomTemplate Collection Indexes
-- Primary query patterns: findByCreator, findByType, public templates
db.customtemplates.createIndex({ "createdBy": 1, "createdAt": -1 }, { 
    name: "idx_customtemplates_creator_created",
    background: true 
});

db.customtemplates.createIndex({ "isPublic": 1, "createdAt": -1 }, { 
    name: "idx_customtemplates_public_created",
    background: true,
    partialFilterExpression: { "isPublic": true }
});

db.customtemplates.createIndex({ "templateType": 1, "isPublic": 1 }, { 
    name: "idx_customtemplates_type_public",
    background: true 
});

db.customtemplates.createIndex({ "status": 1, "moderatedAt": -1 }, { 
    name: "idx_customtemplates_status_moderated",
    background: true,
    sparse: true
});

db.customtemplates.createIndex({ "category": 1, "isPublic": 1, "createdAt": -1 }, { 
    name: "idx_customtemplates_category_public_created",
    background: true 
});

-- Text index for template search
db.customtemplates.createIndex({ 
    "name": "text", 
    "description": "text", 
    "category": "text" 
}, { 
    name: "idx_customtemplates_text",
    default_language: "none",
    background: true 
});

-- AuditLog Collection Indexes
-- Primary query patterns: time-based queries, user activity, entity tracking
db.auditlogs.createIndex({ "timestamp": -1 }, { 
    name: "idx_auditlogs_timestamp",
    background: true 
});

db.auditlogs.createIndex({ "userId": 1, "timestamp": -1 }, { 
    name: "idx_auditlogs_user_timestamp",
    background: true 
});

db.auditlogs.createIndex({ "entityType": 1, "entityId": 1, "timestamp": -1 }, { 
    name: "idx_auditlogs_entity_timestamp",
    background: true 
});

db.auditlogs.createIndex({ "action": 1, "timestamp": -1 }, { 
    name: "idx_auditlogs_action_timestamp",
    background: true 
});

-- TTL index for automatic cleanup (90 days)
db.auditlogs.createIndex({ "timestamp": 1 }, { 
    name: "idx_auditlogs_ttl",
    expireAfterSeconds: 7776000,
    background: true 
});

-- Compound index for audit trail queries
db.auditlogs.createIndex({ 
    "entityType": 1, 
    "entityId": 1, 
    "action": 1, 
    "timestamp": -1 
}, { 
    name: "idx_auditlogs_trail",
    background: true 
});

-- ComplianceReport Collection Indexes
-- Primary query patterns: generatedBy, date ranges, status tracking
db.compliancereports.createIndex({ "generatedBy.userId": 1, "generatedBy.timestamp": -1 }, { 
    name: "idx_compliancereports_generator_timestamp",
    background: true 
});

db.compliancereports.createIndex({ "reportType": 1, "status": 1 }, { 
    name: "idx_compliancereports_type_status",
    background: true 
});

db.compliancereports.createIndex({ "period.startDate": 1, "period.endDate": 1 }, { 
    name: "idx_compliancereports_period",
    background: true 
});

db.compliancereports.createIndex({ "status": 1, "generatedBy.timestamp": -1 }, { 
    name: "idx_compliancereports_status_timestamp",
    background: true 
});

-- PerformanceMetrics Collection Indexes
-- Primary query patterns: query analysis, performance monitoring
db.performancemetrics.createIndex({ "queryHash": 1, "timestamp": -1 }, { 
    name: "idx_performancemetrics_queryhash_timestamp",
    background: true 
});

db.performancemetrics.createIndex({ "databaseName": 1, "collectionName": 1, "timestamp": -1 }, { 
    name: "idx_performancemetrics_db_collection_timestamp",
    background: true 
});

db.performancemetrics.createIndex({ "slowQuery": 1, "timestamp": -1 }, { 
    name: "idx_performancemetrics_slow_timestamp",
    background: true,
    partialFilterExpression: { "slowQuery": true }
});

db.performancemetrics.createIndex({ "executionTime": -1 }, { 
    name: "idx_performancemetrics_executiontime",
    background: true 
});

db.performancemetrics.createIndex({ "cacheHit": 1, "timestamp": -1 }, { 
    name: "idx_performancemetrics_cache_timestamp",
    background: true 
});

-- TTL index for automatic cleanup (30 days)
db.performancemetrics.createIndex({ "timestamp": 1 }, { 
    name: "idx_performancemetrics_ttl",
    expireAfterSeconds: 2592000,
    background: true 
});

-- SearchHistory Collection Indexes
-- Primary query patterns: user search history, popular searches
db.searchhistory.createIndex({ "userId": 1, "searchedAt": -1 }, { 
    name: "idx_searchhistory_user_timestamp",
    background: true,
    sparse: true
});

db.searchhistory.createIndex({ "query": 1, "searchedAt": -1 }, { 
    name: "idx_searchhistory_query_timestamp",
    background: true 
});

-- TTL index for automatic cleanup (60 days)
db.searchhistory.createIndex({ "searchedAt": 1 }, { 
    name: "idx_searchhistory_ttl",
    expireAfterSeconds: 5184000,
    background: true 
});

-- SearchQuery Collection Indexes
-- Primary query patterns: active queries, query tracking
db.searchqueries.createIndex({ "status": 1, "createdAt": -1 }, { 
    name: "idx_searchqueries_status_created",
    background: true 
});

db.searchqueries.createIndex({ "userId": 1, "createdAt": -1 }, { 
    name: "idx_searchqueries_user_created",
    background: true,
    sparse: true
});

-- TTL index for cleanup of old completed queries (7 days)
db.searchqueries.createIndex({ "createdAt": 1 }, { 
    name: "idx_searchqueries_ttl",
    expireAfterSeconds: 604800,
    background: true,
    partialFilterExpression: { "status": "completed" }
});

-- Print index creation summary
print("Index creation completed. Summary:");
print("IPFSContent indexes: 7");
print("CustomTemplate indexes: 6");
print("AuditLog indexes: 6");
print("ComplianceReport indexes: 4");
print("PerformanceMetrics indexes: 6");
print("SearchHistory indexes: 3");
print("SearchQuery indexes: 3");
print("Total indexes created: 35");
