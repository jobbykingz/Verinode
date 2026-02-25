#[cfg(test)]
mod tests {
    use soroban_sdk::{Address, Bytes, Env, Map, Symbol, Vec, symbol_short};
    use super::{ProofVerifier, ProofRequest, BatchOperation, Proof};

    struct ProofVerifierClient<'a> {
        env: &'a Env,
        contract_id: &'a soroban_sdk::Address,
    }

    impl<'a> ProofVerifierClient<'a> {
        fn new(env: &'a Env, contract_id: &'a soroban_sdk::Address) -> Self {
            Self { env, contract_id }
        }

        fn initialize(&self, admin: &Address) {
            ProofVerifier::initialize(self.env.clone(), admin.clone());
        }

        fn get_admin(&self) -> Address {
            ProofVerifier::get_admin(self.env.clone())
        }

        fn get_proof_count(&self) -> u64 {
            ProofVerifier::get_proof_count(self.env.clone())
        }

        fn issue_proof(&self, issuer: &Address, request: &ProofRequest) -> u64 {
            ProofVerifier::issue_proof(self.env.clone(), issuer.clone(), request.clone())
        }

        fn get_proof(&self, proof_id: &u64) -> Proof {
            ProofVerifier::get_proof(self.env.clone(), *proof_id)
        }

        fn verify_proof(&self, verifier: &Address, proof_id: &u64) -> bool {
            ProofVerifier::verify_proof(self.env.clone(), verifier.clone(), *proof_id)
        }

        fn revoke_proof(&self, revoker: &Address, proof_id: &u64, reason: String) {
            ProofVerifier::revoke_proof(self.env.clone(), revoker.clone(), *proof_id, reason);
        }

        fn batch_operations(&self, operator: &Address, operations: Vec<BatchOperation>) -> Vec<super::BatchResult> {
            ProofVerifier::batch_operations(self.env.clone(), operator.clone(), operations)
        }

        fn get_proofs_by_issuer(&self, issuer: &Address) -> Vec<Proof> {
            ProofVerifier::get_proofs_by_issuer(self.env.clone(), issuer.clone())
        }

        fn get_proofs_by_subject(&self, subject: &Address) -> Vec<Proof> {
            ProofVerifier::get_proofs_by_subject(self.env.clone(), subject.clone())
        }

        fn get_revoked_proofs(&self) -> Vec<Proof> {
            ProofVerifier::get_revoked_proofs(self.env.clone())
        }

        fn is_proof_valid(&self, proof_id: &u64) -> bool {
            ProofVerifier::is_proof_valid(self.env.clone(), *proof_id)
        }

        fn update_admin(&self, current_admin: &Address, new_admin: &Address) {
            ProofVerifier::update_admin(self.env.clone(), current_admin.clone(), new_admin.clone());
        }
    }

    #[test]
    fn test_initialize() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ProofVerifier);
        let client = ProofVerifierClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        client.initialize(&admin);
        
        // Test that admin is set
        let stored_admin = client.get_admin();
        assert_eq!(admin, stored_admin);
        
        // Test proof count is initialized
        let count = client.get_proof_count();
        assert_eq!(count, 0);
    }

    #[test]
    fn test_double_initialize_fails() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ProofVerifier);
        let client = ProofVerifierClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        client.initialize(&admin);
        
        // Second initialization should fail
        let result = std::panic::catch_unwind(|| {
            client.initialize(&admin);
        });
        assert!(result.is_err());
    }

    #[test]
    fn test_issue_proof() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ProofVerifier);
        let client = ProofVerifierClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        client.initialize(&admin);
        
        let issuer = Address::generate(&env);
        let subject = Address::generate(&env);
        let event_data = Bytes::from_slice(&env, b"test event data");
        let proof_type = String::from_slice(&env, "identity");
        
        let mut metadata = Map::new(&env);
        metadata.set(symbol_short!("purpose"), String::from_slice(&env, "KYC verification"));
        metadata.set(symbol_short!("level"), String::from_slice(&env, "standard"));
        
        let request = ProofRequest {
            subject: subject.clone(),
            proof_type: proof_type.clone(),
            event_data: event_data.clone(),
            metadata: metadata.clone(),
        };
        
        let proof_id = client.issue_proof(&issuer, &request);
        assert_eq!(proof_id, 1);
        
        let proof = client.get_proof(&proof_id);
        assert_eq!(proof.id, proof_id);
        assert_eq!(proof.issuer, issuer);
        assert_eq!(proof.subject, subject);
        assert_eq!(proof.proof_type, proof_type);
        assert_eq!(proof.event_data, event_data);
        assert!(!proof.verified);
        assert!(!proof.revoked);
        assert_eq!(proof.metadata, metadata);
    }

    #[test]
    fn test_verify_proof() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ProofVerifier);
        let client = ProofVerifierClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        client.initialize(&admin);
        
        let issuer = Address::generate(&env);
        let subject = Address::generate(&env);
        let verifier = Address::generate(&env);
        
        let event_data = Bytes::from_slice(&env, b"test event data");
        let mut metadata = Map::new(&env);
        metadata.set(symbol_short!("purpose"), String::from_slice(&env, "test"));
        
        let request = ProofRequest {
            subject,
            proof_type: String::from_slice(&env, "identity"),
            event_data,
            metadata,
        };
        
        let proof_id = client.issue_proof(&issuer, &request);
        
        // Verify proof
        let result = client.verify_proof(&verifier, &proof_id);
        assert!(result);
        
        let proof = client.get_proof(&proof_id);
        assert!(proof.verified);
    }

    #[test]
    fn test_revoke_proof_by_admin() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ProofVerifier);
        let client = ProofVerifierClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        client.initialize(&admin);
        
        let issuer = Address::generate(&env);
        let subject = Address::generate(&env);
        
        let event_data = Bytes::from_slice(&env, b"test event data");
        let metadata = Map::new(&env);
        
        let request = ProofRequest {
            subject,
            proof_type: String::from_slice(&env, "identity"),
            event_data,
            metadata,
        };
        
        let proof_id = client.issue_proof(&issuer, &request);
        
        // Revoke proof by admin
        let reason = String::from_slice(&env, "Test revocation");
        client.revoke_proof(&admin, &proof_id, reason);
        
        let proof = client.get_proof(&proof_id);
        assert!(proof.revoked);
        assert!(!proof.verified);
        
        // Check it's in revoked list
        let revoked_proofs = client.get_revoked_proofs();
        assert_eq!(revoked_proofs.len(), 1);
        assert_eq!(revoked_proofs.get(0).unwrap().id, proof_id);
    }

    #[test]
    fn test_revoke_proof_by_issuer() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ProofVerifier);
        let client = ProofVerifierClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        client.initialize(&admin);
        
        let issuer = Address::generate(&env);
        let subject = Address::generate(&env);
        
        let event_data = Bytes::from_slice(&env, b"test event data");
        let metadata = Map::new(&env);
        
        let request = ProofRequest {
            subject,
            proof_type: String::from_slice(&env, "identity"),
            event_data,
            metadata,
        };
        
        let proof_id = client.issue_proof(&issuer, &request);
        
        // Revoke proof by issuer
        let reason = String::from_slice(&env, "Issuer revocation");
        client.revoke_proof(&issuer, &proof_id, reason);
        
        let proof = client.get_proof(&proof_id);
        assert!(proof.revoked);
    }

    #[test]
    fn test_revoke_proof_unauthorized_fails() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ProofVerifier);
        let client = ProofVerifierClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        client.initialize(&admin);
        
        let issuer = Address::generate(&env);
        let unauthorized = Address::generate(&env);
        let subject = Address::generate(&env);
        
        let event_data = Bytes::from_slice(&env, b"test event data");
        let metadata = Map::new(&env);
        
        let request = ProofRequest {
            subject,
            proof_type: String::from_slice(&env, "identity"),
            event_data,
            metadata,
        };
        
        let proof_id = client.issue_proof(&issuer, &request);
        
        // Try to revoke by unauthorized party should fail
        let reason = String::from_slice(&env, "Unauthorized revocation");
        let result = std::panic::catch_unwind(|| {
            client.revoke_proof(&unauthorized, &proof_id, reason);
        });
        assert!(result.is_err());
    }

    #[test]
    fn test_batch_operations() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ProofVerifier);
        let client = ProofVerifierClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        client.initialize(&admin);
        
        let operator = Address::generate(&env);
        let subject1 = Address::generate(&env);
        let subject2 = Address::generate(&env);
        
        let event_data = Bytes::from_slice(&env, b"test event data");
        let metadata = Map::new(&env);
        
        let request1 = ProofRequest {
            subject: subject1,
            proof_type: String::from_slice(&env, "identity"),
            event_data: event_data.clone(),
            metadata: metadata.clone(),
        };
        
        let request2 = ProofRequest {
            subject: subject2,
            proof_type: String::from_slice(&env, "credential"),
            event_data,
            metadata,
        };
        
        let mut operations = Vec::new(&env);
        
        // Issue operation
        operations.push_back(BatchOperation {
            operation_type: 1,
            proof_id: None,
            proof_request: Some(request1),
        });
        
        // Issue operation
        operations.push_back(BatchOperation {
            operation_type: 1,
            proof_id: None,
            proof_request: Some(request2),
        });
        
        let results = client.batch_operations(&operator, operations);
        assert_eq!(results.len(), 2);
        assert!(results.get(0).unwrap().success);
        assert!(results.get(1).unwrap().success);
        assert!(results.get(0).unwrap().proof_id.is_some());
        assert!(results.get(1).unwrap().proof_id.is_some());
        
        let proof_id1 = results.get(0).unwrap().proof_id.unwrap();
        let proof_id2 = results.get(1).unwrap().proof_id.unwrap();
        
        // Verify operations
        let mut verify_operations = Vec::new(&env);
        verify_operations.push_back(BatchOperation {
            operation_type: 2,
            proof_id: Some(proof_id1),
            proof_request: None,
        });
        verify_operations.push_back(BatchOperation {
            operation_type: 2,
            proof_id: Some(proof_id2),
            proof_request: None,
        });
        
        let verify_results = client.batch_operations(&operator, verify_operations);
        assert_eq!(verify_results.len(), 2);
        assert!(verify_results.get(0).unwrap().success);
        assert!(verify_results.get(1).unwrap().success);
    }

    #[test]
    fn test_get_proofs_by_issuer() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ProofVerifier);
        let client = ProofVerifierClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        client.initialize(&admin);
        
        let issuer1 = Address::generate(&env);
        let issuer2 = Address::generate(&env);
        let subject = Address::generate(&env);
        
        let event_data = Bytes::from_slice(&env, b"test event data");
        let metadata = Map::new(&env);
        
        let request = ProofRequest {
            subject,
            proof_type: String::from_slice(&env, "identity"),
            event_data,
            metadata,
        };
        
        // Issue proofs for both issuers
        client.issue_proof(&issuer1, &request);
        client.issue_proof(&issuer2, &request);
        client.issue_proof(&issuer1, &request);
        
        let proofs_issuer1 = client.get_proofs_by_issuer(&issuer1);
        assert_eq!(proofs_issuer1.len(), 2);
        
        let proofs_issuer2 = client.get_proofs_by_issuer(&issuer2);
        assert_eq!(proofs_issuer2.len(), 1);
    }

    #[test]
    fn test_get_proofs_by_subject() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ProofVerifier);
        let client = ProofVerifierClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        client.initialize(&admin);
        
        let issuer = Address::generate(&env);
        let subject1 = Address::generate(&env);
        let subject2 = Address::generate(&env);
        
        let event_data = Bytes::from_slice(&env, b"test event data");
        let metadata = Map::new(&env);
        
        let request1 = ProofRequest {
            subject: subject1,
            proof_type: String::from_slice(&env, "identity"),
            event_data: event_data.clone(),
            metadata: metadata.clone(),
        };
        
        let request2 = ProofRequest {
            subject: subject2,
            proof_type: String::from_slice(&env, "credential"),
            event_data,
            metadata,
        };
        
        // Issue proofs for both subjects
        client.issue_proof(&issuer, &request1);
        client.issue_proof(&issuer, &request2);
        client.issue_proof(&issuer, &request1);
        
        let proofs_subject1 = client.get_proofs_by_subject(&subject1);
        assert_eq!(proofs_subject1.len(), 2);
        
        let proofs_subject2 = client.get_proofs_by_subject(&subject2);
        assert_eq!(proofs_subject2.len(), 1);
    }

    #[test]
    fn test_is_proof_valid() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ProofVerifier);
        let client = ProofVerifierClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        client.initialize(&admin);
        
        let issuer = Address::generate(&env);
        let subject = Address::generate(&env);
        
        let event_data = Bytes::from_slice(&env, b"test event data");
        let metadata = Map::new(&env);
        
        let request = ProofRequest {
            subject,
            proof_type: String::from_slice(&env, "identity"),
            event_data,
            metadata,
        };
        
        let proof_id = client.issue_proof(&issuer, &request);
        
        // Proof should be valid initially
        assert!(client.is_proof_valid(&proof_id));
        
        // Revoke proof
        let reason = String::from_slice(&env, "Test revocation");
        client.revoke_proof(&admin, &proof_id, reason);
        
        // Proof should no longer be valid
        assert!(!client.is_proof_valid(&proof_id));
    }

    #[test]
    fn test_update_admin() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ProofVerifier);
        let client = ProofVerifierClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        client.initialize(&admin);
        
        let new_admin = Address::generate(&env);
        client.update_admin(&admin, &new_admin);
        
        let stored_admin = client.get_admin();
        assert_eq!(stored_admin, new_admin);
    }

    #[test]
    fn test_update_admin_unauthorized_fails() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ProofVerifier);
        let client = ProofVerifierClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        client.initialize(&admin);
        
        let unauthorized = Address::generate(&env);
        let new_admin = Address::generate(&env);
        
        let result = std::panic::catch_unwind(|| {
            client.update_admin(&unauthorized, &new_admin);
        });
        assert!(result.is_err());
    }

    #[test]
    fn test_proof_hash_integrity() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ProofVerifier);
        let client = ProofVerifierClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        client.initialize(&admin);
        
        let issuer = Address::generate(&env);
        let subject = Address::generate(&env);
        
        let event_data = Bytes::from_slice(&env, b"test event data");
        let mut metadata = Map::new(&env);
        metadata.set(symbol_short!("key1"), String::from_slice(&env, "value1"));
        metadata.set(symbol_short!("key2"), String::from_slice(&env, "value2"));
        
        let request = ProofRequest {
            subject,
            proof_type: String::from_slice(&env, "identity"),
            event_data,
            metadata,
        };
        
        let proof_id = client.issue_proof(&issuer, &request);
        let proof = client.get_proof(&proof_id);
        
        // Verify that hash is computed correctly
        let mut hash_input = proof.event_data.clone();
        for (key, value) in proof.metadata.iter() {
            hash_input.append(&Bytes::from_slice(&env, key.to_string().as_bytes()));
            hash_input.append(&Bytes::from_slice(&env, value.as_bytes()));
        }
        let computed_hash = env.crypto().sha256(&hash_input);
        
        assert_eq!(proof.hash, computed_hash);
    }

    #[test]
    fn test_edge_cases() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ProofVerifier);
        let client = ProofVerifierClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        client.initialize(&admin);
        
        // Test getting non-existent proof
        let result = std::panic::catch_unwind(|| {
            client.get_proof(&999);
        });
        assert!(result.is_err());
        
        // Test verifying non-existent proof
        let result = std::panic::catch_unwind(|| {
            client.verify_proof(&admin, &999);
        });
        assert!(result.is_err());
        
        // Test revoking non-existent proof
        let result = std::panic::catch_unwind(|| {
            client.revoke_proof(&admin, &999, String::from_slice(&env, "test"));
        });
        assert!(result.is_err());
    }
}
