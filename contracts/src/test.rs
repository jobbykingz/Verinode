#[cfg(test)]
mod tests {
    use soroban_sdk::{Address, Bytes, Env};
    use crate::{VerinodeContract, VerinodeContractClient};

    #[test]
    fn test_initialize() {
        let env = Env::default();
        let contract_id = env.register_contract(None, VerinodeContract);
        let client = VerinodeContractClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        client.initialize(&admin);
        
        // Test that admin is set
        let stored_admin = client.get_admin();
        assert_eq!(admin, stored_admin);
    }

    #[test]
    fn test_issue_proof() {
        let env = Env::default();
        let contract_id = env.register_contract(None, VerinodeContract);
        let client = VerinodeContractClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        client.initialize(&admin);
        
        let issuer = Address::generate(&env);
        let event_data = Bytes::from_slice(&env, b"test event data");
        let hash = Bytes::from_slice(&env, b"test hash");
        
        let proof_id = client.issue_proof(&issuer, &event_data, &hash);
        assert_eq!(proof_id, 1);
        
        let proof = client.get_proof(&proof_id);
        assert_eq!(proof.id, proof_id);
        assert_eq!(proof.issuer, issuer);
        assert!(!proof.verified);
    }

    #[test]
    fn test_verify_proof() {
        let env = Env::default();
        let contract_id = env.register_contract(None, VerinodeContract);
        let client = VerinodeContractClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        client.initialize(&admin);
        
        let issuer = Address::generate(&env);
        let event_data = Bytes::from_slice(&env, b"test event data");
        let hash = Bytes::from_slice(&env, b"test hash");
        
        let proof_id = client.issue_proof(&issuer, &event_data, &hash);
        
        // Verify proof
        let result = client.verify_proof(&admin, &proof_id);
        assert!(result);
        
        let proof = client.get_proof(&proof_id);
        assert!(proof.verified);
    }

    #[test]
    fn test_get_proofs_by_issuer() {
        let env = Env::default();
        let contract_id = env.register_contract(None, VerinodeContract);
        let client = VerinodeContractClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        client.initialize(&admin);
        
        let issuer1 = Address::generate(&env);
        let issuer2 = Address::generate(&env);
        
        let event_data = Bytes::from_slice(&env, b"test event data");
        let hash = Bytes::from_slice(&env, b"test hash");
        
        // Issue proofs for both issuers
        client.issue_proof(&issuer1, &event_data, &hash);
        client.issue_proof(&issuer2, &event_data, &hash);
        client.issue_proof(&issuer1, &event_data, &hash);
        
        let proofs_issuer1 = client.get_proofs_by_issuer(&issuer1);
        assert_eq!(proofs_issuer1.len(), 2);
        
        let proofs_issuer2 = client.get_proofs_by_issuer(&issuer2);
        assert_eq!(proofs_issuer2.len(), 1);
    }
}
