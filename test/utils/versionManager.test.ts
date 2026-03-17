/**
 * Unit tests for VersionManager
 * Requirements: 2.1, 2.2, 4.2
 */
import { VersionManager } from '../../src/utils/versionManager';

describe('VersionManager Unit Tests', () => {
    describe('compareVersions', () => {
        it('should compare standard semver versions correctly', () => {
            expect(VersionManager.compareVersions('1.0.0', '2.0.0')).toBe(-1);
            expect(VersionManager.compareVersions('2.0.0', '1.0.0')).toBe(1);
            expect(VersionManager.compareVersions('1.0.0', '1.0.0')).toBe(0);
        });

        it('should handle versions with v prefix', () => {
            expect(VersionManager.compareVersions('v1.0.0', 'v2.0.0')).toBe(-1);
            expect(VersionManager.compareVersions('v2.0.0', 'v1.0.0')).toBe(1);
            expect(VersionManager.compareVersions('v1.0.0', 'v1.0.0')).toBe(0);
        });

        it('should handle mixed format versions', () => {
            expect(VersionManager.compareVersions('v1.0.0', '2.0.0')).toBe(-1);
            expect(VersionManager.compareVersions('1.0.0', 'v2.0.0')).toBe(-1);
        });

        it('should compare patch versions correctly', () => {
            expect(VersionManager.compareVersions('1.0.0', '1.0.1')).toBe(-1);
            expect(VersionManager.compareVersions('1.0.1', '1.0.0')).toBe(1);
        });

        it('should compare minor versions correctly', () => {
            expect(VersionManager.compareVersions('1.0.0', '1.1.0')).toBe(-1);
            expect(VersionManager.compareVersions('1.1.0', '1.0.0')).toBe(1);
        });

        it('should handle pre-release versions', () => {
            expect(VersionManager.compareVersions('1.0.0-alpha', '1.0.0')).toBe(-1);
            expect(VersionManager.compareVersions('1.0.0', '1.0.0-alpha')).toBe(1);
            expect(VersionManager.compareVersions('1.0.0-alpha', '1.0.0-beta')).toBe(-1);
        });

        it('should coerce malformed versions', () => {
            // These should be coerced to valid semver
            expect(VersionManager.compareVersions('1', '2')).toBe(-1);
            expect(VersionManager.compareVersions('1.0', '1.1')).toBe(-1);
        });

        it('should fall back to string comparison for non-semver', () => {
            // When coercion fails, use string comparison
            const result = VersionManager.compareVersions('abc', 'def');
            expect(result).toBe('abc'.localeCompare('def'));
        });

        it('should throw error for empty strings', () => {
            // Empty strings should throw validation error
            expect(() => VersionManager.compareVersions('', '1.0.0')).toThrow(/cannot be empty/);
            expect(() => VersionManager.compareVersions('1.0.0', '')).toThrow(/cannot be empty/);
            expect(() => VersionManager.compareVersions('', '')).toThrow(/cannot be empty/);
        });

        it('should throw error for very long version strings', () => {
            const longVersion = '1.0.0-' + 'a'.repeat(200);
            expect(() => VersionManager.compareVersions(longVersion, '1.0.0')).toThrow(/exceeds maximum length/);
            expect(() => VersionManager.compareVersions('1.0.0', longVersion)).toThrow(/exceeds maximum length/);
        });

        it('should handle build metadata correctly', () => {
            // Build metadata should be ignored per semver spec
            expect(VersionManager.compareVersions('1.0.0+build.123', '1.0.0+build.456')).toBe(0);
            expect(VersionManager.compareVersions('1.0.0+build', '1.0.0')).toBe(0);
        });
    });

    describe('isUpdateAvailable', () => {
        it('should return true when latest version is higher', () => {
            expect(VersionManager.isUpdateAvailable('1.0.0', '2.0.0')).toBe(true);
            expect(VersionManager.isUpdateAvailable('1.0.0', '1.1.0')).toBe(true);
            expect(VersionManager.isUpdateAvailable('1.0.0', '1.0.1')).toBe(true);
        });

        it('should return false when versions are equal', () => {
            expect(VersionManager.isUpdateAvailable('1.0.0', '1.0.0')).toBe(false);
            expect(VersionManager.isUpdateAvailable('v1.0.0', 'v1.0.0')).toBe(false);
        });

        it('should return false when installed version is higher', () => {
            expect(VersionManager.isUpdateAvailable('2.0.0', '1.0.0')).toBe(false);
            expect(VersionManager.isUpdateAvailable('1.1.0', '1.0.0')).toBe(false);
        });

        it('should handle versions with v prefix', () => {
            expect(VersionManager.isUpdateAvailable('v1.0.0', 'v2.0.0')).toBe(true);
            expect(VersionManager.isUpdateAvailable('v2.0.0', 'v1.0.0')).toBe(false);
        });

        it('should handle mixed format versions', () => {
            expect(VersionManager.isUpdateAvailable('v1.0.0', '2.0.0')).toBe(true);
            expect(VersionManager.isUpdateAvailable('1.0.0', 'v2.0.0')).toBe(true);
        });

        it('should throw error for empty versions', () => {
            expect(() => VersionManager.isUpdateAvailable('', '1.0.0')).toThrow(/cannot be empty/);
            expect(() => VersionManager.isUpdateAvailable('1.0.0', '')).toThrow(/cannot be empty/);
        });
    });

    describe('isValidSemver', () => {
        it('should validate standard semver versions', () => {
            expect(VersionManager.isValidSemver('1.0.0')).toBe(true);
            expect(VersionManager.isValidSemver('2.1.3')).toBe(true);
            expect(VersionManager.isValidSemver('0.0.1')).toBe(true);
        });

        it('should validate versions with v prefix', () => {
            expect(VersionManager.isValidSemver('v1.0.0')).toBe(true);
            expect(VersionManager.isValidSemver('v2.1.3')).toBe(true);
        });

        it('should validate pre-release versions', () => {
            expect(VersionManager.isValidSemver('1.0.0-alpha')).toBe(true);
            expect(VersionManager.isValidSemver('1.0.0-beta.1')).toBe(true);
        });

        it('should validate coercible versions', () => {
            expect(VersionManager.isValidSemver('1')).toBe(true);
            expect(VersionManager.isValidSemver('1.0')).toBe(true);
        });

        it('should reject invalid versions', () => {
            expect(VersionManager.isValidSemver('')).toBe(false);
            expect(VersionManager.isValidSemver('not-a-version')).toBe(false);
        });
    });

    describe('sortVersionsDescending', () => {
        it('should sort versions in descending order', () => {
            const versions = ['1.0.0', '2.0.0', '1.5.0', '3.0.0'];
            const sorted = VersionManager.sortVersionsDescending(versions);
            expect(sorted).toEqual(['3.0.0', '2.0.0', '1.5.0', '1.0.0']);
        });

        it('should handle versions with v prefix', () => {
            const versions = ['v1.0.0', 'v2.0.0', 'v1.5.0'];
            const sorted = VersionManager.sortVersionsDescending(versions);
            expect(sorted).toEqual(['v2.0.0', 'v1.5.0', 'v1.0.0']);
        });

        it('should handle mixed format versions', () => {
            const versions = ['v1.0.0', '2.0.0', 'v1.5.0'];
            const sorted = VersionManager.sortVersionsDescending(versions);
            expect(sorted).toEqual(['2.0.0', 'v1.5.0', 'v1.0.0']);
        });

        it('should handle pre-release versions', () => {
            const versions = ['1.0.0', '1.0.0-alpha', '1.0.0-beta'];
            const sorted = VersionManager.sortVersionsDescending(versions);
            expect(sorted).toEqual(['1.0.0', '1.0.0-beta', '1.0.0-alpha']);
        });

        it('should filter out invalid versions', () => {
            const versions = ['1.0.0', 'invalid', '2.0.0'];
            const sorted = VersionManager.sortVersionsDescending(versions);
            expect(sorted).toEqual(['2.0.0', '1.0.0']);
        });
    });

    describe('extractBundleIdentity', () => {
        it('should extract identity from GitHub bundle IDs with version', () => {
            expect(VersionManager.extractBundleIdentity('owner-repo-v1.0.0', 'github')).toBe('owner-repo');
            expect(VersionManager.extractBundleIdentity('microsoft-vscode-1.0.0', 'github')).toBe('microsoft-vscode');
        });

        it('should handle GitHub bundle IDs with complex versions', () => {
            expect(VersionManager.extractBundleIdentity('owner-repo-v1.0.0-alpha', 'github')).toBe('owner-repo');
            expect(VersionManager.extractBundleIdentity('owner-repo-2.1.3', 'github')).toBe('owner-repo');
        });

        it('should handle GitHub bundle IDs with hyphens in name', () => {
            expect(VersionManager.extractBundleIdentity('my-org-my-repo-v1.0.0', 'github')).toBe('my-org-my-repo');
        });

        it('should return as-is for GitHub bundles without version', () => {
            expect(VersionManager.extractBundleIdentity('owner-repo', 'github')).toBe('owner-repo');
        });

        it('should handle bundle IDs with multiple version-like patterns', () => {
            expect(VersionManager.extractBundleIdentity('v1-repo-v2.0.0', 'github')).toBe('v1-repo');
        });

        it('should handle single-part bundle IDs', () => {
            expect(VersionManager.extractBundleIdentity('repo', 'github')).toBe('repo');
        });

        it('should handle numeric repo names', () => {
            expect(VersionManager.extractBundleIdentity('owner-123-v1.0.0', 'github')).toBe('owner-123');
        });

        it('should throw error for excessively long bundle IDs', () => {
            const longId = 'a'.repeat(201) + '-v1.0.0';
            expect(() => VersionManager.extractBundleIdentity(longId, 'github')).toThrow(/exceeds maximum length/);
        });

        it('should return as-is for non-GitHub sources', () => {
            expect(VersionManager.extractBundleIdentity('bundle-id-v1.0.0', 'gitlab')).toBe('bundle-id-v1.0.0');
            expect(VersionManager.extractBundleIdentity('bundle-id-v1.0.0', 'http')).toBe('bundle-id-v1.0.0');
            expect(VersionManager.extractBundleIdentity('bundle-id-v1.0.0', 'local')).toBe('bundle-id-v1.0.0');
        });
    });

    describe('parseVersion', () => {
        it('should clean standard semver versions', () => {
            expect(VersionManager.parseVersion('1.0.0')).toBe('1.0.0');
            expect(VersionManager.parseVersion('2.1.3')).toBe('2.1.3');
        });

        it('should clean versions with v prefix', () => {
            expect(VersionManager.parseVersion('v1.0.0')).toBe('1.0.0');
            expect(VersionManager.parseVersion('v2.1.3')).toBe('2.1.3');
        });

        it('should coerce partial versions', () => {
            expect(VersionManager.parseVersion('1')).toBe('1.0.0');
            expect(VersionManager.parseVersion('1.0')).toBe('1.0.0');
        });

        it('should handle pre-release versions', () => {
            expect(VersionManager.parseVersion('1.0.0-alpha')).toBe('1.0.0-alpha');
            expect(VersionManager.parseVersion('v1.0.0-beta')).toBe('1.0.0-beta');
        });

        it('should return null for invalid versions', () => {
            expect(VersionManager.parseVersion('not-a-version')).toBe(null);
            expect(VersionManager.parseVersion('')).toBe(null);
        });

        it('should handle build metadata', () => {
            // Note: semver.clean() strips build metadata per semver spec
            // Build metadata should be ignored for version comparison
            expect(VersionManager.parseVersion('1.0.0+build.123')).toBe('1.0.0');
        });
    });
});
