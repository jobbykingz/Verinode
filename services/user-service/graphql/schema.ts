import { gql } from 'apollo-server';

export const typeDefs = gql`
  extend type Query {
    me: User
    user(id: ID!): User
    users(filter: UserFilter, limit: Int, offset: Int): UserConnection
  }

  extend type Mutation {
    updateUser(input: UpdateUserInput!): User
    deleteUser(id: ID!): Boolean
  }

  type User @key(fields: "id") {
    id: ID!
    email: String!
    username: String!
    firstName: String
    lastName: String
    avatar: String
    role: UserRole!
    status: UserStatus!
    createdAt: DateTime!
    updatedAt: DateTime!
    lastLoginAt: DateTime
    preferences: UserPreferences
    profile: UserProfile
  }

  type UserProfile {
    bio: String
    website: String
    location: String
    company: String
    socialLinks: [SocialLink!]!
    skills: [String!]!
    experience: [Experience!]!
    education: [Education!]!
  }

  type UserPreferences {
    theme: Theme!
    language: String!
    notifications: NotificationPreferences!
    privacy: PrivacyPreferences!
  }

  type NotificationPreferences {
    email: Boolean!
    push: Boolean!
    inApp: Boolean!
    proofUpdates: Boolean!
    securityAlerts: Boolean!
  }

  type PrivacyPreferences {
    profileVisibility: Visibility!
    showEmail: Boolean!
    showRealName: Boolean!
    allowDirectMessages: Boolean!
  }

  type SocialLink {
    platform: String!
    url: String!
    verified: Boolean!
  }

  type Experience {
    company: String!
    position: String!
    startDate: DateTime!
    endDate: DateTime
    current: Boolean!
    description: String
  }

  type Education {
    institution: String!
    degree: String!
    field: String!
    startDate: DateTime!
    endDate: DateTime
    current: Boolean!
  }

  type UserConnection {
    edges: [UserEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type UserEdge {
    node: User!
    cursor: String!
  }

  input UserFilter {
    role: UserRole
    status: UserStatus
    search: String
    createdAfter: DateTime
    createdBefore: DateTime
  }

  input UpdateUserInput {
    id: ID!
    firstName: String
    lastName: String
    avatar: String
    preferences: UserPreferencesInput
    profile: UserProfileInput
  }

  input UserPreferencesInput {
    theme: Theme
    language: String
    notifications: NotificationPreferencesInput
    privacy: PrivacyPreferencesInput
  }

  input NotificationPreferencesInput {
    email: Boolean
    push: Boolean
    inApp: Boolean
    proofUpdates: Boolean
    securityAlerts: Boolean
  }

  input PrivacyPreferencesInput {
    profileVisibility: Visibility
    showEmail: Boolean
    showRealName: Boolean
    allowDirectMessages: Boolean
  }

  input UserProfileInput {
    bio: String
    website: String
    location: String
    company: String
    socialLinks: [SocialLinkInput!]
    skills: [String!]
    experience: [ExperienceInput!]
    education: [EducationInput!]
  }

  input SocialLinkInput {
    platform: String!
    url: String!
  }

  input ExperienceInput {
    company: String!
    position: String!
    startDate: DateTime!
    endDate: DateTime
    current: Boolean!
    description: String
  }

  input EducationInput {
    institution: String!
    degree: String!
    field: String!
    startDate: DateTime!
    endDate: DateTime
    current: Boolean!
  }

  enum UserRole {
    ADMIN
    MODERATOR
    VERIFIER
    USER
    GUEST
  }

  enum UserStatus {
    ACTIVE
    INACTIVE
    SUSPENDED
    PENDING_VERIFICATION
    DELETED
  }

  enum Theme {
    LIGHT
    DARK
    AUTO
  }

  enum Visibility {
    PUBLIC
    PRIVATE
    FRIENDS_ONLY
  }

  scalar DateTime
`;

export const resolvers = {
  Query: {
    me: async (_: any, __: any, { dataSources }: any) => {
      return dataSources.userAPI.getMe();
    },
    user: async (_: any, { id }: { id: string }, { dataSources }: any) => {
      return dataSources.userAPI.getUserById(id);
    },
    users: async (_: any, { filter, limit = 20, offset = 0 }: any, { dataSources }: any) => {
      return dataSources.userAPI.getUsers(filter, limit, offset);
    }
  },

  Mutation: {
    updateUser: async (_: any, { input }: any, { dataSources }: any) => {
      return dataSources.userAPI.updateUser(input);
    },
    deleteUser: async (_: any, { id }: { id: string }, { dataSources }: any) => {
      return dataSources.userAPI.deleteUser(id);
    }
  },

  User: {
    __resolveReference: async (user: any, { dataSources }: any) => {
      return dataSources.userAPI.getUserById(user.id);
    }
  }
};
