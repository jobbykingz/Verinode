import { UserAPI } from '../datasources/userAPI';

export const resolvers = {
  Query: {
    me: async (_: any, __: any, { dataSources }: { dataSources: { userAPI: UserAPI } }) => {
      return dataSources.userAPI.getMe();
    },
    user: async (_: any, { id }: { id: string }, { dataSources }: { dataSources: { userAPI: UserAPI } }) => {
      return dataSources.userAPI.getUserById(id);
    },
    users: async (
      _: any, 
      { filter, limit = 20, offset = 0 }: any, 
      { dataSources }: { dataSources: { userAPI: UserAPI } }
    ) => {
      return dataSources.userAPI.getUsers(filter, limit, offset);
    }
  },

  Mutation: {
    updateUser: async (
      _: any, 
      { input }: any, 
      { dataSources }: { dataSources: { userAPI: UserAPI } }
    ) => {
      return dataSources.userAPI.updateUser(input);
    },
    deleteUser: async (
      _: any, 
      { id }: { id: string }, 
      { dataSources }: { dataSources: { userAPI: UserAPI } }
    ) => {
      return dataSources.userAPI.deleteUser(id);
    }
  },

  User: {
    __resolveReference: async (
      user: { id: string }, 
      { dataSources }: { dataSources: { userAPI: UserAPI } }
    ) => {
      return dataSources.userAPI.getUserById(user.id);
    },

    profile: async (user: any, _: any, { dataSources }: { dataSources: { userAPI: UserAPI } }) => {
      return dataSources.userAPI.getUserProfile(user.id);
    },

    preferences: async (user: any, _: any, { dataSources }: { dataSources: { userAPI: UserAPI } }) => {
      return dataSources.userAPI.getUserPreferences(user.id);
    }
  }
};
