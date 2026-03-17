/**
 * Npm Install Integration Tests
 * 
 * Integration tests for the npm install flow after scaffolding.
 * 
 * NOTE: The npm install prompt is handled in ScaffoldCommand.handlePostScaffoldActions(),
 * which is called from runWithUI(), not from execute() directly.
 * These tests verify the NpmCliWrapper.promptAndInstall() functionality.
 * 
 * Feature: workflow-bundle-scaffolding
 * Requirements: 13.1, 13.2, 13.3
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { vi } from 'vitest';
import { NpmCliWrapper } from '../../src/utils/NpmCliWrapper';

// Mock child_process at the module level so ESM imports are intercepted
const mockSpawn = vi.fn();
vi.mock('child_process', () => ({
    spawn: (...args: any[]) => mockSpawn(...args),
}));

describe('E2E: Npm Install Integration Tests', () => {
    let testDir: string;
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        // Create unique temp directory for each test
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npm-install-e2e-'));
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        // Clean up test directory
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
        sandbox.restore();
    });

    describe('NpmCliWrapper.promptAndInstall()', () => {
        /**
         * Test: promptAndInstall shows confirmation dialog
         * Requirements: 13.1 - Prompt user to confirm npm install after scaffolding completes
         */
        it('E2E: promptAndInstall shows confirmation dialog to user', async function() {
            // Create a package.json in the test directory
            fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({ name: 'test' }));

            let promptMessage = '';
            sandbox.stub(vscode.window, 'showInformationMessage')
                .callsFake((message: string) => {
                    promptMessage = message;
                    // User declines
                    return Promise.resolve(undefined) as any;
                });

            const npmWrapper = NpmCliWrapper.getInstance();
            await npmWrapper.promptAndInstall(testDir, false);

            expect(promptMessage.includes('install dependencies'), 'Should show confirmation dialog asking about dependencies').toBeTruthy();
        });

        /**
         * Test: User declining shows manual instructions and returns success
         * Requirements: 13.6 - Show manual instructions if user declines
         * 
         * Note: Declining is not an error - it's a valid user choice.
         * The implementation returns success: true because the operation
         * completed successfully (user made a choice), just without installing.
         */
        it('E2E: Declining npm install shows manual instructions and returns success', async function() {
            // Create a package.json in the test directory
            fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({ name: 'test' }));

            let manualInstructionsShown = false;
            // User declines npm install (returns undefined)
            sandbox.stub(vscode.window, 'showInformationMessage')
                .callsFake((message: string) => {
                    // Check if this is the manual instructions message
                    if (message.includes('To install dependencies later')) {
                        manualInstructionsShown = true;
                    }
                    return Promise.resolve(undefined) as any;
                });

            const npmWrapper = NpmCliWrapper.getInstance();
            const result = await npmWrapper.promptAndInstall(testDir, false);

            // Declining is a valid choice, not an error
            expect(result.success, 'Should return success when user declines (valid choice)').toBe(true);
            expect(manualInstructionsShown, 'Should show manual instructions when user declines').toBeTruthy();
        });
    });

    describe('NpmCliWrapper.installWithProgress()', () => {
        /**
         * Test: installWithProgress() executes npm install command
         * Requirements: 13.2, 13.3 - Execute npm install with visible output
         */
        it('E2E: installWithProgress() attempts to run npm install', async function() {
            // Create a package.json in the test directory
            fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({ name: 'test' }));

            // Mock child_process.spawn to prevent actual npm execution
            mockSpawn.mockImplementation((...spawnArgs: any[]) => {
                const mockProcess = {
                    on: (event: string, callback: Function) => {
                        if (event === 'close') {
                            setTimeout(() => callback(0), 10);
                        }
                        return mockProcess;
                    },
                    kill: vi.fn(),
                    stderr: { on: vi.fn() },
                    stdout: { on: vi.fn() }
                };
                return mockProcess;
            });

            // Mock VS Code withProgress
            sandbox.stub(vscode.window, 'withProgress')
                .callsFake(async (options: any, task: Function) => {
                    const progress = { report: sandbox.stub() };
                    const token = { 
                        isCancellationRequested: false,
                        onCancellationRequested: sandbox.stub() 
                    };
                    return await task(progress, token);
                });

            const npmWrapper = NpmCliWrapper.getInstance();
            const result = await npmWrapper.installWithProgress(testDir);

            expect(mockSpawn.mock.calls.length > 0, 'Should attempt to spawn npm process').toBeTruthy();
        });
    });
});