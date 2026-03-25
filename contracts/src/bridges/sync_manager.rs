#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env, String, Vec, Map};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SyncOperation {
    pub operation_id: u64,
    pub operation_type: SyncOperationType,
    pub source_chain: u32,
    pub target_chains: Vec<u32>,
    pub data: Bytes,
    pub status: SyncStatus,
    pub created_at: u64,
    pub completed_at: Option<u64>,
    pub error_count: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SyncOperationType {
    EventSync,
    StateSync,
    ProofSync,
    BatchSync,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SyncStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
    PartiallyCompleted,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ConflictResolution {
    pub conflict_id: u64,
    pub operation_id: u64,
    pub conflicting_chains: Vec<u32>,
    pub resolution_strategy: ConflictStrategy,
    pub resolved_data: Bytes,
    pub resolved_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ConflictStrategy {
    LatestWins,
    Merge,
    Manual,
    SourcePriority,
}

#[contracttype]
pub enum SyncManagerDataKey {
    SyncOperation(u64),
    ConflictResolution(u64),
    OperationCount,
    ActiveOperations,
    CompletedOperations,
    FailedOperations,
    Conflicts,
}

#[contract]
pub struct SyncManagerContract;

#[contractimpl]
impl SyncManagerContract {
    /// Initialize the sync manager contract
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&SyncManagerDataKey::OperationCount) {
            panic!("Contract already initialized");
        }

        env.storage().instance().set(&SyncManagerDataKey::OperationCount, &0u64);
        env.storage().instance().set(&SyncManagerDataKey::ActiveOperations, &Vec::<u64>::new(&env));
        env.storage().instance().set(&SyncManagerDataKey::CompletedOperations, &Vec::<u64>::new(&env));
        env.storage().instance().set(&SyncManagerDataKey::FailedOperations, &Vec::<u64>::new(&env));
        env.storage().instance().set(&SyncManagerDataKey::Conflicts, &Vec::<u64>::new(&env));
    }

    /// Create a new sync operation
    pub fn create_operation(
        env: Env,
        operation_type: SyncOperationType,
        source_chain: u32,
        target_chains: Vec<u32>,
        data: Bytes,
    ) -> u64 {
        let count: u64 = env.storage().instance().get(&SyncManagerDataKey::OperationCount).unwrap_or(0);
        let operation_id = count + 1;

        let operation = SyncOperation {
            operation_id,
            operation_type,
            source_chain,
            target_chains,
            data,
            status: SyncStatus::Pending,
            created_at: env.ledger().timestamp(),
            completed_at: None,
            error_count: 0,
        };

        env.storage().instance().set(&SyncManagerDataKey::SyncOperation(operation_id), &operation);
        env.storage().instance().set(&SyncManagerDataKey::OperationCount, &operation_id);

        // Add to active operations
        let mut active: Vec<u64> = env.storage().instance().get(&SyncManagerDataKey::ActiveOperations).unwrap();
        active.push_back(operation_id);
        env.storage().instance().set(&SyncManagerDataKey::ActiveOperations, &active);

        operation_id
    }

    /// Start a sync operation
    pub fn start_operation(env: Env, operation_id: u64) {
        let mut operation: SyncOperation = env.storage().instance()
            .get(&SyncManagerDataKey::SyncOperation(operation_id))
            .unwrap_or_else(|| panic!("Sync operation not found"));

        operation.status = SyncStatus::InProgress;
        env.storage().instance().set(&SyncManagerDataKey::SyncOperation(operation_id), &operation);
    }

    /// Complete a sync operation
    pub fn complete_operation(env: Env, operation_id: u64) {
        let mut operation: SyncOperation = env.storage().instance()
            .get(&SyncManagerDataKey::SyncOperation(operation_id))
            .unwrap_or_else(|| panic!("Sync operation not found"));

        operation.status = SyncStatus::Completed;
        operation.completed_at = Some(env.ledger().timestamp());
        env.storage().instance().set(&SyncManagerDataKey::SyncOperation(operation_id), &operation);

        // Move from active to completed
        let mut active: Vec<u64> = env.storage().instance().get(&SyncManagerDataKey::ActiveOperations).unwrap();
        if let Some(index) = active.iter().position(|&id| id == operation_id) {
            active.remove(index);
        }
        env.storage().instance().set(&SyncManagerDataKey::ActiveOperations, &active);

        let mut completed: Vec<u64> = env.storage().instance().get(&SyncManagerDataKey::CompletedOperations).unwrap();
        completed.push_back(operation_id);
        env.storage().instance().set(&SyncManagerDataKey::CompletedOperations, &completed);
    }

    /// Fail a sync operation
    pub fn fail_operation(env: Env, operation_id: u64) {
        let mut operation: SyncOperation = env.storage().instance()
            .get(&SyncManagerDataKey::SyncOperation(operation_id))
            .unwrap_or_else(|| panic!("Sync operation not found"));

        operation.status = SyncStatus::Failed;
        operation.error_count += 1;
        env.storage().instance().set(&SyncManagerDataKey::SyncOperation(operation_id), &operation);

        // Move from active to failed
        let mut active: Vec<u64> = env.storage().instance().get(&SyncManagerDataKey::ActiveOperations).unwrap();
        if let Some(index) = active.iter().position(|&id| id == operation_id) {
            active.remove(index);
        }
        env.storage().instance().set(&SyncManagerDataKey::ActiveOperations, &active);

        let mut failed: Vec<u64> = env.storage().instance().get(&SyncManagerDataKey::FailedOperations).unwrap();
        failed.push_back(operation_id);
        env.storage().instance().set(&SyncManagerDataKey::FailedOperations, &failed);
    }

    /// Report partial completion
    pub fn partial_complete_operation(env: Env, operation_id: u64) {
        let mut operation: SyncOperation = env.storage().instance()
            .get(&SyncManagerDataKey::SyncOperation(operation_id))
            .unwrap_or_else(|| panic!("Sync operation not found"));

        operation.status = SyncStatus::PartiallyCompleted;
        env.storage().instance().set(&SyncManagerDataKey::SyncOperation(operation_id), &operation);
    }

    /// Create a conflict resolution
    pub fn create_conflict_resolution(
        env: Env,
        operation_id: u64,
        conflicting_chains: Vec<u32>,
        resolution_strategy: ConflictStrategy,
        resolved_data: Bytes,
    ) -> u64 {
        let conflicts: Vec<u64> = env.storage().instance().get(&SyncManagerDataKey::Conflicts).unwrap();
        let conflict_id = conflicts.len() as u64 + 1;

        let resolution = ConflictResolution {
            conflict_id,
            operation_id,
            conflicting_chains,
            resolution_strategy,
            resolved_data,
            resolved_at: env.ledger().timestamp(),
        };

        env.storage().instance().set(&SyncManagerDataKey::ConflictResolution(conflict_id), &resolution);

        // Add to conflicts list
        let mut updated_conflicts = conflicts;
        updated_conflicts.push_back(conflict_id);
        env.storage().instance().set(&SyncManagerDataKey::Conflicts, &updated_conflicts);

        conflict_id
    }

    /// Get sync operation
    pub fn get_operation(env: Env, operation_id: u64) -> SyncOperation {
        env.storage().instance()
            .get(&SyncManagerDataKey::SyncOperation(operation_id))
            .unwrap_or_else(|| panic!("Sync operation not found"))
    }

    /// Get active operations
    pub fn get_active_operations(env: Env) -> Vec<u64> {
        env.storage().instance().get(&SyncManagerDataKey::ActiveOperations).unwrap()
    }

    /// Get completed operations
    pub fn get_completed_operations(env: Env) -> Vec<u64> {
        env.storage().instance().get(&SyncManagerDataKey::CompletedOperations).unwrap()
    }

    /// Get failed operations
    pub fn get_failed_operations(env: Env) -> Vec<u64> {
        env.storage().instance().get(&SyncManagerDataKey::FailedOperations).unwrap()
    }

    /// Get conflicts
    pub fn get_conflicts(env: Env) -> Vec<u64> {
        env.storage().instance().get(&SyncManagerDataKey::Conflicts).unwrap()
    }

    /// Get conflict resolution
    pub fn get_conflict_resolution(env: Env, conflict_id: u64) -> ConflictResolution {
        env.storage().instance()
            .get(&SyncManagerDataKey::ConflictResolution(conflict_id))
            .unwrap_or_else(|| panic!("Conflict resolution not found"))
    }

    /// Retry failed operations
    pub fn retry_failed_operations(env: Env) -> Vec<u64> {
        let failed: Vec<u64> = env.storage().instance().get(&SyncManagerDataKey::FailedOperations).unwrap();
        let mut retried = Vec::new(&env);

        for operation_id in failed.iter() {
            let operation: SyncOperation = env.storage().instance()
                .get(&SyncManagerDataKey::SyncOperation(*operation_id))
                .unwrap();

            // Reset status and move back to active
            let mut updated_operation = operation.clone();
            updated_operation.status = SyncStatus::Pending;
            env.storage().instance().set(&SyncManagerDataKey::SyncOperation(*operation_id), &updated_operation);

            let mut active: Vec<u64> = env.storage().instance().get(&SyncManagerDataKey::ActiveOperations).unwrap();
            active.push_back(*operation_id);
            env.storage().instance().set(&SyncManagerDataKey::ActiveOperations, &active);

            retried.push_back(*operation_id);
        }

        // Clear failed operations
        env.storage().instance().set(&SyncManagerDataKey::FailedOperations, &Vec::<u64>::new(&env));

        retried
    }

    /// Get operations by type
    pub fn get_operations_by_type(env: Env, operation_type: SyncOperationType) -> Vec<u64> {
        let count: u64 = env.storage().instance().get(&SyncManagerDataKey::OperationCount).unwrap_or(0);
        let mut matching_ops = Vec::new(&env);

        for i in 1..=count {
            if let Some(operation) = env.storage().instance().get::<SyncManagerDataKey, SyncOperation>(&SyncManagerDataKey::SyncOperation(i)) {
                if operation.operation_type == operation_type {
                    matching_ops.push_back(i);
                }
            }
        }

        matching_ops
    }
}