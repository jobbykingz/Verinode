-- Database Partitioning Migration for Verinode Performance Optimization
-- This script implements table partitioning for large collections

-- Note: MongoDB 4.2+ supports sharding and collection partitioning
-- This migration sets up sharding for large collections

-- Enable sharding on the database (run once per database)
sh.enableSharding("verinode");

-- IPFSContent Collection Sharding
-- Shard by CID hash for even distribution
sh.shardCollection("verinode.ipfscontents", { "cid": "hashed" });

-- Create hashed shard key for CID
-- This ensures even distribution across shards
db.ipfscontents.createIndex({ "cid": "hashed" }, { 
    name: "idx_ipfscontents_cid_hashed",
    background: true 
});

-- Alternative shard key for time-based queries (if needed)
-- Uncomment if time-based queries are more common than CID lookups
-- sh.shardCollection("verinode.ipfscontents", { "createdAt": 1, "cid": 1 });

-- AuditLog Collection Sharding
-- Shard by timestamp for time-based queries and automatic data aging
sh.shardCollection("verinode.auditlogs", { "timestamp": 1 });

-- Create compound index for shard key + common queries
db.auditlogs.createIndex({ "timestamp": 1, "userId": 1 }, { 
    name: "idx_auditlogs_timestamp_user_shard",
    background: true 
});

-- Create zones for data aging (optional - requires MongoDB 4.4+)
-- This creates different retention policies for different time periods
try {
    sh.addShardZone(
        "verinode.auditlogs",
        { "timestamp": { "$gte": new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        "recent_data_zone"
    );
    
    sh.addShardZone(
        "verinode.auditlogs", 
        { "timestamp": { "$lt": new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        "historical_data_zone"
    );
} catch (e) {
    print("Zone creation skipped (requires MongoDB 4.4+): " + e.message);
}

-- PerformanceMetrics Collection Sharding
-- Shard by timestamp for time-based analysis and automatic cleanup
sh.shardCollection("verinode.performancemetrics", { "timestamp": 1 });

-- Create compound index for shard key + query analysis
db.performancemetrics.createIndex({ "timestamp": 1, "queryHash": 1 }, { 
    name: "idx_performancemetrics_timestamp_query_shard",
    background: true 
});

-- Create zones for performance data aging
try {
    sh.addShardZone(
        "verinode.performancemetrics",
        { "timestamp": { "$gte": new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        "recent_metrics_zone"
    );
    
    sh.addShardZone(
        "verinode.performancemetrics",
        { "timestamp": { "$lt": new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        "historical_metrics_zone"
    );
} catch (e) {
    print("Zone creation skipped (requires MongoDB 4.4+): " + e.message);
}

-- CustomTemplate Collection Sharding (if it grows large)
-- Shard by owner for user-specific queries
-- Only enable if collection exceeds 1M documents
try {
    const stats = db.customtemplates.stats();
    if (stats.count > 1000000) {
        sh.shardCollection("verinode.customtemplates", { "createdBy": 1 });
        
        db.customtemplates.createIndex({ "createdBy": 1, "createdAt": -1 }, { 
            name: "idx_customtemplates_owner_created_shard",
            background: true 
        });
        
        print("CustomTemplate sharding enabled (large collection detected)");
    } else {
        print("CustomTemplate sharding skipped (collection not large enough)");
    }
} catch (e) {
    print("CustomTemplate sharding analysis skipped: " + e.message);
}

-- SearchHistory Collection Sharding (if it grows large)
-- Shard by user ID for user-specific search history
try {
    const stats = db.searchhistory.stats();
    if (stats.count > 500000) {
        sh.shardCollection("verinode.searchhistory", { "userId": 1 });
        
        db.searchhistory.createIndex({ "userId": 1, "searchedAt": -1 }, { 
            name: "idx_searchhistory_user_timestamp_shard",
            background: true 
        });
        
        print("SearchHistory sharding enabled (large collection detected)");
    } else {
        print("SearchHistory sharding skipped (collection not large enough)");
    }
} catch (e) {
    print("SearchHistory sharding analysis skipped: " + e.message);
}

-- Configure chunk size for better performance
-- Default chunk size is 64MB, we can optimize for our use case
try {
    // Use smaller chunks for frequently accessed collections
    db.adminCommand({
        configureCollectionBalancing: "verinode.ipfscontents",
        chunkSize: 32
    });
    
    db.adminCommand({
        configureCollectionBalancing: "verinode.auditlogs", 
        chunkSize: 32
    });
    
    db.adminCommand({
        configureCollectionBalancing: "verinode.performancemetrics",
        chunkSize: 32
    });
    
    print("Chunk size optimization completed");
} catch (e) {
    print("Chunk size configuration skipped: " + e.message);
}

-- Set up automatic balancing for optimal performance
try {
    // Enable auto-splitting for high-volume collections
    sh.enableAutoSplit("verinode.ipfscontents");
    sh.enableAutoSplit("verinode.auditlogs");
    sh.enableAutoSplit("verinode.performancemetrics");
    
    print("Auto-splitting enabled for high-volume collections");
} catch (e) {
    print("Auto-splitting configuration skipped: " + e.message);
}

-- Create aggregation pipeline optimization views
-- These views optimize common analytical queries

-- View for slow query analysis
db.createView("slow_queries_view", "performancemetrics", [
    { $match: { slowQuery: true } },
    { $sort: { executionTime: -1, timestamp: -1 } },
    { $limit: 100 },
    {
        $project: {
            queryHash: 1,
            executionTime: 1,
            timestamp: 1,
            databaseName: 1,
            collectionName: 1,
            documentsScanned: 1,
            documentsReturned: 1
        }
    }
]);

-- View for daily performance summary
db.createView("daily_performance_view", "performancemetrics", [
    {
        $match: {
            timestamp: {
                $gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
        }
    },
    {
        $group: {
            _id: {
                database: "$databaseName",
                collection: "$collectionName",
                hour: { $hour: "$timestamp" }
            },
            totalQueries: { $sum: 1 },
            avgExecutionTime: { $avg: "$executionTime" },
            slowQueries: { $sum: { $cond: ["$slowQuery", 1, 0] } },
            cacheHitRate: { $avg: { $cond: ["$cacheHit", 1, 0] } }
        }
    },
    { $sort: { "_id.hour": 1 } }
]);

-- View for user activity analysis
db.createView("user_activity_view", "auditlogs", [
    {
        $match: {
            timestamp: {
                $gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
        }
    },
    {
        $group: {
            _id: "$userId",
            totalActions: { $sum: 1 },
            uniqueEntities: { $addToSet: { entityType: "$entityType", entityId: "$entityId" } },
            actionTypes: { $addToSet: "$action" },
            lastActivity: { $max: "$timestamp" }
        }
    },
    {
        $project: {
            userId: "$_id",
            totalActions: 1,
            uniqueEntityCount: { $size: "$uniqueEntities" },
            actionTypes: 1,
            lastActivity: 1
        }
    },
    { $sort: { totalActions: -1 } }
]);

-- Print migration summary
print("Database partitioning migration completed:");
print("Sharded collections:");
print("- IPFSContent (by CID hash)");
print("- AuditLog (by timestamp)");
print("- PerformanceMetrics (by timestamp)");
print("- CustomTemplate (by owner, if large)");
print("- SearchHistory (by user, if large)");
print("Optimization views created:");
print("- slow_queries_view");
print("- daily_performance_view"); 
print("- user_activity_view");
print("Chunk size and auto-splitting configured");
