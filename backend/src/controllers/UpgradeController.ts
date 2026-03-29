import { Request, Response } from 'express';
import { UpgradeService } from '../services/contracts/UpgradeService';
import { ContractUpgrade } from '../models/ContractUpgrade';

export class UpgradeController {
  static async schedule(req: Request, res: Response) {
    try {
      const { contractName, contractAddress, contractPath, initiatedBy } = req.body;
      const upgrade = await UpgradeService.scheduleUpgrade(contractName, contractAddress, contractPath, initiatedBy);
      res.status(201).json({ success: true, data: upgrade });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async execute(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await UpgradeService.executeUpgrade(id);
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async history(req: Request, res: Response) {
    try {
      const { address } = req.query;
      const query = address ? { contractAddress: address } : {};
      const upgrades = await ContractUpgrade.find(query).sort({ createdAt: -1 });
      res.status(200).json({ success: true, data: upgrades });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

export default UpgradeController;