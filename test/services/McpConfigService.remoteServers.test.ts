/**
 * MCP Config Service - Remote Server Support Tests
 * 
 * TDD tests for remote MCP server (HTTP/SSE) handling and type discrimination.
 * These tests verify the refactored type system and processing logic.
 */
import * as sinon from 'sinon';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import { McpConfigService } from '../../src/services/McpConfigService';
import {
    McpServerConfig,
    McpStdioServerConfig,
    McpRemoteServerConfig,
    isStdioServerConfig,
    isRemoteServerConfig
} from '../../src/types/mcp';

describe('McpConfigService - Remote Server Support', () => {
    let sandbox: sinon.SinonSandbox;
    let configService: McpConfigService;
    let testDir: string;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        configService = new McpConfigService();
        testDir = path.join(os.tmpdir(), 'mcp-remote-test-' + Date.now());
        fs.ensureDirSync(testDir);
    });

    afterEach(async () => {
        sandbox.restore();
        if (fs.existsSync(testDir)) {
            await fs.remove(testDir);
        }
    });

    describe('Type Guards', () => {
        describe('isStdioServerConfig()', () => {
            it('should return true for explicit stdio type', () => {
                const config: McpServerConfig = {
                    type: 'stdio',
                    command: 'node',
                    args: ['server.js']
                };
                expect(isStdioServerConfig(config)).toBe(true);
            });

            it('should return true for config without type (backward compatibility)', () => {
                const config: McpServerConfig = {
                    command: 'node',
                    args: ['server.js']
                } as McpStdioServerConfig;
                expect(isStdioServerConfig(config)).toBe(true);
            });

            it('should return false for http type', () => {
                const config: McpServerConfig = {
                    type: 'http',
                    url: 'https://api.example.com/mcp'
                };
                expect(isStdioServerConfig(config)).toBe(false);
            });

            it('should return false for sse type', () => {
                const config: McpServerConfig = {
                    type: 'sse',
                    url: 'https://api.example.com/mcp/sse'
                };
                expect(isStdioServerConfig(config)).toBe(false);
            });
        });

        describe('isRemoteServerConfig()', () => {
            it('should return true for http type with url', () => {
                const config: McpServerConfig = {
                    type: 'http',
                    url: 'https://api.example.com/mcp'
                };
                expect(isRemoteServerConfig(config)).toBe(true);
            });

            it('should return true for sse type with url', () => {
                const config: McpServerConfig = {
                    type: 'sse',
                    url: 'https://api.example.com/mcp/sse'
                };
                expect(isRemoteServerConfig(config)).toBe(true);
            });

            it('should return false for stdio type', () => {
                const config: McpServerConfig = {
                    type: 'stdio',
                    command: 'node',
                    args: ['server.js']
                };
                expect(isRemoteServerConfig(config)).toBe(false);
            });

            it('should return false for config without type (defaults to stdio)', () => {
                const config: McpServerConfig = {
                    command: 'node',
                    args: ['server.js']
                } as McpStdioServerConfig;
                expect(isRemoteServerConfig(config)).toBe(false);
            });

            it('should return true for http type with headers', () => {
                const config: McpServerConfig = {
                    type: 'http',
                    url: 'https://api.example.com/mcp',
                    headers: {
                        'Authorization': 'Bearer token123'
                    }
                };
                expect(isRemoteServerConfig(config)).toBe(true);
            });
        });
    });

    describe('processServerDefinition() - Remote Servers', () => {
        const bundleId = 'test-bundle';
        const bundleVersion = '1.0.0';

        it('should process HTTP server with URL', () => {
            const definition: McpRemoteServerConfig = {
                type: 'http',
                url: 'https://api.example.com/mcp'
            };

            const result = configService.processServerDefinition(
                'http-server',
                definition,
                bundleId,
                bundleVersion,
                testDir
            );

            expect(isRemoteServerConfig(result)).toBe(true);
            const remoteResult = result as McpRemoteServerConfig;
            expect(remoteResult.type).toBe('http');
            expect(remoteResult.url).toBe('https://api.example.com/mcp');
        });

        it('should process SSE server with URL', () => {
            const definition: McpRemoteServerConfig = {
                type: 'sse',
                url: 'https://api.example.com/mcp/events'
            };

            const result = configService.processServerDefinition(
                'sse-server',
                definition,
                bundleId,
                bundleVersion,
                testDir
            );

            expect(isRemoteServerConfig(result)).toBe(true);
            const remoteResult = result as McpRemoteServerConfig;
            expect(remoteResult.type).toBe('sse');
            expect(remoteResult.url).toBe('https://api.example.com/mcp/events');
        });

        it('should substitute bundlePath variable in URL', () => {
            const definition: McpRemoteServerConfig = {
                type: 'http',
                url: 'file://${bundlePath}/local-server'
            };

            const result = configService.processServerDefinition(
                'local-http-server',
                definition,
                bundleId,
                bundleVersion,
                testDir
            );

            expect(isRemoteServerConfig(result)).toBe(true);
            const remoteResult = result as McpRemoteServerConfig;
            expect(remoteResult.url).toBe(`file://${testDir}/local-server`);
        });

        it('should substitute environment variables in URL', () => {
            const originalEnv = process.env.TEST_MCP_HOST;
            process.env.TEST_MCP_HOST = 'mcp.example.com';

            try {
                const definition: McpRemoteServerConfig = {
                    type: 'http',
                    url: 'https://${env:TEST_MCP_HOST}/api/mcp'
                };

                const result = configService.processServerDefinition(
                    'env-http-server',
                    definition,
                    bundleId,
                    bundleVersion,
                    testDir
                );

                expect(isRemoteServerConfig(result)).toBe(true);
                const remoteResult = result as McpRemoteServerConfig;
                expect(remoteResult.url).toBe('https://mcp.example.com/api/mcp');
            } finally {
                if (originalEnv === undefined) {
                    delete process.env.TEST_MCP_HOST;
                } else {
                    process.env.TEST_MCP_HOST = originalEnv;
                }
            }
        });

        it('should process headers with variable substitution', () => {
            const originalEnv = process.env.TEST_API_TOKEN;
            process.env.TEST_API_TOKEN = 'secret-token-123';

            try {
                const definition: McpRemoteServerConfig = {
                    type: 'http',
                    url: 'https://api.example.com/mcp',
                    headers: {
                        'Authorization': 'Bearer ${env:TEST_API_TOKEN}',
                        'X-Bundle-Id': '${bundleId}'
                    }
                };

                const result = configService.processServerDefinition(
                    'auth-http-server',
                    definition,
                    bundleId,
                    bundleVersion,
                    testDir
                );

                expect(isRemoteServerConfig(result)).toBe(true);
                const remoteResult = result as McpRemoteServerConfig;
                expect(remoteResult.headers?.['Authorization']).toBe('Bearer secret-token-123');
                expect(remoteResult.headers?.['X-Bundle-Id']).toBe(bundleId);
            } finally {
                if (originalEnv === undefined) {
                    delete process.env.TEST_API_TOKEN;
                } else {
                    process.env.TEST_API_TOKEN = originalEnv;
                }
            }
        });

        it('should preserve disabled field for remote servers', () => {
            const definition: McpRemoteServerConfig = {
                type: 'http',
                url: 'https://api.example.com/mcp',
                disabled: true
            };

            const result = configService.processServerDefinition(
                'disabled-http-server',
                definition,
                bundleId,
                bundleVersion,
                testDir
            );

            expect(result.disabled).toBe(true);
        });

        it('should preserve description field for remote servers', () => {
            const definition: McpRemoteServerConfig = {
                type: 'sse',
                url: 'https://api.example.com/mcp/sse',
                description: 'My SSE MCP server'
            };

            const result = configService.processServerDefinition(
                'described-sse-server',
                definition,
                bundleId,
                bundleVersion,
                testDir
            );

            expect(result.description).toBe('My SSE MCP server');
        });

        it('should handle Unix socket URL', () => {
            const definition: McpRemoteServerConfig = {
                type: 'http',
                url: 'unix:///tmp/mcp.sock'
            };

            const result = configService.processServerDefinition(
                'unix-socket-server',
                definition,
                bundleId,
                bundleVersion,
                testDir
            );

            expect(isRemoteServerConfig(result)).toBe(true);
            const remoteResult = result as McpRemoteServerConfig;
            expect(remoteResult.url).toBe('unix:///tmp/mcp.sock');
        });

        it('should handle Windows named pipe URL', () => {
            const definition: McpRemoteServerConfig = {
                type: 'http',
                url: 'pipe:///pipe/mcp-server'
            };

            const result = configService.processServerDefinition(
                'pipe-server',
                definition,
                bundleId,
                bundleVersion,
                testDir
            );

            expect(isRemoteServerConfig(result)).toBe(true);
            const remoteResult = result as McpRemoteServerConfig;
            expect(remoteResult.url).toBe('pipe:///pipe/mcp-server');
        });
    });

    describe('processServerDefinition() - Stdio Servers (Enhanced)', () => {
        const bundleId = 'test-bundle';
        const bundleVersion = '1.0.0';

        it('should preserve explicit stdio type', () => {
            const definition: McpStdioServerConfig = {
                type: 'stdio',
                command: 'node',
                args: ['server.js']
            };

            const result = configService.processServerDefinition(
                'stdio-server',
                definition,
                bundleId,
                bundleVersion,
                testDir
            );

            expect(isStdioServerConfig(result)).toBe(true);
            const stdioResult = result as McpStdioServerConfig;
            expect(stdioResult.type).toBe('stdio');
        });

        it('should handle config without type (backward compatibility)', () => {
            const definition: McpStdioServerConfig = {
                command: 'python',
                args: ['mcp_server.py']
            };

            const result = configService.processServerDefinition(
                'legacy-server',
                definition,
                bundleId,
                bundleVersion,
                testDir
            );

            expect(isStdioServerConfig(result)).toBe(true);
            const stdioResult = result as McpStdioServerConfig;
            expect(stdioResult.command).toBe('python');
        });

        it('should substitute envFile path', () => {
            const definition: McpStdioServerConfig = {
                command: 'node',
                args: ['server.js'],
                envFile: '${bundlePath}/.env'
            };

            const result = configService.processServerDefinition(
                'envfile-server',
                definition,
                bundleId,
                bundleVersion,
                testDir
            );

            expect(isStdioServerConfig(result)).toBe(true);
            const stdioResult = result as McpStdioServerConfig;
            expect(stdioResult.envFile).toBe(`${testDir}/.env`);
        });
    });

    describe('Mixed Server Types', () => {
        it('should correctly discriminate between stdio and remote in same manifest', () => {
            const stdioConfig: McpStdioServerConfig = {
                command: 'node',
                args: ['local-server.js']
            };

            const httpConfig: McpRemoteServerConfig = {
                type: 'http',
                url: 'https://api.example.com/mcp'
            };

            const sseConfig: McpRemoteServerConfig = {
                type: 'sse',
                url: 'https://api.example.com/mcp/events'
            };

            expect(isStdioServerConfig(stdioConfig)).toBe(true);
            expect(isRemoteServerConfig(stdioConfig)).toBe(false);

            expect(isStdioServerConfig(httpConfig)).toBe(false);
            expect(isRemoteServerConfig(httpConfig)).toBe(true);

            expect(isStdioServerConfig(sseConfig)).toBe(false);
            expect(isRemoteServerConfig(sseConfig)).toBe(true);
        });
    });
});
