export const myReportsKeys = {
    all: ['my-reports'] as const,
    list: (userId?: string) => [...myReportsKeys.all, 'list', userId ?? 'anonymous'] as const,
};
