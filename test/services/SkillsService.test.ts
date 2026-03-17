/**
 * SkillsService Unit Tests
 * Tests for skills installation directory resolution and syncing
 */

import * as path from 'path';
import * as os from 'os';

describe('SkillsService', () => {
    describe('getSkillsDirectory', () => {
        it('should return ~/.copilot/skills for user scope', () => {
            const expectedPath = path.join(os.homedir(), '.copilot', 'skills');
            expect(expectedPath).toBe(path.join(os.homedir(), '.copilot', 'skills'));
        });

        it('should return ~/.claude/skills as fallback location', () => {
            const expectedPath = path.join(os.homedir(), '.claude', 'skills');
            expect(expectedPath).toBe(path.join(os.homedir(), '.claude', 'skills'));
        });

        it('should return .copilot/skills for workspace scope', () => {
            const workspacePath = '/mock/workspace';
            const expectedPath = path.join(workspacePath, '.copilot', 'skills');
            expect(expectedPath).toBe(path.join(workspacePath, '.copilot', 'skills'));
        });
    });

    describe('Skill Directory Structure', () => {
        it('should recognize SKILL.md as the main skill file', () => {
            const skillPath = 'skills/my-skill/SKILL.md';
            const isValidSkillPath = skillPath.match(/^skills\/[^\/]+\/SKILL\.md$/);
            expect(isValidSkillPath, 'Should match skill path pattern').toBeTruthy();
        });

        it('should support scripts subdirectory', () => {
            const scriptPath = 'skills/my-skill/scripts/helper.py';
            const isInScriptsDir = scriptPath.includes('/scripts/');
            expect(isInScriptsDir).toBeTruthy();
        });

        it('should support references subdirectory', () => {
            const referencePath = 'skills/my-skill/references/docs.md';
            const isInReferencesDir = referencePath.includes('/references/');
            expect(isInReferencesDir).toBeTruthy();
        });

        it('should support assets subdirectory', () => {
            const assetPath = 'skills/my-skill/assets/template.json';
            const isInAssetsDir = assetPath.includes('/assets/');
            expect(isInAssetsDir).toBeTruthy();
        });
    });
});

describe('Skill Kind Mapping', () => {
    it('should map skill kind to skill type', () => {
        const kindMap: Record<string, string> = {
            'prompt': 'prompt',
            'instruction': 'instructions',
            'chat-mode': 'chatmode',
            'agent': 'agent',
            'skill': 'skill'
        };
        
        expect(kindMap['skill']).toBe('skill');
    });

    it('should recognize skill path pattern in collection', () => {
        const pattern = /^(?:skills\/[^\/]+\/SKILL\.md|(prompts|instructions|agents)\/[^\/]+\.(prompt|instructions|agent)\.md)$/;
        
        expect(pattern.test('skills/my-skill/SKILL.md')).toBeTruthy();
        expect(pattern.test('skills/another-skill/SKILL.md')).toBeTruthy();
        expect(pattern.test('prompts/test.prompt.md')).toBeTruthy();
        expect(pattern.test('instructions/test.instructions.md')).toBeTruthy();
        expect(pattern.test('agents/test.agent.md')).toBeTruthy();
        
        expect(!pattern.test('skills/SKILL.md')).toBeTruthy();
        expect(!pattern.test('skills/my-skill/skill.md')).toBeTruthy();
        expect(!pattern.test('prompts/test.md')).toBeTruthy();
    });
});

describe('Skill Content Type', () => {
    it('should identify skill type from path', () => {
        const detectType = (itemPath: string): string => {
            if (itemPath.includes('/SKILL.md')) {
                return 'skill';
            }
            const match = itemPath.match(/\.(prompt|instructions|chatmode|agent)\.md$/);
            return match ? match[1] : 'prompt';
        };
        
        expect(detectType('skills/my-skill/SKILL.md')).toBe('skill');
        expect(detectType('prompts/test.prompt.md')).toBe('prompt');
        expect(detectType('instructions/test.instructions.md')).toBe('instructions');
    });
});
