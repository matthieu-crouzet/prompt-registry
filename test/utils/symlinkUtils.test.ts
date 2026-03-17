/**
 * Symlink Utilities Unit Tests
 * Tests for broken symlink detection and symlink target verification
 */

import * as path from 'path';
import * as fs from 'fs';
import { checkPathExists } from '../../src/utils/symlinkUtils';

describe('symlinkUtils', () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = path.join(__dirname, '..', '..', 'test-temp-symlink-utils');
        
        // Create temp directory
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
    });

    afterEach(() => {
        // Cleanup temp directories
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('checkPathExists', () => {
        it('should return exists=false for non-existent path', async () => {
            const result = await checkPathExists(path.join(tempDir, 'non-existent'));
            
            expect(result.exists).toBe(false);
            expect(result.isSymbolicLink).toBe(false);
            expect(result.isBroken).toBe(false);
        });

        it('should return exists=true for regular file', async () => {
            const filePath = path.join(tempDir, 'regular-file.txt');
            fs.writeFileSync(filePath, 'content');
            
            const result = await checkPathExists(filePath);
            
            expect(result.exists).toBe(true);
            expect(result.isSymbolicLink).toBe(false);
            expect(result.isBroken).toBe(false);
        });

        it('should return exists=true for directory', async () => {
            const dirPath = path.join(tempDir, 'test-dir');
            fs.mkdirSync(dirPath);
            
            const result = await checkPathExists(dirPath);
            
            expect(result.exists).toBe(true);
            expect(result.isSymbolicLink).toBe(false);
            expect(result.isBroken).toBe(false);
        });

        it('should detect valid symlink', async () => {
            const targetPath = path.join(tempDir, 'symlink-target.txt');
            const symlinkPath = path.join(tempDir, 'valid-symlink.txt');
            
            fs.writeFileSync(targetPath, 'target content');
            
            try {
                fs.symlinkSync(targetPath, symlinkPath);
                
                const result = await checkPathExists(symlinkPath);
                
                expect(result.exists).toBe(true);
                expect(result.isSymbolicLink).toBe(true);
                expect(result.isBroken).toBe(false);
            } catch (error: any) {
                // Symlinks may not be supported on all platforms
                if (error.code === 'EPERM' || error.code === 'ENOTSUP') {
                    expect(true, 'Symlinks not supported on this platform').toBeTruthy();
                } else {
                    throw error;
                }
            }
        });

        it('should detect broken symlink', async () => {
            const targetPath = path.join(tempDir, 'will-be-deleted.txt');
            const symlinkPath = path.join(tempDir, 'broken-symlink.txt');
            
            fs.writeFileSync(targetPath, 'will be deleted');
            
            try {
                fs.symlinkSync(targetPath, symlinkPath);
                
                // Remove target to make symlink broken
                fs.unlinkSync(targetPath);
                
                // Verify fs.existsSync returns false (the bug we're fixing)
                expect(fs.existsSync(symlinkPath), 'fs.existsSync should return false for broken symlink').toBe(false);
                
                // Our utility should detect the broken symlink
                const result = await checkPathExists(symlinkPath);
                
                expect(result.exists, 'Should detect broken symlink exists').toBe(true);
                expect(result.isSymbolicLink, 'Should identify as symlink').toBe(true);
                expect(result.isBroken, 'Should identify as broken').toBe(true);
            } catch (error: any) {
                if (error.code === 'EPERM' || error.code === 'ENOTSUP') {
                    expect(true, 'Symlinks not supported on this platform').toBeTruthy();
                } else {
                    throw error;
                }
            }
        });
    });
});
