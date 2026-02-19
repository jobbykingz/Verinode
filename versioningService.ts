import { ProofVersion } from '../models/ProofVersion';

// Mock storage for versions
let versions: ProofVersion[] = [];

export class VersioningService {
    static async createVersion(proofId: number, data: any, author: string, message: string, branch: string = 'main', previousVersionId?: number): Promise<ProofVersion> {
        const currentVersions = versions.filter(v => v.proofId === proofId);
        
        // Conflict Detection: Ensure we are building on the latest version of the branch
        if (previousVersionId) {
            const branchVersions = currentVersions.filter(v => v.branch === branch);
            const latestInBranch = branchVersions.sort((a, b) => b.versionNumber - a.versionNumber)[0];
            if (latestInBranch && latestInBranch.id !== previousVersionId) {
                throw new Error('Merge conflict: The branch has been updated since you last retrieved it.');
            }
        }

        const nextVersion = currentVersions.length + 1;

        const newVersion: ProofVersion = {
            id: versions.length + 1,
            proofId,
            versionNumber: nextVersion,
            eventData: data.eventData,
            hash: data.hash,
            timestamp: new Date().toISOString(),
            author,
            commitMessage: message,
            branch
        };

        versions.push(newVersion);
        return newVersion;
    }

    static async getHistory(proofId: number): Promise<ProofVersion[]> {
        return versions
            .filter(v => v.proofId === proofId)
            .sort((a, b) => b.versionNumber - a.versionNumber);
    }

    static async getVersion(proofId: number, versionNumber: number): Promise<ProofVersion | undefined> {
        return versions.find(v => v.proofId === proofId && v.versionNumber === versionNumber);
    }
    
    static async rollback(proofId: number, targetVersion: number, author: string): Promise<ProofVersion> {
        const target = await this.getVersion(proofId, targetVersion);
        if (!target) throw new Error('Version not found');
        
        // Create a new version that is a copy of the target
        return this.createVersion(
            proofId, 
            { eventData: target.eventData, hash: target.hash }, 
            author, 
            `Rollback to version ${targetVersion}`,
            target.branch // Maintain the branch of the target version
        );
    }
}