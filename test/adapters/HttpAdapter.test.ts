/**
 * HttpAdapter Unit Tests
 */

import nock from 'nock';
import { HttpAdapter } from '../../src/adapters/HttpAdapter';
import { RegistrySource } from '../../src/types/registry';

describe('HttpAdapter', () => {
    const mockSource: RegistrySource = {
        id: 'test-http-source',
        name: 'Test HTTP Source',
        type: 'http',
        url: 'https://example.com/bundles',
        enabled: true,
        priority: 1,
    };

    afterEach(() => {
        nock.cleanAll();
    });

    describe('Constructor and Validation', () => {
        it('should accept valid HTTP URL', () => {
            const adapter = new HttpAdapter(mockSource);
            expect(adapter.type).toBe('http');
        });

        it('should accept valid HTTPS URL', () => {
            const source = { ...mockSource, url: 'https://example.com/bundles' };
            const adapter = new HttpAdapter(source);
            expect(adapter).toBeTruthy();
        });

        it('should handle URLs with query parameters', () => {
            const source = { ...mockSource, url: 'https://example.com/bundles?filter=active' };
            expect(() => new HttpAdapter(source)).not.toThrow();
        });
    });

    describe('fetchBundles', () => {
        it('should fetch bundles from HTTP endpoint', async () => {
            const mockIndex = {
                name: 'Test Registry',
                version: '1.0.0',
                bundles: [
                    {
                        id: 'bundle-1',
                        name: 'Bundle 1',
                        version: '1.0.0',
                        description: 'Test bundle',
                        author: 'Test',
                        environments: ['vscode'],
                        tags: [],
                        lastUpdated: new Date().toISOString(),
                        size: '1MB',
                        dependencies: [],
                        license: 'MIT',
                        downloadUrl: 'https://example.com/bundle-1.zip',
                        manifestUrl: 'https://example.com/bundle-1/manifest.yml',
                    },
                ],
            };

            nock('https://example.com')
                .get('/bundles/index.json')
                .reply(200, mockIndex);

            const adapter = new HttpAdapter(mockSource);
            const bundles = await adapter.fetchBundles();

            expect(bundles.length).toBe(1);
            expect(bundles[0].id).toBe('bundle-1');
        });

        it('should handle 404 errors gracefully', async () => {
            nock('https://example.com')
                .get('/bundles/index.json')
                .reply(404);

            const adapter = new HttpAdapter(mockSource);
            await expect(async () => await adapter.fetchBundles()).rejects.toThrow(/404|Not found/);
        });

        it('should handle network errors', async () => {
            nock('https://example.com')
                .get('/bundles/index.json')
                .replyWithError('Network error');

            const adapter = new HttpAdapter(mockSource);
            await expect(async () => await adapter.fetchBundles()).rejects.toThrow(/Network error/);
        });
    });

    describe('getDownloadUrl', () => {
        it('should construct download URL from bundle ID', () => {
            const adapter = new HttpAdapter(mockSource);
            const url = adapter.getDownloadUrl('bundle-1', '1.0.0');

            expect(url.includes('example.com')).toBeTruthy();
            expect(url.includes('bundle-1')).toBeTruthy();
        });

        it('should handle version parameter', () => {
            const adapter = new HttpAdapter(mockSource);
            const url = adapter.getDownloadUrl('bundle-1', '2.0.0');

            expect(url.includes('bundle-1')).toBeTruthy();
        });
    });

    describe('Authentication', () => {
        it('should include Authorization header when token provided', async () => {
            const sourceWithToken = { ...mockSource, token: 'test-token-123' };
            const mockIndex = {
                name: 'Test Registry',
                version: '1.0.0',
                bundles: [],
            };

            nock('https://example.com', {
                reqheaders: {
                    'Authorization': 'Bearer test-token-123',
                },
            })
                .get('/bundles/index.json')
                .reply(200, mockIndex);

            const adapter = new HttpAdapter(sourceWithToken);
            const bundles = await adapter.fetchBundles();

            expect(bundles.length).toBe(0);
        });

        it('should handle 401 unauthorized errors', async () => {
            const sourceWithToken = { ...mockSource, token: 'invalid-token' };

            nock('https://example.com')
                .get('/bundles/index.json')
                .reply(401, { error: 'Unauthorized' });

            const adapter = new HttpAdapter(sourceWithToken);
            await expect(async () => await adapter.fetchBundles()).rejects.toThrow(/401|Unauthorized/);
        });
    });

    describe('Rate Limiting', () => {
        it('should handle 429 rate limit errors', async () => {
            nock('https://example.com')
                .get('/bundles/index.json')
                .reply(429, { error: 'Rate limit exceeded' });

            const adapter = new HttpAdapter(mockSource);
            await expect(async () => await adapter.fetchBundles()).rejects.toThrow(/429|Rate limit/);
        });
    });
});
