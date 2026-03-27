#![cfg(test)]
use soroban_sdk::{testutils::{Address as _, Ledger as _}, Address, Bytes, Env};
use crate::crossChainBridge::{CrossChainBridge, BridgeDataKey, ChainConfig, CrossChainProof, BridgeMessage};

#[test]
fn test_initialize() {
    let env = Env::default();
    let admin = Address::generate(&env);
    
    let contract = CrossChainBridge::new(&env);
    contract.initialize(&admin);
    
    assert_eq!(contract.get_admin(), admin);
    assert_eq!(contract.get_proof_count(), 0);
    assert_eq!(contract.get_message_count(), 0);
    
    let supported_chains = contract.get_supported_chains();
    assert_eq!(supported_chains.len(), 3);
    assert!(supported_chains.contains(&1u32)); // Ethereum
    assert!(supported_chains.contains(&137u32)); // Polygon
    assert!(supported_chains.contains(&56u32)); // BSC
}

#[test]
fn test_add_chain_config() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let contract = CrossChainBridge::new(&env);
    contract.initialize(&admin);
    
    let chain_config = ChainConfig {
        chain_id: 42161,
        chain_name: String::from_str(&env, "Arbitrum"),
        bridge_address: Address::generate(&env),
        gas_price: 10000000000,
        block_time: 250,
    };
    
    contract.add_chain_config(&admin, &chain_config);
    
    let retrieved_config = contract.get_chain_config(&42161).unwrap();
    assert_eq!(retrieved_config.chain_id, 42161);
    assert_eq!(retrieved_config.chain_name, String::from_str(&env, "Arbitrum"));
    assert_eq!(retrieved_config.gas_price, 10000000000);
}

#[test]
fn test_submit_cross_chain_proof() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let submitter = Address::generate(&env);
    let contract = CrossChainBridge::new(&env);
    contract.initialize(&admin);
    
    let proof_data = Bytes::from_slice(&env, b"test proof data");
    let proof_id = contract.submit_cross_chain_proof(&1, &137, &proof_data, &submitter);
    
    assert_eq!(proof_id, 1);
    assert_eq!(contract.get_proof_count(), 1);
    
    let proof = contract.get_cross_chain_proof(&proof_id);
    assert_eq!(proof.proof_id, proof_id);
    assert_eq!(proof.source_chain, 1);
    assert_eq!(proof.target_chain, 137);
    assert_eq!(proof.proof_data, proof_data);
    assert!(!proof.source_verification);
    assert!(!proof.target_verification);
}

#[test]
fn test_verify_source_proof() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let submitter = Address::generate(&env);
    let contract = CrossChainBridge::new(&env);
    contract.initialize(&admin);
    
    let proof_data = Bytes::from_slice(&env, b"test proof data");
    let proof_id = contract.submit_cross_chain_proof(&1, &137, &proof_data, &submitter);
    
    let verified = contract.verify_source_proof(&admin, &proof_id);
    assert!(verified);
    
    let proof = contract.get_cross_chain_proof(&proof_id);
    assert!(proof.source_verification);
    assert!(!proof.target_verification);
}

#[test]
fn test_verify_target_proof() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let submitter = Address::generate(&env);
    let contract = CrossChainBridge::new(&env);
    contract.initialize(&admin);
    
    let proof_data = Bytes::from_slice(&env, b"test proof data");
    let proof_id = contract.submit_cross_chain_proof(&1, &137, &proof_data, &submitter);
    
    // Verify source first
    contract.verify_source_proof(&admin, &proof_id);
    
    // Then verify target
    let verified = contract.verify_target_proof(&admin, &proof_id);
    assert!(verified);
    
    let proof = contract.get_cross_chain_proof(&proof_id);
    assert!(proof.source_verification);
    assert!(proof.target_verification);
}

#[test]
#[should_panic(expected = "Source proof must be verified first")]
fn test_verify_target_proof_without_source() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let submitter = Address::generate(&env);
    let contract = CrossChainBridge::new(&env);
    contract.initialize(&admin);
    
    let proof_data = Bytes::from_slice(&env, b"test proof data");
    let proof_id = contract.submit_cross_chain_proof(&1, &137, &proof_data, &submitter);
    
    // Try to verify target without source verification
    contract.verify_target_proof(&admin, &proof_id);
}

#[test]
fn test_send_bridge_message() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let contract = CrossChainBridge::new(&env);
    contract.initialize(&admin);
    
    let data = Bytes::from_slice(&env, b"test message data");
    let signature = Bytes::from_slice(&env, b"test signature");
    let message_id = contract.send_bridge_message(&1, &137, &recipient, &data, &sender, &signature);
    
    assert_eq!(message_id, 1);
    assert_eq!(contract.get_message_count(), 1);
    
    let message = contract.get_bridge_message(&message_id);
    assert_eq!(message.message_id, message_id);
    assert_eq!(message.source_chain, 1);
    assert_eq!(message.target_chain, 137);
    assert_eq!(message.sender, sender);
    assert_eq!(message.recipient, recipient);
    assert_eq!(message.data, data);
}

#[test]
fn test_unsupported_chain() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let submitter = Address::generate(&env);
    let contract = CrossChainBridge::new(&env);
    contract.initialize(&admin);
    
    let proof_data = Bytes::from_slice(&env, b"test proof data");
    
    // Try to submit proof for unsupported chain
    let result = std::panic::catch_unwind(|| {
        contract.submit_cross_chain_proof(&1, &999, &proof_data, &submitter);
    });
    
    assert!(result.is_err());
}

#[test]
fn test_unauthorized_access() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let unauthorized = Address::generate(&env);
    let contract = CrossChainBridge::new(&env);
    contract.initialize(&admin);
    
    let proof_data = Bytes::from_slice(&env, b"test proof data");
    let proof_id = contract.submit_cross_chain_proof(&1, &137, &proof_data, &admin);
    
    // Try to verify proof with unauthorized address
    let result = std::panic::catch_unwind(|| {
        contract.verify_source_proof(&unauthorized, &proof_id);
    });
    
    assert!(result.is_err());
}

#[test]
fn test_multiple_proofs() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let submitter = Address::generate(&env);
    let contract = CrossChainBridge::new(&env);
    contract.initialize(&admin);
    
    // Submit multiple proofs
    let proof_data1 = Bytes::from_slice(&env, b"proof data 1");
    let proof_data2 = Bytes::from_slice(&env, b"proof data 2");
    let proof_data3 = Bytes::from_slice(&env, b"proof data 3");
    
    let proof_id1 = contract.submit_cross_chain_proof(&1, &137, &proof_data1, &submitter);
    let proof_id2 = contract.submit_cross_chain_proof(&137, &56, &proof_data2, &submitter);
    let proof_id3 = contract.submit_cross_chain_proof(&56, &1, &proof_data3, &submitter);
    
    assert_eq!(proof_id1, 1);
    assert_eq!(proof_id2, 2);
    assert_eq!(proof_id3, 3);
    assert_eq!(contract.get_proof_count(), 3);
    
    // Verify each proof
    assert!(contract.verify_source_proof(&admin, &proof_id1));
    assert!(contract.verify_source_proof(&admin, &proof_id2));
    assert!(contract.verify_source_proof(&admin, &proof_id3));
    
    // Check proof details
    let proof1 = contract.get_cross_chain_proof(&proof_id1);
    assert_eq!(proof1.source_chain, 1);
    assert_eq!(proof1.target_chain, 137);
    
    let proof2 = contract.get_cross_chain_proof(&proof_id2);
    assert_eq!(proof2.source_chain, 137);
    assert_eq!(proof2.target_chain, 56);
    
    let proof3 = contract.get_cross_chain_proof(&proof_id3);
    assert_eq!(proof3.source_chain, 56);
    assert_eq!(proof3.target_chain, 1);
}

#[test]
fn test_message_nonce_increment() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let contract = CrossChainBridge::new(&env);
    contract.initialize(&admin);
    
    let data = Bytes::from_slice(&env, b"test message data");
    let signature = Bytes::from_slice(&env, b"test signature");
    
    // Send multiple messages
    let message_id1 = contract.send_bridge_message(&1, &137, &recipient, &data, &sender, &signature);
    let message_id2 = contract.send_bridge_message(&1, &137, &recipient, &data, &sender, &signature);
    let message_id3 = contract.send_bridge_message(&1, &137, &recipient, &data, &sender, &signature);
    
    assert_eq!(message_id1, 1);
    assert_eq!(message_id2, 2);
    assert_eq!(message_id3, 3);
    
    // Check nonce values
    let message1 = contract.get_bridge_message(&message_id1);
    let message2 = contract.get_bridge_message(&message_id2);
    let message3 = contract.get_bridge_message(&message_id3);
    
    assert_eq!(message1.nonce, 0);
    assert_eq!(message2.nonce, 1);
    assert_eq!(message3.nonce, 2);
}

#[test]
fn test_timestamp_functionality() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let submitter = Address::generate(&env);
    let contract = CrossChainBridge::new(&env);
    contract.initialize(&admin);
    
    // Set a specific timestamp
    env.ledger().set_timestamp(1234567890);
    
    let proof_data = Bytes::from_slice(&env, b"test proof data");
    let proof_id = contract.submit_cross_chain_proof(&1, &137, &proof_data, &submitter);
    
    let proof = contract.get_cross_chain_proof(&proof_id);
    assert_eq!(proof.timestamp, 1234567890);
    
    // Test message timestamp
    let recipient = Address::generate(&env);
    let data = Bytes::from_slice(&env, b"test message data");
    let signature = Bytes::from_slice(&env, b"test signature");
    
    env.ledger().set_timestamp(1234567900);
    let message_id = contract.send_bridge_message(&1, &137, &recipient, &data, &submitter, &signature);
    
    let message = contract.get_bridge_message(&message_id);
    assert_eq!(message.timestamp, 1234567900);
}
