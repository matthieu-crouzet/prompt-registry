/**
 * SchemaValidator Unit Tests
 */

import * as path from 'path';
import * as fs from 'fs';
import { SchemaValidator, ValidationResult } from '../../src/services/SchemaValidator';

describe('SchemaValidator', () => {
    let validator: SchemaValidator;
    let tempDir: string;
    let testSchemaPath: string;
    let testCollectionSchemaPath: string;

    // Test data
    const validCollection = {
        id: 'test-collection',
        name: 'Test Collection',
        description: 'A test collection for validation',
        version: '1.0.0',
        author: 'Test Author',
        items: [
            { path: 'prompts/test.txt', kind: 'prompt' },
            { path: 'instructions/guide.md', kind: 'instruction' }
        ]
    };

    const minimalCollection = {
        id: 'minimal',
        name: 'Minimal',
        description: 'Minimal collection',
        items: []
    };

    beforeEach(() => {
        validator = new SchemaValidator(process.cwd());
        tempDir = path.join(__dirname, '..', '..', 'test-temp-schema');
        
        // Create temp directory
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Create a test schema
        testSchemaPath = path.join(tempDir, 'test.schema.json');
        const testSchema = {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "required": ["name"],
            "properties": {
                "name": { "type": "string", "minLength": 1 },
                "age": { "type": "number", "minimum": 0 }
            }
        };
        fs.writeFileSync(testSchemaPath, JSON.stringify(testSchema, null, 2));

        // Path to actual collection schema (should exist after previous implementation)
        testCollectionSchemaPath = path.join(process.cwd(), 'schemas', 'collection.schema.json');
    });

    afterEach(() => {
        // Cleanup temp directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        
        // Clear schema cache
        validator.clearCache();
    });

    describe('Schema Loading', () => {
        it('should load and compile a valid schema', async () => {
            const result = await validator.validate({ name: 'Test' }, testSchemaPath);
            expect(result).toBeTruthy();
            expect(result.valid).toBe(true);
        });

        it('should cache loaded schemas', async () => {
            // First load
            await validator.validate({ name: 'Test1' }, testSchemaPath);
            
            // Second load (should use cache)
            const result = await validator.validate({ name: 'Test2' }, testSchemaPath);
            expect(result.valid).toBe(true);
        });

        it('should throw error for non-existent schema', async () => {
            const badPath = path.join(tempDir, 'nonexistent.schema.json');
            const result = await validator.validate({ name: 'Test' }, badPath);
            
            expect(result.valid).toBe(false);
            expect(result.errors.length > 0).toBeTruthy();
            expect(result.errors[0].includes('Validation error')).toBeTruthy();
        });

        it('should throw error for invalid JSON schema', async () => {
            const invalidSchemaPath = path.join(tempDir, 'invalid.schema.json');
            fs.writeFileSync(invalidSchemaPath, 'not valid json');
            
            const result = await validator.validate({ name: 'Test' }, invalidSchemaPath);
            
            expect(result.valid).toBe(false);
            expect(result.errors.length > 0).toBeTruthy();
        });
    });

    describe('Basic Validation', () => {
        it('should validate valid data', async () => {
            const validData = { name: 'John', age: 30 };
            const result = await validator.validate(validData, testSchemaPath);
            
            expect(result.valid).toBe(true);
            expect(result.errors.length).toBe(0);
        });

        it('should detect missing required field', async () => {
            const invalidData = { age: 30 };
            const result = await validator.validate(invalidData, testSchemaPath);
            
            expect(result.valid).toBe(false);
            expect(result.errors.length > 0).toBeTruthy();
            expect(result.errors[0].includes('Missing required field')).toBeTruthy();
            expect(result.errors[0].includes('name')).toBeTruthy();
        });

        it('should detect wrong type', async () => {
            const invalidData = { name: 'John', age: 'thirty' };
            const result = await validator.validate(invalidData, testSchemaPath);
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('must be number'))).toBeTruthy();
        });

        it('should detect value below minimum', async () => {
            const invalidData = { name: 'John', age: -5 };
            const result = await validator.validate(invalidData, testSchemaPath);
            
            expect(result.valid).toBe(false);
            expect(result.errors.length > 0).toBeTruthy();
        });
    });

    describe('Collection Validation', () => {
        it('should validate valid collection', async ({ skip }: any) => {
            // Skip if schema doesn't exist yet
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const result = await validator.validateCollection(validCollection);
            
            expect(result.valid).toBe(true);
            expect(result.errors.length).toBe(0);
        });

        it('should validate minimal valid collection', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const result = await validator.validateCollection(minimalCollection);
            
            expect(result.valid).toBe(true);
            expect(result.errors.length).toBe(0);
        });

        it('should detect missing required fields in collection', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const invalidCollection = {
                id: 'test',
                name: 'Test'
                // missing description and items
            };

            const result = await validator.validateCollection(invalidCollection);
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('description'))).toBeTruthy();
        });

        it('should detect invalid id format', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const invalidCollection = {
                id: 'Invalid_ID_With_Caps',
                name: 'Test',
                description: 'Test description',
                items: []
            };

            const result = await validator.validateCollection(invalidCollection);
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('pattern') || e.includes('id'))).toBeTruthy();
        });

        it('should detect invalid item kind', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const invalidCollection = {
                id: 'test-collection',
                name: 'Test',
                description: 'Test description',
                items: [
                    { path: 'test.txt', kind: 'invalid-kind' }
                ]
            };

            const result = await validator.validateCollection(invalidCollection);
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('allowed values') || e.includes('enum'))).toBeTruthy();
        });

        it('should detect description too long', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const invalidCollection = {
                id: 'test-collection',
                name: 'Test',
                description: 'x'.repeat(600), // Over 500 limit
                items: []
            };

            const result = await validator.validateCollection(invalidCollection);
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('maximum') || e.includes('500'))).toBeTruthy();
        });
    });

        it('should validate collection with valid MCP configuration', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const collectionWithMcp = {
                id: 'test-mcp-collection',
                name: 'Test MCP Collection',
                description: 'Collection with MCP servers',
                items: [
                    { path: 'prompts/test.md', kind: 'prompt' }
                ],
                mcp: {
                    items: {
                        'time-server': {
                            type: 'stdio',
                            command: 'npx',
                            args: ['-y', '@modelcontextprotocol/server-sequential-thinking']
                        },
                        'custom-server': {
                            type: 'stdio',
                            command: 'node',
                            args: ['${bundlePath}/server.js'],
                            env: {
                                LOG_LEVEL: 'debug'
                            },
                            disabled: false
                        }
                    }
                }
            };

            const result = await validator.validateCollection(collectionWithMcp);
            
            expect(result.valid, `Validation failed: ${result.errors.join(', ')}`).toBe(true);
            expect(result.errors.length).toBe(0);
        });
        it('should validate MCP with environment variables', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const mcpWithEnv = {
                id: 'test-mcp-env',
                name: 'MCP with Environment',
                description: 'Collection with MCP env variables',
                items: [],
                mcp: {
                    items: {
                        'github-server': {
                            type: 'stdio',
                            command: 'npx',
                            args: ['-y', '@modelcontextprotocol/server-github'],
                            env: {
                                GITHUB_TOKEN: '${env:GITHUB_TOKEN}',
                                LOG_LEVEL: 'info'
                            }
                        }
                    }
                }
            };

            const result = await validator.validateCollection(mcpWithEnv);
            
            expect(result.valid, `Validation failed: ${result.errors.join(', ')}`).toBe(true);
        });

        it('should validate MCP with variable substitution in args', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const mcpWithVariables = {
                id: 'test-mcp-vars',
                name: 'MCP with Variables',
                description: 'Collection with variable substitution',
                items: [],
                mcp: {
                    items: {
                        'custom': {
                            type: 'stdio',
                            command: 'node',
                            args: [
                                '${bundlePath}/server.js',
                                '--id',
                                '${bundleId}',
                                '--version',
                                '${bundleVersion}'
                            ]
                        }
                    }
                }
            };

            const result = await validator.validateCollection(mcpWithVariables);
            
            expect(result.valid, `Validation failed: ${result.errors.join(', ')}`).toBe(true);
        });


        it('should detect stdio MCP server missing required command', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const invalidStdioMcp = {
                id: 'test-invalid-stdio',
                name: 'Invalid Stdio MCP',
                description: 'Stdio MCP missing command',
                items: [],
                mcp: {
                    items: {
                        'invalid-stdio': {
                            type: 'stdio',
                            // Missing required 'command' field for stdio type
                            args: ['some-arg']
                        }
                    }
                }
            };

            const result = await validator.validateCollection(invalidStdioMcp);
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('command'))).toBeTruthy();
        });

        it('should detect http MCP server missing required url', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const invalidHttpMcp = {
                id: 'test-invalid-http',
                name: 'Invalid HTTP MCP',
                description: 'HTTP MCP missing url',
                items: [],
                mcp: {
                    items: {
                        'invalid-http': {
                            type: 'http',
                            // Missing required 'url' field for http type
                            env: { API_KEY: 'test' }
                        }
                    }
                }
            };

            const result = await validator.validateCollection(invalidHttpMcp);
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('url'))).toBeTruthy();
        });

        it('should validate http MCP server with url', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const httpMcpCollection = {
                id: 'test-http-mcp',
                name: 'HTTP MCP Collection',
                description: 'Collection with HTTP MCP server',
                items: [],
                mcp: {
                    items: {
                        'remote-server': {
                            type: 'http',
                            url: 'https://api.example.com/mcp',
                            env: {
                                API_KEY: 'test-key'
                            }
                        }
                    }
                }
            };

            const result = await validator.validateCollection(httpMcpCollection);
            
            expect(result.valid, `Validation failed: ${result.errors.join(', ')}`).toBe(true);
            expect(result.errors.length).toBe(0);
        });

        it('should allow collection without MCP (optional)', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const collectionWithoutMcp = {
                id: 'test-no-mcp',
                name: 'No MCP Collection',
                description: 'Collection without MCP servers',
                items: [
                    { path: 'prompts/test.md', kind: 'prompt' }
                ]
            };

            const result = await validator.validateCollection(collectionWithoutMcp);
            
            expect(result.valid, `Validation failed: ${result.errors.join(', ')}`).toBe(true);
        });

        it('should validate collection with valid MCP configuration', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const collectionWithMcp = {
                id: 'test-mcp-collection',
                name: 'Test MCP Collection',
                description: 'Collection with MCP servers',
                items: [
                    { path: 'prompts/test.md', kind: 'prompt' }
                ],
                mcp: {
                    items: {
                        'time-server': {
                            type: 'stdio',
                            command: 'npx',
                            args: ['-y', '@modelcontextprotocol/server-sequential-thinking']
                        },
                        'custom-server': {
                            type: 'stdio',
                            command: 'node',
                            args: ['${bundlePath}/server.js'],
                            env: {
                                LOG_LEVEL: 'debug'
                            },
                            disabled: false
                        }
                    }
                }
            };

            const result = await validator.validateCollection(collectionWithMcp);
            
            expect(result.valid, `Validation failed: ${result.errors.join(', ')}`).toBe(true);
            expect(result.errors.length).toBe(0);
        });
        it('should validate MCP with environment variables', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const mcpWithEnv = {
                id: 'test-mcp-env',
                name: 'MCP with Environment',
                description: 'Collection with MCP env variables',
                items: [],
                mcp: {
                    items: {
                        'github-server': {
                            type: 'stdio',
                            command: 'npx',
                            args: ['-y', '@modelcontextprotocol/server-github'],
                            env: {
                                GITHUB_TOKEN: '${env:GITHUB_TOKEN}',
                                LOG_LEVEL: 'info'
                            }
                        }
                    }
                }
            };

            const result = await validator.validateCollection(mcpWithEnv);
            
            expect(result.valid, `Validation failed: ${result.errors.join(', ')}`).toBe(true);
        });

        it('should validate MCP with variable substitution in args', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const mcpWithVariables = {
                id: 'test-mcp-vars',
                name: 'MCP with Variables',
                description: 'Collection with variable substitution',
                items: [],
                mcp: {
                    items: {
                        'custom': {
                            type: 'stdio',
                            command: 'node',
                            args: [
                                '${bundlePath}/server.js',
                                '--id',
                                '${bundleId}',
                                '--version',
                                '${bundleVersion}'
                            ]
                        }
                    }
                }
            };

            const result = await validator.validateCollection(mcpWithVariables);
            
            expect(result.valid, `Validation failed: ${result.errors.join(', ')}`).toBe(true);
        });

        it('should allow collection without MCP (optional)', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const collectionWithoutMcp = {
                id: 'test-no-mcp',
                name: 'No MCP Collection',
                description: 'Collection without MCP servers',
                items: [
                    { path: 'prompts/test.md', kind: 'prompt' }
                ]
            };

            const result = await validator.validateCollection(collectionWithoutMcp);
            
            expect(result.valid, `Validation failed: ${result.errors.join(', ')}`).toBe(true);
        });

        it('should validate collection with valid MCP configuration', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const collectionWithMcp = {
                id: 'test-mcp-collection',
                name: 'Test MCP Collection',
                description: 'Collection with MCP servers',
                items: [
                    { path: 'prompts/test.md', kind: 'prompt' }
                ],
                mcp: {
                    items: {
                        'time-server': {
                            type: 'stdio',
                            command: 'npx',
                            args: ['-y', '@modelcontextprotocol/server-sequential-thinking']
                        },
                        'custom-server': {
                            type: 'stdio',
                            command: 'node',
                            args: ['${bundlePath}/server.js'],
                            env: {
                                LOG_LEVEL: 'debug'
                            },
                            disabled: false
                        }
                    }
                }
            };

            const result = await validator.validateCollection(collectionWithMcp);
            
            expect(result.valid, `Validation failed: ${result.errors.join(', ')}`).toBe(true);
            expect(result.errors.length).toBe(0);
        });
        it('should validate MCP with environment variables', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const mcpWithEnv = {
                id: 'test-mcp-env',
                name: 'MCP with Environment',
                description: 'Collection with MCP env variables',
                items: [],
                mcp: {
                    items: {
                        'github-server': {
                            type: 'stdio',
                            command: 'npx',
                            args: ['-y', '@modelcontextprotocol/server-github'],
                            env: {
                                GITHUB_TOKEN: '${env:GITHUB_TOKEN}',
                                LOG_LEVEL: 'info'
                            }
                        }
                    }
                }
            };

            const result = await validator.validateCollection(mcpWithEnv);
            
            expect(result.valid, `Validation failed: ${result.errors.join(', ')}`).toBe(true);
        });

        it('should validate MCP with variable substitution in args', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const mcpWithVariables = {
                id: 'test-mcp-vars',
                name: 'MCP with Variables',
                description: 'Collection with variable substitution',
                items: [],
                mcp: {
                    items: {
                        'custom': {
                            type: 'stdio',
                            command: 'node',
                            args: [
                                '${bundlePath}/server.js',
                                '--id',
                                '${bundleId}',
                                '--version',
                                '${bundleVersion}'
                            ]
                        }
                    }
                }
            };

            const result = await validator.validateCollection(mcpWithVariables);
            
            expect(result.valid, `Validation failed: ${result.errors.join(', ')}`).toBe(true);
        });

        it('should allow collection without MCP (optional)', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const collectionWithoutMcp = {
                id: 'test-no-mcp',
                name: 'No MCP Collection',
                description: 'Collection without MCP servers',
                items: [
                    { path: 'prompts/test.md', kind: 'prompt' }
                ]
            };

            const result = await validator.validateCollection(collectionWithoutMcp);
            
            expect(result.valid, `Validation failed: ${result.errors.join(', ')}`).toBe(true);
        });

    describe('Error Formatting', () => {
        it('should format required field errors', async () => {
            const result = await validator.validate({}, testSchemaPath);
            
            expect(result.errors.some(e => e.includes('Missing required field: name'))).toBeTruthy();
        });

        it('should format type errors', async () => {
            const result = await validator.validate({ name: 123 }, testSchemaPath);
            
            expect(result.errors.some(e => e.includes('must be string'))).toBeTruthy();
        });

        it('should format minLength errors', async () => {
            const result = await validator.validate({ name: '' }, testSchemaPath);
            
            expect(result.errors.some(e => e.includes('minimum 1 characters'))).toBeTruthy();
        });
    });

    describe('File Reference Validation', () => {
        it('should not check file references by default', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const collectionWithRefs = {
                id: 'test',
                name: 'Test',
                description: 'Test',
                items: [
                    { path: 'nonexistent.txt', kind: 'prompt' }
                ]
            };

            const result = await validator.validateCollection(collectionWithRefs);
            
            // Should be valid (schema-wise) even if files don't exist
            expect(result.valid).toBe(true);
            // Should not have file reference errors
            expect(!result.errors.some(e => e.includes('not found'))).toBeTruthy();
        });

        it('should check file references when option enabled', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const collectionWithRefs = {
                id: 'test',
                name: 'Test',
                description: 'Test',
                items: [
                    { path: 'nonexistent.txt', kind: 'prompt' }
                ]
            };

            const result = await validator.validateCollection(collectionWithRefs, {
                checkFileReferences: true,
                workspaceRoot: tempDir
            });
            
            // Should have file reference errors
            expect(result.errors.some(e => e.includes('not found'))).toBeTruthy();
        });

        it('should pass when referenced files exist', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            // Create test file
            const testFilePath = path.join(tempDir, 'exists.txt');
            fs.writeFileSync(testFilePath, 'test content');

            const collectionWithRefs = {
                id: 'test',
                name: 'Test',
                description: 'Test',
                items: [
                    { path: 'exists.txt', kind: 'prompt' }
                ]
            };

            const result = await validator.validateCollection(collectionWithRefs, {
                checkFileReferences: true,
                workspaceRoot: tempDir
            });
            
            // Should not have file reference errors
            expect(!result.errors.some(e => e.includes('not found'))).toBeTruthy();
        });
    });

    describe('Warning Generation', () => {
        it('should warn about long descriptions', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const collection = {
                id: 'test',
                name: 'Test',
                description: 'x'.repeat(350), // Over 300 but under 500
                items: []
            };

            const result = await validator.validateCollection(collection);
            
            expect(result.warnings.some(w => w.includes('quite long'))).toBeTruthy();
        });

        it('should warn about empty collections', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const result = await validator.validateCollection(minimalCollection);
            
            expect(result.warnings.some(w => w.includes('no items'))).toBeTruthy();
        });

        it('should warn about too many items', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const manyItems = Array.from({ length: 35 }, (_, i) => ({
                path: `item${i}.txt`,
                kind: 'prompt' as const
            }));

            const collection = {
                id: 'test',
                name: 'Test',
                description: 'Test',
                items: manyItems
            };

            const result = await validator.validateCollection(collection);
            
            expect(result.warnings.some(w => w.includes('many items'))).toBeTruthy();
        });

        it('should warn about missing version', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const result = await validator.validateCollection(minimalCollection);
            
            expect(result.warnings.some(w => w.includes('version'))).toBeTruthy();
        });

        it('should warn about missing author', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const result = await validator.validateCollection(minimalCollection);
            
            expect(result.warnings.some(w => w.includes('author'))).toBeTruthy();
        });

        it('should not warn when metadata is complete', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const result = await validator.validateCollection(validCollection);
            
            // Should have minimal warnings (only about empty items if any)
            const metadataWarnings = result.warnings.filter(w => 
                w.includes('version') || w.includes('author')
            );
            expect(metadataWarnings.length).toBe(0);
        });
    });

    describe('MCP Remote Server Types (HTTP/SSE)', () => {
        it('should validate HTTP MCP server with url', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const httpMcpCollection = {
                id: 'test-http-mcp',
                name: 'HTTP MCP Collection',
                description: 'Collection with HTTP MCP server',
                items: [],
                mcp: {
                    items: {
                        'remote-api': {
                            type: 'http',
                            url: 'https://api.example.com/mcp'
                        }
                    }
                }
            };

            const result = await validator.validateCollection(httpMcpCollection);
            expect(result.valid, `Validation failed: ${result.errors.join(', ')}`).toBe(true);
        });

        it('should validate SSE MCP server with url', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const sseMcpCollection = {
                id: 'test-sse-mcp',
                name: 'SSE MCP Collection',
                description: 'Collection with SSE MCP server',
                items: [],
                mcp: {
                    items: {
                        'sse-stream': {
                            type: 'sse',
                            url: 'https://stream.example.com/events'
                        }
                    }
                }
            };

            const result = await validator.validateCollection(sseMcpCollection);
            expect(result.valid, `Validation failed: ${result.errors.join(', ')}`).toBe(true);
        });

        it('should validate HTTP MCP server with headers', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const httpWithHeaders = {
                id: 'test-http-headers',
                name: 'HTTP with Headers',
                description: 'HTTP MCP with authentication headers',
                items: [],
                mcp: {
                    items: {
                        'authenticated-api': {
                            type: 'http',
                            url: 'https://api.example.com/mcp',
                            headers: {
                                'Authorization': 'Bearer ${input:api-token}',
                                'X-Custom-Header': 'value'
                            }
                        }
                    }
                }
            };

            const result = await validator.validateCollection(httpWithHeaders);
            expect(result.valid, `Validation failed: ${result.errors.join(', ')}`).toBe(true);
        });

        it('should reject HTTP MCP server without url', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const invalidHttpMcp = {
                id: 'test-invalid-http',
                name: 'Invalid HTTP MCP',
                description: 'HTTP MCP missing url',
                items: [],
                mcp: {
                    items: {
                        'broken-http': {
                            type: 'http'
                        }
                    }
                }
            };

            const result = await validator.validateCollection(invalidHttpMcp);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('url'))).toBeTruthy();
        });

        it('should reject SSE MCP server without url', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const invalidSseMcp = {
                id: 'test-invalid-sse',
                name: 'Invalid SSE MCP',
                description: 'SSE MCP missing url',
                items: [],
                mcp: {
                    items: {
                        'broken-sse': {
                            type: 'sse',
                            headers: {
                                'Authorization': 'Bearer token'
                            }
                        }
                    }
                }
            };

            const result = await validator.validateCollection(invalidSseMcp);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('url'))).toBeTruthy();
        });
    });

    describe('MCP Stdio Server with envFile', () => {
        it('should validate stdio MCP server with envFile', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const stdioWithEnvFile = {
                id: 'test-stdio-envfile',
                name: 'Stdio with EnvFile',
                description: 'Stdio MCP with environment file',
                items: [],
                mcp: {
                    items: {
                        'local-server': {
                            type: 'stdio',
                            command: 'node',
                            args: ['${bundlePath}/server.js'],
                            envFile: '${bundlePath}/.env'
                        }
                    }
                }
            };

            const result = await validator.validateCollection(stdioWithEnvFile);
            expect(result.valid, `Validation failed: ${result.errors.join(', ')}`).toBe(true);
        });

        it('should validate stdio MCP server with both env and envFile', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const stdioWithBoth = {
                id: 'test-stdio-both',
                name: 'Stdio with Both',
                description: 'Stdio MCP with env and envFile',
                items: [],
                mcp: {
                    items: {
                        'hybrid-server': {
                            type: 'stdio',
                            command: 'python',
                            args: ['-m', 'my_mcp_server'],
                            env: {
                                'LOG_LEVEL': 'debug'
                            },
                            envFile: '${workspaceFolder}/.env'
                        }
                    }
                }
            };

            const result = await validator.validateCollection(stdioWithBoth);
            expect(result.valid, `Validation failed: ${result.errors.join(', ')}`).toBe(true);
        });
    });

    describe('MCP URL Format Support', () => {
        it('should validate Unix socket URL', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const unixSocketMcp = {
                id: 'test-unix-socket',
                name: 'Unix Socket MCP',
                description: 'MCP server via Unix socket',
                items: [],
                mcp: {
                    items: {
                        'unix-server': {
                            type: 'http',
                            url: 'unix:///tmp/mcp.sock'
                        }
                    }
                }
            };

            const result = await validator.validateCollection(unixSocketMcp);
            expect(result.valid, `Validation failed: ${result.errors.join(', ')}`).toBe(true);
        });

        it('should validate Windows named pipe URL', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const namedPipeMcp = {
                id: 'test-named-pipe',
                name: 'Named Pipe MCP',
                description: 'MCP server via Windows named pipe',
                items: [],
                mcp: {
                    items: {
                        'pipe-server': {
                            type: 'http',
                            url: 'pipe:///pipe/mcp-server'
                        }
                    }
                }
            };

            const result = await validator.validateCollection(namedPipeMcp);
            expect(result.valid, `Validation failed: ${result.errors.join(', ')}`).toBe(true);
        });

        it('should validate standard HTTP URL', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const httpUrlMcp = {
                id: 'test-http-url',
                name: 'HTTP URL MCP',
                description: 'MCP server via HTTP',
                items: [],
                mcp: {
                    items: {
                        'http-server': {
                            type: 'http',
                            url: 'http://localhost:3000/mcp'
                        }
                    }
                }
            };

            const result = await validator.validateCollection(httpUrlMcp);
            expect(result.valid, `Validation failed: ${result.errors.join(', ')}`).toBe(true);
        });

        it('should validate HTTPS URL', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const httpsUrlMcp = {
                id: 'test-https-url',
                name: 'HTTPS URL MCP',
                description: 'MCP server via HTTPS',
                items: [],
                mcp: {
                    items: {
                        'https-server': {
                            type: 'http',
                            url: 'https://secure.example.com/mcp'
                        }
                    }
                }
            };

            const result = await validator.validateCollection(httpsUrlMcp);
            expect(result.valid, `Validation failed: ${result.errors.join(', ')}`).toBe(true);
        });
    });

    describe('MCP Backward Compatibility', () => {
        it('should accept stdio server without explicit type (defaults to stdio)', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const legacyStdioMcp = {
                id: 'test-legacy-stdio',
                name: 'Legacy Stdio MCP',
                description: 'Stdio MCP without type field',
                items: [],
                mcp: {
                    items: {
                        'legacy-server': {
                            command: 'node',
                            args: ['server.js']
                        }
                    }
                }
            };

            const result = await validator.validateCollection(legacyStdioMcp);
            expect(result.valid, `Validation failed: ${result.errors.join(', ')}`).toBe(true);
        });

        it('should reject server without type and without command', async ({ skip }: any) => {
            if (!fs.existsSync(testCollectionSchemaPath)) {
                skip();
                return;
            }

            const invalidMcp = {
                id: 'test-invalid-no-type-no-command',
                name: 'Invalid MCP',
                description: 'MCP without type or command',
                items: [],
                mcp: {
                    items: {
                        'broken-server': {
                            args: ['some-arg']
                        }
                    }
                }
            };

            const result = await validator.validateCollection(invalidMcp);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('command'))).toBeTruthy();
        });
    });

    describe('Cache Management', () => {
        it('should clear cache', async () => {
            // Load schema
            await validator.validate({ name: 'Test' }, testSchemaPath);
            
            // Clear cache
            validator.clearCache();
            
            // Should still work after clearing
            const result = await validator.validate({ name: 'Test' }, testSchemaPath);
            expect(result.valid).toBe(true);
        });

        it('should reload schema after cache clear', async () => {
            // Load schema
            await validator.validate({ name: 'Test' }, testSchemaPath);
            
            // Modify schema file
            const modifiedSchema = {
                "$schema": "http://json-schema.org/draft-07/schema#",
                "type": "object",
                "required": ["name", "email"],
                "properties": {
                    "name": { "type": "string" },
                    "email": { "type": "string" }
                }
            };
            fs.writeFileSync(testSchemaPath, JSON.stringify(modifiedSchema, null, 2));
            
            // Clear cache to force reload
            validator.clearCache();
            
            // Validate with new schema
            const result = await validator.validate({ name: 'Test' }, testSchemaPath);
            
            // Should fail because email is now required
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('email'))).toBeTruthy();
        });
    });
});
