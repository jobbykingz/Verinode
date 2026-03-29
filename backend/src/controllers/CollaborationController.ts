import { Request, Response } from 'express';
import { CollaborationService } from '../services/collaboration/CollaborationService';

export class CollaborationController {
  static async getSession(req: Request, res: Response) {
    try {
      const { proofId } = req.params;
      const session = await CollaborationService.getOrCreateSession(proofId);
      res.status(200).json({ success: true, data: session });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getComments(req: Request, res: Response) {
    try {
      const { proofId } = req.params;
      const comments = await CollaborationService.getComments(proofId);
      res.status(200).json({ success: true, data: comments });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async addComment(req: Request, res: Response) {
    try {
      const { proofId } = req.params;
      const { authorId, authorName, content, parentId } = req.body;
      
      const comment = await CollaborationService.addComment({
        proofId, authorId, authorName, content, parentId
      });
      
      res.status(201).json({ success: true, data: comment });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

export default CollaborationController;