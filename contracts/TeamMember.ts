export interface TeamMember {
    id: string;
    enterpriseId: string;
    userId: string;
    name: string;
    email: string;
    role: 'admin' | 'editor' | 'viewer';
    joinedAt: string;
}