export interface Enterprise {
    id: string;
    name: string;
    plan: 'starter' | 'growth' | 'enterprise';
    billingEmail: string;
    createdAt: string;
}