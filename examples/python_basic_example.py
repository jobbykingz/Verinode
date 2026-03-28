"""
Basic example demonstrating Verinode Python SDK usage.
"""

import asyncio
import sys
import os

# Add the SDK to the path for development
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'sdks', 'python', 'src'))

from verinode import Verinode, VerinodeConfig


async def basic_example():
    """Basic example of using the Verinode SDK."""
    
    # Initialize SDK with configuration
    config = VerinodeConfig(
        api_endpoint="https://api.verinode.com",
        network="testnet",
        logging_enabled=True,
        log_level="INFO"
    )
    
    client = Verinode(config)
    
    try:
        print("🚀 Starting Verinode Python SDK Example")
        print("=" * 50)
        
        # Check if SDK is ready
        if not client.is_ready():
            print("❌ SDK configuration is invalid")
            return
        
        print("✅ SDK initialized successfully")
        
        # Authenticate (using demo credentials - replace with real ones)
        try:
            print("\n🔐 Authenticating...")
            await client.authenticate("demo@example.com", "demo-password")
            print(f"✅ Authenticated as: {client.current_user.email if client.current_user else 'Unknown'}")
        except Exception as e:
            print(f"⚠️  Authentication failed (expected in demo): {e}")
            print("Continuing with unauthenticated operations...")
        
        # Example 1: Create a proof
        print("\n📄 Creating a proof...")
        try:
            proof_request = {
                "title": "Example Document Verification",
                "description": "This is an example proof created with the Python SDK",
                "metadata": {
                    "document_type": "identity",
                    "created_by": "python-sdk-example"
                },
                "tags": ["example", "python", "sdk"]
            }
            
            proof = await client.proof.create(proof_request)
            print(f"✅ Proof created with ID: {proof.id}")
            print(f"   Title: {proof.title}")
            print(f"   Status: {proof.status}")
            
            proof_id = proof.id
            
        except Exception as e:
            print(f"⚠️  Proof creation failed: {e}")
            proof_id = "demo-proof-id"
        
        # Example 2: List proofs
        print("\n📋 Listing proofs...")
        try:
            proofs_response = await client.proof.list(
                status="pending",
                options={"page": 1, "page_size": 5}
            )
            print(f"✅ Found {len(proofs_response.items)} proofs")
            for proof in proofs_response.items:
                print(f"   - {proof.title} ({proof.status})")
        except Exception as e:
            print(f"⚠️  Proof listing failed: {e}")
        
        # Example 3: Search proofs
        print("\n🔍 Searching proofs...")
        try:
            search_results = await client.proof.search("example")
            print(f"✅ Found {len(search_results.items)} matching proofs")
        except Exception as e:
            print(f"⚠️  Search failed: {e}")
        
        # Example 4: Wallet operations
        print("\n💳 Wallet operations...")
        try:
            # Connect a demo wallet
            wallet_request = {
                "wallet_type": "stellar",
                "network": "testnet"
            }
            
            wallet = await client.wallet.connect(wallet_request)
            print(f"✅ Wallet connected: {wallet.id}")
            print(f"   Type: {wallet.wallet_type}")
            print(f"   Network: {wallet.network}")
            
            # Get balance
            balance = await client.wallet.get_balance(wallet.id)
            print(f"   Balance: {balance}")
            
        except Exception as e:
            print(f"⚠️  Wallet operations failed: {e}")
        
        # Example 5: Verification operations
        print("\n✅ Verification operations...")
        try:
            if proof_id != "demo-proof-id":
                # Create a verification
                verification_request = {
                    "proof_id": proof_id,
                    "status": "approved",
                    "comment": "Automated verification example",
                    "evidence": {
                        "method": "automated",
                        "confidence": 0.95
                    }
                }
                
                verification = await client.verification.create(verification_request)
                print(f"✅ Verification created: {verification.id}")
                
                # Get verification statistics
                stats = await client.verification.get_statistics()
                print(f"   Total verifications: {stats.get('total', 0)}")
            else:
                print("⚠️  Skipping verification - no valid proof ID")
                
        except Exception as e:
            print(f"⚠️  Verification operations failed: {e}")
        
        # Example 6: Real-time subscription
        print("\n📡 Setting up real-time subscription...")
        try:
            async def handle_update(data):
                print(f"📨 Received update: {data.get('type', 'unknown')}")
            
            subscription_id = await client.subscribe_to_updates({
                "event_types": ["proof_updated", "verification_created"]
            })
            print(f"✅ Subscription created: {subscription_id}")
            
            # Simulate some time to receive updates
            await asyncio.sleep(2)
            
        except Exception as e:
            print(f"⚠️  Subscription setup failed: {e}")
        
        print("\n🎉 Example completed successfully!")
        
    except Exception as e:
        print(f"❌ Example failed: {e}")
    
    finally:
        # Cleanup
        print("\n🧹 Cleaning up...")
        try:
            await client.logout()
        except:
            pass


if __name__ == "__main__":
    print("Verinode Python SDK - Basic Example")
    print("====================================")
    
    # Run the example
    asyncio.run(basic_example())
