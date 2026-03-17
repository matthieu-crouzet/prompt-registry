/**
 * Source ID Utilities Tests
 * 
 * Tests for the sourceIdUtils module which provides stable, portable
 * source identifiers for lockfile entries.
 */

import {
    generateHubSourceId,
    isLegacyHubSourceId,
    generateHubKey,
    normalizeUrl,
    normalizeUrlLegacy,
    generateLegacyHubSourceId,
    generateLegacyHubKey
} from '../../src/utils/sourceIdUtils';

describe('sourceIdUtils', () => {
    describe('generateHubSourceId()', () => {
        it('should produce correct format: {sourceType}-{12-char-hash}', () => {
            const result = generateHubSourceId('github', 'https://github.com/owner/repo');

            // Should match format: type-12hexchars
            expect(result).toMatch(/^github-[a-f0-9]{12}$/);
        });

        it('should be deterministic - same input produces same output', () => {
            const url = 'https://github.com/owner/repo';
            const sourceType = 'github';
            
            const result1 = generateHubSourceId(sourceType, url);
            const result2 = generateHubSourceId(sourceType, url);
            const result3 = generateHubSourceId(sourceType, url);
            
            expect(result1).toBe(result2);
            expect(result2).toBe(result3);
        });

        it('should normalize URL case', () => {
            const result1 = generateHubSourceId('github', 'https://GitHub.com/Owner/Repo');
            const result2 = generateHubSourceId('github', 'https://github.com/Owner/Repo');
            
            // Host should be case-insensitive, but path should be case-sensitive
            // So these should be EQUAL (same host, same path case)
            expect(result1, 'Host case should be normalized').toBe(result2);
        });

        it('should normalize path case (case-insensitive)', () => {
            const result1 = generateHubSourceId('github', 'https://github.com/Owner/Repo');
            const result2 = generateHubSourceId('github', 'https://github.com/owner/repo');

            // Different path case should produce same IDs (case-insensitive)
            expect(result1, 'Path case should be normalized (case-insensitive)').toBe(result2);
        });

        it('should normalize full URL case', () => {
            const resultMixedHost = generateHubSourceId('github', 'https://GitHub.COM/Owner/Repo');
            const resultLowerHost = generateHubSourceId('github', 'https://github.com/Owner/Repo');
            const resultDiffPath = generateHubSourceId('github', 'https://github.com/owner/repo');

            // Same path, different host case -> should be equal
            expect(resultMixedHost, 'Host case should be normalized').toBe(resultLowerHost);

            // Different path case -> should also be equal (full case-insensitive normalization)
            expect(resultLowerHost, 'Path case should be normalized').toBe(resultDiffPath);
        });

        it('should normalize URL protocol', () => {
            const result1 = generateHubSourceId('github', 'https://github.com/owner/repo');
            const result2 = generateHubSourceId('github', 'http://github.com/owner/repo');
            
            expect(result1).toBe(result2);
        });

        it('should normalize trailing slashes', () => {
            const result1 = generateHubSourceId('github', 'https://github.com/owner/repo');
            const result2 = generateHubSourceId('github', 'https://github.com/owner/repo/');
            const result3 = generateHubSourceId('github', 'https://github.com/owner/repo///');
            
            expect(result1).toBe(result2);
            expect(result2).toBe(result3);
        });

        it('should produce different IDs for different source types', () => {
            const url = 'https://example.com/repo';
            
            const githubId = generateHubSourceId('github', url);
            const gitlabId = generateHubSourceId('gitlab', url);
            const httpId = generateHubSourceId('http', url);
            
            expect(githubId).not.toBe(gitlabId);
            expect(gitlabId).not.toBe(httpId);
            expect(githubId).not.toBe(httpId);
        });

        it('should produce different IDs for different URLs', () => {
            const sourceType = 'github';
            
            const id1 = generateHubSourceId(sourceType, 'https://github.com/owner1/repo');
            const id2 = generateHubSourceId(sourceType, 'https://github.com/owner2/repo');
            
            expect(id1).not.toBe(id2);
        });

        it('should handle various source types', () => {
            const url = 'https://example.com/repo';
            
            expect(generateHubSourceId('github', url)).toMatch(/^github-[a-f0-9]{12}$/);
            expect(generateHubSourceId('gitlab', url)).toMatch(/^gitlab-[a-f0-9]{12}$/);
            expect(generateHubSourceId('http', url)).toMatch(/^http-[a-f0-9]{12}$/);
            expect(generateHubSourceId('local', url)).toMatch(/^local-[a-f0-9]{12}$/);
        });

        it('should produce different IDs for same URL but different branch', () => {
            const url = 'https://github.com/owner/repo';
            const sourceType = 'github';
            
            const id1 = generateHubSourceId(sourceType, url, { branch: 'main' });
            const id2 = generateHubSourceId(sourceType, url, { branch: 'develop' });
            
            expect(id1, 'Different branches should produce different IDs').not.toBe(id2);
        });

        it('should produce different IDs for same URL but different collectionsPath', () => {
            const url = 'https://github.com/owner/repo';
            const sourceType = 'github';
            
            const id1 = generateHubSourceId(sourceType, url, { collectionsPath: 'collections' });
            const id2 = generateHubSourceId(sourceType, url, { collectionsPath: 'prompts' });
            
            expect(id1, 'Different collectionsPath should produce different IDs').not.toBe(id2);
        });

        it('should produce same ID when defaults are explicit vs omitted', () => {
            const url = 'https://github.com/owner/repo';
            const sourceType = 'github';
            
            const idNoConfig = generateHubSourceId(sourceType, url);
            const idExplicitDefaults = generateHubSourceId(sourceType, url, { 
                branch: 'main', 
                collectionsPath: 'collections' 
            });
            
            expect(idNoConfig, 'Omitted config should equal explicit defaults').toBe(idExplicitDefaults);
        });

        it('should produce same ID when branch default varies (main vs master)', () => {
            const url = 'https://github.com/owner/repo';
            const sourceType = 'github';
            
            const idMain = generateHubSourceId(sourceType, url, { branch: 'main' });
            const idMaster = generateHubSourceId(sourceType, url, { branch: 'master' });
            
            // Both main and master should be treated as the default branch
            expect(idMain, 'main and master should produce same ID').toBe(idMaster);
        });
    });

    describe('isLegacyHubSourceId()', () => {
        it('should return true for legacy format with 3 segments', () => {
            expect(isLegacyHubSourceId('hub-my-hub-source1')).toBe(true);
        });

        it('should return true for legacy format with more than 3 segments', () => {
            expect(isLegacyHubSourceId('hub-test-hub-github-source')).toBe(true);
            expect(isLegacyHubSourceId('hub-a-b-c-d-e')).toBe(true);
        });

        it('should return false for new format', () => {
            expect(isLegacyHubSourceId('github-a1b2c3d4e5f6')).toBe(false);
            expect(isLegacyHubSourceId('gitlab-123456789abc')).toBe(false);
            expect(isLegacyHubSourceId('http-abcdef123456')).toBe(false);
        });

        it('should return false for hub- prefix with only 2 segments', () => {
            expect(isLegacyHubSourceId('hub-only')).toBe(false);
        });

        it('should return false for non-hub prefixed IDs', () => {
            expect(isLegacyHubSourceId('github-source')).toBe(false);
            expect(isLegacyHubSourceId('my-custom-source')).toBe(false);
            expect(isLegacyHubSourceId('source-id')).toBe(false);
        });

        it('should return false for empty string', () => {
            expect(isLegacyHubSourceId('')).toBe(false);
        });

        it('should return false for hub prefix without hyphen', () => {
            expect(isLegacyHubSourceId('hubsource')).toBe(false);
        });
    });

    describe('generateHubKey()', () => {
        it('should produce correct format: 12-char hash', () => {
            const result = generateHubKey('https://example.com/hub.json');

            expect(result).toMatch(/^[a-f0-9]{12}$/);
        });

        it('should be deterministic - same input produces same output', () => {
            const url = 'https://example.com/hub.json';
            
            const result1 = generateHubKey(url);
            const result2 = generateHubKey(url);
            const result3 = generateHubKey(url);
            
            expect(result1).toBe(result2);
            expect(result2).toBe(result3);
        });

        it('should not append branch for main', () => {
            const url = 'https://example.com/hub.json';
            
            const result = generateHubKey(url, 'main');
            
            // Should be just the hash, no branch suffix
            expect(result).toMatch(/^[a-f0-9]{12}$/);
        });

        it('should not append branch for master', () => {
            const url = 'https://example.com/hub.json';
            
            const result = generateHubKey(url, 'master');
            
            // Should be just the hash, no branch suffix
            expect(result).toMatch(/^[a-f0-9]{12}$/);
        });

        it('should append branch for non-main/master branches', () => {
            const url = 'https://example.com/hub.json';
            
            const result = generateHubKey(url, 'develop');
            
            // Should be hash-branch format
            expect(result).toMatch(/^[a-f0-9]{12}-develop$/);
        });

        it('should handle various branch names', () => {
            const url = 'https://example.com/hub.json';
            
            expect(generateHubKey(url, 'feature/test')).toMatch(/^[a-f0-9]{12}-feature\/test$/);
            expect(generateHubKey(url, 'release-1.0')).toMatch(/^[a-f0-9]{12}-release-1\.0$/);
            expect(generateHubKey(url, 'v2')).toMatch(/^[a-f0-9]{12}-v2$/);
        });

        it('should produce same hash for same URL regardless of branch', () => {
            const url = 'https://example.com/hub.json';
            
            const keyMain = generateHubKey(url, 'main');
            const keyDevelop = generateHubKey(url, 'develop');
            
            // Extract hash portion (first 12 chars)
            const hashMain = keyMain.substring(0, 12);
            const hashDevelop = keyDevelop.substring(0, 12);
            
            expect(hashMain).toBe(hashDevelop);
        });

        it('should normalize full URL case', () => {
            // Same path, different host case -> should be equal
            const result1 = generateHubKey('https://Example.COM/hub.json');
            const result2 = generateHubKey('https://example.com/hub.json');
            expect(result1, 'Host case should be normalized').toBe(result2);

            // Different path case -> should also be equal (full case-insensitive normalization)
            const result3 = generateHubKey('https://example.com/Hub.json');
            expect(result2, 'Path case should be normalized').toBe(result3);
        });

        it('should normalize URL protocol', () => {
            const result1 = generateHubKey('https://example.com/hub.json');
            const result2 = generateHubKey('http://example.com/hub.json');
            
            expect(result1).toBe(result2);
        });

        it('should normalize trailing slashes', () => {
            const result1 = generateHubKey('https://example.com/hub.json');
            const result2 = generateHubKey('https://example.com/hub.json/');
            
            expect(result1).toBe(result2);
        });

        it('should produce different keys for different URLs', () => {
            const key1 = generateHubKey('https://example.com/hub1.json');
            const key2 = generateHubKey('https://example.com/hub2.json');
            
            expect(key1).not.toBe(key2);
        });

        it('should handle undefined branch', () => {
            const result = generateHubKey('https://example.com/hub.json', undefined);
            
            // Should be just the hash, no branch suffix
            expect(result).toMatch(/^[a-f0-9]{12}$/);
        });

        it('should handle empty string branch', () => {
            const result = generateHubKey('https://example.com/hub.json', '');

            // Empty string is falsy, should be just the hash
            expect(result).toMatch(/^[a-f0-9]{12}$/);
        });
    });

    describe('normalizeUrlLegacy()', () => {
        it('should lowercase host only, preserve path case', () => {
            const result = normalizeUrlLegacy('https://GitHub.COM/Owner/Repo');
            expect(result).toBe('github.com/Owner/Repo');
        });

        it('should match normalizeUrl when path is already lowercase', () => {
            const url = 'https://github.com/owner/repo';
            expect(normalizeUrlLegacy(url)).toBe(normalizeUrl(url));
        });

        it('should differ from normalizeUrl when path has uppercase', () => {
            const url = 'https://github.com/Owner/Repo';
            expect(normalizeUrlLegacy(url)).not.toBe(normalizeUrl(url));
        });

        it('should remove trailing slashes', () => {
            const result = normalizeUrlLegacy('https://github.com/Owner/Repo/');
            expect(result).toBe('github.com/Owner/Repo');
        });

        it('should remove protocol', () => {
            const result = normalizeUrlLegacy('https://github.com/Path');
            expect(!result.startsWith('https://')).toBeTruthy();
        });
    });

    describe('generateLegacyHubSourceId()', () => {
        it('should return undefined when URL path is all lowercase', () => {
            const result = generateLegacyHubSourceId('github', 'https://github.com/owner/repo');
            expect(result).toBe(undefined);
        });

        it('should return a legacy ID when URL path has uppercase', () => {
            const result = generateLegacyHubSourceId('github', 'https://github.com/Owner/Repo');
            expect(result, 'Should return a legacy ID').toBeTruthy();
            expect(result!).toMatch(/^github-[a-f0-9]{12}$/);
        });

        it('legacy ID should differ from current ID for mixed-case URL', () => {
            const url = 'https://github.com/Owner/Repo';
            const legacyId = generateLegacyHubSourceId('github', url);
            const currentId = generateHubSourceId('github', url);

            expect(legacyId).toBeTruthy();
            expect(legacyId).not.toBe(currentId);
        });

        it('should respect branch and collectionsPath config', () => {
            const url = 'https://github.com/Owner/Repo';
            const id1 = generateLegacyHubSourceId('github', url, { branch: 'main' });
            const id2 = generateLegacyHubSourceId('github', url, { branch: 'develop' });

            expect(id1).toBeTruthy();
            expect(id2).toBeTruthy();
            expect(id1, 'Different branches should produce different legacy IDs').not.toBe(id2);
        });
    });

    describe('generateLegacyHubKey()', () => {
        it('should return undefined when URL path is all lowercase', () => {
            const result = generateLegacyHubKey('https://example.com/hub.json');
            expect(result).toBe(undefined);
        });

        it('should return a legacy key when URL path has uppercase', () => {
            const result = generateLegacyHubKey('https://example.com/Hub.json');
            expect(result).toBeTruthy();
            expect(result!).toMatch(/^[a-f0-9]{12}$/);
        });

        it('legacy key should differ from current key for mixed-case URL', () => {
            const url = 'https://example.com/Hub.json';
            const legacyKey = generateLegacyHubKey(url);
            const currentKey = generateHubKey(url);

            expect(legacyKey).toBeTruthy();
            expect(legacyKey).not.toBe(currentKey);
        });

        it('should append branch for non-main branches', () => {
            const result = generateLegacyHubKey('https://example.com/Hub.json', 'develop');
            expect(result).toBeTruthy();
            expect(result!).toMatch(/^[a-f0-9]{12}-develop$/);
        });

        it('should not append branch for main', () => {
            const result = generateLegacyHubKey('https://example.com/Hub.json', 'main');
            expect(result).toBeTruthy();
            expect(result!).toMatch(/^[a-f0-9]{12}$/);
        });
    });
});
