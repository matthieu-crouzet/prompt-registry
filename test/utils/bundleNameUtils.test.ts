/**
 * Bundle Name Utilities Tests
 */

import { 
    generateSanitizedId, 
    formatByteSize,
    isManifestIdMatch,
    generateGitHubBundleId,
    generateBuildScriptBundleId
} from '../../src/utils/bundleNameUtils';

describe('bundleNameUtils', () => {
    describe('generateSanitizedId', () => {
        it('should convert to lowercase', () => {
            expect(generateSanitizedId('MyProject')).toBe('myproject');
            expect(generateSanitizedId('UPPERCASE')).toBe('uppercase');
        });

        it('should replace spaces with hyphens', () => {
            expect(generateSanitizedId('my project')).toBe('my-project');
            expect(generateSanitizedId('hello world test')).toBe('hello-world-test');
        });

        it('should replace multiple spaces with single hyphen', () => {
            expect(generateSanitizedId('my   project')).toBe('my-project');
            expect(generateSanitizedId('hello    world')).toBe('hello-world');
        });

        it('should remove special characters', () => {
            expect(generateSanitizedId('my-project!!')).toBe('my-project');
            expect(generateSanitizedId('test@#$%name')).toBe('test-name');
        });

        it('should trim leading and trailing whitespace', () => {
            expect(generateSanitizedId('  my project  ')).toBe('my-project');
            expect(generateSanitizedId('\t\ntest\t\n')).toBe('test');
        });

        it('should remove leading and trailing hyphens', () => {
            expect(generateSanitizedId('--my-project--')).toBe('my-project');
            expect(generateSanitizedId('!!!test!!!')).toBe('test');
        });

        it('should handle complex cases', () => {
            expect(generateSanitizedId('  My  Project!!  ')).toBe('my-project');
            expect(generateSanitizedId('Hello, World! 123')).toBe('hello-world-123');
            expect(generateSanitizedId('test_name-here')).toBe('test-name-here');
        });

        it('should preserve numbers', () => {
            expect(generateSanitizedId('project123')).toBe('project123');
            expect(generateSanitizedId('v2.0.0')).toBe('v2-0-0');
        });

        it('should handle empty string', () => {
            expect(generateSanitizedId('')).toBe('');
            expect(generateSanitizedId('   ')).toBe('');
        });
    });

    describe('formatByteSize', () => {
        it('should format bytes', () => {
            expect(formatByteSize(0)).toBe('0 B');
            expect(formatByteSize(512)).toBe('512 B');
            expect(formatByteSize(1023)).toBe('1023 B');
        });

        it('should format kilobytes', () => {
            expect(formatByteSize(1024)).toBe('1.0 KB');
            expect(formatByteSize(1536)).toBe('1.5 KB');
            expect(formatByteSize(10240)).toBe('10.0 KB');
        });

        it('should format megabytes', () => {
            expect(formatByteSize(1024 * 1024)).toBe('1.0 MB');
            expect(formatByteSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
            expect(formatByteSize(10 * 1024 * 1024)).toBe('10.0 MB');
        });
    });

    describe('isManifestIdMatch', () => {
        it('should match exact IDs', () => {
            expect(isManifestIdMatch('my-bundle', '1.0.0', 'my-bundle')).toBeTruthy();
            expect(isManifestIdMatch('owner-repo-v1.0.0', '1.0.0', 'owner-repo-v1.0.0')).toBeTruthy();
        });

        it('should match suffix pattern with v prefix', () => {
            expect(isManifestIdMatch('collection', '1.0.0', 'owner-repo-collection-v1.0.0')).toBeTruthy();
            expect(isManifestIdMatch('test2', '1.0.2', 'org-repo-test2-v1.0.2')).toBeTruthy();
        });

        it('should match suffix pattern without v prefix', () => {
            expect(isManifestIdMatch('collection', '1.0.0', 'owner-repo-collection-1.0.0')).toBeTruthy();
            expect(isManifestIdMatch('test2', '1.0.2', 'org-repo-test2-1.0.2')).toBeTruthy();
        });

        it('should not match mismatched IDs', () => {
            expect(!isManifestIdMatch('wrong', '1.0.0', 'owner-repo-collection-v1.0.0')).toBeTruthy();
            expect(!isManifestIdMatch('collection', '2.0.0', 'owner-repo-collection-v1.0.0')).toBeTruthy();
        });

        it('should handle special characters in repo names', () => {
            expect(isManifestIdMatch('test2', '1.0.2', 'org-repo.name-test2-1.0.2')).toBeTruthy();
        });
    });

    describe('generateGitHubBundleId', () => {
        it('should generate ID with manifest info', () => {
            const id = generateGitHubBundleId('owner', 'repo', 'v1.0.0', 'collection', '1.0.0');
            expect(id).toBe('owner-repo-collection-1.0.0');
        });

        it('should generate legacy ID without manifest info', () => {
            const id = generateGitHubBundleId('owner', 'repo', 'v1.0.0');
            expect(id).toBe('owner-repo-v1.0.0');
        });

        it('should strip v prefix from tag when no manifest version', () => {
            const id = generateGitHubBundleId('owner', 'repo', 'v2.0.0', 'test');
            expect(id).toBe('owner-repo-test-2.0.0');
        });

        it('should use manifest version as-is when provided', () => {
            const id = generateGitHubBundleId('owner', 'repo', 'v2.0.0', 'test', '2.0.0');
            expect(id).toBe('owner-repo-test-2.0.0');
        });
    });

    describe('generateBuildScriptBundleId', () => {
        it('should generate ID with v prefix', () => {
            const id = generateBuildScriptBundleId('owner/repo', 'collection', '1.0.0');
            expect(id).toBe('owner-repo-collection-v1.0.0');
        });

        it('should normalize repo slug', () => {
            const id1 = generateBuildScriptBundleId('owner/repo', 'test', '1.0.0');
            const id2 = generateBuildScriptBundleId('owner-repo', 'test', '1.0.0');
            expect(id1).toBe(id2);
        });
    });
});
