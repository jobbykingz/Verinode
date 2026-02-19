export interface BillingUsage {
    proofsGenerated: number;
    storageUsedGB: number;
    apiCalls: number;
    estimatedCost: number;
}

export class BillingService {
    static async getUsage(enterpriseId: string): Promise<BillingUsage> {
        // Mock logic for usage calculation
        return {
            proofsGenerated: 1250,
            storageUsedGB: 4.5,
            apiCalls: 15400,
            estimatedCost: 299.00
        };
    }

    static async getInvoices(enterpriseId: string): Promise<any[]> {
        return [
            { id: 'inv_123', date: '2023-10-01', amount: 299.00, status: 'paid' },
            { id: 'inv_124', date: '2023-09-01', amount: 299.00, status: 'paid' }
        ];
    }
}