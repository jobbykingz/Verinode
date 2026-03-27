import { TeamMember } from '../models/TeamMember';

// Mock storage for team members
let members: TeamMember[] = [];

export class RoleService {
    static async addMember(enterpriseId: string, user: { id: string, name: string, email: string }, role: 'admin' | 'editor' | 'viewer'): Promise<TeamMember> {
        const member: TeamMember = {
            id: Math.random().toString(36).substr(2, 9),
            enterpriseId,
            userId: user.id,
            name: user.name,
            email: user.email,
            role,
            joinedAt: new Date().toISOString()
        };
        members.push(member);
        return member;
    }

    static async getMembers(enterpriseId: string): Promise<TeamMember[]> {
        return members.filter(m => m.enterpriseId === enterpriseId);
    }

    static async updateRole(memberId: string, newRole: 'admin' | 'editor' | 'viewer'): Promise<TeamMember | undefined> {
        const member = members.find(m => m.id === memberId);
        if (member) {
            member.role = newRole;
        }
        return member;
    }

    static async removeMember(memberId: string): Promise<boolean> {
        const initialLength = members.length;
        members = members.filter(m => m.id !== memberId);
        return members.length < initialLength;
    }
}