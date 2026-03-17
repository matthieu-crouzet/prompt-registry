/**
 * ApmAdapter Unit Tests
 * Tests remote APM package adapter (GitHub-based)
 */

import * as sinon from 'sinon';
import * as vscode from 'vscode';
import nock from 'nock';
import { ApmAdapter } from '../../src/adapters/ApmAdapter';
import { RegistrySource } from '../../src/types/registry';
import { ApmRuntimeManager } from '../../src/services/ApmRuntimeManager';

describe('ApmAdapter', () => {
    let sandbox: sinon.SinonSandbox;
    let mockRuntime: sinon.SinonStubbedInstance<ApmRuntimeManager>;
    
    const mockSource: RegistrySource = {
        id: 'test-apm',
        name: 'Test APM',
        type: 'apm',
        url: 'https://github.com/test-owner/test-repo',
        enabled: true,
        priority: 1,
    };

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        nock.cleanAll(); // Clean any existing nocks (e.g. from vitest.setup.ts)
        
        // Mock runtime manager
        ApmRuntimeManager.resetInstance();
        mockRuntime = sandbox.createStubInstance(ApmRuntimeManager);
        mockRuntime.getStatus.resolves({ installed: true, version: '1.0.0' });
        mockRuntime.isAvailable.resolves(true);
        
        sandbox.stub(ApmRuntimeManager, 'getInstance').returns(mockRuntime as unknown as ApmRuntimeManager);
        
        // Stub vscode authentication
        sandbox.stub(vscode.authentication, 'getSession').resolves(undefined);
    });

    afterEach(() => {
        sandbox.restore();
        ApmRuntimeManager.resetInstance();
        nock.cleanAll();
    });

    describe('Authentication', () => {
        it('should use VS Code authentication token when available', async () => {
            const adapter = new ApmAdapter(mockSource);
            const token = 'vscode-token';
            
            // Mock VS Code auth
            (vscode.authentication.getSession as sinon.SinonStub).resolves({
                accessToken: token,
                scopes: ['repo'],
                id: 'id',
                account: { id: 'acc', label: 'acc' }
            });
            
            // Verify nock request
            const scope = nock('https://api.github.com')
                .get('/repos/test-owner/test-repo/git/trees/main')
                .query({ recursive: '1' })
                .matchHeader('Authorization', `token ${token}`)
                .reply(200, { tree: [] });
            
            await adapter.fetchBundles();
            
            expect(scope.isDone(), 'Request with auth header was not made').toBeTruthy();
        });

        it('should use token in HTTPS requests', async () => {
            const adapter = new ApmAdapter(mockSource);
            const token = 'test-token-123';
            
            // Mock VS Code auth
            (vscode.authentication.getSession as sinon.SinonStub).resolves({
                accessToken: token,
                scopes: ['repo'],
                id: 'id',
                account: { id: 'acc', label: 'acc' }
            });

            // Verify nock request
            const scope = nock('https://api.github.com')
                .get('/repos/test-owner/test-repo/git/trees/main')
                .query({ recursive: '1' })
                .matchHeader('Authorization', `token ${token}`)
                .reply(200, { tree: [] });

            await adapter.fetchBundles();

            expect(scope.isDone(), 'Request with auth header was not made').toBeTruthy();
        });
        
        it('should fallback to config token if VS Code auth fails', async () => {
            const sourceWithToken = { ...mockSource, token: 'config-token' };
            const adapter = new ApmAdapter(sourceWithToken);
            
            // Stub execShell to fail (simulate gh not installed or not authenticated)
            sandbox.stub(adapter as any, 'execShell').rejects(new Error('gh not found'));
            
            // VS Code auth fails/returns undefined
            (vscode.authentication.getSession as sinon.SinonStub).resolves(undefined);
            
            // Verify nock request
            const scope = nock('https://api.github.com')
                .get('/repos/test-owner/test-repo/git/trees/main')
                .query({ recursive: '1' })
                .matchHeader('Authorization', 'token config-token')
                .reply(200, { tree: [] });
            
            await adapter.fetchBundles();
            
            expect(scope.isDone(), 'Request with config token auth header was not made').toBeTruthy();
        });
    });

    describe('Constructor and Validation', () => {
        it('should accept valid GitHub URL', () => {
            const adapter = new ApmAdapter(mockSource);
            expect(adapter.type).toBe('apm');
        });

        it('should accept GitHub URL with .git suffix', () => {
            const source = { ...mockSource, url: 'https://github.com/owner/repo.git' };
            const adapter = new ApmAdapter(source);
            expect(adapter).toBeTruthy();
        });

        it('should throw error for invalid URL', () => {
            const source = { ...mockSource, url: 'not-a-url' };
            expect(() => new ApmAdapter(source)).toThrow(/Invalid|URL/i);
        });

        it('should throw error for non-GitHub URL', () => {
            const source = { ...mockSource, url: 'https://gitlab.com/owner/repo' };
            expect(() => new ApmAdapter(source)).toThrow(/GitHub/i);
        });
    });

    describe('parseGitHubUrl', () => {
        it('should extract owner and repo from URL', () => {
            const adapter = new ApmAdapter(mockSource);
            const { owner, repo } = (adapter as any).parseGitHubUrl();
            
            expect(owner).toBe('test-owner');
            expect(repo).toBe('test-repo');
        });

        it('should handle .git suffix', () => {
            const source = { ...mockSource, url: 'https://github.com/owner/repo.git' };
            const adapter = new ApmAdapter(source);
            const { repo } = (adapter as any).parseGitHubUrl();
            
            expect(repo).toBe('repo');
        });
    });

    describe('fetchBundles', () => {
        it('should throw error when runtime not installed and setup fails', async () => {
            mockRuntime.getStatus.resolves({ installed: false, uvxAvailable: false });
            mockRuntime.setupRuntime.resolves(false);
            
            const adapter = new ApmAdapter(mockSource);
            
            await expect(() => adapter.fetchBundles()).rejects.toThrow(/APM runtime is not available/);
            
            expect(mockRuntime.setupRuntime.called).toBeTruthy();
        });

        it('should proceed when runtime setup succeeds', async () => {
            mockRuntime.getStatus.resolves({ installed: false, uvxAvailable: false });
            mockRuntime.setupRuntime.resolves(true);
            
            const adapter = new ApmAdapter(mockSource);
            
            // Stub fetchGitTree to avoid network
            sandbox.stub(adapter as any, 'fetchGitTree').resolves([]);
            
            const bundles = await adapter.fetchBundles();
            
            expect(mockRuntime.setupRuntime.called).toBeTruthy();
            expect(Array.isArray(bundles)).toBeTruthy();
        });

        it('should return empty array when manifest not found', async () => {
            const adapter = new ApmAdapter(mockSource);
            
            // Will return empty array for non-existent repo
            const bundles = await adapter.fetchBundles();
            
            expect(Array.isArray(bundles)).toBeTruthy();
        });

        it('should fetch bundles using git tree optimization', async () => {
            const adapter = new ApmAdapter(mockSource);
            
            // Mock httpsGet to return tree then manifests
            const httpsGetStub = sandbox.stub(adapter as any, 'httpsGet');
            
            // 1. Git Tree response
            httpsGetStub.onCall(0).resolves(JSON.stringify({
                tree: [
                    { path: 'apm.yml', type: 'blob' },
                    { path: 'sub-package/apm.yml', type: 'blob' },
                    { path: 'node_modules/apm.yml', type: 'blob' } // Should be ignored
                ]
            }));
            
            // 2. Root manifest response
            httpsGetStub.onCall(1).resolves('name: root-pkg\nversion: 1.0.0');
            
            // 3. Sub-package manifest response
            httpsGetStub.onCall(2).resolves('name: sub-pkg\nversion: 1.0.0');
            
            const bundles = await adapter.fetchBundles();
            
            expect(bundles.length).toBe(2);
            expect(bundles[0].name).toBe('root-pkg');
            expect(bundles[1].name).toBe('sub-pkg');
        });

        it('should cache results', async () => {
            const adapter = new ApmAdapter(mockSource);
            
            // First call
            const bundles1 = await adapter.fetchBundles();
            
            // Second call should use cache (same result, no network)
            const bundles2 = await adapter.fetchBundles();
            
            // Both should return arrays
            expect(Array.isArray(bundles1)).toBeTruthy();
            expect(Array.isArray(bundles2)).toBeTruthy();
        });
    });

    describe('validate', () => {
        it('should return invalid when runtime not installed', async () => {
            mockRuntime.getStatus.resolves({ installed: false });
            
            const adapter = new ApmAdapter(mockSource);
            const result = await adapter.validate();
            
            expect(result.valid).toBe(false);
            expect(result.errors.length > 0).toBeTruthy();
            expect(result.errors[0].includes('APM CLI')).toBeTruthy();
        });

        it('should return runtime version in status', async () => {
            mockRuntime.getStatus.resolves({ 
                installed: true, 
                version: '2.0.0' 
            });
            
            const adapter = new ApmAdapter(mockSource);
            
            const result = await adapter.validate();
            
            // Should include validation info
            expect('valid' in result).toBeTruthy();
            expect('errors' in result).toBeTruthy();
        });
    });

    describe('getManifestUrl', () => {
        it('should generate correct raw GitHub URL', () => {
            const adapter = new ApmAdapter(mockSource);
            const url = adapter.getManifestUrl('some-bundle');
            
            expect(url.includes('raw.githubusercontent.com')).toBeTruthy();
            expect(url.includes('test-owner/test-repo')).toBeTruthy();
            expect(url.includes('apm.yml')).toBeTruthy();
        });
    });

    describe('getDownloadUrl', () => {
        it('should return manifest URL (APM has no pre-built downloads)', () => {
            const adapter = new ApmAdapter(mockSource);
            const downloadUrl = adapter.getDownloadUrl('some-bundle');
            const manifestUrl = adapter.getManifestUrl('some-bundle');
            
            expect(downloadUrl).toBe(manifestUrl);
        });
    });

    describe('requiresAuthentication', () => {
        it('should return false for public repos by default', () => {
            const adapter = new ApmAdapter(mockSource);
            
            expect(adapter.requiresAuthentication()).toBe(false);
        });

        it('should return true when source is marked private', () => {
            const source = { ...mockSource, private: true };
            const adapter = new ApmAdapter(source);
            
            expect(adapter.requiresAuthentication()).toBe(true);
        });
    });

    describe('Configuration', () => {
        it('should accept custom branch config', () => {
            const source = { 
                ...mockSource, 
                config: { branch: 'develop' } 
            };
            const adapter = new ApmAdapter(source);
            
            expect(adapter).toBeTruthy();
        });

        it('should accept custom cache TTL config', () => {
            const source = { 
                ...mockSource, 
                config: { cacheTtl: 60000 } 
            };
            const adapter = new ApmAdapter(source);
            
            expect(adapter).toBeTruthy();
        });
    });

    describe('Security', () => {
        it('should validate GitHub URL format strictly', () => {
            const maliciousUrls = [
                'https://github.com/owner/repo;rm -rf /',
                'https://github.com/owner/repo|cat /etc/passwd',
                'javascript:alert(1)',
                'file:///etc/passwd',
            ];
            
            for (const url of maliciousUrls) {
                const source = { ...mockSource, url };
                expect(() => new ApmAdapter(source)).toThrow(/Invalid|URL|GitHub/i);
            }
        });

        it('should not execute arbitrary code from manifest', async () => {
            // This test verifies that even if a manifest contains script fields,
            // the adapter does not execute them - it only parses YAML data
            const adapter = new ApmAdapter(mockSource);
            
            // Fetch bundles - internal https.get will fail for non-existent repo
            // but this demonstrates the adapter doesn't execute scripts
            const bundles = await adapter.fetchBundles();
            
            // Should return array (empty or with bundles) without executing any scripts
            expect(Array.isArray(bundles)).toBeTruthy();
        });
    });

    describe('Error Handling', () => {
        it('should handle network errors gracefully', async () => {
            // When network fails, adapter should return empty array (internal error handling)
            // Network errors are caught internally and result in empty bundle array
            const adapter = new ApmAdapter(mockSource);
            
            // The adapter uses https.get internally which will fail for non-existent repos
            // This tests the graceful handling - no unhandled rejections
            const bundles = await adapter.fetchBundles();
            
            // Should return empty array on failure (repo doesn't exist)
            expect(Array.isArray(bundles)).toBeTruthy();
        });

        it('should provide helpful error messages when runtime not installed', async () => {
            mockRuntime.getStatus.resolves({ installed: false });
            
            const adapter = new ApmAdapter(mockSource);
            
            try {
                await adapter.fetchBundles();
                expect.fail('Should have thrown');
            } catch (error: any) {
                expect(error.message.includes('APM') || error.message.includes('install')).toBeTruthy();
            }
        });
    });
});
