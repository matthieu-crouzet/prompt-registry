/**
 * Tests for LocalOlafAdapter
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import { LocalOlafAdapter } from '../../src/adapters/LocalOlafAdapter';
import { RegistrySource } from '../../src/types/registry';

describe('LocalOlafAdapter', () => {
    let tempDir: string;
    let adapter: LocalOlafAdapter;
    let source: RegistrySource;

    beforeEach(async () => {
        // Create temporary directory for testing
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-olaf-test-'));
        
        source = {
            id: 'test-local-olaf',
            name: 'Test Local OLAF',
            type: 'local-olaf',
            url: tempDir,
            enabled: true,
            priority: 1,
        };
    });

    afterEach(() => {
        // Clean up temporary directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('constructor', () => {
        it('should create adapter with valid local path', () => {
            expect(() => new LocalOlafAdapter(source)).not.toThrow();
        });

        it('should throw error with invalid path', () => {
            const invalidSource = { ...source, url: 'invalid://path' };
            expect(() => new LocalOlafAdapter(invalidSource)).toThrow(/Invalid local OLAF path/);
        });
    });

    describe('validate', () => {
        it('should fail validation when directory does not exist', async () => {
            const nonExistentSource = { ...source, url: '/non/existent/path' };
            adapter = new LocalOlafAdapter(nonExistentSource);
            
            const result = await adapter.validate();
            expect(result.valid).toBe(false);
            expect(result.errors.length > 0).toBeTruthy();
        });

        it('should fail validation when bundles directory is missing', async () => {
            // Create only skills directory
            fs.mkdirSync(path.join(tempDir, 'skills'));
            
            adapter = new LocalOlafAdapter(source);
            const result = await adapter.validate();
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(error => error.includes('bundles'))).toBeTruthy();
        });

        it('should fail validation when skills directory is missing', async () => {
            // Create only bundles directory
            fs.mkdirSync(path.join(tempDir, 'bundles'));
            
            adapter = new LocalOlafAdapter(source);
            const result = await adapter.validate();
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(error => error.includes('skills'))).toBeTruthy();
        });

        it('should pass validation when both directories exist', async () => {
            // Create required directories
            fs.mkdirSync(path.join(tempDir, 'bundles'));
            fs.mkdirSync(path.join(tempDir, 'skills'));
            
            adapter = new LocalOlafAdapter(source);
            const result = await adapter.validate();
            
            expect(result.valid).toBe(true);
            expect(result.errors.length).toBe(0);
        });
    });

    describe('fetchMetadata', () => {
        beforeEach(() => {
            // Create required directories
            fs.mkdirSync(path.join(tempDir, 'bundles'));
            fs.mkdirSync(path.join(tempDir, 'skills'));
            adapter = new LocalOlafAdapter(source);
        });

        it('should return metadata with correct bundle count', async () => {
            // Create test bundle definition
            const bundleDefinition = {
                metadata: {
                    name: 'Test Bundle',
                    description: 'A test bundle',
                },
                skills: [],
            };
            
            fs.writeFileSync(
                path.join(tempDir, 'bundles', 'test.json'),
                JSON.stringify(bundleDefinition, null, 2)
            );
            
            const metadata = await adapter.fetchMetadata();
            
            expect(metadata.name).toBe(path.basename(tempDir));
            expect(metadata.description).toBe('Local OLAF Skills Registry');
            expect(metadata.bundleCount).toBe(1);
            expect(metadata.version).toBe('1.0.0');
        });
    });

    describe('fetchBundles', () => {
        beforeEach(() => {
            // Create required directories
            fs.mkdirSync(path.join(tempDir, 'bundles'));
            fs.mkdirSync(path.join(tempDir, 'skills'));
            adapter = new LocalOlafAdapter(source);
        });

        it('should return empty array when no bundles exist', async () => {
            const bundles = await adapter.fetchBundles();
            expect(Array.isArray(bundles)).toBeTruthy();
            expect(bundles.length).toBe(0);
        });

        it('should parse valid bundle with skills', async () => {
            // Create skill directory and manifest
            const skillDir = path.join(tempDir, 'skills', 'test-skill');
            fs.mkdirSync(skillDir, { recursive: true });
            
            const skillManifest = {
                name: 'Test Skill',
                description: 'A test skill',
                entry_points: [
                    {
                        protocol: 'Propose-Act',
                        path: '/prompts/test.md',
                        patterns: ['test pattern'],
                    },
                ],
            };
            
            fs.writeFileSync(
                path.join(skillDir, 'manifest.json'),
                JSON.stringify(skillManifest, null, 2)
            );
            
            // Create bundle definition
            const bundleDefinition = {
                metadata: {
                    name: 'Test Bundle',
                    description: 'A test bundle',
                    version: '1.0.0',
                    author: 'Test Author',
                    tags: ['test'],
                },
                skills: [
                    {
                        name: 'Test Skill',
                        description: 'A test skill',
                        path: 'skills/test-skill',
                        manifest: 'skills/test-skill/manifest.json',
                    },
                ],
            };
            
            fs.writeFileSync(
                path.join(tempDir, 'bundles', 'test.json'),
                JSON.stringify(bundleDefinition, null, 2)
            );
            
            const bundles = await adapter.fetchBundles();
            
            expect(bundles.length).toBe(1);
            expect(bundles[0].id).toBe('local-olaf-test');
            expect(bundles[0].name).toBe('Test Bundle');
            expect(bundles[0].description).toBe('A test bundle');
            expect(bundles[0].version).toBe('1.0.0');
            expect(bundles[0].author).toBe('Test Author');
            expect(bundles[0].tags.includes('local-olaf')).toBeTruthy();
            expect(bundles[0].tags.includes('test')).toBeTruthy();
            expect(bundles[0].size).toBe('1 skill');
        });

        it('should skip invalid bundle definitions', async () => {
            // Create invalid bundle definition (missing metadata)
            const invalidBundle = {
                skills: [],
            };
            
            fs.writeFileSync(
                path.join(tempDir, 'bundles', 'invalid.json'),
                JSON.stringify(invalidBundle, null, 2)
            );
            
            const bundles = await adapter.fetchBundles();
            expect(Array.isArray(bundles)).toBeTruthy();
            expect(bundles.length).toBe(0);
        });
    });

    describe('competency index path consistency', () => {
        beforeEach(() => {
            // Create required directories
            fs.mkdirSync(path.join(tempDir, 'bundles'));
            fs.mkdirSync(path.join(tempDir, 'skills'));
            adapter = new LocalOlafAdapter(source);
        });

        it('should use consistent paths for installation and uninstallation', async () => {
            // Create skill directory and manifest
            const skillDir = path.join(tempDir, 'skills', 'test-skill');
            fs.mkdirSync(skillDir, { recursive: true });
            
            const skillManifest = {
                name: 'Test Skill',
                description: 'A test skill',
                entry_points: [
                    {
                        protocol: 'Propose-Act',
                        path: '/prompts/test.md',
                        patterns: ['test pattern'],
                    },
                ],
            };
            
            fs.writeFileSync(
                path.join(skillDir, 'manifest.json'),
                JSON.stringify(skillManifest, null, 2)
            );
            
            // Create bundle definition
            const bundleDefinition = {
                metadata: {
                    name: 'Test Bundle',
                    description: 'A test bundle',
                },
                skills: [
                    {
                        name: 'Test Skill',
                        description: 'A test skill',
                        path: 'skills/test-skill',
                        manifest: 'skills/test-skill/manifest.json',
                    },
                ],
            };
            
            fs.writeFileSync(
                path.join(tempDir, 'bundles', 'test.json'),
                JSON.stringify(bundleDefinition, null, 2)
            );

            // Mock workspace and competency index setup
            const mockWorkspace = path.join(tempDir, 'workspace');
            const competencyIndexDir = path.join(mockWorkspace, '.olaf', 'olaf-core', 'reference');
            const competencyIndexPath = path.join(competencyIndexDir, 'competency-index.json');
            
            fs.mkdirSync(competencyIndexDir, { recursive: true });
            
            // Mock vscode.workspace.workspaceFolders via the ESM mock
            const originalWorkspaceFolders = (vscode.workspace as any).workspaceFolders;
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: mockWorkspace } }];
            
            // Mock the runtime manager methods to avoid initialization issues
            const originalEnsureRuntimeInstalled = adapter['ensureRuntimeInstalled'];
            const originalCreateWorkspaceLinks = adapter['createWorkspaceLinks'];
            const originalCreateSkillSymbolicLinks = adapter['createSkillSymbolicLinks'];
            const originalRemoveSkillSymbolicLinks = adapter['removeSkillSymbolicLinks'];
            
            adapter['ensureRuntimeInstalled'] = async () => { /* mock - do nothing */ };
            adapter['createWorkspaceLinks'] = async () => { /* mock - do nothing */ };
            adapter['createSkillSymbolicLinks'] = async () => { /* mock - do nothing */ };
            adapter['removeSkillSymbolicLinks'] = async () => { /* mock - do nothing */ };
            
            try {
                // Test installation - should create entry with "olaf-local" path
                await adapter.postInstall('local-olaf-test', '/mock/install/path');
                
                // Verify competency index was created with correct path
                expect(fs.existsSync(competencyIndexPath), 'Competency index should be created').toBeTruthy();
                
                const indexContent = JSON.parse(fs.readFileSync(competencyIndexPath, 'utf-8'));
                expect(Array.isArray(indexContent), 'Competency index should be an array').toBeTruthy();
                expect(indexContent.length, 'Should have one entry').toBe(1);
                
                const entry = indexContent[0];
                expect(entry.file, 'Should use actual source name in path during installation').toBe('external-skills/Test Local OLAF/test-skill/prompts/test.md');
                
                // Test uninstallation - should remove entry using same "olaf-local" path
                await adapter.postUninstall('local-olaf-test', '/mock/install/path');
                
                // Verify entry was removed
                const updatedIndexContent = JSON.parse(fs.readFileSync(competencyIndexPath, 'utf-8'));
                expect(Array.isArray(updatedIndexContent), 'Competency index should still be an array').toBeTruthy();
                expect(updatedIndexContent.length, 'Entry should be removed during uninstallation').toBe(0);
                
            } finally {
                // Restore original methods and workspace folders
                adapter['ensureRuntimeInstalled'] = originalEnsureRuntimeInstalled;
                adapter['createWorkspaceLinks'] = originalCreateWorkspaceLinks;
                adapter['createSkillSymbolicLinks'] = originalCreateSkillSymbolicLinks;
                adapter['removeSkillSymbolicLinks'] = originalRemoveSkillSymbolicLinks;
                (vscode.workspace as any).workspaceFolders = originalWorkspaceFolders;
            }
        });
    });
});