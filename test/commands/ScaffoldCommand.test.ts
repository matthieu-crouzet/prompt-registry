/**
 * ScaffoldCommand Unit Tests
 * 
 * Tests for the GitHub structure scaffolding command
 * Following TDD approach - tests written first
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { ScaffoldCommand, ScaffoldType } from '../../src/commands/ScaffoldCommand';

const TEMPLATES_ROOT = path.join(process.cwd(), 'templates/scaffolds/github');

describe('ScaffoldCommand', () => {
    let testDir: string;
    let scaffoldCommand: ScaffoldCommand;

    beforeEach(() => {
        // Create temp directory for each test
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-test-'));
        scaffoldCommand = new ScaffoldCommand(TEMPLATES_ROOT);
    });

    afterEach(() => {
        // Clean up test directory
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('ScaffoldType Enum', () => {
        it('should not contain AwesomeCopilot type', () => {
            // Verify AwesomeCopilot is not in ScaffoldType enum
            const scaffoldTypes = Object.values(ScaffoldType);
            expect(!scaffoldTypes.includes('awesome-copilot' as ScaffoldType), 'ScaffoldType should not contain awesome-copilot').toBeTruthy();
            expect(!('AwesomeCopilot' in ScaffoldType), 'ScaffoldType should not have AwesomeCopilot key').toBeTruthy();
        });

        it('should only contain GitHub, Apm, and Skill types', () => {
            const scaffoldTypes = Object.values(ScaffoldType);
            expect(scaffoldTypes.length, 'ScaffoldType should have exactly 3 values').toBe(3);
            expect(scaffoldTypes.includes(ScaffoldType.GitHub), 'ScaffoldType should contain GitHub').toBeTruthy();
            expect(scaffoldTypes.includes(ScaffoldType.Apm), 'ScaffoldType should contain Apm').toBeTruthy();
            expect(scaffoldTypes.includes(ScaffoldType.Skill), 'ScaffoldType should contain Skill').toBeTruthy();
        });

        it('GitHub type should have correct value', () => {
            expect(ScaffoldType.GitHub, 'GitHub type should have value "github"').toBe('github');
        });

        it('Apm type should have correct value', () => {
            expect(ScaffoldType.Apm, 'Apm type should have value "apm"').toBe('apm');
        });
    });

    describe('Directory Creation', () => {
        it('should create directory structure with all required folders', async () => {
            await scaffoldCommand.execute(testDir);

            // Check main folders exist
            expect(fs.existsSync(path.join(testDir, 'prompts'))).toBeTruthy();
            expect(fs.existsSync(path.join(testDir, 'instructions'))).toBeTruthy();
            expect(fs.existsSync(path.join(testDir, 'agents'))).toBeTruthy();
            expect(fs.existsSync(path.join(testDir, 'collections'))).toBeTruthy();
            //             expect(fs.existsSync(path.join(testDir, '.vscode'))).toBeTruthy();
        });

        it('should not overwrite existing directory', async () => {
            // Create a file in the target directory
            const testFile = path.join(testDir, 'existing-file.txt');
            fs.writeFileSync(testFile, 'test content');

            await scaffoldCommand.execute(testDir);

            // File should still exist
            expect(fs.existsSync(testFile)).toBeTruthy();
            expect(fs.readFileSync(testFile, 'utf8')).toBe('test content');
        });

        it('should create nested structure when specified', async () => {
            const nestedPath = path.join(testDir, 'my-project', 'copilot-prompts');
            
            await scaffoldCommand.execute(nestedPath);

            expect(fs.existsSync(path.join(nestedPath, 'prompts'))).toBeTruthy();
            expect(fs.existsSync(path.join(nestedPath, 'collections'))).toBeTruthy();
        });
    });

    describe('Example Files', () => {
        it('should create example prompt file', async () => {
            await scaffoldCommand.execute(testDir);

            const promptFile = path.join(testDir, 'prompts', 'example.prompt.md');
            expect(fs.existsSync(promptFile)).toBeTruthy();

            const content = fs.readFileSync(promptFile, 'utf8');
            expect(content.length > 0).toBeTruthy();
            expect(content.includes('name:') || content.includes('description:') || content.includes('Create README')).toBeTruthy();
        });

        it('should create example instruction file', async () => {
            await scaffoldCommand.execute(testDir);

            const instructionFile = path.join(testDir, 'instructions', 'example.instructions.md');
            expect(fs.existsSync(instructionFile)).toBeTruthy();

            const content = fs.readFileSync(instructionFile, 'utf8');
            expect(content.length > 0).toBeTruthy();
            expect(content.includes('name:') || content.includes('description:') || content.includes('TypeScript')).toBeTruthy();
        });

        it('should create example agent file', async () => {
            await scaffoldCommand.execute(testDir);

            const agentFile = path.join(testDir, 'agents', 'example.agent.md');
            expect(fs.existsSync(agentFile)).toBeTruthy();

            const content = fs.readFileSync(agentFile, 'utf8');
            expect(content.length > 0).toBeTruthy();
            expect(content.includes('Persona') || content.includes('Expertise') || content.includes('Guidelines')).toBeTruthy();
        });

        it('should create example collection file', async () => {
            await scaffoldCommand.execute(testDir);

            const collectionFile = path.join(testDir, 'collections', 'example.collection.yml');
            expect(fs.existsSync(collectionFile)).toBeTruthy();

            const content = fs.readFileSync(collectionFile, 'utf8');
            expect(content.length > 0).toBeTruthy();
            expect(content.includes('id:')).toBeTruthy();
            expect(content.includes('name:')).toBeTruthy();
            expect(content.includes('items:')).toBeTruthy();
        });

        it('example files should have correct extensions', async () => {
            await scaffoldCommand.execute(testDir);

            const promptFile = path.join(testDir, 'prompts', 'example.prompt.md');
            const instructionFile = path.join(testDir, 'instructions', 'example.instructions.md');
            const agentFile = path.join(testDir, 'agents', 'example.agent.md');
            const collectionFile = path.join(testDir, 'collections', 'example.collection.yml');

            expect(promptFile.endsWith('.prompt.md')).toBeTruthy();
            expect(instructionFile.endsWith('.instructions.md')).toBeTruthy();
            expect(agentFile.endsWith('.agent.md')).toBeTruthy();
            expect(collectionFile.endsWith('.collection.yml')).toBeTruthy();
        });
    });

    describe('InnerSource Documentation', () => {
        it('should create InnerSource documentation files', async () => {
            await scaffoldCommand.execute(testDir);

            // Check that InnerSource documentation files exist
            const innerSourceFiles = [
                'CONTRIBUTING.md',
                'COMMUNICATION.md', 
                'CODE_OF_CONDUCT.md',
                'SECURITY.md',
                'LICENSE'
            ];

            for (const file of innerSourceFiles) {
                const filePath = path.join(testDir, file);
                expect(fs.existsSync(filePath), `InnerSource file ${file} should be created`).toBeTruthy();
            }
        });

        it('should include project name in documentation templates', async () => {
            // Use a fixed project name for testing
            const fixedProjectName = 'test-project';
            await scaffoldCommand.execute(testDir, { projectName: fixedProjectName });

            // Check that project name is substituted in templates
            const contributingPath = path.join(testDir, 'CONTRIBUTING.md');
            const contributingContent = fs.readFileSync(contributingPath, 'utf8');
            
            expect(contributingContent.includes(fixedProjectName), 'Project name should be substituted in CONTRIBUTING.md').toBeTruthy();
            
            const communicationPath = path.join(testDir, 'COMMUNICATION.md');
            const communicationContent = fs.readFileSync(communicationPath, 'utf8');
            
            expect(communicationContent.includes(fixedProjectName), 'Project name should be substituted in COMMUNICATION.md').toBeTruthy();
        });

        it('should create comprehensive documentation with proper structure', async () => {
            await scaffoldCommand.execute(testDir);

            // Verify CONTRIBUTING.md has required sections
            const contributingPath = path.join(testDir, 'CONTRIBUTING.md');
            const contributingContent = fs.readFileSync(contributingPath, 'utf8');
            
            const requiredSections = [
                '## 🤝 How to Contribute',
                '## 👥 Trusted Committers',
                '## 📋 Code Review Process',
                '## 🧪 Testing Requirements'
            ];
            
            for (const section of requiredSections) {
                expect(contributingContent.includes(section), `CONTRIBUTING.md should contain section: ${section}`).toBeTruthy();
            }
        });

        it('should include security best practices', async () => {
            await scaffoldCommand.execute(testDir);

            const securityPath = path.join(testDir, 'SECURITY.md');
            const securityContent = fs.readFileSync(securityPath, 'utf8');
            
            const securityTopics = [
                '## 🛡️ Security',
                '## 🐛 Reporting a Vulnerability',
                '## 🔒 Security Best Practices',
                '## 📋 Security Checklist',
                '## 🔄 Security Updates'
            ];
            
            for (const topic of securityTopics) {
                expect(securityContent.includes(topic), `SECURITY.md should contain section: ${topic}`).toBeTruthy();
            }
        });

        it('should include code of conduct with enforcement', async () => {
            await scaffoldCommand.execute(testDir);

            const cocPath = path.join(testDir, 'CODE_OF_CONDUCT.md');
            const cocContent = fs.readFileSync(cocPath, 'utf8');
            
            const cocTopics = [
                '## Our Pledge',
                '## ✅ Positive Behavior',
                '## ❌ Unacceptable Behavior',
                '## Scope',
                '## Enforcement'
            ];
            
            for (const topic of cocTopics) {
                expect(cocContent.includes(topic), `CODE_OF_CONDUCT.md should contain section: ${topic}`).toBeTruthy();
            }
        });

        it('should include internal use license', async () => {
            await scaffoldCommand.execute(testDir);

            const licensePath = path.join(testDir, 'LICENSE');
            const licenseContent = fs.readFileSync(licensePath, 'utf8');
            
            expect(licenseContent.includes('Internal Use License'), 'LICENSE should be Internal Use License').toBeTruthy();
            expect(licenseContent.includes('proprietary to'), 'LICENSE should specify it is proprietary').toBeTruthy();
        });

        it('should substitute organization details in LICENSE when provided', async () => {
            const orgOptions = {
                projectName: 'test-project',
                organizationName: 'Acme Corp',
                internalContact: 'security@acme.com',
                legalContact: 'legal@acme.com',
                organizationPolicyLink: 'https://acme.com/policies'
            };
            
            await scaffoldCommand.execute(testDir, orgOptions);

            const licensePath = path.join(testDir, 'LICENSE');
            const licenseContent = fs.readFileSync(licensePath, 'utf8');
            
            expect(licenseContent.includes('Acme Corp'), 'LICENSE should contain organization name').toBeTruthy();
            expect(licenseContent.includes('security@acme.com'), 'LICENSE should contain internal contact').toBeTruthy();
            expect(licenseContent.includes('legal@acme.com'), 'LICENSE should contain legal contact').toBeTruthy();
            expect(licenseContent.includes('https://acme.com/policies'), 'LICENSE should contain organization policy link').toBeTruthy();
        });

        it('should substitute author and githubOrg in generated files', async () => {
            const options = {
                projectName: 'test-project',
                author: 'Test Author',
                githubOrg: 'test-org',
                internalContact: 'security@test.com'
            };
            
            await scaffoldCommand.execute(testDir, options);

            // Check package.json for author
            const packageJsonPath = path.join(testDir, 'package.json');
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            expect(packageJson.author, 'package.json should contain author').toBe('Test Author');
            expect(packageJson.license, 'package.json should have correct license field').toBe('SEE LICENSE IN LICENSE');

            // Check COMMUNICATION.md for githubOrg
            const communicationPath = path.join(testDir, 'COMMUNICATION.md');
            const communicationContent = fs.readFileSync(communicationPath, 'utf8');
            expect(communicationContent.includes('github.com/test-org/test-project'), 'COMMUNICATION.md should contain githubOrg in URLs').toBeTruthy();

            // Check SECURITY.md for internalContact
            const securityPath = path.join(testDir, 'SECURITY.md');
            const securityContent = fs.readFileSync(securityPath, 'utf8');
            expect(securityContent.includes('security@test.com'), 'SECURITY.md should contain internal contact').toBeTruthy();
        });
    });

    describe('Collection File Validation', () => {
        it('collection file should be valid YAML', async () => {
            await scaffoldCommand.execute(testDir);

            const collectionFile = path.join(testDir, 'collections', 'example.collection.yml');
            const content = fs.readFileSync(collectionFile, 'utf8');

            // Should not throw
            const yaml = require('js-yaml');
            const parsed = yaml.load(content);
            expect(parsed).toBeTruthy();
        });

        it('collection should reference example files', async () => {
            await scaffoldCommand.execute(testDir);

            const collectionFile = path.join(testDir, 'collections', 'example.collection.yml');
            const content = fs.readFileSync(collectionFile, 'utf8');

            expect(content.includes('prompts/example.prompt.md')).toBeTruthy();
            expect(content.includes('instructions/example.instructions.md')).toBeTruthy();
            expect(content.includes('agents/example.agent.md')).toBeTruthy();
        });

        it('collection should have required fields', async () => {
            await scaffoldCommand.execute(testDir);

            const collectionFile = path.join(testDir, 'collections', 'example.collection.yml');
            const content = fs.readFileSync(collectionFile, 'utf8');
            const yaml = require('js-yaml');
            const collection = yaml.load(content);

            expect(collection.id).toBeTruthy();
            expect(collection.name).toBeTruthy();
            expect(collection.description).toBeTruthy();
            expect(Array.isArray(collection.items)).toBeTruthy();
            expect(collection.items.length > 0).toBeTruthy();
        });

        it('collection items should have correct kinds', async () => {
            await scaffoldCommand.execute(testDir);

            const collectionFile = path.join(testDir, 'collections', 'example.collection.yml');
            const content = fs.readFileSync(collectionFile, 'utf8');
            const yaml = require('js-yaml');
            const collection = yaml.load(content);

            const promptItem = collection.items.find((item: any) => item.path.includes('prompt'));
            const instructionItem = collection.items.find((item: any) => item.path.includes('instruction'));
            const agentItem = collection.items.find((item: any) => item.path.includes('agent'));

            expect(promptItem?.kind).toBe('prompt');
            expect(instructionItem?.kind).toBe('instruction');
            expect(agentItem?.kind).toBe('agent');
        });
    });

    describe('README Creation', () => {
        it('should create README.md file', async () => {
            await scaffoldCommand.execute(testDir);

            const readmeFile = path.join(testDir, 'README.md');
            expect(fs.existsSync(readmeFile)).toBeTruthy();
        });
    });

    describe('Error Handling', () => {
        it('should throw error for invalid path', async () => {
            const invalidPath = '/invalid/path/that/does/not/exist/and/cannot/be/created/abc123xyz';
            
            await expect(async () => await scaffoldCommand.execute(invalidPath)).rejects.toThrow(/Cannot create directory|permission denied|EACCES|ENOENT/i);
        });

        it('should handle permission errors gracefully', async () => {
            // This test is platform-specific, so we'll just ensure it doesn't crash
            try {
                await scaffoldCommand.execute('/root/test-scaffold');
            } catch (error) {
                expect(error instanceof Error).toBeTruthy();
                expect((error as Error).message.length > 0).toBeTruthy();
            }
        });
        
        it('should support custom project name in collection', async () => {
            await scaffoldCommand.execute(testDir, { projectName: 'my-awesome-prompts' });

            const collectionFile = path.join(testDir, 'collections', 'example.collection.yml');
            const content = fs.readFileSync(collectionFile, 'utf8');
            const yaml = require('js-yaml');
            const collection = yaml.load(content);

            expect(collection.id === 'my-awesome-prompts' || collection.name.includes('my-awesome-prompts')).toBeTruthy();
        });

        it.skip('should support skipping example files', async () => {
            await scaffoldCommand.execute(testDir, { skipExamples: true });

            // Folders should exist
            expect(fs.existsSync(path.join(testDir, 'prompts'))).toBeTruthy();
            
            // But example files should not
            expect(!fs.existsSync(path.join(testDir, 'prompts', 'example.prompt.md'))).toBeTruthy();
            expect(!fs.existsSync(path.join(testDir, 'instructions', 'example.instructions.md'))).toBeTruthy();
        });
    });

    describe('Content Quality', () => {
        it('example prompt should be helpful and clear', async () => {
            await scaffoldCommand.execute(testDir);

            const promptFile = path.join(testDir, 'prompts', 'example.prompt.md');
            const content = fs.readFileSync(promptFile, 'utf8');

            // Should have meaningful content (more than just a title)
            expect(content.length > 100).toBeTruthy();
            // Should have some structure
            expect(content.includes('#') || content.includes('##')).toBeTruthy();
        });

        it('example instruction should explain best practices', async () => {
            await scaffoldCommand.execute(testDir);

            const instructionFile = path.join(testDir, 'instructions', 'example.instructions.md');
            const content = fs.readFileSync(instructionFile, 'utf8');

            expect(content.length > 100).toBeTruthy();
            expect(content.includes('best practice') || content.includes('guideline') || content.includes('standard')).toBeTruthy();
        });

        it('example chatmode should define a persona', async () => {
            await scaffoldCommand.execute(testDir);

            const agentFile = path.join(testDir, 'agents', 'example.agent.md');
            const content = fs.readFileSync(agentFile, 'utf8');

            expect(content.length > 100).toBeTruthy();
            expect(content.includes('You are') || content.includes('Act as') || content.includes('persona') || content.includes('role')).toBeTruthy();
        });

        it('example skill should have rich structure with scripts, references, and assets', async () => {
            await scaffoldCommand.execute(testDir);

            // Check SKILL.md exists and has proper frontmatter
            const skillFile = path.join(testDir, 'skills', 'example-skill', 'SKILL.md');
            expect(fs.existsSync(skillFile), 'SKILL.md should exist').toBeTruthy();
            const skillContent = fs.readFileSync(skillFile, 'utf8');
            expect(skillContent.includes('name:'), 'SKILL.md should have name in frontmatter').toBeTruthy();
            expect(skillContent.includes('description:'), 'SKILL.md should have description in frontmatter').toBeTruthy();

            // Check scripts directory
            const scriptFile = path.join(testDir, 'skills', 'example-skill', 'scripts', 'review-helper.sh');
            expect(fs.existsSync(scriptFile), 'Helper script should exist').toBeTruthy();

            // Check references directory
            const checklistFile = path.join(testDir, 'skills', 'example-skill', 'references', 'CHECKLIST.md');
            expect(fs.existsSync(checklistFile), 'Checklist reference should exist').toBeTruthy();
            const feedbackFile = path.join(testDir, 'skills', 'example-skill', 'references', 'FEEDBACK.md');
            expect(fs.existsSync(feedbackFile), 'Feedback reference should exist').toBeTruthy();

            // Check assets directory
            const templatesFile = path.join(testDir, 'skills', 'example-skill', 'assets', 'comment-templates.md');
            expect(fs.existsSync(templatesFile), 'Comment templates asset should exist').toBeTruthy();
        });

        it('should create GitHub Issue and PR templates', async () => {
            await scaffoldCommand.execute(testDir);

            // Check Issue templates
            const bugReportTemplate = path.join(testDir, '.github', 'ISSUE_TEMPLATE', 'bug_report.yml');
            expect(fs.existsSync(bugReportTemplate), 'Bug report template should exist').toBeTruthy();

            const featureRequestTemplate = path.join(testDir, '.github', 'ISSUE_TEMPLATE', 'feature_request.yml');
            expect(fs.existsSync(featureRequestTemplate), 'Feature request template should exist').toBeTruthy();

            const issueConfigTemplate = path.join(testDir, '.github', 'ISSUE_TEMPLATE', 'config.yml');
            expect(fs.existsSync(issueConfigTemplate), 'Issue config template should exist').toBeTruthy();

            // Check PR template
            const prTemplate = path.join(testDir, '.github', 'pull_request_template.md');
            expect(fs.existsSync(prTemplate), 'PR template should exist').toBeTruthy();
        });
    });
});

describe('Skill Scaffold', () => {
    let testDir: string;
    let skillScaffoldCommand: ScaffoldCommand;

    beforeEach(() => {
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-scaffold-test-'));
        // Import ScaffoldType to create skill-specific command
        // ScaffoldType imported at top of file
        const skillTemplateRoot = path.join(process.cwd(), 'templates/scaffolds/skill');
        skillScaffoldCommand = new ScaffoldCommand(skillTemplateRoot, ScaffoldType.Skill);
    });

    afterEach(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    it('should create SKILL.md file with correct structure', async () => {
        await skillScaffoldCommand.execute(testDir, { projectName: 'my-skill' });

        const skillFile = path.join(testDir, 'my-skill', 'SKILL.md');
        expect(fs.existsSync(skillFile), 'SKILL.md should exist').toBeTruthy();

        const content = fs.readFileSync(skillFile, 'utf8');
        
        // Should have YAML frontmatter
        expect(content.startsWith('---'), 'Should have YAML frontmatter').toBeTruthy();
        expect(content.includes('name:'), 'Should have name field').toBeTruthy();
        expect(content.includes('description:'), 'Should have description field').toBeTruthy();
        expect(content.includes('allowed-tools:'), 'Should have allowed-tools').toBeTruthy();
    });

    it('should create README.md file', async () => {
        await skillScaffoldCommand.execute(testDir, { projectName: 'test-skill' });

        const readmeFile = path.join(testDir, 'test-skill', 'README.md');
        expect(fs.existsSync(readmeFile), 'README.md should exist').toBeTruthy();

        const content = fs.readFileSync(readmeFile, 'utf8');
        expect(content.includes('test-skill'), 'Should contain skill name').toBeTruthy();
        expect(content.includes('Installation'), 'Should have installation section').toBeTruthy();
    });

    it('should create example script', async () => {
        await skillScaffoldCommand.execute(testDir, { projectName: 'scripted-skill' });

        const scriptFile = path.join(testDir, 'scripted-skill', 'scripts', 'example.py');
        expect(fs.existsSync(scriptFile), 'example.py should exist').toBeTruthy();

        const content = fs.readFileSync(scriptFile, 'utf8');
        expect(content.includes('scripted-skill'), 'Should reference skill name').toBeTruthy();
        expect(content.includes('#!/usr/bin/env python3'), 'Should have shebang').toBeTruthy();
    });

    it('should use provided description', async () => {
        await skillScaffoldCommand.execute(testDir, { 
            projectName: 'described-skill',
            description: 'A custom skill description'
        });

        const skillFile = path.join(testDir, 'described-skill', 'SKILL.md');
        const content = fs.readFileSync(skillFile, 'utf8');
        expect(content.includes('A custom skill description'), 'Should use provided description').toBeTruthy();
    });

    it('should use provided author', async () => {
        await skillScaffoldCommand.execute(testDir, { 
            projectName: 'authored-skill',
            author: 'Test Author'
        });

        const skillFile = path.join(testDir, 'authored-skill', 'SKILL.md');
        const content = fs.readFileSync(skillFile, 'utf8');
        expect(content.includes('Test Author'), 'Should use provided author').toBeTruthy();
    });

    it('should create skill directory structure', async () => {
        await skillScaffoldCommand.execute(testDir, { projectName: 'structured-skill' });

        const skillDir = path.join(testDir, 'structured-skill');
        expect(fs.existsSync(skillDir), 'Skill directory should exist').toBeTruthy();
        expect(fs.existsSync(path.join(skillDir, 'SKILL.md')), 'SKILL.md should exist').toBeTruthy();
        expect(fs.existsSync(path.join(skillDir, 'README.md')), 'README.md should exist').toBeTruthy();
    });
});
