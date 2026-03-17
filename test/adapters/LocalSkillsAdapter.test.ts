/**
 * LocalSkillsAdapter Tests
 * Tests for local filesystem Anthropic-style skills repository adapter
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as sinon from 'sinon';
import { LocalSkillsAdapter } from '../../src/adapters/LocalSkillsAdapter';
import { RegistrySource } from '../../src/types/registry';

describe('LocalSkillsAdapter Tests', () => {
    let tempDir: string;
    let skillsDir: string;

    /**
     * Create a temporary directory structure for testing
     */
    function createTempSkillsStructure(): string {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-test-'));
        skillsDir = path.join(tempDir, 'skills');
        fs.mkdirSync(skillsDir);
        return tempDir;
    }

    /**
     * Create a skill in the temporary directory
     */
    function createSkill(skillId: string, options: {
        name?: string;
        description?: string;
        license?: string;
        additionalFiles?: string[];
    } = {}): void {
        const skillPath = path.join(skillsDir, skillId);
        fs.mkdirSync(skillPath, { recursive: true });

        const name = options.name || skillId;
        const description = options.description || `Description for ${skillId}`;
        const license = options.license ? `license: ${options.license}` : '';

        const skillMdContent = `---
name: ${name}
description: ${description}
${license}
---

# ${name}

Instructions for ${name}
`;

        fs.writeFileSync(path.join(skillPath, 'SKILL.md'), skillMdContent);

        for (const file of options.additionalFiles || []) {
            fs.writeFileSync(path.join(skillPath, file), `Content of ${file}`);
        }
    }

    /**
     * Clean up temporary directory
     */
    function cleanupTempDir(): void {
        if (tempDir && fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    }

    beforeEach(() => {
        createTempSkillsStructure();
    });

    afterEach(() => {
        cleanupTempDir();
        sinon.restore();
    });

    describe('Constructor', () => {
        it('should create adapter with valid local path', () => {
            const source: RegistrySource = {
                id: 'test-local-skills',
                name: 'Test Local Skills',
                type: 'local-skills',
                url: tempDir,
                enabled: true,
                priority: 1,
            };

            const adapter = new LocalSkillsAdapter(source);
            expect(adapter.type).toBe('local-skills');
        });

        it('should create adapter with file:// URL', () => {
            const source: RegistrySource = {
                id: 'test-local-skills',
                name: 'Test Local Skills',
                type: 'local-skills',
                url: `file://${tempDir}`,
                enabled: true,
                priority: 1,
            };

            const adapter = new LocalSkillsAdapter(source);
            expect(adapter.type).toBe('local-skills');
        });

        it('should throw error for invalid path', () => {
            const source: RegistrySource = {
                id: 'test-local-skills',
                name: 'Test Local Skills',
                type: 'local-skills',
                url: 'https://github.com/owner/repo',
                enabled: true,
                priority: 1,
            };

            expect(() => {
                new LocalSkillsAdapter(source);
            }).toThrow(/Invalid local skills path/);
        });
    });

    describe('fetchBundles()', () => {
        it('should discover skills from skills/ directory', async () => {
            createSkill('algorithmic-art', {
                name: 'algorithmic-art',
                description: 'Creating algorithmic art using p5.js',
                license: 'Apache-2.0',
                additionalFiles: ['README.md']
            });

            const source: RegistrySource = {
                id: 'test-local-skills',
                name: 'Test Local Skills',
                type: 'local-skills',
                url: tempDir,
                enabled: true,
                priority: 1,
            };

            const adapter = new LocalSkillsAdapter(source);
            const bundles = await adapter.fetchBundles();

            expect(bundles.length).toBe(1);
            expect(bundles[0].name).toBe('algorithmic-art');
            expect(bundles[0].description).toBe('Creating algorithmic art using p5.js');
            expect(bundles[0].id.includes('algorithmic-art')).toBeTruthy();
            expect(bundles[0].tags.includes('skill')).toBeTruthy();
            expect(bundles[0].tags.includes('local')).toBeTruthy();
        });

        it('should discover multiple skills', async () => {
            createSkill('skill-one', { description: 'First skill' });
            createSkill('skill-two', { description: 'Second skill' });
            createSkill('skill-three', { description: 'Third skill' });

            const source: RegistrySource = {
                id: 'test-local-skills',
                name: 'Test Local Skills',
                type: 'local-skills',
                url: tempDir,
                enabled: true,
                priority: 1,
            };

            const adapter = new LocalSkillsAdapter(source);
            const bundles = await adapter.fetchBundles();

            expect(bundles.length).toBe(3);
            
            const skillOne = bundles.find(b => b.name === 'skill-one');
            const skillTwo = bundles.find(b => b.name === 'skill-two');
            const skillThree = bundles.find(b => b.name === 'skill-three');
            
            expect(skillOne).toBeTruthy();
            expect(skillTwo).toBeTruthy();
            expect(skillThree).toBeTruthy();
        });

        it('should skip directories without SKILL.md', async () => {
            createSkill('valid-skill', { description: 'Valid skill' });
            
            // Create invalid skill directory without SKILL.md
            const invalidSkillPath = path.join(skillsDir, 'invalid-skill');
            fs.mkdirSync(invalidSkillPath);
            fs.writeFileSync(path.join(invalidSkillPath, 'README.md'), 'No SKILL.md here');

            const source: RegistrySource = {
                id: 'test-local-skills',
                name: 'Test Local Skills',
                type: 'local-skills',
                url: tempDir,
                enabled: true,
                priority: 1,
            };

            const adapter = new LocalSkillsAdapter(source);
            const bundles = await adapter.fetchBundles();

            expect(bundles.length).toBe(1);
            expect(bundles[0].name).toBe('valid-skill');
        });

        it('should handle empty skills directory', async () => {
            const source: RegistrySource = {
                id: 'test-local-skills',
                name: 'Test Local Skills',
                type: 'local-skills',
                url: tempDir,
                enabled: true,
                priority: 1,
            };

            const adapter = new LocalSkillsAdapter(source);
            const bundles = await adapter.fetchBundles();

            expect(bundles.length).toBe(0);
        });
    });

    describe('validate()', () => {
        it('should validate directory with skills/ subdirectory', async () => {
            createSkill('test-skill', { description: 'Test skill' });

            const source: RegistrySource = {
                id: 'test-local-skills',
                name: 'Test Local Skills',
                type: 'local-skills',
                url: tempDir,
                enabled: true,
                priority: 1,
            };

            const adapter = new LocalSkillsAdapter(source);
            const result = await adapter.validate();

            expect(result.valid).toBe(true);
            expect(result.errors.length).toBe(0);
            expect(result.bundlesFound).toBe(1);
        });

        it('should fail validation when skills/ directory is missing', async () => {
            // Remove skills directory
            fs.rmSync(skillsDir, { recursive: true });

            const source: RegistrySource = {
                id: 'test-local-skills',
                name: 'Test Local Skills',
                type: 'local-skills',
                url: tempDir,
                enabled: true,
                priority: 1,
            };

            const adapter = new LocalSkillsAdapter(source);
            const result = await adapter.validate();

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('skills'))).toBeTruthy();
        });

        it('should fail validation when directory does not exist', async () => {
            const source: RegistrySource = {
                id: 'test-local-skills',
                name: 'Test Local Skills',
                type: 'local-skills',
                url: '/nonexistent/path/to/skills',
                enabled: true,
                priority: 1,
            };

            const adapter = new LocalSkillsAdapter(source);
            const result = await adapter.validate();

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('not exist') || e.includes('not accessible'))).toBeTruthy();
        });

        it('should warn when no valid skills found', async () => {
            // skills/ directory exists but is empty
            const source: RegistrySource = {
                id: 'test-local-skills',
                name: 'Test Local Skills',
                type: 'local-skills',
                url: tempDir,
                enabled: true,
                priority: 1,
            };

            const adapter = new LocalSkillsAdapter(source);
            const result = await adapter.validate();

            expect(result.valid).toBe(true);
            expect(result.warnings.some(w => w.includes('No valid skills'))).toBeTruthy();
        });
    });

    describe('fetchMetadata()', () => {
        it('should return correct metadata', async () => {
            createSkill('skill-one', { description: 'First skill' });
            createSkill('skill-two', { description: 'Second skill' });

            const source: RegistrySource = {
                id: 'test-local-skills',
                name: 'Test Local Skills',
                type: 'local-skills',
                url: tempDir,
                enabled: true,
                priority: 1,
            };

            const adapter = new LocalSkillsAdapter(source);
            const metadata = await adapter.fetchMetadata();

            expect(metadata.bundleCount).toBe(2);
            expect(metadata.description).toBe('Local Skills Repository');
            expect(metadata.name).toBeTruthy();
            expect(metadata.lastUpdated).toBeTruthy();
        });
    });

    describe('getManifestUrl()', () => {
        it('should return file:// URL for skill manifest', () => {
            const source: RegistrySource = {
                id: 'test-local-skills',
                name: 'Test Local Skills',
                type: 'local-skills',
                url: tempDir,
                enabled: true,
                priority: 1,
            };

            const adapter = new LocalSkillsAdapter(source);
            const sourceName = path.basename(tempDir);
            const url = adapter.getManifestUrl(`local-skills-${sourceName}-test-skill`);
            
            expect(url.startsWith('file://')).toBeTruthy();
            expect(url.includes('SKILL.md')).toBeTruthy();
        });
    });

    describe('getDownloadUrl()', () => {
        it('should return file:// URL for skill directory', () => {
            const source: RegistrySource = {
                id: 'test-local-skills',
                name: 'Test Local Skills',
                type: 'local-skills',
                url: tempDir,
                enabled: true,
                priority: 1,
            };

            const adapter = new LocalSkillsAdapter(source);
            const sourceName = path.basename(tempDir);
            const url = adapter.getDownloadUrl(`local-skills-${sourceName}-test-skill`);
            
            expect(url.startsWith('file://')).toBeTruthy();
            expect(url.includes('test-skill')).toBeTruthy();
        });
    });

    describe('downloadBundle()', () => {
        it('should package skill as ZIP buffer', async () => {
            createSkill('test-skill', {
                description: 'Test skill for download',
                additionalFiles: ['helper.md']
            });

            const source: RegistrySource = {
                id: 'test-local-skills',
                name: 'Test Local Skills',
                type: 'local-skills',
                url: tempDir,
                enabled: true,
                priority: 1,
            };

            const adapter = new LocalSkillsAdapter(source);
            const bundles = await adapter.fetchBundles();
            
            expect(bundles.length).toBe(1);
            
            const zipBuffer = await adapter.downloadBundle(bundles[0]);
            
            expect(Buffer.isBuffer(zipBuffer)).toBeTruthy();
            expect(zipBuffer.length > 0).toBeTruthy();
            
            // Verify it's a valid ZIP (starts with PK signature)
            expect(zipBuffer[0]).toBe(0x50); // 'P'
            expect(zipBuffer[1]).toBe(0x4B); // 'K'
        });

        it('should throw error for non-existent skill', async () => {
            const source: RegistrySource = {
                id: 'test-local-skills',
                name: 'Test Local Skills',
                type: 'local-skills',
                url: tempDir,
                enabled: true,
                priority: 1,
            };

            const adapter = new LocalSkillsAdapter(source);
            
            const fakeBundle = {
                id: `local-skills-${path.basename(tempDir)}-nonexistent`,
                name: 'nonexistent',
                version: '1.0.0',
                description: 'Does not exist',
                author: 'test',
                sourceId: 'test-local-skills',
                environments: [],
                tags: [],
                lastUpdated: new Date().toISOString(),
                size: '0 B',
                dependencies: [],
                license: 'Unknown',
            };

            await expect(adapter.downloadBundle(fakeBundle as any)).rejects.toThrow(/Skill not found/);
        });
    });

    describe('getSkillSourcePath()', () => {
        it('should return absolute path to skill directory', () => {
            createSkill('test-skill', { description: 'Test skill' });

            const source: RegistrySource = {
                id: 'test-local-skills',
                name: 'Test Local Skills',
                type: 'local-skills',
                url: tempDir,
                enabled: true,
                priority: 1,
            };

            const adapter = new LocalSkillsAdapter(source);
            const sourceName = path.basename(tempDir);
            
            const mockBundle = {
                id: `local-skills-${sourceName}-test-skill`,
                name: 'test-skill',
                version: '1.0.0',
                description: 'Test skill',
                author: 'test',
                sourceId: 'test-local-skills',
                environments: [],
                tags: [],
                lastUpdated: new Date().toISOString(),
                size: '0 B',
                dependencies: [],
                license: 'Unknown',
            };

            const skillPath = adapter.getSkillSourcePath(mockBundle as any);
            
            expect(path.isAbsolute(skillPath)).toBeTruthy();
            expect(skillPath.includes('test-skill')).toBeTruthy();
            expect(skillPath).toBe(path.join(tempDir, 'skills', 'test-skill'));
        });
    });

    describe('getSkillName()', () => {
        it('should extract skill name from bundle ID', () => {
            const source: RegistrySource = {
                id: 'test-local-skills',
                name: 'Test Local Skills',
                type: 'local-skills',
                url: tempDir,
                enabled: true,
                priority: 1,
            };

            const adapter = new LocalSkillsAdapter(source);
            const sourceName = path.basename(tempDir);
            
            const mockBundle = {
                id: `local-skills-${sourceName}-my-awesome-skill`,
                name: 'my-awesome-skill',
                version: '1.0.0',
                description: 'Test skill',
                author: 'test',
                sourceId: 'test-local-skills',
                environments: [],
                tags: [],
                lastUpdated: new Date().toISOString(),
                size: '0 B',
                dependencies: [],
                license: 'Unknown',
            };

            const skillName = adapter.getSkillName(mockBundle as any);
            
            expect(skillName).toBe('my-awesome-skill');
        });
    });
});
