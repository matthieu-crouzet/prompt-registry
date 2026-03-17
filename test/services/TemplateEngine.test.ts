import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { TemplateEngine, TemplateContext } from '../../src/services/TemplateEngine';

describe('TemplateEngine', () => {
    const templateRoot = path.join(process.cwd(), 'templates/scaffolds/github');
    let templateEngine: TemplateEngine;

    beforeEach(() => {
        templateEngine = new TemplateEngine(templateRoot);
    });

    describe('loadManifest', () => {
        it('should load manifest from templates directory', async () => {
            const manifest = await templateEngine.loadManifest();
            expect(manifest, 'Manifest should be loaded').toBeTruthy();
            expect(manifest.version, 'Version should exist').toBeTruthy();
            expect(manifest.templates, 'Should have templates object').toBeTruthy();
        });

        it('should throw error if manifest not found', async () => {
            await expect(() => new TemplateEngine('/nonexistent/path').loadManifest()).rejects.toThrow(/Template manifest not found/);
        });

        it('should load template metadata', async () => {
            const manifest = await templateEngine.loadManifest();
            expect(manifest.templates['example-prompt'], 'Should have example-prompt template').toBeTruthy();
            expect(manifest.templates['readme'], 'Should have readme template').toBeTruthy();
        });
    });

    describe('renderTemplate', () => {
        it('should render template without variables', async () => {
            const context: TemplateContext = {
                projectName: 'Test',
                collectionId: 'test'
            };

            const content = await templateEngine.renderTemplate('example-prompt', context);
            expect(content.includes('---') && content.includes('name:'), 'Should contain frontmatter').toBeTruthy();
        });

        it('should substitute variables in template', async () => {
            const context: TemplateContext = {
                projectName: 'My Project',
                collectionId: 'my-collection'
            };

            const content = await templateEngine.renderTemplate('example-collection', context);
            expect(content.includes('my-collection'), 'Should substitute collectionId').toBeTruthy();
            expect(content.includes('My Project'), 'Should substitute projectName').toBeTruthy();
        });

        it('should render package.json template', async () => {
            const context: TemplateContext = {
                projectName: 'Test Project',
                collectionId: 'test'
            };

            const content = await templateEngine.renderTemplate('package-json', context);
            const parsed = JSON.parse(content);
            expect(parsed.name, 'Should have kebab-case name').toBe('test-project');
            expect(parsed.scripts, 'Should have scripts').toBeTruthy();
            expect(parsed.scripts.validate, 'Should have validate script').toBeTruthy();
        });

        it('should throw error for unknown template', async () => {
            const context: TemplateContext = {
                projectName: 'Test',
                collectionId: 'test'
            };

            await expect(() => templateEngine.renderTemplate('nonexistent', context)).rejects.toThrow(/Template.*not found/);
        });
    });

    describe('copyTemplate', () => {
        it('should copy template to target location', async () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'template-test-'));
            const targetPath = path.join(tempDir, 'test.prompt.md');
            const context: TemplateContext = {
                projectName: 'Test',
                collectionId: 'test'
            };

            await templateEngine.copyTemplate('example-prompt', targetPath, context);

            expect(fs.existsSync(targetPath), 'File should be created').toBeTruthy();
            const content = fs.readFileSync(targetPath, 'utf8');
            expect(content.includes('---') && content.includes('name:'), 'Should have correct content').toBeTruthy();

            // Cleanup
            fs.rmSync(tempDir, { recursive: true });
        });

        it('should create target directory if not exists', async () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'template-test-'));
            const targetPath = path.join(tempDir, 'nested', 'dir', 'file.md');
            const context: TemplateContext = {
                projectName: 'Test',
                collectionId: 'test'
            };

            await templateEngine.copyTemplate('example-prompt', targetPath, context);

            expect(fs.existsSync(targetPath), 'File should be created').toBeTruthy();
            expect(fs.existsSync(path.dirname(targetPath)), 'Directory should be created').toBeTruthy();

            // Cleanup
            fs.rmSync(tempDir, { recursive: true });
        });

        it('should substitute variables when copying', async () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'template-test-'));
            const targetPath = path.join(tempDir, 'collection.yml');
            const context: TemplateContext = {
                projectName: 'My Project',
                collectionId: 'my-collection'
            };

            await templateEngine.copyTemplate('example-collection', targetPath, context);

            const content = fs.readFileSync(targetPath, 'utf8');
            expect(content.includes('my-collection'), 'Should have collection ID').toBeTruthy();
            expect(content.includes('My Project'), 'Should have project name').toBeTruthy();

            // Cleanup
            fs.rmSync(tempDir, { recursive: true });
        });
    });

    describe('scaffoldProject', () => {
        it('should create all required directories', async () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'template-test-'));
            const context: TemplateContext = {
                projectName: 'Awesome Project',
                collectionId: 'test-project'
            };

            await templateEngine.scaffoldProject(tempDir, context);

            expect(fs.existsSync(path.join(tempDir, 'prompts')), 'Should create prompts directory').toBeTruthy();
            expect(fs.existsSync(path.join(tempDir, 'instructions')), 'Should create instructions directory').toBeTruthy();
            expect(fs.existsSync(path.join(tempDir, 'agents')), 'Should create agents directory').toBeTruthy();
            expect(fs.existsSync(path.join(tempDir, 'collections')), 'Should create collections directory').toBeTruthy();
            expect(fs.existsSync(path.join(tempDir, '.github', 'workflows')), 'Should create workflows directory').toBeTruthy();
            expect(fs.existsSync(path.join(tempDir, 'scripts')), 'Should create scripts directory').toBeTruthy();

            // Cleanup
            fs.rmSync(tempDir, { recursive: true });
        });

        it('should create all template files', async () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'template-test-'));
            const context: TemplateContext = {
                projectName: 'Awesome Project',
                collectionId: 'test-project'
            };

            await templateEngine.scaffoldProject(tempDir, context);
            
            expect(fs.existsSync(path.join(tempDir, 'prompts/example.prompt.md')), 'Should create example prompt').toBeTruthy();
            expect(fs.existsSync(path.join(tempDir, 'instructions/example.instructions.md')), 'Should create example instruction').toBeTruthy();
            expect(fs.existsSync(path.join(tempDir, 'agents/example.agent.md')), 'Should create example agent').toBeTruthy();
            expect(fs.existsSync(path.join(tempDir, 'collections/example.collection.yml')), 'Should create example collection').toBeTruthy();
            expect(fs.existsSync(path.join(tempDir, 'README.md')), 'Should create README').toBeTruthy();
            expect(fs.existsSync(path.join(tempDir, 'package.json')), 'Should create package.json').toBeTruthy();
            expect(fs.existsSync(path.join(tempDir, '.github/workflows/publish.yml')), 'Should create publish workflow').toBeTruthy();
            expect(fs.existsSync(path.join(tempDir, 'scripts/README.md')), 'Should create scripts README').toBeTruthy();

            // Cleanup
            fs.rmSync(tempDir, { recursive: true });
        });

        it('should substitute variables in all files', async () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'template-test-'));
            const context: TemplateContext = {
                projectName: 'Awesome Project',
                collectionId: 'test-project'
            };

            await templateEngine.scaffoldProject(tempDir, context);
            
            // Check collection file
            const collectionContent = fs.readFileSync(
                path.join(tempDir, 'collections/example.collection.yml'),
                'utf8'
            );
            expect(collectionContent.includes('test-project'), 'Collection should have project ID').toBeTruthy();
            expect(collectionContent.includes('Awesome Project'), 'Collection should have project name').toBeTruthy();

            // Check package.json
            const packageContent = fs.readFileSync(
                path.join(tempDir, 'package.json'),
                'utf8'
            );
            const packageJson = JSON.parse(packageContent);
            expect(packageJson.name, 'Package should have substituted name').toBe('awesome-project');

            // Cleanup
            fs.rmSync(tempDir, { recursive: true });
        });

        it('should copy scripts README', async () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'template-test-'));
            const context: TemplateContext = {
                projectName: 'Test Project',
                collectionId: 'test'
            };

            await templateEngine.scaffoldProject(tempDir, context);

            const readmePath = path.join(tempDir, 'scripts/README.md');
            expect(fs.existsSync(readmePath), 'Scripts README should be copied').toBeTruthy();

            const content = fs.readFileSync(readmePath, 'utf8');
            expect(content.length > 0, 'README should have content').toBeTruthy();

            // Cleanup
            fs.rmSync(tempDir, { recursive: true });
        });

        it('should create base directory if not exists', async () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'template-test-'));
            const projectDir = path.join(tempDir, 'new-project');
            const context: TemplateContext = {
                projectName: 'Test',
                collectionId: 'test'
            };

            // Should not throw even though projectDir doesn't exist
            await templateEngine.scaffoldProject(projectDir, context);

            expect(fs.existsSync(projectDir), 'Should create base directory').toBeTruthy();
            expect(fs.existsSync(path.join(projectDir, 'prompts')), 'Should create subdirectories').toBeTruthy();

            // Cleanup
            fs.rmSync(tempDir, { recursive: true });
        });
    });

    describe('getTemplates', () => {
        it('should return all available templates', async () => {
            const templates = await templateEngine.getTemplates();
            expect(templates, 'Should return templates object').toBeTruthy();
            expect(Object.keys(templates).length > 0, 'Should have templates').toBeTruthy();
        });

        it('should include template metadata', async () => {
            const templates = await templateEngine.getTemplates();
            const examplePrompt = templates['example-prompt'];
            
            expect(examplePrompt, 'Should have example-prompt').toBeTruthy();
            expect(examplePrompt.path, 'Should have path').toBeTruthy();
            expect(examplePrompt.description, 'Should have description').toBeTruthy();
            expect(typeof examplePrompt.required, 'Should have required flag').toBe('boolean');
            expect(Array.isArray(examplePrompt.variables), 'Should have variables array').toBeTruthy();
        });
    });
});
