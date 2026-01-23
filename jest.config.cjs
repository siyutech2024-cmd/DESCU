module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
    testMatch: ['**/__tests__/**/*.test.ts'],
    collectCoverageFrom: [
        'services/**/*.ts',
        '!services/**/*.test.ts'
    ]
};
