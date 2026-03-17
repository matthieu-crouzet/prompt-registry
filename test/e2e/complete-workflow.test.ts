/**
 * End-to-End Integration Tests
 *
 * Tests complete workflows from source addition to bundle installation.
 * These tests require running in VS Code extension host environment.
 *
 * To run these tests, use the VS Code Extension Test Runner or:
 * npm run test:integration
 */

import * as vscode from 'vscode';

// Skip this entire suite when running outside VS Code extension host
const ext = vscode.extensions.getExtension('AmadeusITGroup.prompt-registry');
const describeIfExtension = ext ? describe : describe.skip;

describeIfExtension('E2E: Complete Workflow Tests', () => {
    beforeAll(async () => {
        await ext!.activate();
    });

    // Note: Placeholder tests have been removed.
    // Real E2E tests should be added when running in VS Code extension host.
    // See test/e2e/AGENTS.md for guidance on writing E2E tests.

    it('Extension activates successfully', async () => {
        expect(ext, 'Extension should be available').toBeTruthy();
        expect(ext!.isActive, 'Extension should be active').toBeTruthy();
    });
});
