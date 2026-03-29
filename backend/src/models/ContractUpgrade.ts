import mongoose, { Schema, Document } from 'mongoose';

export interface IContractUpgrade extends Document {
  contractName: string;
  contractAddress: string;
  oldWasmHash: string;
  newWasmHash: string;
  status: 'PENDING' | 'VALIDATING' | 'SUCCESS' | 'FAILED' | 'ROLLED_BACK';
  scheduledFor?: Date;
  executedAt?: Date;
  initiatedBy: string;
  auditLogs: string[];
}

const ContractUpgradeSchema: Schema = new Schema({
  contractName: { type: String, required: true },
  contractAddress: { type: String, required: true },
  oldWasmHash: { type: String, required: true },
  newWasmHash: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['PENDING', 'VALIDATING', 'SUCCESS', 'FAILED', 'ROLLED_BACK'], 
    default: 'PENDING' 
  },
  scheduledFor: { type: Date },
  executedAt: { type: Date },
  initiatedBy: { type: String, required: true },
  auditLogs: [{ type: String }]
}, {
  timestamps: true
});

// Add index for quick queries on contract upgrades
ContractUpgradeSchema.index({ contractAddress: 1, status: 1 });

export const ContractUpgrade = mongoose.model<IContractUpgrade>(
  'ContractUpgrade', 
  ContractUpgradeSchema
);

export default ContractUpgrade;