export interface ProofVersion {
    id: number;
    proofId: number;
    versionNumber: number;
    eventData: string;
    hash: string;
    timestamp: string;
    author: string;
    commitMessage: string;
    branch: string;
}