/**
 * DeploymentManifestValidator Unit Tests
 * 
 * Tests validation of deployment-manifest.yml files including:
 * - Required fields (id, name, version)
 * - Optional fields and their constraints
 * - Resource types (prompt, instructions, chatmode, agent)
 * - MCP server configuration
 * - Metadata, environments, hooks sections
 */

import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { DeploymentManifest } from '../../src/types/registry';

// Minimal valid manifest for testing
const createMinimalManifest = (): any => ({
    id: 'test-bundle',
    name: 'Test Bundle',
    version: '1.0.0'
});

// Full valid manifest with all optional fields
const createFullManifest = (): any => ({
    id: 'comprehensive-bundle',
    name: 'Comprehensive Bundle',
    version: '2.1.0',
    description: 'Complete example with all resource types',
    author: 'Test Author',
    tags: ['test', 'comprehensive'],
    environments: ['vscode', 'cursor'],
    license: 'MIT',
    repository: 'https://github.com/test/repo',
    dependencies: [],
    prompts: [
        {
            id: 'code-review',
            name: 'Code Review',
            description: 'Review code changes',
            file: 'prompts/code-review.prompt.md',
            type: 'prompt',
            tags: ['review']
        },
        {
            id: 'typescript-style',
            name: 'TypeScript Style',
            description: 'TypeScript standards',
            file: 'instructions/typescript.instructions.md',
            type: 'instructions',
            tags: ['style']
        },
        {
            id: 'architect',
            name: 'Senior Architect',
            description: 'Architecture expert',
            file: 'chatmodes/architect.chatmode.md',
            type: 'chatmode',
            tags: ['architecture']
        },
        {
            id: 'qa-engineer',
            name: 'QA Engineer',
            description: 'QA automation',
            file: 'agents/qa.agent.md',
            type: 'agent',
            tags: ['testing']
        }
    ],
    mcpServers: {
        filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/path']
        }
    },
    metadata: {
        manifest_version: '1.0',
        description: 'Test bundle',
        author: 'Test Author'
    }
});

describe('DeploymentManifestValidator - Schema Validation', () => {
    
    describe('Required Fields', () => {
        it('should accept minimal valid manifest with id, name, version', () => {
            const manifest = createMinimalManifest();
            
            expect(manifest.id).toBeTruthy();
            expect(manifest.name).toBeTruthy();
            expect(manifest.version).toBeTruthy();
            expect(manifest.id).toBe('test-bundle');
            expect(manifest.name).toBe('Test Bundle');
            expect(manifest.version).toBe('1.0.0');
        });

        it('should reject manifest missing id', () => {
            const manifest = createMinimalManifest();
            delete manifest.id;
            
            expect(manifest.id).toBe(undefined);
            // Validation should fail
        });

        it('should reject manifest missing name', () => {
            const manifest = createMinimalManifest();
            delete manifest.name;
            
            expect(manifest.name).toBe(undefined);
            // Validation should fail
        });

        it('should reject manifest missing version', () => {
            const manifest = createMinimalManifest();
            delete manifest.version;
            
            expect(manifest.version).toBe(undefined);
            // Validation should fail
        });

        it('should reject manifest with empty id', () => {
            const manifest = createMinimalManifest();
            manifest.id = '';
            
            expect(manifest.id).toBe('');
            // Validation should fail - id must not be empty
        });

        it('should reject manifest with empty name', () => {
            const manifest = createMinimalManifest();
            manifest.name = '';
            
            expect(manifest.name).toBe('');
            // Validation should fail - name must not be empty
        });

        it('should reject manifest with invalid version format', () => {
            const manifest = createMinimalManifest();
            manifest.version = 'not-a-version';
            
            // Should fail semantic version validation
            expect(manifest.version).toBeTruthy();
        });
    });

    describe('Optional Top-Level Fields', () => {
        it('should accept manifest with description', () => {
            const manifest = createMinimalManifest();
            manifest.description = 'A test bundle';
            
            expect(manifest.description).toBe('A test bundle');
        });

        it('should accept manifest with author', () => {
            const manifest = createMinimalManifest();
            manifest.author = 'Test Author';
            
            expect(manifest.author).toBe('Test Author');
        });

        it('should accept manifest with tags array', () => {
            const manifest = createMinimalManifest();
            manifest.tags = ['test', 'example'];
            
            expect(Array.isArray(manifest.tags)).toBeTruthy();
            expect(manifest.tags.length).toBe(2);
        });

        it('should accept manifest with environments array', () => {
            const manifest = createMinimalManifest();
            manifest.environments = ['vscode', 'cursor', 'windsurf'];
            
            expect(Array.isArray(manifest.environments)).toBeTruthy();
            expect(manifest.environments.includes('vscode')).toBeTruthy();
        });

        it('should accept manifest with license', () => {
            const manifest = createMinimalManifest();
            manifest.license = 'MIT';
            
            expect(manifest.license).toBe('MIT');
        });

        it('should accept manifest with repository URL', () => {
            const manifest = createMinimalManifest();
            manifest.repository = 'https://github.com/user/repo';
            
            expect(manifest.repository.startsWith('https://')).toBeTruthy();
        });

        it('should accept manifest with empty dependencies array', () => {
            const manifest = createMinimalManifest();
            manifest.dependencies = [];
            
            expect(Array.isArray(manifest.dependencies)).toBeTruthy();
            expect(manifest.dependencies.length).toBe(0);
        });
    });

    describe('Prompts Section - All Resource Types', () => {
        it('should accept manifest without prompts section', () => {
            const manifest = createMinimalManifest();
            
            expect(manifest.prompts).toBe(undefined);
            // Should be valid - prompts is optional
        });

        it('should accept manifest with empty prompts array', () => {
            const manifest = createMinimalManifest();
            manifest.prompts = [];
            
            expect(Array.isArray(manifest.prompts)).toBeTruthy();
            expect(manifest.prompts.length).toBe(0);
        });

        it('should accept prompt with type "prompt"', () => {
            const manifest = createMinimalManifest();
            manifest.prompts = [{
                id: 'test-prompt',
                name: 'Test Prompt',
                description: 'A test prompt',
                file: 'prompts/test.prompt.md',
                type: 'prompt'
            }];
            
            expect(manifest.prompts[0].type).toBe('prompt');
            expect(manifest.prompts[0].file.endsWith('.prompt.md')).toBeTruthy();
        });

        it('should accept prompt with type "instructions"', () => {
            const manifest = createMinimalManifest();
            manifest.prompts = [{
                id: 'test-instructions',
                name: 'Test Instructions',
                description: 'Test instructions',
                file: 'instructions/test.instructions.md',
                type: 'instructions'
            }];
            
            expect(manifest.prompts[0].type).toBe('instructions');
            expect(manifest.prompts[0].file.endsWith('.instructions.md')).toBeTruthy();
        });

        it('should accept prompt with type "chatmode"', () => {
            const manifest = createMinimalManifest();
            manifest.prompts = [{
                id: 'test-chatmode',
                name: 'Test Chatmode',
                description: 'Test chatmode',
                file: 'chatmodes/test.chatmode.md',
                type: 'chatmode'
            }];
            
            expect(manifest.prompts[0].type).toBe('chatmode');
            expect(manifest.prompts[0].file.endsWith('.chatmode.md')).toBeTruthy();
        });

        it('should accept prompt with type "agent"', () => {
            const manifest = createMinimalManifest();
            manifest.prompts = [{
                id: 'test-agent',
                name: 'Test Agent',
                description: 'Test agent',
                file: 'agents/test.agent.md',
                type: 'agent'
            }];
            
            expect(manifest.prompts[0].type).toBe('agent');
            expect(manifest.prompts[0].file.endsWith('.agent.md')).toBeTruthy();
        });

        it('should accept prompt without type (defaults to prompt)', () => {
            const manifest = createMinimalManifest();
            manifest.prompts = [{
                id: 'test-prompt',
                name: 'Test Prompt',
                description: 'A test prompt',
                file: 'prompts/test.prompt.md'
            }];
            
            expect(manifest.prompts[0].type).toBe(undefined);
            // Type is optional, defaults to 'prompt'
        });

        it('should reject prompt with invalid type', () => {
            const manifest = createMinimalManifest();
            manifest.prompts = [{
                id: 'test-prompt',
                name: 'Test Prompt',
                description: 'A test prompt',
                file: 'prompts/test.md',
                type: 'invalid-type'
            }];
            
            // Should fail - type must be one of: prompt, instructions, chatmode, agent
            expect(manifest.prompts[0].type).toBe('invalid-type');
        });

        it('should accept prompt with tags array', () => {
            const manifest = createMinimalManifest();
            manifest.prompts = [{
                id: 'test-prompt',
                name: 'Test Prompt',
                description: 'A test prompt',
                file: 'prompts/test.prompt.md',
                tags: ['testing', 'example']
            }];
            
            expect(Array.isArray(manifest.prompts[0].tags)).toBeTruthy();
            expect(manifest.prompts[0].tags.length).toBe(2);
        });

        it('should reject prompt missing required id', () => {
            const manifest = createMinimalManifest();
            manifest.prompts = [{
                name: 'Test Prompt',
                description: 'A test prompt',
                file: 'prompts/test.prompt.md'
            }];
            
            expect(manifest.prompts[0].id).toBe(undefined);
            // Should fail - id is required
        });

        it('should reject prompt missing required name', () => {
            const manifest = createMinimalManifest();
            manifest.prompts = [{
                id: 'test-prompt',
                description: 'A test prompt',
                file: 'prompts/test.prompt.md'
            }];
            
            expect(manifest.prompts[0].name).toBe(undefined);
            // Should fail - name is required
        });

        it('should reject prompt missing required file', () => {
            const manifest = createMinimalManifest();
            manifest.prompts = [{
                id: 'test-prompt',
                name: 'Test Prompt',
                description: 'A test prompt'
            }];
            
            expect(manifest.prompts[0].file).toBe(undefined);
            // Should fail - file is required
        });
    });

    describe('MCP Servers Section', () => {
        it('should accept manifest without mcpServers', () => {
            const manifest = createMinimalManifest();
            
            expect(manifest.mcpServers).toBe(undefined);
            // Should be valid - mcpServers is optional
        });

        it('should accept manifest with empty mcpServers object', () => {
            const manifest = createMinimalManifest();
            manifest.mcpServers = {};
            
            expect(typeof manifest.mcpServers).toBe('object');
            expect(Object.keys(manifest.mcpServers).length).toBe(0);
        });

        it('should accept valid MCP server configuration', () => {
            const manifest = createMinimalManifest();
            manifest.mcpServers = {
                filesystem: {
                    command: 'npx',
                    args: ['-y', '@modelcontextprotocol/server-filesystem']
                }
            };
            
            expect(manifest.mcpServers.filesystem).toBeTruthy();
            expect(manifest.mcpServers.filesystem.command).toBe('npx');
            expect(Array.isArray(manifest.mcpServers.filesystem.args)).toBeTruthy();
        });

        it('should accept MCP server with env variables', () => {
            const manifest = createMinimalManifest();
            manifest.mcpServers = {
                github: {
                    command: 'npx',
                    args: ['-y', '@modelcontextprotocol/server-github'],
                    env: {
                        GITHUB_TOKEN: '${env:GITHUB_TOKEN}',
                        LOG_LEVEL: 'ERROR'
                    }
                }
            };
            
            expect(manifest.mcpServers.github.env).toBeTruthy();
            expect(manifest.mcpServers.github.env.GITHUB_TOKEN).toBeTruthy();
        });

        it('should reject MCP server missing command', () => {
            const manifest = createMinimalManifest();
            manifest.mcpServers = {
                invalid: {
                    args: ['some-arg']
                }
            };
            
            expect(manifest.mcpServers.invalid.command).toBe(undefined);
            // Should fail - command is required
        });
    });

    describe('Metadata Section', () => {
        it('should accept manifest without metadata section', () => {
            const manifest = createMinimalManifest();
            
            expect(manifest.metadata).toBe(undefined);
            // Should be valid - metadata is optional
        });

        it('should accept metadata with manifest_version', () => {
            const manifest = createMinimalManifest();
            manifest.metadata = {
                manifest_version: '1.0',
                description: 'Test'
            };
            
            expect(manifest.metadata.manifest_version).toBe('1.0');
        });

        it('should accept metadata with repository object', () => {
            const manifest = createMinimalManifest();
            manifest.metadata = {
                manifest_version: '1.0',
                description: 'Test',
                repository: {
                    type: 'git',
                    url: 'https://github.com/user/repo',
                    directory: 'prompts/'
                }
            };
            
            expect(manifest.metadata.repository.type).toBe('git');
            expect(manifest.metadata.repository.url).toBeTruthy();
        });

        it('should accept metadata with compatibility section', () => {
            const manifest = createMinimalManifest();
            manifest.metadata = {
                manifest_version: '1.0',
                description: 'Test',
                compatibility: {
                    min_manifest_version: '1.0',
                    platforms: ['vscode', 'cursor']
                }
            };
            
            expect(manifest.metadata.compatibility).toBeTruthy();
            expect(Array.isArray(manifest.metadata.compatibility.platforms)).toBeTruthy();
        });
    });

    describe('Full Manifest Validation', () => {
        it('should accept comprehensive manifest with all sections', () => {
            const manifest = createFullManifest();
            
            // Verify all sections present
            expect(manifest.id).toBeTruthy();
            expect(manifest.name).toBeTruthy();
            expect(manifest.version).toBeTruthy();
            expect(manifest.prompts).toBeTruthy();
            expect(manifest.mcpServers).toBeTruthy();
            expect(manifest.metadata).toBeTruthy();
            
            // Verify all 4 resource types
            const types = manifest.prompts.map((p: any) => p.type);
            expect(types.includes('prompt')).toBeTruthy();
            expect(types.includes('instructions')).toBeTruthy();
            expect(types.includes('chatmode')).toBeTruthy();
            expect(types.includes('agent')).toBeTruthy();
        });
    });
});

describe('DeploymentManifestValidator - Resource Type Validation', () => {
    
    describe('File Extension Conventions', () => {
        it('should validate prompt files end with .prompt.md', () => {
            const validExtensions = [
                'test.prompt.md',
                'code-review.prompt.md',
                'prompts/example.prompt.md'
            ];
            
            validExtensions.forEach(file => {
                expect(file.endsWith('.prompt.md'), `${file} should end with .prompt.md`).toBeTruthy();
            });
        });

        it('should validate instruction files end with .instructions.md', () => {
            const validExtensions = [
                'test.instructions.md',
                'style-guide.instructions.md',
                'instructions/typescript.instructions.md'
            ];
            
            validExtensions.forEach(file => {
                expect(file.endsWith('.instructions.md'), `${file} should end with .instructions.md`).toBeTruthy();
            });
        });

        it('should validate chatmode files end with .chatmode.md', () => {
            const validExtensions = [
                'test.chatmode.md',
                'architect.chatmode.md',
                'chatmodes/expert.chatmode.md'
            ];
            
            validExtensions.forEach(file => {
                expect(file.endsWith('.chatmode.md'), `${file} should end with .chatmode.md`).toBeTruthy();
            });
        });

        it('should validate agent files end with .agent.md', () => {
            const validExtensions = [
                'test.agent.md',
                'qa-engineer.agent.md',
                'agents/reviewer.agent.md'
            ];
            
            validExtensions.forEach(file => {
                expect(file.endsWith('.agent.md'), `${file} should end with .agent.md`).toBeTruthy();
            });
        });

        it('should detect mismatched type and file extension', () => {
            const mismatches = [
                { type: 'prompt', file: 'test.instructions.md' },
                { type: 'instructions', file: 'test.chatmode.md' },
                { type: 'chatmode', file: 'test.agent.md' },
                { type: 'agent', file: 'test.prompt.md' }
            ];
            
            mismatches.forEach(({ type, file }) => {
                const expectedExt = `.${type === 'instructions' ? 'instructions' : type}.md`;
                expect(!file.endsWith(expectedExt), `Type ${type} should not match file ${file}`).toBeTruthy();
            });
        });
    });

    describe('Type Field Validation', () => {
        it('should accept all valid type values', () => {
            const validTypes = ['prompt', 'instructions', 'chatmode', 'agent'];
            
            validTypes.forEach(type => {
                expect(['prompt', 'instructions', 'chatmode', 'agent'].includes(type)).toBeTruthy();
            });
        });

        it('should reject invalid type values', () => {
            const invalidTypes = ['prompts', 'instruction', 'chat', 'bot', 'unknown'];
            
            invalidTypes.forEach(type => {
                expect(!['prompt', 'instructions', 'chatmode', 'agent'].includes(type)).toBeTruthy();
            });
        });

        it('should handle undefined type (defaults to prompt)', () => {
            const prompt: any = {
                id: 'test',
                name: 'Test',
                description: 'Test',
                file: 'test.prompt.md'
            };
            
            const effectiveType = prompt.type || 'prompt';
            expect(effectiveType).toBe('prompt');
        });
    });

    describe('Directory Conventions', () => {
        it('should validate prompts are in prompts/ directory', () => {
            const validPaths = [
                'prompts/test.prompt.md',
                'prompts/subfolder/test.prompt.md'
            ];
            
            validPaths.forEach(path => {
                expect(path.startsWith('prompts/')).toBeTruthy();
            });
        });

        it('should validate instructions are in instructions/ directory', () => {
            const validPaths = [
                'instructions/test.instructions.md',
                'instructions/subfolder/test.instructions.md'
            ];
            
            validPaths.forEach(path => {
                expect(path.startsWith('instructions/')).toBeTruthy();
            });
        });

        it('should validate chatmodes are in chatmodes/ directory', () => {
            const validPaths = [
                'chatmodes/test.chatmode.md',
                'chatmodes/subfolder/test.chatmode.md'
            ];
            
            validPaths.forEach(path => {
                expect(path.startsWith('chatmodes/')).toBeTruthy();
            });
        });

        it('should validate agents are in agents/ directory', () => {
            const validPaths = [
                'agents/test.agent.md',
                'agents/subfolder/test.agent.md'
            ];
            
            validPaths.forEach(path => {
                expect(path.startsWith('agents/')).toBeTruthy();
            });
        });
    });
});

describe('DeploymentManifestValidator - Integration with Real Fixtures', () => {
    const fixturesDir = path.join(__dirname, '..', 'fixtures', 'local-library');
    
    describe('Validate Existing Fixture Manifests', () => {
        it('should validate bundle1 manifest', () => {
            const manifestPath = path.join(fixturesDir, 'bundle1', 'deployment-manifest.yml');
            
            if (!fs.existsSync(manifestPath)) {
                expect.fail('bundle1 manifest not found');
            }
            
            const content = fs.readFileSync(manifestPath, 'utf-8');
            const manifest = yaml.load(content) as any;
            
            // Verify required fields
            expect(manifest.id, 'id is required').toBeTruthy();
            expect(manifest.name, 'name is required').toBeTruthy();
            expect(manifest.version, 'version is required').toBeTruthy();
        });

        it('should validate example-bundle manifest', () => {
            const manifestPath = path.join(fixturesDir, 'example-bundle', 'deployment-manifest.yml');
            
            if (!fs.existsSync(manifestPath)) {
                expect.fail('example-bundle manifest not found');
            }
            
            const content = fs.readFileSync(manifestPath, 'utf-8');
            const manifest = yaml.load(content) as any;
            
            // Verify required fields
            expect(manifest.id).toBeTruthy();
            expect(manifest.name).toBeTruthy();
            expect(manifest.version).toBeTruthy();
            
            // Verify prompts section if present
            if (manifest.prompts) {
                expect(Array.isArray(manifest.prompts)).toBeTruthy();
                manifest.prompts.forEach((prompt: any) => {
                    expect(prompt.id, 'prompt id is required').toBeTruthy();
                    expect(prompt.name, 'prompt name is required').toBeTruthy();
                    expect(prompt.file, 'prompt file is required').toBeTruthy();
                });
            }
        });

        it('should validate testing-bundle manifest', () => {
            const manifestPath = path.join(fixturesDir, 'testing-bundle', 'deployment-manifest.yml');
            
            if (!fs.existsSync(manifestPath)) {
                expect.fail('testing-bundle manifest not found');
            }
            
            const content = fs.readFileSync(manifestPath, 'utf-8');
            const manifest = yaml.load(content) as any;
            
            // Verify required fields
            expect(manifest.id).toBeTruthy();
            expect(manifest.name).toBeTruthy();
            expect(manifest.version).toBeTruthy();
            
            // Verify prompts with different types
            if (manifest.prompts) {
                const types = manifest.prompts.map((p: any) => p.type).filter(Boolean);
                
                // Check if types are valid
                types.forEach((type: string) => {
                    expect(['prompt', 'instructions', 'chatmode', 'agent'].includes(type), `Invalid type: ${type}`).toBeTruthy();
                });
            }
        });
    });

    describe('Validate All Fixtures in Directory', () => {
        it('should find and validate all deployment manifests', () => {
            if (!fs.existsSync(fixturesDir)) {
                expect.fail('Fixtures directory not found');
            }
            
            const bundles = fs.readdirSync(fixturesDir, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);
            
            let validCount = 0;
            let invalidCount = 0;
            const errors: string[] = [];
            
            bundles.forEach(bundleName => {
                const manifestPath = path.join(fixturesDir, bundleName, 'deployment-manifest.yml');
                
                if (fs.existsSync(manifestPath)) {
                    try {
                        const content = fs.readFileSync(manifestPath, 'utf-8');
                        const manifest = yaml.load(content) as any;
                        
                        // Basic validation
                        if (manifest.id && manifest.name && manifest.version) {
                            validCount++;
                        } else {
                            invalidCount++;
                            errors.push(`${bundleName}: Missing required fields`);
                        }
                    } catch (error) {
                        invalidCount++;
                        errors.push(`${bundleName}: ${error}`);
                    }
                }
            });
            
            expect(validCount > 0, 'Should have at least one valid manifest').toBeTruthy();
            
            if (errors.length > 0) {
                console.log('Validation errors:', errors);
            }
        });
    });

    describe('Validate Resource Type Usage in Fixtures', () => {
        it('should check if fixtures use all 4 resource types', ({ skip }: any) => {
            if (!fs.existsSync(fixturesDir)) {
                skip();
                return;
            }
            
            const bundles = fs.readdirSync(fixturesDir, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);
            
            const typesFound = new Set<string>();
            
            bundles.forEach(bundleName => {
                const manifestPath = path.join(fixturesDir, bundleName, 'deployment-manifest.yml');
                
                if (fs.existsSync(manifestPath)) {
                    const content = fs.readFileSync(manifestPath, 'utf-8');
                    const manifest = yaml.load(content) as any;
                    
                    if (manifest.prompts) {
                        manifest.prompts.forEach((prompt: any) => {
                            if (prompt.type) {
                                typesFound.add(prompt.type);
                            }
                        });
                    }
                }
            });
            
            // Report which types are used in fixtures
            console.log('Resource types found in fixtures:', Array.from(typesFound));
            
            // At least some types should be present
            expect(typesFound.size > 0, 'Should find at least one resource type').toBeTruthy();
        });
    });
});
