/**
 * ApmPackageMapper Unit Tests
 * Tests mapping of APM manifest format to Prompt Registry Bundle format
 */

import { ApmPackageMapper, ApmManifest, PackageContext } from '../../src/adapters/ApmPackageMapper';

describe('ApmPackageMapper', () => {
    let mapper: ApmPackageMapper;

    const baseContext: PackageContext = {
        sourceId: 'test-source',
        owner: 'test-owner',
        repo: 'test-repo',
        path: '',
    };

    beforeEach(() => {
        mapper = new ApmPackageMapper();
    });

    describe('toBundle', () => {
        it('should map basic manifest to bundle', () => {
            const manifest: ApmManifest = {
                name: 'Test Package',
                version: '1.0.0',
                description: 'A test package',
            };

            const bundle = mapper.toBundle(manifest, baseContext);

            expect(bundle.id).toBe('test-owner-test-package');
            expect(bundle.name).toBe('Test Package');
            expect(bundle.version).toBe('1.0.0');
            expect(bundle.description).toBe('A test package');
            expect(bundle.sourceId).toBe('test-source');
            expect(bundle.tags.includes('apm')).toBeTruthy();
        });

        it('should use default version 1.0.0 if not provided', () => {
            const manifest: ApmManifest = {
                name: 'Test Package',
            };

            const bundle = mapper.toBundle(manifest, baseContext);

            expect(bundle.version).toBe('1.0.0');
        });

        it('should use owner as default author', () => {
            const manifest: ApmManifest = {
                name: 'Test',
            };

            const bundle = mapper.toBundle(manifest, baseContext);

            expect(bundle.author).toBe('test-owner');
        });

        it('should use manifest author if provided', () => {
            const manifest: ApmManifest = {
                name: 'Test',
                author: 'Custom Author',
            };

            const bundle = mapper.toBundle(manifest, baseContext);

            expect(bundle.author).toBe('Custom Author');
        });

        it('should include all manifest tags plus apm tag', () => {
            const manifest: ApmManifest = {
                name: 'Test',
                tags: ['azure', 'testing'],
            };

            const bundle = mapper.toBundle(manifest, baseContext);

            expect(bundle.tags.includes('azure')).toBeTruthy();
            expect(bundle.tags.includes('testing')).toBeTruthy();
            expect(bundle.tags.includes('apm')).toBeTruthy();
        });

        it('should infer cloud environment from azure tag', () => {
            const manifest: ApmManifest = {
                name: 'Test',
                tags: ['azure'],
            };

            const bundle = mapper.toBundle(manifest, baseContext);

            expect(bundle.environments.includes('cloud')).toBeTruthy();
        });

        it('should infer cloud environment from aws tag', () => {
            const manifest: ApmManifest = {
                name: 'Test',
                tags: ['aws'],
            };

            const bundle = mapper.toBundle(manifest, baseContext);

            expect(bundle.environments.includes('cloud')).toBeTruthy();
        });

        it('should infer infrastructure environment from devops tag', () => {
            const manifest: ApmManifest = {
                name: 'Test',
                tags: ['devops'],
            };

            const bundle = mapper.toBundle(manifest, baseContext);

            expect(bundle.environments.includes('infrastructure')).toBeTruthy();
        });

        it('should infer web environment from frontend tag', () => {
            const manifest: ApmManifest = {
                name: 'Test',
                tags: ['frontend'],
            };

            const bundle = mapper.toBundle(manifest, baseContext);

            expect(bundle.environments.includes('web')).toBeTruthy();
        });

        it('should default to general environment if no tags match', () => {
            const manifest: ApmManifest = {
                name: 'Test',
                tags: ['random-tag'],
            };

            const bundle = mapper.toBundle(manifest, baseContext);

            expect(bundle.environments.includes('general')).toBeTruthy();
        });

        it('should map APM dependencies correctly', () => {
            const manifest: ApmManifest = {
                name: 'Test',
                dependencies: {
                    apm: ['owner/dep1', 'owner/dep2'],
                },
            };

            const bundle = mapper.toBundle(manifest, baseContext);

            expect(bundle.dependencies.length).toBe(2);
            expect(bundle.dependencies[0].bundleId).toBe('owner/dep1');
            expect(bundle.dependencies[0].versionRange).toBe('*');
            expect(bundle.dependencies[0].optional).toBe(false);
        });

        it('should handle empty dependencies', () => {
            const manifest: ApmManifest = {
                name: 'Test',
                dependencies: {
                    apm: [],
                },
            };

            const bundle = mapper.toBundle(manifest, baseContext);

            expect(bundle.dependencies.length).toBe(0);
        });

        it('should include apmPackageRef for root package', () => {
            const manifest: ApmManifest = { name: 'Test' };

            const bundle = mapper.toBundle(manifest, baseContext);

            expect((bundle as any).apmPackageRef).toBe('test-owner/test-repo');
        });

        it('should include apmPackageRef for subpath package', () => {
            const manifest: ApmManifest = { name: 'Test' };
            const context = { ...baseContext, path: 'packages/my-pkg' };

            const bundle = mapper.toBundle(manifest, context);

            expect((bundle as any).apmPackageRef).toBe('test-owner/test-repo/packages/my-pkg');
        });

        it('should generate correct manifest URL', () => {
            const manifest: ApmManifest = { name: 'Test' };

            const bundle = mapper.toBundle(manifest, baseContext);

            expect(bundle.manifestUrl.includes('raw.githubusercontent.com')).toBeTruthy();
            expect(bundle.manifestUrl.includes('test-owner/test-repo')).toBeTruthy();
            expect(bundle.manifestUrl.includes('apm.yml')).toBeTruthy();
        });

        it('should generate correct manifest URL for subpath', () => {
            const manifest: ApmManifest = { name: 'Test' };
            const context = { ...baseContext, path: 'packages/my-pkg' };

            const bundle = mapper.toBundle(manifest, context);

            expect(bundle.manifestUrl.includes('packages/my-pkg/apm.yml')).toBeTruthy();
        });

        it('should set license to MIT by default', () => {
            const manifest: ApmManifest = { name: 'Test' };

            const bundle = mapper.toBundle(manifest, baseContext);

            expect(bundle.license).toBe('MIT');
        });

        it('should use manifest license if provided', () => {
            const manifest: ApmManifest = { name: 'Test', license: 'Apache-2.0' };

            const bundle = mapper.toBundle(manifest, baseContext);

            expect(bundle.license).toBe('Apache-2.0');
        });

        it('should include lastUpdated timestamp', () => {
            const manifest: ApmManifest = { name: 'Test' };

            const bundle = mapper.toBundle(manifest, baseContext);

            expect(bundle.lastUpdated).toBeTruthy();
            // Should be a valid ISO date string
            expect(!isNaN(Date.parse(bundle.lastUpdated))).toBeTruthy();
        });

        it('should sanitize bundle ID by converting to lowercase and replacing spaces', () => {
            const manifest: ApmManifest = { name: 'My Test Package' };

            const bundle = mapper.toBundle(manifest, baseContext);

            expect(bundle.id).toBe('test-owner-my-test-package');
            expect(!bundle.id.includes(' ')).toBeTruthy();
            expect(bundle.id).toBe(bundle.id.toLowerCase());
        });

        it('should generate description from package ref if not provided', () => {
            const manifest: ApmManifest = { name: 'Test' };

            const bundle = mapper.toBundle(manifest, baseContext);

            expect(bundle.description.includes('test-owner/test-repo')).toBeTruthy();
        });

        it('should set repository URL', () => {
            const manifest: ApmManifest = { name: 'Test' };

            const bundle = mapper.toBundle(manifest, baseContext);

            expect(bundle.repository).toBe('https://github.com/test-owner/test-repo');
        });
    });

    describe('Security', () => {
        it('should sanitize name with special characters', () => {
            const manifest: ApmManifest = { name: 'Test<script>alert(1)</script>' };

            const bundle = mapper.toBundle(manifest, baseContext);

            // ID should be sanitized
            expect(!bundle.id.includes('<')).toBeTruthy();
            expect(!bundle.id.includes('>')).toBeTruthy();
        });

        it('should handle very long names gracefully', () => {
            const longName = 'A'.repeat(1000);
            const manifest: ApmManifest = { name: longName };

            const bundle = mapper.toBundle(manifest, baseContext);

            // Should not throw and should have reasonable ID length
            expect(bundle.id.length < 500).toBeTruthy();
        });

        it('should handle null/undefined tags gracefully', () => {
            const manifest: ApmManifest = { 
                name: 'Test',
                tags: undefined,
            };

            const bundle = mapper.toBundle(manifest, baseContext);

            expect(Array.isArray(bundle.tags)).toBeTruthy();
            expect(bundle.tags.includes('apm')).toBeTruthy();
        });
    });
});
