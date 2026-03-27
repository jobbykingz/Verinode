import mongoose, { Schema, Document } from 'mongoose';

export interface IComment extends Document {
  proofId: string;
  authorId: string;
  authorName: string;
  content: string;
  parentId?: string; // For threading
  resolved: boolean;
  position?: {
    fieldId: string;
    line?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema: Schema = new Schema({
  proofId: { type: String, required: true, index: true },
  authorId: { type: String, required: true },
  authorName: { type: String, required: true },
  content: { type: String, required: true },
  parentId: { type: Schema.Types.ObjectId, ref: 'Comment' },
  resolved: { type: Boolean, default: false },
  position: {
    fieldId: String,
    line: Number
  }
}, {
  timestamps: true
});

CommentSchema.index({ proofId: 1, parentId: 1 });

export const Comment = mongoose.model<IComment>('Comment', CommentSchema);
export default Comment;