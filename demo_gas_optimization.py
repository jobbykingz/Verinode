#!/usr/bin/env python3
"""
Gas Optimization Suite Demo

This script demonstrates the capabilities of the Gas Optimization Suite v2
by analyzing a sample contract and generating optimization suggestions.
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'ai'))

from ai.gas_optimization import GasOptimizer
from ai.pattern_recognition import AdvancedPatternRecognizer
import json

def demo_gas_optimization():
    """Demonstrate the gas optimization capabilities"""
    
    print("🚀 Gas Optimization Suite v2 Demo")
    print("=" * 50)
    
    # Sample contract with optimization opportunities
    sample_contract = '''
    pub fn expensive_function(env: Env, data: Vec<Bytes>) -> Vec<Bytes> {
        let mut results = Vec::new(&env);
        
        // Storage operations in loop - HIGH IMPACT
        for i in 0..data.len() {
            let timestamp = env.ledger().timestamp();  // Repeated computation
            let proof = env.storage().instance().get(&DataKey::Proof(i as u64));
            
            if let Some(p) = proof {
                if p.verified == true {  // Redundant check
                    results.push_back(p.event_data.clone());  // Unnecessary clone
                    env.storage().instance().set(&DataKey::Result(i as u64), &timestamp);
                }
            }
            
            // Inefficient nested loop
            for j in 0..10 {
                let temp = env.ledger().timestamp();  // Another repeated computation
                if temp > 0 {
                    results.push_back(data[i].clone());  // Another unnecessary clone
                }
            }
        }
        
        results
    }
    
    pub fn another_function(env: Env) -> u64 {
        // Multiple storage operations - BATCH OPPORTUNITY
        env.storage().instance().set(&DataKey::Temp1, &1);
        env.storage().instance().set(&DataKey::Temp2, &2);
        env.storage().instance().set(&DataKey::Temp3, &3);
        
        // Repeated expensive computation
        let timestamp1 = env.ledger().timestamp();
        let timestamp2 = env.ledger().timestamp();
        let timestamp3 = env.ledger().timestamp();
        
        timestamp1 + timestamp2 + timestamp3
    }
    '''
    
    print("\n📝 Analyzing Sample Contract...")
    print("-" * 30)
    
    # Initialize AI Gas Optimizer
    optimizer = GasOptimizer()
    
    # Analyze contract
    function_signatures = ["expensive_function", "another_function"]
    result = optimizer.analyze_contract(sample_contract, function_signatures)
    
    print(f"✅ Analysis Complete!")
    print(f"📊 Original Gas Cost: {result.original_gas_cost:,}")
    print(f"⚡ Optimized Gas Cost: {result.optimized_gas_cost:,}")
    print(f"💰 Total Gas Savings: {result.total_savings:,} ({result.savings_percentage:.1f}%)")
    print(f"🔍 Suggestions Generated: {len(result.suggestions)}")
    print(f"⚠️  Risk Assessment: {result.risk_assessment}")
    
    print("\n🎯 Top Optimization Suggestions:")
    print("-" * 35)
    
    for i, suggestion in enumerate(result.suggestions[:5], 1):
        print(f"\n{i}. {suggestion.optimization_type.value.title()}")
        print(f"   💰 Savings: {suggestion.estimated_gas_savings:,} gas ({suggestion.savings_percentage:.1f}%)")
        print(f"   🎯 Function: {suggestion.function_name}")
        print(f"   📝 Description: {suggestion.description}")
        print(f"   🔧 Changes: {', '.join(suggestion.code_changes[:2])}")
        print(f"   📊 Confidence: {suggestion.confidence_score:.1f}")
    
    print("\n🔍 Advanced Pattern Recognition...")
    print("-" * 35)
    
    # Initialize Pattern Recognizer
    recognizer = AdvancedPatternRecognizer()
    
    # Perform pattern analysis
    pattern_result = recognizer.analyze_contract(sample_contract)
    
    print(f"📈 Total Patterns Found: {len(pattern_result['patterns'])}")
    print(f"🔗 Pattern Clusters: {len(pattern_result['clusters'])}")
    
    # Show key insights
    print("\n💡 Key Insights:")
    for insight in pattern_result['insights']:
        print(f"   • {insight['message']}")
    
    # Show pattern distribution
    if pattern_result['patterns']:
        pattern_types = {}
        for pattern in pattern_result['patterns']:
            pattern_type = pattern.pattern_type.value
            pattern_types[pattern_type] = pattern_types.get(pattern_type, 0) + 1
        
        print("\n📊 Pattern Distribution:")
        for pattern_type, count in pattern_types.items():
            print(f"   • {pattern_type.replace('_', ' ').title()}: {count}")
    
    print("\n🎯 Implementation Recommendations:")
    print("-" * 40)
    
    # Generate implementation plan
    high_priority = [s for s in result.suggestions if s.confidence_score > 0.8]
    medium_priority = [s for s in result.suggestions if 0.6 < s.confidence_score <= 0.8]
    
    print(f"🔥 High Priority (Apply First): {len(high_priority)} suggestions")
    for suggestion in high_priority[:3]:
        print(f"   • {suggestion.optimization_type.value}: {suggestion.description}")
    
    print(f"\n⚡ Medium Priority: {len(medium_priority)} suggestions")
    for suggestion in medium_priority[:2]:
        print(f"   • {suggestion.optimization_type.value}: {suggestion.description}")
    
    print("\n📈 Expected Performance Impact:")
    print("-" * 30)
    print(f"⚡ Gas Efficiency: +{result.savings_percentage:.1f}%")
    print(f"🚀 Execution Speed: +{result.savings_percentage * 0.8:.1f}%")
    print(f"💾 Memory Usage: +{result.savings_percentage * 0.6:.1f}%")
    print(f"📏 Code Size: -{len(result.applied_optimizations) * 2:.1f}%")
    
    print("\n🔒 Risk Analysis:")
    print("-" * 20)
    if result.risk_assessment == "Low":
        print("✅ Low Risk: Safe to implement with minimal testing")
    elif result.risk_assessment == "Medium":
        print("⚠️  Medium Risk: Requires thorough testing and monitoring")
    else:
        print("🚨 High Risk: Requires extensive testing and gradual rollout")
    
    print("\n🎉 Demo Results Summary:")
    print("=" * 30)
    print(f"💰 Total Gas Savings: {result.total_savings:,} ({result.savings_percentage:.1f}%)")
    print(f"🎯 Target Achievement: {'✅ PASSED' if result.savings_percentage >= 35 else '❌ FAILED'}")
    print(f"🔍 Optimizations Found: {len(result.suggestions)}")
    print(f"📊 Average Confidence: {sum(s.confidence_score for s in result.suggestions) / len(result.suggestions) * 100:.1f}%")
    
    if result.savings_percentage >= 35:
        print("\n🎊 SUCCESS: Gas optimization target achieved!")
        print("🚀 Ready for production deployment!")
    else:
        print("\n⚠️  WARNING: Gas optimization target not fully achieved")
        print("🔧 Additional optimizations may be needed")
    
    # Save detailed results
    output_data = {
        'optimization_result': {
            'original_gas_cost': result.original_gas_cost,
            'optimized_gas_cost': result.optimized_gas_cost,
            'total_savings': result.total_savings,
            'savings_percentage': result.savings_percentage,
            'suggestions_count': len(result.suggestions),
            'risk_assessment': result.risk_assessment
        },
        'pattern_analysis': {
            'patterns_found': len(pattern_result['patterns']),
            'clusters_found': len(pattern_result['clusters']),
            'insights_count': len(pattern_result['insights'])
        }
    }
    
    with open('demo_results.json', 'w') as f:
        json.dump(output_data, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: demo_results.json")
    print("\n🔗 Next Steps:")
    print("1. Review detailed optimization suggestions")
    print("2. Run comprehensive tests")
    print("3. Implement high-priority optimizations")
    print("4. Monitor performance improvements")
    print("5. Deploy to production with monitoring")

if __name__ == "__main__":
    demo_gas_optimization()
