/**
 * Copilot File Type Utilities Tests
 * 
 * Tests for shared utilities that determine file types, generate target file names,
 * and map file types to repository directories.
 * 
 * Requirements: 1.2-1.7, 10.1-10.5
 */

import {
    CopilotFileType,
    determineFileType,
    getTargetFileName,
    getRepositoryTargetDirectory,
    getFileExtension,
    isSkillDirectory,
    getSkillName,
    normalizePromptId
} from '../../src/utils/copilotFileTypeUtils';

describe('copilotFileTypeUtils', () => {
    describe('normalizePromptId', () => {
        it('should return string unchanged when already valid', () => {
            expect(normalizePromptId('my-prompt')).toBe('my-prompt');
            expect(normalizePromptId('test_prompt')).toBe('test_prompt');
            expect(normalizePromptId('prompt123')).toBe('prompt123');
        });

        it('should replace special characters with hyphens', () => {
            expect(normalizePromptId('my prompt')).toBe('my-prompt');
            expect(normalizePromptId('my.prompt')).toBe('my-prompt');
            expect(normalizePromptId('my/prompt')).toBe('my-prompt');
            expect(normalizePromptId('my@prompt!')).toBe('my-prompt-');
        });

        it('should handle numeric IDs from YAML parsing', () => {
            expect(normalizePromptId(6)).toBe('6');
            expect(normalizePromptId(123)).toBe('123');
            expect(normalizePromptId(0)).toBe('0');
        });

        it('should preserve alphanumeric characters, hyphens, and underscores', () => {
            expect(normalizePromptId('ABC-123_test')).toBe('ABC-123_test');
            expect(normalizePromptId('a-b_c')).toBe('a-b_c');
        });

        it('should handle empty string', () => {
            expect(normalizePromptId('')).toBe('');
        });

        it('should handle string with only special characters', () => {
            expect(normalizePromptId('...')).toBe('---');
            expect(normalizePromptId('@#$')).toBe('---');
        });
    });

    describe('determineFileType', () => {
        describe('detection from file name', () => {
            it('should detect prompt type from .prompt.md extension', () => {
                expect(determineFileType('my-prompt.prompt.md')).toBe('prompt');
                expect(determineFileType('test.prompt.md')).toBe('prompt');
            });

            it('should detect instructions type from .instructions.md extension', () => {
                expect(determineFileType('coding-standards.instructions.md')).toBe('instructions');
                expect(determineFileType('test.instructions.md')).toBe('instructions');
            });

            it('should detect chatmode type from .chatmode.md extension', () => {
                expect(determineFileType('expert.chatmode.md')).toBe('chatmode');
                expect(determineFileType('test.chatmode.md')).toBe('chatmode');
            });

            it('should detect agent type from .agent.md extension', () => {
                expect(determineFileType('code-reviewer.agent.md')).toBe('agent');
                expect(determineFileType('test.agent.md')).toBe('agent');
            });

            it('should detect skill type from SKILL.md file', () => {
                expect(determineFileType('SKILL.md')).toBe('skill');
            });

            it('should detect instructions from filename containing "instructions"', () => {
                expect(determineFileType('my-instructions.md')).toBe('instructions');
                expect(determineFileType('coding_instructions.md')).toBe('instructions');
            });

            it('should default to prompt for unrecognized .md files', () => {
                expect(determineFileType('unknown.md')).toBe('prompt');
                expect(determineFileType('readme.md')).toBe('prompt');
            });
        });

        describe('detection from tags', () => {
            it('should detect instructions type from tags', () => {
                expect(determineFileType('file.md', ['instructions'])).toBe('instructions');
                expect(determineFileType('file.md', ['other', 'instructions'])).toBe('instructions');
            });

            it('should detect chatmode type from tags', () => {
                expect(determineFileType('file.md', ['chatmode'])).toBe('chatmode');
                expect(determineFileType('file.md', ['mode'])).toBe('chatmode');
            });

            it('should detect agent type from tags', () => {
                expect(determineFileType('file.md', ['agent'])).toBe('agent');
            });

            it('should detect skill type from tags', () => {
                expect(determineFileType('file.md', ['skill'])).toBe('skill');
            });

            it('should prioritize file extension over tags', () => {
                // File extension should take precedence
                expect(determineFileType('test.agent.md', ['instructions'])).toBe('agent');
                expect(determineFileType('test.instructions.md', ['agent'])).toBe('instructions');
            });

            it('should use tags when file extension is generic', () => {
                expect(determineFileType('generic.md', ['agent'])).toBe('agent');
                expect(determineFileType('generic.md', ['chatmode'])).toBe('chatmode');
            });
        });

        describe('edge cases', () => {
            it('should handle empty tags array', () => {
                expect(determineFileType('test.prompt.md', [])).toBe('prompt');
            });

            it('should handle undefined tags', () => {
                expect(determineFileType('test.prompt.md')).toBe('prompt');
            });

            it('should handle case-insensitive file extensions', () => {
                expect(determineFileType('TEST.PROMPT.MD')).toBe('prompt');
                expect(determineFileType('Test.Instructions.Md')).toBe('instructions');
            });

            it('should handle paths with directories', () => {
                expect(determineFileType('prompts/my-prompt.prompt.md')).toBe('prompt');
                expect(determineFileType('agents/code-reviewer.agent.md')).toBe('agent');
            });
        });
    });

    describe('getTargetFileName', () => {
        it('should generate prompt file name', () => {
            expect(getTargetFileName('my-prompt', 'prompt')).toBe('my-prompt.prompt.md');
        });

        it('should generate instructions file name', () => {
            expect(getTargetFileName('coding-standards', 'instructions')).toBe('coding-standards.instructions.md');
        });

        it('should generate chatmode file name', () => {
            expect(getTargetFileName('expert-mode', 'chatmode')).toBe('expert-mode.chatmode.md');
        });

        it('should generate agent file name', () => {
            expect(getTargetFileName('code-reviewer', 'agent')).toBe('code-reviewer.agent.md');
        });

        it('should generate skill file name (SKILL.md)', () => {
            // Skills use SKILL.md as the main file
            expect(getTargetFileName('my-skill', 'skill')).toBe('SKILL.md');
        });

        it('should handle IDs with special characters', () => {
            expect(getTargetFileName('my_prompt-v1', 'prompt')).toBe('my_prompt-v1.prompt.md');
        });
    });

    describe('getRepositoryTargetDirectory', () => {
        it('should return .github/prompts/ for prompt type', () => {
            expect(getRepositoryTargetDirectory('prompt')).toBe('.github/prompts/');
        });

        it('should return .github/instructions/ for instructions type', () => {
            expect(getRepositoryTargetDirectory('instructions')).toBe('.github/instructions/');
        });

        it('should return .github/prompts/ for chatmode type', () => {
            // Chatmodes go to prompts directory per VS Code Copilot conventions
            expect(getRepositoryTargetDirectory('chatmode')).toBe('.github/prompts/');
        });

        it('should return .github/agents/ for agent type', () => {
            expect(getRepositoryTargetDirectory('agent')).toBe('.github/agents/');
        });

        it('should return .github/skills/ for skill type', () => {
            expect(getRepositoryTargetDirectory('skill')).toBe('.github/skills/');
        });

        it('should return paths with trailing slash', () => {
            const types: CopilotFileType[] = ['prompt', 'instructions', 'chatmode', 'agent', 'skill'];
            for (const type of types) {
                const dir = getRepositoryTargetDirectory(type);
                expect(dir.endsWith('/'), `Directory for ${type} should end with /`).toBeTruthy();
            }
        });

        it('should return paths starting with .github/', () => {
            const types: CopilotFileType[] = ['prompt', 'instructions', 'chatmode', 'agent', 'skill'];
            for (const type of types) {
                const dir = getRepositoryTargetDirectory(type);
                expect(dir.startsWith('.github/'), `Directory for ${type} should start with .github/`).toBeTruthy();
            }
        });
    });

    describe('getFileExtension', () => {
        it('should return .prompt.md for prompt type', () => {
            expect(getFileExtension('prompt')).toBe('.prompt.md');
        });

        it('should return .instructions.md for instructions type', () => {
            expect(getFileExtension('instructions')).toBe('.instructions.md');
        });

        it('should return .chatmode.md for chatmode type', () => {
            expect(getFileExtension('chatmode')).toBe('.chatmode.md');
        });

        it('should return .agent.md for agent type', () => {
            expect(getFileExtension('agent')).toBe('.agent.md');
        });

        it('should return empty string for skill type (skills are directories)', () => {
            // Skills are directories, not single files
            expect(getFileExtension('skill')).toBe('');
        });
    });

    describe('isSkillDirectory', () => {
        it('should return true for paths under skills/ directory', () => {
            expect(isSkillDirectory('skills/my-skill')).toBe(true);
            expect(isSkillDirectory('skills/another-skill/')).toBe(true);
        });

        it('should return true for nested skills paths', () => {
            expect(isSkillDirectory('path/to/skills/my-skill')).toBe(true);
            expect(isSkillDirectory('bundles/test/skills/skill-name')).toBe(true);
        });

        it('should return false for non-skill paths', () => {
            expect(isSkillDirectory('prompts/my-prompt.prompt.md')).toBe(false);
            expect(isSkillDirectory('agents/my-agent.agent.md')).toBe(false);
            expect(isSkillDirectory('my-file.md')).toBe(false);
        });

        it('should handle Windows-style paths', () => {
            expect(isSkillDirectory('skills\\my-skill')).toBe(true);
            expect(isSkillDirectory('path\\to\\skills\\my-skill')).toBe(true);
        });

        it('should be case-insensitive for skills directory', () => {
            expect(isSkillDirectory('Skills/my-skill')).toBe(true);
            expect(isSkillDirectory('SKILLS/my-skill')).toBe(true);
        });
    });

    describe('getSkillName', () => {
        it('should extract skill name from simple path', () => {
            expect(getSkillName('skills/my-skill')).toBe('my-skill');
            expect(getSkillName('skills/another-skill')).toBe('another-skill');
        });

        it('should extract skill name from nested path', () => {
            expect(getSkillName('path/to/skills/my-skill')).toBe('my-skill');
            expect(getSkillName('bundles/test/skills/skill-name')).toBe('skill-name');
        });

        it('should extract skill name from path with trailing content', () => {
            expect(getSkillName('skills/my-skill/SKILL.md')).toBe('my-skill');
            expect(getSkillName('skills/my-skill/src/index.js')).toBe('my-skill');
        });

        it('should return null for non-skill paths', () => {
            expect(getSkillName('prompts/my-prompt.prompt.md')).toBe(null);
            expect(getSkillName('agents/my-agent.agent.md')).toBe(null);
            expect(getSkillName('my-file.md')).toBe(null);
        });

        it('should handle Windows-style paths', () => {
            expect(getSkillName('skills\\my-skill')).toBe('my-skill');
            expect(getSkillName('path\\to\\skills\\my-skill')).toBe('my-skill');
        });

        it('should be case-insensitive for skills directory', () => {
            expect(getSkillName('Skills/my-skill')).toBe('my-skill');
            expect(getSkillName('SKILLS/my-skill')).toBe('my-skill');
        });
    });
});
