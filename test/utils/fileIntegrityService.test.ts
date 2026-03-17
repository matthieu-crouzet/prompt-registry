/**
 * FileIntegrityService Unit Tests
 * 
 * Tests for the file integrity utilities including checksum calculation
 * and directory management.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
    calculateFileChecksum,
    ensureDirectory,
    directoryExists,
    fileExists
} from '../../src/utils/fileIntegrityService';

describe('FileIntegrityService', () => {
    let tempDir: string;

    const createTempDir = (): string => {
        const dir = path.join(__dirname, '..', '..', 'test-temp-integrity-' + Date.now());
        fs.mkdirSync(dir, { recursive: true });
        return dir;
    };

    const cleanupTempDir = (dir: string): void => {
        if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    };

    beforeEach(() => {
        tempDir = createTempDir();
    });

    afterEach(() => {
        cleanupTempDir(tempDir);
    });

    describe('calculateFileChecksum()', () => {
        it('should calculate SHA256 checksum for file', async () => {
            const testFile = path.join(tempDir, 'test.txt');
            fs.writeFileSync(testFile, 'test content');
            
            const checksum = await calculateFileChecksum(testFile);
            
            // SHA256 produces 64 hex characters
            expect(checksum).toMatch(/^[a-f0-9]{64}$/);
        });

        it('should return consistent checksum for same content', async () => {
            const testFile = path.join(tempDir, 'test.txt');
            fs.writeFileSync(testFile, 'consistent content');
            
            const checksum1 = await calculateFileChecksum(testFile);
            const checksum2 = await calculateFileChecksum(testFile);
            
            expect(checksum1).toBe(checksum2);
        });

        it('should return different checksum for different content', async () => {
            const file1 = path.join(tempDir, 'file1.txt');
            const file2 = path.join(tempDir, 'file2.txt');
            fs.writeFileSync(file1, 'content 1');
            fs.writeFileSync(file2, 'content 2');
            
            const checksum1 = await calculateFileChecksum(file1);
            const checksum2 = await calculateFileChecksum(file2);
            
            expect(checksum1).not.toBe(checksum2);
        });

        it('should handle empty files', async () => {
            const testFile = path.join(tempDir, 'empty.txt');
            fs.writeFileSync(testFile, '');
            
            const checksum = await calculateFileChecksum(testFile);
            
            expect(checksum).toMatch(/^[a-f0-9]{64}$/);
        });

        it('should handle binary files', async () => {
            const testFile = path.join(tempDir, 'binary.bin');
            const buffer = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);
            fs.writeFileSync(testFile, buffer);
            
            const checksum = await calculateFileChecksum(testFile);
            
            expect(checksum).toMatch(/^[a-f0-9]{64}$/);
        });

        it('should throw error for non-existent file', async () => {
            const nonExistentFile = path.join(tempDir, 'does-not-exist.txt');
            
            await expect(async () => await calculateFileChecksum(nonExistentFile)).rejects.toThrow(/ENOENT/);
        });
    });

    describe('ensureDirectory()', () => {
        it('should create directory if it does not exist', async () => {
            const newDir = path.join(tempDir, 'new-dir');
            expect(!fs.existsSync(newDir)).toBeTruthy();
            
            await ensureDirectory(newDir);
            
            expect(fs.existsSync(newDir)).toBeTruthy();
        });

        it('should create nested directories', async () => {
            const nestedDir = path.join(tempDir, 'a', 'b', 'c');
            expect(!fs.existsSync(nestedDir)).toBeTruthy();
            
            await ensureDirectory(nestedDir);
            
            expect(fs.existsSync(nestedDir)).toBeTruthy();
        });

        it('should not throw if directory already exists', async () => {
            const existingDir = path.join(tempDir, 'existing');
            fs.mkdirSync(existingDir);
            
            await expect(ensureDirectory(existingDir)).resolves.not.toThrow();
        });
    });

    describe('directoryExists()', () => {
        it('should return true for existing directory', async () => {
            const dir = path.join(tempDir, 'exists');
            fs.mkdirSync(dir);
            
            const result = await directoryExists(dir);
            
            expect(result).toBe(true);
        });

        it('should return false for non-existent path', async () => {
            const dir = path.join(tempDir, 'does-not-exist');
            
            const result = await directoryExists(dir);
            
            expect(result).toBe(false);
        });

        it('should return false for file path', async () => {
            const file = path.join(tempDir, 'file.txt');
            fs.writeFileSync(file, 'content');
            
            const result = await directoryExists(file);
            
            expect(result).toBe(false);
        });
    });

    describe('fileExists()', () => {
        it('should return true for existing file', async () => {
            const file = path.join(tempDir, 'exists.txt');
            fs.writeFileSync(file, 'content');
            
            const result = await fileExists(file);
            
            expect(result).toBe(true);
        });

        it('should return false for non-existent path', async () => {
            const file = path.join(tempDir, 'does-not-exist.txt');
            
            const result = await fileExists(file);
            
            expect(result).toBe(false);
        });

        it('should return false for directory path', async () => {
            const dir = path.join(tempDir, 'directory');
            fs.mkdirSync(dir);
            
            const result = await fileExists(dir);
            
            expect(result).toBe(false);
        });
    });
});
