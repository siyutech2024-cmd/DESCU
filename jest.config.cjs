/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src', '<rootDir>/api'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
    testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    transform: {
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react-jsx', esModuleInterop: true } }],
    },
    collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        'api/_lib/**/*.ts',
        '!**/__tests__/**',
    ],
};
