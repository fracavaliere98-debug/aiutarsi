export const preferredCityKeys = {
    all: ['preferred-city'] as const,
    capitals: () => [...preferredCityKeys.all, 'capitals'] as const,
    user: (userId?: string) => [...preferredCityKeys.all, 'user', userId ?? 'anonymous'] as const,
};
