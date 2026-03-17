import { 
  HubReference, 
  HubConfig,
  validateHubReference,
  validateHubConfig,
  sanitizeHubId,
  isValidProtocol,
  hasPathTraversal
} from '../../../src/types/hub';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

describe('Hub Types - TDD Implementation', () => {
  describe('validateHubReference', () => {
    it('should validate valid GitHub reference', () => {
      const ref: HubReference = {
        type: 'github',
        location: 'promptregistry/official-hub',
        ref: 'main'
      };
      
      expect(() => validateHubReference(ref)).not.toThrow();
    });

    it('should reject path traversal in local paths', () => {
      const ref: HubReference = {
        type: 'local',
        location: '../../etc/passwd'
      };
      
      expect(() => validateHubReference(ref)).toThrow(/Path traversal detected/);
    });

    it('should reject non-HTTPS URLs', () => {
      const ref: HubReference = {
        type: 'url',
        location: 'http://example.com/hub.yml'
      };
      
      expect(() => validateHubReference(ref)).toThrow(/Only HTTPS URLs are allowed/);
    });

    it('should reject invalid GitHub format', () => {
      const ref: HubReference = {
        type: 'github',
        location: 'invalid-format'
      };
      
      expect(() => validateHubReference(ref)).toThrow(/Invalid GitHub repository format/);
    });

    it('should reject empty location', () => {
      const ref: HubReference = {
        type: 'github',
        location: ''
      };
      
      expect(() => validateHubReference(ref)).toThrow(/Location cannot be empty/);
    });

    it('should reject FTP URLs', () => {
      const ref: HubReference = {
        type: 'url',
        location: 'ftp://malicious.com/hub.yml'
      };
      
      expect(() => validateHubReference(ref)).toThrow(/Only HTTPS URLs are allowed/);
    });
  });

  describe('validateHubConfig', () => {
    let validConfig: HubConfig;

    beforeEach(() => {
      const fixtureContent = fs.readFileSync(
        path.join(__dirname, '../../fixtures/hubs/valid-hub-config.yml'),
        'utf-8'
      );
      validConfig = yaml.load(fixtureContent) as HubConfig;
    });

    it('should validate complete valid hub config', () => {
      const result = validateHubConfig(validConfig);
      
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should reject config without version', () => {
      const config = { ...validConfig };
      delete (config as any).version;
      
      const result = validateHubConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.includes('version is required')).toBeTruthy();
    });

    it('should reject config with invalid version format', () => {
      const config = { ...validConfig, version: 'invalid' };
      
      const result = validateHubConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('semver'))).toBeTruthy();
    });

    it('should reject config without metadata', () => {
      const config = { ...validConfig };
      delete (config as any).metadata;
      
      const result = validateHubConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.includes('metadata is required')).toBeTruthy();
    });

    it('should reject config without sources', () => {
      const config = { ...validConfig };
      delete (config as any).sources;
      
      const result = validateHubConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.includes('sources is required')).toBeTruthy();
    });

    it('should validate config with empty profiles array', () => {
      const config = { ...validConfig, profiles: [] };
      
      const result = validateHubConfig(config);
      
      expect(result.valid).toBe(true);
    });

    it('should detect bundle referencing non-existent source', () => {
      const config = { ...validConfig };
      config.profiles[0].bundles[0].source = 'non-existent-source';
      
      const result = validateHubConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('non-existent source'))).toBeTruthy();
    });

    it('should validate checksum format - reject invalid', () => {
      const config = { ...validConfig };
      config.metadata.checksum = 'invalid-checksum';
      
      const result = validateHubConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('checksum'))).toBeTruthy();
    });

    it('should validate checksum format - accept sha256', () => {
      const config = { ...validConfig };
      config.metadata.checksum = 'sha256:abc123def456';
      
      const result = validateHubConfig(config);
      
      expect(result.valid).toBe(true);
    });

    it('should validate checksum format - accept sha512', () => {
      const config = { ...validConfig };
      config.metadata.checksum = 'sha512:abc123def456789';
      
      const result = validateHubConfig(config);
      
      expect(result.valid).toBe(true);
    });
  });

  describe('sanitizeHubId', () => {
    it('should accept valid alphanumeric IDs', () => {
      expect(() => sanitizeHubId('valid-hub-id')).not.toThrow();
      expect(() => sanitizeHubId('hub123')).not.toThrow();
      expect(() => sanitizeHubId('my_hub')).not.toThrow();
    });

    it('should reject IDs with path traversal', () => {
      expect(() => sanitizeHubId('../etc')).toThrow(/Invalid hub ID/);
      expect(() => sanitizeHubId('../../passwd')).toThrow(/Invalid hub ID/);
    });

    it('should reject IDs with slashes', () => {
      expect(() => sanitizeHubId('hub/id')).toThrow(/Invalid hub ID/);
      expect(() => sanitizeHubId('hub\\id')).toThrow(/Invalid hub ID/);
    });

    it('should reject IDs with special characters', () => {
      expect(() => sanitizeHubId('hub@id')).toThrow(/Invalid hub ID/);
      expect(() => sanitizeHubId('hub#id')).toThrow(/Invalid hub ID/);
    });

    it('should reject empty IDs', () => {
      expect(() => sanitizeHubId('')).toThrow(/Invalid hub ID/);
    });

    it('should reject very long IDs', () => {
      const longId = 'a'.repeat(256);
      expect(() => sanitizeHubId(longId)).toThrow(/Invalid hub ID/);
    });
  });

  describe('Security utilities', () => {
    describe('isValidProtocol', () => {
      it('should accept HTTPS protocol', () => {
        expect(isValidProtocol('https:')).toBe(true);
      });

      it('should reject HTTP protocol', () => {
        expect(isValidProtocol('http:')).toBe(false);
      });

      it('should reject FTP protocol', () => {
        expect(isValidProtocol('ftp:')).toBe(false);
      });

      it('should reject file protocol', () => {
        expect(isValidProtocol('file:')).toBe(false);
      });
    });

    describe('hasPathTraversal', () => {
      it('should detect .. in path', () => {
        expect(hasPathTraversal('../etc')).toBe(true);
        expect(hasPathTraversal('../../passwd')).toBe(true);
        expect(hasPathTraversal('/home/../etc')).toBe(true);
      });

      it('should not flag valid paths', () => {
        expect(hasPathTraversal('/home/user/config.yml')).toBe(false);
        expect(hasPathTraversal('config/hub.yml')).toBe(false);
      });

      it('should handle encoded path traversal', () => {
        expect(hasPathTraversal('%2e%2e/etc')).toBe(true);
        expect(hasPathTraversal('..%2Fetc')).toBe(true);
      });
    });
  });

  describe('Security tests - malicious inputs', () => {
    let maliciousConfig: any;

    beforeEach(() => {
      const fixtureContent = fs.readFileSync(
        path.join(__dirname, '../../fixtures/hubs/malicious-hub-config.yml'),
        'utf-8'
      );
      maliciousConfig = yaml.load(fixtureContent);
    });

    it('should reject config with path traversal in source ID', () => {
      const result = validateHubConfig(maliciousConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => 
        e.includes('path traversal') || e.includes('../')
      )).toBeTruthy();
    });

    it('should reject config with path traversal in bundle ID', () => {
      const result = validateHubConfig(maliciousConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => 
        e.includes('traversal') || e.includes('../')
      )).toBeTruthy();
    });
  });
});
