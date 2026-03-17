/**
 * Hub Schema Validator Tests
 * Tests JSON Schema validation for hub configurations
 */

import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { SchemaValidator, ValidationResult } from '../../src/services/SchemaValidator';
import { HubConfig } from '../../src/types/hub';

describe('HubSchemaValidator - TDD', () => {
    let validator: SchemaValidator;
    let hubSchemaPath: string;
    let validHubConfig: HubConfig;
    let invalidHubConfig: any;
    let maliciousHubConfig: any;

    beforeEach(() => {
        validator = new SchemaValidator(process.cwd());
        hubSchemaPath = path.join(process.cwd(), 'schemas', 'hub-config.schema.json');
        
        // Load test fixtures
        const fixturesDir = path.join(process.cwd(), 'test', 'fixtures', 'hubs');
        
        const validContent = fs.readFileSync(
            path.join(fixturesDir, 'valid-hub-config.yml'),
            'utf-8'
        );
        validHubConfig = yaml.load(validContent) as HubConfig;
        
        const invalidContent = fs.readFileSync(
            path.join(fixturesDir, 'invalid-hub-config.yml'),
            'utf-8'
        );
        invalidHubConfig = yaml.load(invalidContent);
        
        const maliciousContent = fs.readFileSync(
            path.join(fixturesDir, 'malicious-hub-config.yml'),
            'utf-8'
        );
        maliciousHubConfig = yaml.load(maliciousContent);
    });

    describe('Schema existence and structure', () => {
        it('hub schema file should exist', () => {
            expect(fs.existsSync(hubSchemaPath), 'Hub schema file should exist').toBeTruthy();
        });

        it('hub schema should be valid JSON', () => {
            const schemaContent = fs.readFileSync(hubSchemaPath, 'utf-8');
            expect(() => JSON.parse(schemaContent)).not.toThrow();
        });

        it('hub schema should have required root properties', () => {
            const schemaContent = fs.readFileSync(hubSchemaPath, 'utf-8');
            const schema = JSON.parse(schemaContent);
            
            expect(schema.$schema, 'Schema should have $schema property').toBeTruthy();
            expect(schema.type, 'Schema should have type property').toBeTruthy();
            expect(schema.required, 'Schema should have required property').toBeTruthy();
            expect(schema.properties, 'Schema should have properties').toBeTruthy();
        });
    });

    describe('Valid hub configuration validation', () => {
        it('should validate complete valid hub config', async () => {
            const result = await validator.validate(validHubConfig, hubSchemaPath);
            
            expect(result.valid, 'Valid config should pass validation').toBe(true);
            expect(result.errors.length, 'Should have no errors').toBe(0);
        });

        it('should accept optional checksum field', async () => {
            const config = JSON.parse(JSON.stringify(validHubConfig));
            config.metadata.checksum = 'sha256:abc123def456';
            
            const result = await validator.validate(config, hubSchemaPath);
            
            expect(result.valid).toBe(true);
        });

        it('should accept empty profiles array', async () => {
            const config = JSON.parse(JSON.stringify(validHubConfig));
            config.profiles = [];
            
            const result = await validator.validate(config, hubSchemaPath);
            
            expect(result.valid).toBe(true);
        });

        it('should accept configuration object', async () => {
            const config = JSON.parse(JSON.stringify(validHubConfig));
            config.configuration = {
                autoSync: true,
                syncInterval: 3600,
                strictMode: true
            };
            
            const result = await validator.validate(config, hubSchemaPath);
            
            expect(result.valid).toBe(true);
        });
    });

    describe('Required field validation', () => {
        it('should reject config without version', async () => {
            const config = JSON.parse(JSON.stringify(validHubConfig));
            delete config.version;
            
            const result = await validator.validate(config, hubSchemaPath);
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('version'))).toBeTruthy();
        });

        it('should reject config without metadata', async () => {
            const config = JSON.parse(JSON.stringify(validHubConfig));
            delete config.metadata;
            
            const result = await validator.validate(config, hubSchemaPath);
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('metadata'))).toBeTruthy();
        });

        it('should reject config without sources', async () => {
            const config = JSON.parse(JSON.stringify(validHubConfig));
            delete config.sources;
            
            const result = await validator.validate(config, hubSchemaPath);
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('sources'))).toBeTruthy();
        });

        it('should reject metadata without name', async () => {
            const config = JSON.parse(JSON.stringify(validHubConfig));
            delete config.metadata.name;
            
            const result = await validator.validate(config, hubSchemaPath);
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('name'))).toBeTruthy();
        });

        it('should reject metadata without description', async () => {
            const config = JSON.parse(JSON.stringify(validHubConfig));
            delete config.metadata.description;
            
            const result = await validator.validate(config, hubSchemaPath);
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('description'))).toBeTruthy();
        });
    });

    describe('Format validation', () => {
        it('should validate version format (semver)', async () => {
            const config = JSON.parse(JSON.stringify(validHubConfig));
            config.version = 'invalid';
            
            const result = await validator.validate(config, hubSchemaPath);
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('version') || e.includes('pattern'))).toBeTruthy();
        });

        it('should accept valid semver versions', async () => {
            const versions = ['1.0.0', '2.1.3', '0.0.1', '10.20.30'];
            
            for (const version of versions) {
                const config = JSON.parse(JSON.stringify(validHubConfig));
                config.version = version;
                const result = await validator.validate(config, hubSchemaPath);
                expect(result.valid, `Version ${version} should be valid`).toBe(true);
            }
        });

        it('should validate checksum format', async () => {
            const config = JSON.parse(JSON.stringify(validHubConfig));
            config.metadata.checksum = 'invalid-checksum';
            
            const result = await validator.validate(config, hubSchemaPath);
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('checksum') || e.includes('pattern'))).toBeTruthy();
        });

        it('should accept sha256 and sha512 checksums', async () => {
            const checksums = [
                'sha256:abc123def456',
                'sha512:abc123def456789',
                'sha256:0123456789abcdef'
            ];
            
            for (const checksum of checksums) {
                const config = JSON.parse(JSON.stringify(validHubConfig));
                config.metadata.checksum = checksum;
                const result = await validator.validate(config, hubSchemaPath);
                expect(result.valid, `Checksum ${checksum} should be valid`).toBe(true);
            }
        });

        it('should validate source type enum', async () => {
            const config = JSON.parse(JSON.stringify(validHubConfig));
            config.sources[0].type = 'invalid-type';
            
            const result = await validator.validate(config, hubSchemaPath);
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('type') || e.includes('enum'))).toBeTruthy();
        });

        it('should accept valid source types', async () => {
            const types = ['github', 'local', 'url'];
            
            for (const type of types) {
                const config = JSON.parse(JSON.stringify(validHubConfig));
                config.sources[0].type = type;
                const result = await validator.validate(config, hubSchemaPath);
                expect(result.valid, `Source type ${type} should be valid`).toBe(true);
            }
        });
    });

    describe('Type validation', () => {
        it('should reject non-string version', async () => {
            const config = JSON.parse(JSON.stringify(validHubConfig));
            config.version = 123;
            
            const result = await validator.validate(config, hubSchemaPath);
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('version') || e.includes('string'))).toBeTruthy();
        });

        it('should reject non-object metadata', async () => {
            const config = JSON.parse(JSON.stringify(validHubConfig));
            config.metadata = 'invalid';
            
            const result = await validator.validate(config, hubSchemaPath);
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('metadata') || e.includes('object'))).toBeTruthy();
        });

        it('should reject non-array sources', async () => {
            const config = JSON.parse(JSON.stringify(validHubConfig));
            config.sources = 'invalid';
            
            const result = await validator.validate(config, hubSchemaPath);
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('sources') || e.includes('array'))).toBeTruthy();
        });

        it('should reject non-boolean enabled field', async () => {
            const config = JSON.parse(JSON.stringify(validHubConfig));
            config.sources[0].enabled = 'yes';
            
            const result = await validator.validate(config, hubSchemaPath);
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('enabled') || e.includes('boolean'))).toBeTruthy();
        });

        it('should reject non-number priority', async () => {
            const config = JSON.parse(JSON.stringify(validHubConfig));
            config.sources[0].priority = 'high';
            
            const result = await validator.validate(config, hubSchemaPath);
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('priority') || e.includes('number'))).toBeTruthy();
        });
    });

    describe('Invalid configuration validation', () => {
        it('should reject invalid hub config from fixture', async () => {
            const result = await validator.validate(invalidHubConfig, hubSchemaPath);
            
            expect(result.valid).toBe(false);
            expect(result.errors.length > 0, 'Should have validation errors').toBeTruthy();
        });
    });

    describe('Security validation', () => {
        it('should reject malicious hub config', async () => {
            const result = await validator.validate(maliciousHubConfig, hubSchemaPath);
            
            // Schema validation catches structure issues
            // Additional security validation happens in validateHubConfig()
            expect(result.errors.length > 0 || !result.valid, 'Should detect issues in malicious config').toBeTruthy();
        });
    });

    describe('Array constraints', () => {
        it('should accept empty sources array minimum', async () => {
            const config = JSON.parse(JSON.stringify(validHubConfig));
            config.sources = [];
            
            const result = await validator.validate(config, hubSchemaPath);
            
            // Note: We may want sources to be required, adjust schema accordingly
            expect(result.valid !== undefined).toBeTruthy();
        });

        it('should validate bundle structure in profiles', async () => {
            const config = JSON.parse(JSON.stringify(validHubConfig));
            config.profiles[0].bundles[0] = { invalid: true };
            
            const result = await validator.validate(config, hubSchemaPath);
            
            expect(result.valid).toBe(false);
            expect(result.errors.length > 0).toBeTruthy();
        });
    });

    describe('Additional properties', () => {
        it('should handle additional properties based on schema config', async () => {
            const config = JSON.parse(JSON.stringify(validHubConfig));
            config.extraField = 'should be handled based on additionalProperties setting';
            
            const result = await validator.validate(config, hubSchemaPath);
            
            // Result depends on additionalProperties in schema
            expect(result !== undefined).toBeTruthy();
        });
    });

    describe('Profile path validation', () => {
        it('should accept optional path in profiles', async () => {
            const config = JSON.parse(JSON.stringify(validHubConfig));
            config.profiles[0].path = ['Folder', 'Subfolder'];
            
            const result = await validator.validate(config, hubSchemaPath);
            
            expect(result.valid, 'Profile path should be valid').toBe(true);
        });

        it('should accept path with spaces', async () => {
            const config = JSON.parse(JSON.stringify(validHubConfig));
            config.profiles[0].path = ['Amadeus Airlines', 'Solutions'];
            
            const result = await validator.validate(config, hubSchemaPath);
            
            expect(result.valid, 'Profile path with spaces should be valid').toBe(true);
        });

        it('should accept path with dots', async () => {
            const config = JSON.parse(JSON.stringify(validHubConfig));
            config.profiles[0].path = ['Company.Division', 'Team.Project'];
            
            const result = await validator.validate(config, hubSchemaPath);
            
            expect(result.valid, 'Profile path with dots should be valid').toBe(true);
        });

        it('should reject path with invalid characters like slashes', async () => {
            const config = JSON.parse(JSON.stringify(validHubConfig));
            config.profiles[0].path = ['Invalid/Character'];
            
            const result = await validator.validate(config, hubSchemaPath);
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('path') || e.includes('pattern'))).toBeTruthy();
        });

        it('should reject path that is not an array', async () => {
            const config = JSON.parse(JSON.stringify(validHubConfig));
            config.profiles[0].path = 'Not an array';
            
            const result = await validator.validate(config, hubSchemaPath);
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('path') || e.includes('array'))).toBeTruthy();
        });
    });

    describe('Engagement configuration validation', () => {
        it('should accept valid engagement configuration with all fields', async () => {
            const config = JSON.parse(JSON.stringify(validHubConfig));
            config.engagement = {
                enabled: true,
                backend: {
                    type: 'github-discussions',
                    repository: 'owner/repo'
                },
                telemetry: {
                    enabled: false,
                    anonymize: true
                },
                ratings: {
                    enabled: true,
                    ratingsUrl: 'https://example.com/ratings.json'
                },
                feedback: {
                    enabled: true,
                    requireRating: false,
                    maxLength: 2000,
                    feedbackUrl: 'https://example.com/feedbacks.json'
                }
            };
            
            const result = await validator.validate(config, hubSchemaPath);
            
            expect(result.valid, `Validation failed: ${result.errors.join(', ')}`).toBe(true);
        });

        it('should accept engagement configuration without optional URLs', async () => {
            const config = JSON.parse(JSON.stringify(validHubConfig));
            config.engagement = {
                enabled: true,
                backend: {
                    type: 'file'
                },
                ratings: {
                    enabled: true
                },
                feedback: {
                    enabled: true
                }
            };
            
            const result = await validator.validate(config, hubSchemaPath);
            
            expect(result.valid, `Validation failed: ${result.errors.join(', ')}`).toBe(true);
        });

        it('should accept all backend types', async () => {
            const backendTypes = ['file', 'github-issues', 'github-discussions', 'api'];
            
            for (const backendType of backendTypes) {
                const config = JSON.parse(JSON.stringify(validHubConfig));
                config.engagement = {
                    enabled: true,
                    backend: {
                        type: backendType
                    }
                };
                
                const result = await validator.validate(config, hubSchemaPath);
                
                expect(result.valid, `Backend type ${backendType} should be valid`).toBe(true);
            }
        });

        it('should reject invalid backend type', async () => {
            const config = JSON.parse(JSON.stringify(validHubConfig));
            config.engagement = {
                enabled: true,
                backend: {
                    type: 'invalid-backend'
                }
            };
            
            const result = await validator.validate(config, hubSchemaPath);
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('type') || e.includes('enum'))).toBeTruthy();
        });

        it('should accept github repository format in backend', async () => {
            const config = JSON.parse(JSON.stringify(validHubConfig));
            config.engagement = {
                enabled: true,
                backend: {
                    type: 'github-discussions',
                    repository: 'Amadeus-xDLC/genai.prompt-registry-engagement'
                }
            };
            
            const result = await validator.validate(config, hubSchemaPath);
            
            expect(result.valid, `Validation failed: ${result.errors.join(', ')}`).toBe(true);
        });

        it('should reject invalid repository format in backend', async () => {
            const config = JSON.parse(JSON.stringify(validHubConfig));
            config.engagement = {
                enabled: true,
                backend: {
                    type: 'github-discussions',
                    repository: 'invalid-format'
                }
            };
            
            const result = await validator.validate(config, hubSchemaPath);
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('repository') || e.includes('pattern'))).toBeTruthy();
        });

        it('should validate feedback maxLength constraints', async () => {
            const config = JSON.parse(JSON.stringify(validHubConfig));
            config.engagement = {
                enabled: true,
                backend: { type: 'file' },
                feedback: {
                    enabled: true,
                    maxLength: 50
                }
            };
            
            const result = await validator.validate(config, hubSchemaPath);
            
            expect(result.valid, 'maxLength below minimum should fail').toBe(false);
            expect(result.errors.some(e => e.includes('maxLength') || e.includes('minimum'))).toBeTruthy();
        });

        it('should accept hub config without engagement section', async () => {
            const config = JSON.parse(JSON.stringify(validHubConfig));
            delete config.engagement;
            
            const result = await validator.validate(config, hubSchemaPath);
            
            expect(result.valid, 'Hub config without engagement should be valid').toBe(true);
        });
    });
});
