/**
 * Unit tests for CollectionValidator
 * 
 * Following TDD: Tests written first, implementation to follow
 */

import * as path from 'path';
import { CollectionValidator, ValidationResult, ValidationError, ValidationWarning } from '../../src/utils/collectionValidator';

describe('CollectionValidator', () => {
    let validator: CollectionValidator;
    // Fixtures are in source tree, not copied to test-dist
    // __dirname in compiled code: test-dist/test/utils
    // Need to go to project root, then to test/fixtures
    const fixturesDir = path.join(__dirname, '../fixtures/collections-validator');

    beforeEach(() => {
        validator = new CollectionValidator();
    });

    describe('validateCollection', () => {
        describe('Valid Collections', () => {
            it('should pass a valid collection', () => {
                const collectionPath = path.join(fixturesDir, 'valid/good.collection.yml');
                const result = validator.validateCollection(collectionPath, path.join(fixturesDir, 'valid'));

                expect(result.valid, 'Collection should be valid').toBe(true);
                expect(result.errors.length, 'Should have no errors').toBe(0);
                expect(result.warnings.length, 'Should have no warnings').toBe(0);
            });
        });

        describe('Required Fields', () => {
            it('should fail if id is missing', () => {
                const collectionPath = path.join(fixturesDir, 'invalid/missing-id.collection.yml');
                const result = validator.validateCollection(collectionPath, fixturesDir);

                expect(result.valid, 'Collection should be invalid').toBe(false);
                expect(result.errors.some((e: ValidationError) => e.message.includes('id')), 'Should have error about missing id').toBeTruthy();
            });

            it('should fail if name is missing', () => {
                const collectionPath = path.join(fixturesDir, 'invalid/missing-name.collection.yml');
                const result = validator.validateCollection(collectionPath, fixturesDir);

                expect(result.valid, 'Collection should be invalid').toBe(false);
                expect(result.errors.some((e: ValidationError) => e.message.includes('name')), 'Should have error about missing name').toBeTruthy();
            });

            it('should fail if description is missing', () => {
                const collectionPath = path.join(fixturesDir, 'invalid/missing-description.collection.yml');
                const result = validator.validateCollection(collectionPath, fixturesDir);

                expect(result.valid, 'Collection should be invalid').toBe(false);
                expect(result.errors.some((e: ValidationError) => e.message.includes('description')), 'Should have error about missing description').toBeTruthy();
            });

            it('should fail if items is missing', () => {
                const collectionPath = path.join(fixturesDir, 'invalid/missing-items.collection.yml');
                const result = validator.validateCollection(collectionPath, fixturesDir);

                expect(result.valid, 'Collection should be invalid').toBe(false);
                expect(result.errors.some((e: ValidationError) => e.message.includes('items')), 'Should have error about missing items').toBeTruthy();
            });
        });

        describe('ID Validation', () => {
            it('should fail if id has uppercase letters', () => {
                const collectionPath = path.join(fixturesDir, 'invalid/invalid-id-uppercase.collection.yml');
                const result = validator.validateCollection(collectionPath, fixturesDir);

                expect(result.valid, 'Collection should be invalid').toBe(false);
                expect(result.errors.some((e: ValidationError) => e.message.toLowerCase().includes('id') && e.message.toLowerCase().includes('lowercase')), 'Should have error about ID format').toBeTruthy();
            });

            it('should fail if id has spaces', () => {
                const collectionPath = path.join(fixturesDir, 'invalid/invalid-id-spaces.collection.yml');
                const result = validator.validateCollection(collectionPath, fixturesDir);

                expect(result.valid, 'Collection should be invalid').toBe(false);
                expect(result.errors.some((e: ValidationError) => e.message.toLowerCase().includes('id')), 'Should have error about ID format').toBeTruthy();
            });

            it('should accept valid id with lowercase, numbers, and hyphens', () => {
                const collectionPath = path.join(fixturesDir, 'valid/good.collection.yml');
                const result = validator.validateCollection(collectionPath, path.join(fixturesDir, 'valid'));

                expect(result.valid, 'Collection should be valid').toBe(true);
                const idErrors = result.errors.filter((e: ValidationError) => e.message.toLowerCase().includes('id'));
                expect(idErrors.length, 'Should have no ID format errors').toBe(0);
            });
        });

        describe('Description Validation', () => {
            it('should warn if description exceeds 500 characters', () => {
                const collectionPath = path.join(fixturesDir, 'warnings/long-description.collection.yml');
                const result = validator.validateCollection(collectionPath, fixturesDir);

                expect(result.warnings.some((w: ValidationWarning) => w.message.toLowerCase().includes('description') && w.message.includes('500')), 'Should have warning about long description').toBeTruthy();
            });
        });

        describe('Items Validation', () => {
            it('should fail if item is missing path field', () => {
                const collectionPath = path.join(fixturesDir, 'invalid/item-missing-path.collection.yml');
                const result = validator.validateCollection(collectionPath, fixturesDir);

                expect(result.valid, 'Collection should be invalid').toBe(false);
                expect(result.errors.some((e: ValidationError) => e.message.toLowerCase().includes('path')), 'Should have error about missing path').toBeTruthy();
            });

            it('should fail if item is missing kind field', () => {
                const collectionPath = path.join(fixturesDir, 'invalid/item-missing-kind.collection.yml');
                const result = validator.validateCollection(collectionPath, fixturesDir);

                expect(result.valid, 'Collection should be invalid').toBe(false);
                expect(result.errors.some((e: ValidationError) => e.message.toLowerCase().includes('kind')), 'Should have error about missing kind').toBeTruthy();
            });

            it('should fail if kind is invalid', () => {
                const collectionPath = path.join(fixturesDir, 'invalid/invalid-kind.collection.yml');
                const result = validator.validateCollection(collectionPath, fixturesDir);

                expect(result.valid, 'Collection should be invalid').toBe(false);
                expect(result.errors.some(e => e.message.toLowerCase().includes('kind')), 'Should have error about invalid kind').toBeTruthy();
            });

            it('should accept valid kinds: prompt, instruction, chat-mode, agent', () => {
                const collectionPath = path.join(fixturesDir, 'valid/good.collection.yml');
                const result = validator.validateCollection(collectionPath, path.join(fixturesDir, 'valid'));

                expect(result.valid, 'Collection should be valid').toBe(true);
                const kindErrors = result.errors.filter((e: ValidationError) => e.message.toLowerCase().includes('kind'));
                expect(kindErrors.length, 'Should have no kind errors').toBe(0);
            });
        });

        describe('File Reference Validation', () => {
            it('should fail if referenced file does not exist', () => {
                const collectionPath = path.join(fixturesDir, 'invalid/missing-file-ref.collection.yml');
                const result = validator.validateCollection(collectionPath, fixturesDir);

                expect(result.valid, 'Collection should be invalid').toBe(false);
                expect(result.errors.some((e: ValidationError) => e.message.toLowerCase().includes('not exist') || e.message.toLowerCase().includes('missing')), 'Should have error about missing file').toBeTruthy();
            });

            it('should pass if all referenced files exist', () => {
                const collectionPath = path.join(fixturesDir, 'valid/good.collection.yml');
                const result = validator.validateCollection(collectionPath, path.join(fixturesDir, 'valid'));

                expect(result.valid, 'Collection should be valid').toBe(true);
                const fileErrors = result.errors.filter((e: ValidationError) => e.message.toLowerCase().includes('not exist') || e.message.toLowerCase().includes('missing'));
                expect(fileErrors.length, 'Should have no file reference errors').toBe(0);
            });
        });

        describe('Tags Validation', () => {
            it('should warn if more than 10 tags', () => {
                const collectionPath = path.join(fixturesDir, 'warnings/many-tags.collection.yml');
                const result = validator.validateCollection(collectionPath, fixturesDir);

                expect(result.warnings.some((w: ValidationWarning) => w.message.includes('tag') && w.message.includes('10')), 'Should have warning about too many tags').toBeTruthy();
            });

            it('should accept collections with valid tags', () => {
                const collectionPath = path.join(fixturesDir, 'valid/good.collection.yml');
                const result = validator.validateCollection(collectionPath, path.join(fixturesDir, 'valid'));

                expect(result.valid, 'Collection should be valid').toBe(true);
                const tagErrors = result.errors.filter((e: ValidationError) => e.message.toLowerCase().includes('tag'));
                expect(tagErrors.length, 'Should have no tag errors').toBe(0);
            });
        });

        describe('YAML Parsing', () => {
            it('should fail gracefully with YAML syntax errors', () => {
                const collectionPath = path.join(fixturesDir, 'invalid/yaml-syntax-error.collection.yml');
                const result = validator.validateCollection(collectionPath, fixturesDir);

                expect(result.valid, 'Collection should be invalid').toBe(false);
                expect(result.errors.some((e: ValidationError) => e.message.toLowerCase().includes('yaml') || e.message.toLowerCase().includes('parse')), 'Should have error about YAML parsing').toBeTruthy();
            });
        });

        describe('Error Structure', () => {
            it('should include file name in errors', () => {
                const collectionPath = path.join(fixturesDir, 'invalid/missing-id.collection.yml');
                const result = validator.validateCollection(collectionPath, fixturesDir);

                expect(result.errors.length > 0, 'Should have errors').toBeTruthy();
                expect(result.errors[0].file, 'Error should include file name').toBeTruthy();
                expect(result.errors[0].file.includes('missing-id'), 'File name should match').toBeTruthy();
            });

            it('should include descriptive messages', () => {
                const collectionPath = path.join(fixturesDir, 'invalid/missing-id.collection.yml');
                const result = validator.validateCollection(collectionPath, fixturesDir);

                expect(result.errors.length > 0, 'Should have errors').toBeTruthy();
                expect(result.errors[0].message, 'Error should have message').toBeTruthy();
                expect(result.errors[0].message.length > 10, 'Message should be descriptive').toBeTruthy();
            });
        });
    });

    describe('validateAllCollections', () => {
        it('should validate multiple collections in a directory', () => {
            const validDir = path.join(fixturesDir, 'valid');
            const result = validator.validateAllCollections(validDir);

            expect(result.valid, 'Should be valid').toBe(true);
            expect(result.errors.length, 'Should have no errors').toBe(0);
        });

        it('should aggregate errors from multiple invalid collections', () => {
            const invalidDir = path.join(fixturesDir, 'invalid');
            const result = validator.validateAllCollections(invalidDir);

            expect(result.valid, 'Should be invalid').toBe(false);
            expect(result.errors.length > 0, 'Should have errors from multiple files').toBeTruthy();
        });

        it('should return success if directory has no collection files', () => {
            const emptyDir = path.join(fixturesDir, 'empty-test-dir');
            const result = validator.validateAllCollections(emptyDir);

            // Should not fail, just return empty result
            expect(result.errors.length, 'Should have no errors').toBe(0);
        });

        it('should handle non-existent directory gracefully', () => {
            const nonExistentDir = path.join(fixturesDir, 'does-not-exist');
            const result = validator.validateAllCollections(nonExistentDir);

            expect(result.valid, 'Should be invalid').toBe(false);
            expect(result.errors.some((e: ValidationError) => e.message.toLowerCase().includes('not found') || e.message.toLowerCase().includes('not exist')), 'Should have error about missing directory').toBeTruthy();
        });
    });

    describe('ValidationResult', () => {
        it('should mark result as valid only if no errors', () => {
            const collectionPath = path.join(fixturesDir, 'warnings/long-description.collection.yml');
            const result = validator.validateCollection(collectionPath, fixturesDir);

            // Has warnings but no errors, so should be valid
            expect(result.valid, 'Should be valid despite warnings').toBe(true);
            expect(result.warnings.length > 0, 'Should have warnings').toBeTruthy();
        });

        it('should mark result as invalid if any errors', () => {
            const collectionPath = path.join(fixturesDir, 'invalid/missing-id.collection.yml');
            const result = validator.validateCollection(collectionPath, fixturesDir);

            expect(result.valid, 'Should be invalid').toBe(false);
            expect(result.errors.length > 0, 'Should have errors').toBeTruthy();
        });
    });
});
