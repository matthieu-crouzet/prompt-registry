/**
 * Tests for regex utility functions
 */

import { escapeRegex, createSafeRegex, replaceAll, replaceVariables } from '../../src/utils/regexUtils';

describe('regexUtils', () => {
    describe('escapeRegex', () => {
        it('should escape all special regex characters', () => {
            const input = '.*+?^${}()|[]\\';
            const escaped = escapeRegex(input);
            
            // All special chars should be escaped
            expect(escaped).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
            
            // Should create valid regex
            const regex = new RegExp(escaped);
            expect(regex.test(input), 'Escaped regex should match original string').toBeTruthy();
        });

        it('should handle Windows paths', () => {
            const windowsPath = 'C:\\Users\\Test\\file.txt';
            const escaped = escapeRegex(windowsPath);
            
            // Should not throw
            const regex = new RegExp(escaped);
            expect(regex.test(windowsPath), 'Should match Windows path').toBeTruthy();
        });

        it('should handle paths with parentheses', () => {
            const path = 'C:\\Program Files (x86)\\App';
            const escaped = escapeRegex(path);
            
            const regex = new RegExp(escaped);
            expect(regex.test(path), 'Should match path with parentheses').toBeTruthy();
        });

        it('should handle paths with brackets', () => {
            const path = '/usr/local/[config]/file';
            const escaped = escapeRegex(path);
            
            const regex = new RegExp(escaped);
            expect(regex.test(path), 'Should match path with brackets').toBeTruthy();
        });

        it('should handle empty string', () => {
            const escaped = escapeRegex('');
            expect(escaped).toBe('');
        });

        it('should handle string with no special chars', () => {
            const input = 'simple-string_123';
            const escaped = escapeRegex(input);
            expect(escaped, 'Should not modify string without special chars').toBe(input);
        });

        it('should handle unicode characters', () => {
            const unicode = 'path/with/émojis/🎉/file.txt';
            const escaped = escapeRegex(unicode);
            const regex = new RegExp(escaped);
            expect(regex.test(unicode), 'Should handle unicode characters').toBeTruthy();
        });

        it('should handle very long strings efficiently', () => {
            const longPath = 'C:\\' + 'folder\\'.repeat(100) + 'file.txt';
            const start = Date.now();
            const escaped = escapeRegex(longPath);
            const duration = Date.now() - start;
            expect(duration < 100, 'Should escape long strings quickly').toBeTruthy();
            expect(escaped.length > longPath.length, 'Should escape backslashes').toBeTruthy();
        });
    });

    describe('createSafeRegex', () => {
        it('should create regex from string with special chars', () => {
            const pattern = 'path.with.dots';
            const regex = createSafeRegex(pattern);
            
            expect(regex.test('path.with.dots'), 'Should match literal string').toBeTruthy();
            expect(!regex.test('pathXwithXdots'), 'Should not match with different chars').toBeTruthy();
        });

        it('should support regex flags', () => {
            const pattern = 'test';
            const regex = createSafeRegex(pattern, 'i');
            
            expect(regex.test('TEST'), 'Should be case-insensitive with i flag').toBeTruthy();
            expect(regex.test('Test'), 'Should be case-insensitive with i flag').toBeTruthy();
        });

        it('should support global flag', () => {
            const pattern = 'a';
            const regex = createSafeRegex(pattern, 'g');
            const text = 'aaa';
            
            const matches = text.match(regex);
            expect(matches?.length, 'Should match all occurrences with g flag').toBe(3);
        });
    });

    describe('replaceAll', () => {
        it('should replace all occurrences', () => {
            const text = 'foo bar foo baz foo';
            const result = replaceAll(text, 'foo', 'qux');
            
            expect(result).toBe('qux bar qux baz qux');
        });

        it('should handle Windows paths in replacement', () => {
            const template = 'Path: PLACEHOLDER';
            const windowsPath = 'C:\\Users\\Test\\file.txt';
            const result = replaceAll(template, 'PLACEHOLDER', windowsPath);
            
            expect(result).toBe(`Path: ${windowsPath}`);
            expect(result.includes('\\Users\\'), 'Should preserve backslashes').toBeTruthy();
        });

        it('should handle $ in replacement', () => {
            const template = 'Price: AMOUNT';
            const result = replaceAll(template, 'AMOUNT', '$100');
            
            expect(result).toBe('Price: $100');
        });

        it('should handle special regex chars in search', () => {
            const text = 'Value: {{KEY}}';
            const result = replaceAll(text, '{{KEY}}', 'value');
            
            expect(result).toBe('Value: value');
        });

        it('should handle dots in search pattern', () => {
            const text = 'file.txt is a file.txt';
            const result = replaceAll(text, 'file.txt', 'doc.pdf');
            
            expect(result).toBe('doc.pdf is a doc.pdf');
        });

        it('should handle empty replacement', () => {
            const text = 'foo bar foo';
            const result = replaceAll(text, 'foo', '');
            
            expect(result).toBe(' bar ');
        });

        it('should handle no matches', () => {
            const text = 'foo bar baz';
            const result = replaceAll(text, 'qux', 'replacement');
            
            expect(result, 'Should return original text if no matches').toBe(text);
        });
    });

    describe('replaceVariables', () => {
        it('should replace multiple variables', () => {
            const template = 'Hello {{NAME}}, you are {{AGE}} years old';
            const result = replaceVariables(template, {
                NAME: 'Alice',
                AGE: '30'
            });
            
            expect(result).toBe('Hello Alice, you are 30 years old');
        });

        it('should handle Windows paths in values', () => {
            const template = 'Install to: {{PATH}}';
            const result = replaceVariables(template, {
                PATH: 'C:\\Users\\Test\\AppData'
            });
            
            expect(result).toBe('Install to: C:\\Users\\Test\\AppData');
        });

        it('should handle special characters in values', () => {
            const template = 'Price: {{PRICE}}, Path: {{PATH}}';
            const result = replaceVariables(template, {
                PRICE: '$100',
                PATH: 'C:\\Program Files (x86)'
            });
            
            expect(result).toBe('Price: $100, Path: C:\\Program Files (x86)');
        });

        it('should support custom prefix and suffix', () => {
            const template = 'Hello {NAME}, version {VERSION}';
            const result = replaceVariables(template, {
                NAME: 'Bob',
                VERSION: '1.0.0'
            }, {
                prefix: '{',
                suffix: '}'
            });
            
            expect(result).toBe('Hello Bob, version 1.0.0');
        });

        it('should handle missing variables', () => {
            const template = 'Hello {{NAME}}, {{MISSING}}';
            const result = replaceVariables(template, {
                NAME: 'Alice'
            });
            
            expect(result, 'Should leave unmatched placeholders').toBe('Hello Alice, {{MISSING}}');
        });

        it('should handle empty variables object', () => {
            const template = 'Hello {{NAME}}';
            const result = replaceVariables(template, {});
            
            expect(result, 'Should return original template').toBe(template);
        });

        it('should handle variables with dots in names', () => {
            const template = 'Value: {{MY.KEY}}';
            const result = replaceVariables(template, {
                'MY.KEY': 'test-value'
            });
            
            expect(result).toBe('Value: test-value');
        });

        it('should handle nested template syntax', () => {
            const template = 'Value: {{{{KEY}}}}';
            const result = replaceVariables(template, { KEY: 'value' });
            // Should replace inner {{KEY}} first, leaving outer braces
            expect(result).toBe('Value: {{value}}');
        });

        it('should handle malformed template syntax gracefully', () => {
            const template = 'Value: {{KEY} or {KEY}} or {{KEY';
            const result = replaceVariables(template, { KEY: 'value' });
            // Should only replace properly formed {{KEY}}
            expect(result).toBe('Value: {{KEY} or {KEY}} or {{KEY');
        });
    });
});
