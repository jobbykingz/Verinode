export interface ChangeLog {
    id: number;
    proofId: number;
    versionId: number;
    action: 'CREATE' | 'UPDATE' | 'ROLLBACK';
    timestamp: string;
    actor: string;
    details: string;
}