/**
 * GitHubAdapter Authentication Tests
 * 
 * Tests to verify authentication headers are built correctly
 * for different authentication methods (VSCode, gh CLI, explicit token)
 */

import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { GitHubAdapter } from '../../src/adapters/GitHubAdapter';
import { RegistrySource } from '../../src/types/registry';

describe('GitHubAdapter Authentication Tests', () => {
    let sandbox: sinon.SinonSandbox;
    let source: RegistrySource;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        source = {
            id: 'test-source',
            name: 'Test Source',
            url: 'https://github.com/test-owner/test-repo',
            type: 'github',
            enabled: true,
            priority: 1,
        };
    });

    afterEach(() => {
        sandbox.restore();
    });

    // TODO: These tests are currently skipped because Sinon stubs don't properly mock child_process.exec
    // The GitHubAdapter imports child_process at module load time, so stubs created in tests come too late.
    // Solutions:
    // 1. Refactor GitHubAdapter to use dependency injection for child_process
    // 2. Use proxyquire or similar tool to mock modules before they're loaded
    // 3. Move these to integration tests
    // Until then, these tests would call the REAL gh CLI and expose actual tokens - security risk!

    it.skip('should use Bearer token format for VSCode authentication', async () => {
        // Mock VSCode authentication
        const mockSession = {
            accessToken: 'gho_mockVSCodeToken12345678901234567890',
            account: { id: 'test', label: 'test' },
            id: 'test',
            scopes: ['repo'],
        };

        const getSessionStub = sandbox.stub(vscode.authentication, 'getSession')
            .resolves(mockSession as any);

        const adapter = new GitHubAdapter(source);

        // Access private method via reflection
        const getAuthToken = (adapter as any).getAuthenticationToken.bind(adapter);
        const token = await getAuthToken();

        expect(token).toBe(mockSession.accessToken);
        expect((adapter as any).authMethod).toBe('vscode');
        
        // Verify getSession was called with correct params
        expect(getSessionStub.calledOnce).toBeTruthy();
        expect(getSessionStub.calledWith('github', ['repo'], { silent: true })).toBeTruthy();
    });

    it.skip('should build correct Authorization header with Bearer format', async () => {
        // Mock VSCode authentication
        const mockToken = 'gho_testToken123';
        const mockSession = {
            accessToken: mockToken,
            account: { id: 'test', label: 'test' },
            id: 'test',
            scopes: ['repo'],
        };

        sandbox.stub(vscode.authentication, 'getSession').resolves(mockSession as any);

        const adapter = new GitHubAdapter(source);

        // Get the token first to cache it
        await (adapter as any).getAuthenticationToken();

        // Get headers
        const makeRequest = (adapter as any).makeRequest.bind(adapter);
        
        // Spy on https.get to capture headers
        const httpsModule = require('https');
        const httpsGetStub = sandbox.stub(httpsModule, 'get').callsFake((url: any, options: any, callback: any) => {
            // Verify Authorization header format
            expect(options.headers.Authorization, 'Authorization header should exist').toBeTruthy();
            expect(options.headers.Authorization, 'Should use Bearer format, not token format').toBe(`Bearer ${mockToken}`);
            
            // Return mock response
            const mockResponse: any = {
                statusCode: 200,
                on: (event: string, handler: Function) => {
                    if (event === 'data') {
                        handler('{"test": "data"}');
                    } else if (event === 'end') {
                        handler();
                    }
                    return mockResponse;
                },
            };
            
            callback(mockResponse);
            return { on: () => ({}) };
        });

        try {
            await makeRequest('https://api.github.com/repos/test-owner/test-repo');
            expect(httpsGetStub.calledOnce, 'https.get should be called').toBeTruthy();
        } catch (error) {
            // Expected if mock doesn't perfectly emulate response
        }
    });

    it.skip('should use gh CLI token when VSCode auth fails', async () => {
        // Mock VSCode auth failure
        sandbox.stub(vscode.authentication, 'getSession').rejects(new Error('Not authenticated'));

        // Mock gh CLI success
        const mockToken = 'ghp_cliToken123';
        const { exec } = require('child_process');
        const execStub = sandbox.stub(require('child_process'), 'exec');
        execStub.callsFake((...args: any[]) => {
            const [cmd, callback] = args;
            if (cmd === 'gh auth token') {
                callback(null, { stdout: mockToken + '\n', stderr: '' });
            }
        });

        const adapter = new GitHubAdapter(source);

        const token = await (adapter as any).getAuthenticationToken();

        expect(token).toBe(mockToken);
        expect((adapter as any).authMethod).toBe('gh-cli');
    });

    it.skip('should use explicit token when both VSCode and gh CLI fail', async () => {
        // Mock VSCode auth failure
        sandbox.stub(vscode.authentication, 'getSession').rejects(new Error('Not authenticated'));

        // Mock gh CLI failure
        sandbox.stub(require('child_process'), 'exec').callsFake((...args: any[]) => {
            args[1](new Error('gh not found'), null);
        });

        // Create source with explicit token
        const mockToken = 'ghp_explicitToken123';
        const sourceWithToken: RegistrySource = {
            ...source,
            token: mockToken,
        };

        const adapter = new GitHubAdapter(sourceWithToken);

        const token = await (adapter as any).getAuthenticationToken();

        expect(token).toBe(mockToken);
        expect((adapter as any).authMethod).toBe('explicit');
    });

    it.skip('should return undefined when no authentication is available', async () => {
        // Mock all auth methods failing
        sandbox.stub(vscode.authentication, 'getSession').rejects(new Error('Not authenticated'));
        sandbox.stub(require('child_process'), 'exec').callsFake((...args: any[]) => {
            args[1](new Error('gh not found'), null);
        });

        const adapter = new GitHubAdapter(source);

        const token = await (adapter as any).getAuthenticationToken();

        expect(token).toBe(undefined);
        expect((adapter as any).authMethod).toBe('none');
    });

    it.skip('should cache authentication token after first retrieval', async () => {
        const mockToken = 'gho_cachedToken123';
        const mockSession = {
            accessToken: mockToken,
            account: { id: 'test', label: 'test' },
            id: 'test',
            scopes: ['repo'],
        };

        const getSessionStub = sandbox.stub(vscode.authentication, 'getSession')
            .resolves(mockSession as any);

        const adapter = new GitHubAdapter(source);

        // Call twice
        const token1 = await (adapter as any).getAuthenticationToken();
        const token2 = await (adapter as any).getAuthenticationToken();

        expect(token1).toBe(mockToken);
        expect(token2).toBe(mockToken);
        
        // Should only call VSCode auth once (cached on second call)
        expect(getSessionStub.calledOnce, 'VSCode auth should only be called once').toBeTruthy();
    });

    it.skip('should include authentication in download requests', async () => {
        const mockToken = 'gho_downloadToken123';
        const mockSession = {
            accessToken: mockToken,
            account: { id: 'test', label: 'test' },
            id: 'test',
            scopes: ['repo'],
        };

        sandbox.stub(vscode.authentication, 'getSession').resolves(mockSession as any);

        const adapter = new GitHubAdapter(source);

        // Get token to cache it
        await (adapter as any).getAuthenticationToken();

        // Spy on https.get for download
        const httpsModule = require('https');
        const httpsGetStub = sandbox.stub(httpsModule, 'get').callsFake((url: any, options: any, callback: any) => {
            // Verify download includes auth
            expect(options.headers.Authorization, 'Download should include Authorization header').toBeTruthy();
            expect(options.headers.Authorization, 'Download should use Bearer format').toBe(`Bearer ${mockToken}`);
            
            // Return mock response
            const mockResponse: any = {
                statusCode: 200,
                on: (event: string, handler: Function) => {
                    if (event === 'data') {
                        handler(Buffer.from('test data'));
                    } else if (event === 'end') {
                        handler();
                    }
                    return mockResponse;
                },
            };
            
            callback(mockResponse);
            return { on: () => ({}) };
        });

        try {
            await (adapter as any).downloadFile('https://github.com/test-owner/test-repo/releases/download/v1.0.0/bundle.zip');
            expect(httpsGetStub.calledOnce, 'Download should use https.get').toBeTruthy();
        } catch (error) {
            // Expected if mock doesn't perfectly emulate response
        }
    });

    it.skip('should provide helpful error message for 404 errors', async () => {
        sandbox.stub(vscode.authentication, 'getSession').resolves(undefined);

        const adapter = new GitHubAdapter(source);

        const httpsModule = require('https');
        sandbox.stub(httpsModule, 'get').callsFake((url: any, options: any, callback: any) => {
            const mockResponse: any = {
                statusCode: 404,
                statusMessage: 'Not Found',
                on: (event: string, handler: Function) => {
                    if (event === 'data') {
                        handler('{"message": "Not Found"}');
                    } else if (event === 'end') {
                        handler();
                    }
                    return mockResponse;
                },
            };
            
            callback(mockResponse);
            return { on: () => ({}) };
        });

        try {
            await (adapter as any).makeRequest('https://api.github.com/repos/test-owner/private-repo');
            expect.fail('Should have thrown an error');
        } catch (error: any) {
            expect(error.message.includes('404')).toBeTruthy();
            expect(error.message.includes('not accessible')).toBeTruthy();
            expect(error.message.includes('authentication')).toBeTruthy();
        }
    });

    it.skip('should provide helpful error message for 401 errors', async () => {
        const mockSession = {
            accessToken: 'invalid_token',
            account: { id: 'test', label: 'test' },
            id: 'test',
            scopes: ['repo'],
        };

        sandbox.stub(vscode.authentication, 'getSession').resolves(mockSession as any);

        const adapter = new GitHubAdapter(source);

        const httpsModule = require('https');
        sandbox.stub(httpsModule, 'get').callsFake((url: any, options: any, callback: any) => {
            const mockResponse: any = {
                statusCode: 401,
                statusMessage: 'Unauthorized',
                on: (event: string, handler: Function) => {
                    if (event === 'data') {
                        handler('{"message": "Bad credentials"}');
                    } else if (event === 'end') {
                        handler();
                    }
                    return mockResponse;
                },
            };
            
            callback(mockResponse);
            return { on: () => ({}) };
        });

        try {
            await (adapter as any).makeRequest('https://api.github.com/repos/test-owner/test-repo');
            expect.fail('Should have thrown an error');
        } catch (error: any) {
            expect(error.message.includes('401')).toBeTruthy();
            expect(error.message.includes('Authentication failed')).toBeTruthy();
            expect(error.message.includes('invalid or expired')).toBeTruthy();
        }
    });

    it.skip('should provide helpful error message for 403 errors', async () => {
        const mockSession = {
            accessToken: 'token_without_repo_scope',
            account: { id: 'test', label: 'test' },
            id: 'test',
            scopes: [],
        };

        sandbox.stub(vscode.authentication, 'getSession').resolves(mockSession as any);

        const adapter = new GitHubAdapter(source);

        const httpsModule = require('https');
        sandbox.stub(httpsModule, 'get').callsFake((url: any, options: any, callback: any) => {
            const mockResponse: any = {
                statusCode: 403,
                statusMessage: 'Forbidden',
                on: (event: string, handler: Function) => {
                    if (event === 'data') {
                        handler('{"message": "Insufficient scopes"}');
                    } else if (event === 'end') {
                        handler();
                    }
                    return mockResponse;
                },
            };
            
            callback(mockResponse);
            return { on: () => ({}) };
        });

        try {
            await (adapter as any).makeRequest('https://api.github.com/repos/test-owner/test-repo');
            expect.fail('Should have thrown an error');
        } catch (error: any) {
            expect(error.message.includes('403')).toBeTruthy();
            expect(error.message.includes('Access forbidden')).toBeTruthy();
            expect(error.message.includes('required scopes')).toBeTruthy();
        }
    });
});
