export enum ProofStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected'
}

export interface User {
  id: string;
  email: string;
  username: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Proof {
  id: string;
  userId: string;
  title: string;
  description: string;
  status: ProofStatus;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface AuthPayload {
  token: string;
  user: User;
}

export interface GraphQLContext {
  user?: User;
  req: any;
  res: any;
}
