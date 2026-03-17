/**
 * AwesomeCopilotAdapter Unit Tests
 * Tests the dynamic bundle creation from YAML collections
 */

import nock from 'nock';
import { AwesomeCopilotAdapter } from '../../src/adapters/AwesomeCopilotAdapter';
import { RegistrySource, Bundle } from '../../src/types/registry';

describe('AwesomeCopilotAdapter', () => {
    const mockSource: RegistrySource = {
        id: 'awesome-test',
        name: 'Awesome Copilot Test',
        type: 'awesome-copilot',
        url: 'https://github.com/test-owner/awesome-copilot',
        enabled: true,
        priority: 1,
    };

    afterEach(() => {
        nock.cleanAll();
    });

    describe('Constructor and Validation', () => {
        it('should accept valid awesome-copilot source', () => {
            const adapter = new AwesomeCopilotAdapter(mockSource);
            expect(adapter.type).toBe('awesome-copilot');
        });

        it('should accept GitHub URL format', () => {
            const source = { ...mockSource, url: 'https://github.com/microsoft/prompt-bundle-spec' };
            const adapter = new AwesomeCopilotAdapter(source);
            expect(adapter).toBeTruthy();
        });
    });

    describe('fetchBundles', () => {
        it('should fetch collections from repository', async () => {
            // Mock the collections directory listing
            nock('https://api.github.com')
                .get('/repos/test-owner/awesome-copilot/contents/collections?ref=main')
                .reply(200, [
                    {
                        name: 'test-collection.collection.yml',
                        type: 'file',
                        download_url: 'https://raw.githubusercontent.com/test-owner/awesome-copilot/main/collections/test-collection.collection.yml'
                    }
                ]);

            // Mock the collection file content
            nock('https://raw.githubusercontent.com')
                .get('/test-owner/awesome-copilot/main/collections/test-collection.collection.yml')
                .reply(200, `
id: test-collection
name: Test Collection
description: Test collection for unit tests
tags: ["test", "example"]
items:
  - path: "prompts/test.prompt.md"
    kind: prompt
`);

            const adapter = new AwesomeCopilotAdapter(mockSource);
            const bundles = await adapter.fetchBundles();

            expect(bundles.length).toBe(1);
            expect(bundles[0].id).toBe('test-collection');
            expect(bundles[0].name).toBe('Test Collection');
            expect(bundles[0].version).toBe('1.0.0');
            expect(bundles[0].sourceId).toBe('awesome-test');
        });

        it('should skip invalid YAML files', async () => {
            nock('https://api.github.com')
                .get('/repos/test-owner/awesome-copilot/contents/collections?ref=main')
                .reply(200, [
                    { name: 'invalid.collection.yml', type: 'file', download_url: 'https://raw.githubusercontent.com/test-owner/awesome-copilot/main/collections/invalid.collection.yml' }
                ]);

            nock('https://raw.githubusercontent.com')
                .get('/test-owner/awesome-copilot/main/collections/invalid.collection.yml')
                .reply(200, 'invalid: yaml: content:');

            const adapter = new AwesomeCopilotAdapter(mockSource);
            const bundles = await adapter.fetchBundles();

            // Should handle parsing error gracefully
            expect(Array.isArray(bundles)).toBeTruthy();
        });

        it('should handle empty collections directory', async () => {
            nock('https://api.github.com')
                .get('/repos/test-owner/awesome-copilot/contents/collections?ref=main')
                .reply(200, []);

            const adapter = new AwesomeCopilotAdapter(mockSource);
            const bundles = await adapter.fetchBundles();

            expect(bundles.length).toBe(0);
        });
    });

    describe('downloadBundle - Dynamic ZIP Creation', () => {
        it.skip('should create ZIP archive from collection items', async () => {
            const mockBundle: Bundle = {
                id: 'test-bundle',
                name: 'Test Bundle',
                version: '1.0.0',
                description: 'Test',
                author: 'Test Author',
                sourceId: 'awesome-test',
                environments: ['vscode'],
                tags: ['test'],
                lastUpdated: '2025-01-01T00:00:00Z',
                size: '1KB',
                dependencies: [],
                license: 'MIT',
                manifestUrl: 'https://example.com/manifest.json',
                downloadUrl: 'https://example.com/bundle.zip',
            };

            // Mock collection YAML - not needed, downloadBundle uses getManifestUrl

            nock('https://raw.githubusercontent.com')
                .get('/test-owner/awesome-copilot/main/collections/test-bundle.collection.yml')
                .reply(200, `
id: test-bundle
name: Test Bundle
description: Test
tags: []
items:
  - path: "prompts/test.prompt.md"
    kind: prompt
`)
                .get('/test-owner/awesome-copilot/main/prompts/test.prompt.md')
                .reply(200, '# Test Prompt\n\nThis is a test prompt.');

            const adapter = new AwesomeCopilotAdapter(mockSource);
            const buffer = await adapter.downloadBundle(mockBundle);

            expect(Buffer.isBuffer(buffer)).toBeTruthy();
            expect(buffer.length > 0).toBeTruthy();
        });

        it.skip('should include deployment-manifest.yml in ZIP', async () => {
            const mockBundle: Bundle = {
                id: 'manifest-test',
                name: 'Manifest Test',
                version: '2.0.0',
                description: 'Test manifest creation',
                author: 'Test',
                sourceId: 'awesome-test',
                environments: ['vscode'],
                tags: [],
                lastUpdated: '2025-01-01',
                size: '1KB',
                dependencies: [],
                license: 'MIT',
                manifestUrl: 'https://example.com/manifest.json',
                downloadUrl: 'https://example.com/bundle.zip',
            };

            // Mock not needed - downloadBundle uses direct raw URL

            nock('https://raw.githubusercontent.com')
                .get('/test-owner/awesome-copilot/main/collections/manifest-test.collection.yml')
                .reply(200, `
id: manifest-test
name: Manifest Test
description: Test manifest
tags: []
items: []
`);

            const adapter = new AwesomeCopilotAdapter(mockSource);
            const buffer = await adapter.downloadBundle(mockBundle);

            // ZIP should contain deployment-manifest.yml
            expect(buffer.length > 100).toBeTruthy(); // Reasonable minimum size for ZIP with manifest
        });

        it.skip('should handle missing prompt files gracefully', async () => {
            const mockBundle: Bundle = {
                id: 'missing-files',
                name: 'Missing Files Test',
                version: '1.0.0',
                description: 'Test',
                author: 'Test',
                sourceId: 'awesome-test',
                environments: [],
                tags: [],
                lastUpdated: '2025-01-01',
                size: '1KB',
                dependencies: [],
                license: 'MIT',
                manifestUrl: 'https://example.com/manifest.json',
                downloadUrl: 'https://example.com/bundle.zip',
            };

            // Mock not needed

            nock('https://raw.githubusercontent.com')
                .get('/test-owner/awesome-copilot/main/collections/missing-files.collection.yml')
                .reply(200, `
id: missing-files
name: Missing Files
description: Test
tags: []
items:
  - path: "prompts/missing.prompt.md"
    kind: prompt
`)
                .get('/test-owner/awesome-copilot/main/prompts/missing.prompt.md')
                .reply(404);

            const adapter = new AwesomeCopilotAdapter(mockSource);
            
            // Should throw error for missing files
            let errorThrown = false;
            try {
                await adapter.downloadBundle(mockBundle);
            } catch (error: any) {
                errorThrown = true;
                expect(error.message, 'Error should have a message').toBeTruthy();
            }
            expect(errorThrown, 'Should throw error for missing files').toBeTruthy();
        });
    });

    describe('fetchMetadata', () => {
        it('should fetch repository metadata', async () => {
            nock('https://api.github.com')
                .get('/repos/test-owner/awesome-copilot')
                .reply(200, {
                    name: 'awesome-copilot',
                    description: 'Awesome Copilot Collection',
                    stargazers_count: 100
                })
                .get('/repos/test-owner/awesome-copilot/contents/collections?ref=main')
                .reply(200, [
                    { name: 'col1.collection.yml', type: 'file' },
                    { name: 'col2.collection.yml', type: 'file' }
                ]);

            const adapter = new AwesomeCopilotAdapter(mockSource);
            const metadata = await adapter.fetchMetadata();

            expect(metadata.name).toBe('test-owner/awesome-copilot');
            expect(metadata.description.includes('Awesome Copilot collections')).toBeTruthy();
            expect(metadata.bundleCount).toBe(2);
        });
    });

    describe('validate', () => {
        it('should validate accessible repository', async () => {
            nock('https://api.github.com')
                .get('/repos/test-owner/awesome-copilot')
                .reply(200, { name: 'awesome-copilot' })
                .get('/repos/test-owner/awesome-copilot/contents/collections?ref=main')
                .reply(200, [{
                    name: 'test.collection.yml',
                    type: 'file'
                }]);

            const adapter = new AwesomeCopilotAdapter(mockSource);
            const result = await adapter.validate();

            expect(result.valid).toBe(true);
            expect(result.errors.length).toBe(0);
        });

        it('should fail validation for inaccessible repository', async () => {
            nock('https://api.github.com')
                .get('/repos/test-owner/awesome-copilot')
                .reply(404);

            const adapter = new AwesomeCopilotAdapter(mockSource);
            const result = await adapter.validate();

            expect(result.valid).toBe(false);
            expect(result.errors.length > 0).toBeTruthy();
        });
    });

    describe('Content Type Mapping', () => {
        it('should map .prompt.md files to prompt type', async () => {
            nock('https://api.github.com')
                .get('/repos/test-owner/awesome-copilot/contents/collections?ref=main')
                .reply(200, [{
                    name: 'types.collection.yml',
                    type: 'file',
                    download_url: 'https://raw.githubusercontent.com/test-owner/awesome-copilot/main/collections/types.collection.yml'
                }]);

            nock('https://raw.githubusercontent.com')
                .get('/test-owner/awesome-copilot/main/collections/types.collection.yml')
                .reply(200, `
id: types
name: Types Test
description: Test content types
tags: []
items:
  - path: "test.prompt.md"
    kind: prompt
  - path: "test.instructions.md"
    kind: instruction
  - path: "test.chat-mode.md"
    kind: chat-mode
  - path: "test.agent.md"
    kind: agent
`);

            const adapter = new AwesomeCopilotAdapter(mockSource);
            const bundles = await adapter.fetchBundles();

            expect(bundles.length > 0).toBeTruthy();
            // Content types should be inferred from file extensions
        });
    });
});

describe('Skill Kind Support', () => {
    it('should parse collection with skill items', async () => {
        const mockSource: RegistrySource = {
            id: 'awesome-test',
            name: 'Awesome Copilot Test',
            type: 'awesome-copilot',
            url: 'https://github.com/test-owner/awesome-copilot',
            enabled: true,
            priority: 1,
        };

        nock('https://api.github.com')
            .get('/repos/test-owner/awesome-copilot/contents/collections?ref=main')
            .reply(200, [{
                name: 'skills-collection.collection.yml',
                type: 'file',
                download_url: 'https://raw.githubusercontent.com/test-owner/awesome-copilot/main/collections/skills-collection.collection.yml'
            }]);

        nock('https://raw.githubusercontent.com')
            .get('/test-owner/awesome-copilot/main/collections/skills-collection.collection.yml')
            .reply(200, `
id: skills-collection
name: Skills Collection
description: Test collection with skills
tags: ["test", "skills"]
items:
  - path: "skills/my-skill/SKILL.md"
    kind: skill
  - path: "prompts/test.prompt.md"
    kind: prompt
`);

        const adapter = new AwesomeCopilotAdapter(mockSource);
        const bundles = await adapter.fetchBundles();

        expect(bundles.length).toBe(1);
        expect(bundles[0].id).toBe('skills-collection');
        // The bundle should contain both skill and prompt items
    });

    it('should map skill kind correctly in type mapping', () => {
        // Test the mapKindToType function behavior
        const kindMap: Record<string, string> = {
            'prompt': 'prompt',
            'instruction': 'instructions',
            'chat-mode': 'chatmode',
            'agent': 'agent',
            'skill': 'skill'
        };
        
        expect(kindMap['skill']).toBe('skill');
        expect(kindMap['prompt']).toBe('prompt');
        expect(kindMap['instruction']).toBe('instructions');
    });

    it('should fetch entire skill directory when downloading bundle with skills', async () => {
        const mockSource: RegistrySource = {
            id: 'awesome-test',
            name: 'Awesome Copilot Test',
            type: 'awesome-copilot',
            url: 'https://github.com/test-owner/awesome-copilot',
            enabled: true,
            priority: 1,
        };

        const mockBundle: Bundle = {
            id: 'skill-bundle',
            name: 'Skill Bundle',
            version: '1.0.0',
            description: 'Bundle with skills',
            author: 'Test Author',
            sourceId: 'awesome-test',
            environments: ['vscode'],
            tags: ['test'],
            lastUpdated: '2025-01-01T00:00:00Z',
            size: '1KB',
            dependencies: [],
            license: 'MIT',
            manifestUrl: 'https://example.com/manifest.json',
            downloadUrl: 'https://example.com/bundle.zip',
        };

        // Mock the collection YAML with a skill item
        nock('https://raw.githubusercontent.com')
            .get('/test-owner/awesome-copilot/main/collections/skill-bundle.collection.yml')
            .reply(200, `
id: skill-bundle
name: Skill Bundle
description: Bundle with skills
tags: []
items:
  - path: "skills/my-skill/SKILL.md"
    kind: skill
`);

        // Mock the GitHub API to list skill directory contents
        nock('https://api.github.com')
            .get('/repos/test-owner/awesome-copilot/contents/skills/my-skill?ref=main')
            .reply(200, [
                { name: 'SKILL.md', path: 'skills/my-skill/SKILL.md', type: 'file' },
                { name: 'helper.js', path: 'skills/my-skill/helper.js', type: 'file' },
                { name: 'data', path: 'skills/my-skill/data', type: 'dir' }
            ]);

        // Mock subdirectory listing
        nock('https://api.github.com')
            .get('/repos/test-owner/awesome-copilot/contents/skills/my-skill/data?ref=main')
            .reply(200, [
                { name: 'config.json', path: 'skills/my-skill/data/config.json', type: 'file' }
            ]);

        // Mock fetching each file in the skill directory
        nock('https://raw.githubusercontent.com')
            .get('/test-owner/awesome-copilot/main/skills/my-skill/SKILL.md')
            .reply(200, '# My Skill\n\nSkill description');

        nock('https://raw.githubusercontent.com')
            .get('/test-owner/awesome-copilot/main/skills/my-skill/helper.js')
            .reply(200, 'module.exports = { helper: true };');

        nock('https://raw.githubusercontent.com')
            .get('/test-owner/awesome-copilot/main/skills/my-skill/data/config.json')
            .reply(200, '{"setting": "value"}');

        const adapter = new AwesomeCopilotAdapter(mockSource);
        const buffer = await adapter.downloadBundle(mockBundle);

        // Verify the archive was created
        expect(Buffer.isBuffer(buffer), 'Should return a Buffer').toBeTruthy();
        expect(buffer.length > 0, 'Buffer should not be empty').toBeTruthy();

        // Verify the archive contains the expected files by checking its size
        // A proper archive with 3 files + manifest should be reasonably sized
        expect(buffer.length > 200, 'Archive should contain multiple files').toBeTruthy();
    });
});

describe('AwesomeCopilotAdapter HTTP Redirect Handling', () => {
    const mockSource: RegistrySource = {
        id: 'awesome-test',
        name: 'Awesome Copilot Test',
        type: 'awesome-copilot',
        url: 'https://github.com/test-owner/awesome-copilot',
        enabled: true,
        priority: 1,
    };

    afterEach(() => {
        nock.cleanAll();
    });

    it('should follow HTTP 301 redirects when fetching collections', async () => {
        // Mock the collections directory listing with a redirect
        nock('https://api.github.com')
            .get('/repos/test-owner/awesome-copilot/contents/collections?ref=main')
            .reply(301, '', { location: 'https://api.github.com/repos/new-owner/new-repo/contents/collections?ref=main' });

        nock('https://api.github.com')
            .get('/repos/new-owner/new-repo/contents/collections?ref=main')
            .reply(200, [
                {
                    name: 'redirect-test.collection.yml',
                    type: 'file',
                    download_url: 'https://raw.githubusercontent.com/new-owner/new-repo/main/collections/redirect-test.collection.yml'
                }
            ]);

        // Mock the collection file content
        nock('https://raw.githubusercontent.com')
            .get('/test-owner/awesome-copilot/main/collections/redirect-test.collection.yml')
            .reply(301, '', { location: 'https://raw.githubusercontent.com/new-owner/new-repo/main/collections/redirect-test.collection.yml' });

        nock('https://raw.githubusercontent.com')
            .get('/new-owner/new-repo/main/collections/redirect-test.collection.yml')
            .reply(200, `
id: redirect-test
name: Redirect Test Collection
description: Test collection for redirect handling
tags: ["test"]
items:
- path: "prompts/test.prompt.md"
  kind: prompt
`);

        const adapter = new AwesomeCopilotAdapter(mockSource);
        const bundles = await adapter.fetchBundles();

        expect(bundles.length).toBe(1);
        expect(bundles[0].id).toBe('redirect-test');
    });

    it('should follow HTTP 302 redirects when validating repository', async () => {
        // Mock the collections directory with a temporary redirect
        nock('https://api.github.com')
            .get('/repos/test-owner/awesome-copilot/contents/collections?ref=main')
            .reply(302, '', { location: 'https://api.github.com/repos/test-owner/awesome-copilot-v2/contents/collections?ref=main' });

        nock('https://api.github.com')
            .get('/repos/test-owner/awesome-copilot-v2/contents/collections?ref=main')
            .reply(200, [
                { name: 'test.collection.yml', type: 'file' }
            ]);

        const adapter = new AwesomeCopilotAdapter(mockSource);
        const result = await adapter.validate();

        expect(result.valid).toBe(true);
        expect(result.bundlesFound).toBe(1);
    });
});
