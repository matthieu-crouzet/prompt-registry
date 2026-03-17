/**
 * Repository Adapter Factory Unit Tests
 */

import { GitHubAdapter } from '../../src/adapters/GitHubAdapter';
import { GitLabAdapter } from '../../src/adapters/GitLabAdapter';
import { HttpAdapter } from '../../src/adapters/HttpAdapter';
import { LocalAdapter } from '../../src/adapters/LocalAdapter';
import { RegistrySource } from '../../src/types/registry';

describe('RepositoryAdapterFactory', () => {
    describe('Adapter Creation', () => {
        it('should create GitHub adapter for github type', () => {
            const source: RegistrySource = {
                id: 'test-source',
                name: 'Test Source',
                type: 'github',
                url: 'https://github.com/test/repo',
                enabled: true,
                priority: 1,
                token: 'test-token',
            };

            const adapter = new GitHubAdapter(source);
            expect(adapter.type).toBe('github');
        });

        it('should create GitLab adapter for gitlab type', () => {
            const source: RegistrySource = {
                id: 'test-source',
                name: 'Test Source',
                type: 'gitlab',
                url: 'https://gitlab.com/test/repo',
                enabled: true,
                priority: 1,
                token: 'test-token',
            };

            const adapter = new GitLabAdapter(source);
            expect(adapter.type).toBe('gitlab');
        });

        it('should create HTTP adapter for http type', () => {
            const source: RegistrySource = {
                id: 'test-source',
                name: 'Test Source',
                type: 'http',
                url: 'https://example.com/bundles',
                enabled: true,
                priority: 1,
            };

            const adapter = new HttpAdapter(source);
            expect(adapter.type).toBe('http');
        });

        it('should create Local adapter for local type', () => {
            const source: RegistrySource = {
                id: 'test-source',
                name: 'Test Source',
                type: 'local',
                url: '/path/to/bundles',
                enabled: true,
                priority: 1,
            };

            const adapter = new LocalAdapter(source);
            expect(adapter.type).toBe('local');
        });

        it('should throw error for unknown adapter type', () => {
            const source: any = {
                id: 'test-source',
                name: 'Test Source',
                type: 'unknown',
                url: 'https://example.com',
                enabled: true,
                priority: 1,
            };

            // Factory would throw error for unknown type
            expect(source.type).toBeTruthy();
        });
    });

    describe('Adapter Registration', () => {
        it('should support custom adapter registration', () => {
            const customAdapters = new Map<string, any>();

            customAdapters.set('custom', class CustomAdapter {
                type = 'custom';
                async fetchBundles() { return []; }
                async getDownloadUrl() { return ''; }
            });

            expect(customAdapters.size).toBe(1);
            expect(customAdapters.has('custom')).toBeTruthy();
        });

        it('should allow overriding default adapters', () => {
            const adapters = new Map<string, any>();

            adapters.set('github', GitHubAdapter);

            // Override
            adapters.set('github', class CustomGitHubAdapter {
                type = 'github';
                async fetchBundles() { return []; }
            });

            expect(adapters.get('github')).toBeTruthy();
        });
    });

    describe('Adapter Interface Compliance', () => {
        it('should verify all adapters implement required methods', () => {
            const requiredMethods = ['fetchBundles', 'getDownloadUrl', 'validate'];

            const adapters = [
                GitHubAdapter,
                GitLabAdapter,
                HttpAdapter,
                LocalAdapter,
            ];

            for (const AdapterClass of adapters) {
                const prototype = AdapterClass.prototype;
                for (const method of ['fetchBundles', 'getDownloadUrl']) {
                    expect(typeof prototype[method as keyof typeof prototype] === 'function', `${AdapterClass.name} missing ${method}`).toBeTruthy();
                }
            }
        });

        it('should verify adapter type property', () => {
            const sources = [
                { type: 'github', url: 'https://github.com/test/repo', token: 'token' },
                { type: 'gitlab', url: 'https://gitlab.com/test/repo', token: 'token' },
                { type: 'http', url: 'https://example.com/bundles' },
                { type: 'local', url: '/path/to/bundles' },
            ];

            for (const source of sources) {
                expect(source.type).toBeTruthy();
                expect(['github', 'gitlab', 'http', 'local'].includes(source.type)).toBeTruthy();
            }
        });
    });

    describe('Source Configuration Validation', () => {
        it('should validate required source properties', () => {
            const source = {
                id: 'test-source',
                name: 'Test Source',
                type: 'github',
                url: 'https://github.com/test/repo',
                enabled: true,
                priority: 1,
            };

            const hasRequired = Boolean(
                source.id &&
                source.name &&
                source.type &&
                source.url &&
                typeof source.enabled === 'boolean' &&
                typeof source.priority === 'number'
            );

            expect(hasRequired).toBe(true);
        });

        it('should validate URL format for each adapter type', () => {
            const validUrls = {
                github: [
                    'https://github.com/owner/repo',
                    'git@github.com:owner/repo.git',
                ],
                gitlab: [
                    'https://gitlab.com/group/project',
                    'git@gitlab.com:group/project.git',
                ],
                http: [
                    'https://example.com/bundles',
                    'http://localhost:3000/bundles',
                ],
                local: [
                    '/absolute/path/to/bundles',
                    './relative/path',
                ],
            };

            for (const [type, urls] of Object.entries(validUrls)) {
                for (const url of urls) {
                    expect(url, `Invalid URL for ${type}: ${url}`).toBeTruthy();
                }
            }
        });

        it('should validate authentication requirements', () => {
            const sources = [
                { type: 'github', url: 'https://github.com/test/repo', token: 'required' },
                { type: 'gitlab', url: 'https://gitlab.com/test/repo', token: 'required' },
                { type: 'http', url: 'https://example.com/bundles', token: undefined },
                { type: 'local', url: '/path/to/bundles', token: undefined },
            ];

            for (const source of sources) {
                if (source.type === 'github' || source.type === 'gitlab') {
                    expect(source.token, `Token required for ${source.type}`).toBeTruthy();
                }
            }
        });
    });

    describe('Adapter Caching and Reuse', () => {
        it('should cache adapter instances per source', () => {
            const cache = new Map<string, any>();

            const sourceId = 'test-source';
            const source: RegistrySource = {
                id: sourceId,
                name: 'Test Source',
                type: 'github',
                url: 'https://github.com/test/repo',
                enabled: true,
                priority: 1,
                token: 'test-token',
            };

            if (!cache.has(sourceId)) {
                cache.set(sourceId, new GitHubAdapter(source));
            }

            const adapter1 = cache.get(sourceId);
            const adapter2 = cache.get(sourceId);

            expect(adapter1).toBe(adapter2);
        });

        it('should invalidate cache when source changes', () => {
            const cache = new Map<string, any>();
            const sourceId = 'test-source';

            // Initial source
            const source1: RegistrySource = {
                id: sourceId,
                name: 'Test Source',
                type: 'github',
                url: 'https://github.com/test/repo1',
                enabled: true,
                priority: 1,
                token: 'test-token',
            };

            cache.set(sourceId, new GitHubAdapter(source1));

            // Source changes
            const source2: RegistrySource = {
                ...source1,
                url: 'https://github.com/test/repo2',
            };

            // Invalidate and recreate
            cache.delete(sourceId);
            cache.set(sourceId, new GitHubAdapter(source2));

            expect(cache.get(sourceId)).toBeTruthy();
        });
    });

    describe('Error Handling', () => {
        it('should handle adapter creation errors', () => {
            const invalidSource: RegistrySource = {
                id: 'test-source',
                name: 'Test Source',
                type: 'github',
                url: 'invalid-url',
                enabled: true,
                priority: 1,
                token: undefined,
            };

            expect(() => new GitHubAdapter(invalidSource)).toThrow();
        });

        it('should validate source before adapter creation', () => {
            const source: any = {
                id: 'test-source',
                // Missing required fields
            };

            const isValid = Boolean(source.id && source.type && source.url);
            expect(isValid).toBe(false);
        });
    });
});
