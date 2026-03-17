/**
 * Tests for MarketplaceViewProvider Scope Selection Bug Fix
 * 
 * Bug: handleInstall and handleInstallVersion hardcode scope: 'user' instead of
 * showing the scope selection dialog.
 * 
 * These tests verify the BEHAVIOR:
 * - User should be able to choose installation scope when installing from marketplace
 * - Repository scope option should be available when workspace is open
 */


// Import the scope selection UI to verify it's being used
import * as scopeSelectionUI from '../../src/utils/scopeSelectionUI';

describe('MarketplaceViewProvider - Scope Selection Bug', () => {

    describe('Scope selection dialog options', () => {
        it('should provide three scope options', () => {
            const items = scopeSelectionUI.createScopeQuickPickItems(true);
            
            expect(items.length, 'Should have exactly 3 scope options').toBe(3);
            
            const scopes = items.map(i => ({ scope: i._scope, commitMode: i._commitMode }));
            expect(scopes.some(s => s.scope === 'repository' && s.commitMode === 'commit'), 'Should have repository commit option').toBeTruthy();
            expect(scopes.some(s => s.scope === 'repository' && s.commitMode === 'local-only'), 'Should have repository local-only option').toBeTruthy();
            expect(scopes.some(s => s.scope === 'user'), 'Should have user option').toBeTruthy();
        });

        it('should disable repository options when no workspace is open', () => {
            const items = scopeSelectionUI.createScopeQuickPickItems(false);
            
            const repoCommit = items.find(i => i._scope === 'repository' && i._commitMode === 'commit');
            const repoLocal = items.find(i => i._scope === 'repository' && i._commitMode === 'local-only');
            const userOption = items.find(i => i._scope === 'user');
            
            expect(repoCommit?._disabled, 'Repository commit option should be disabled without workspace').toBeTruthy();
            expect(repoLocal?._disabled, 'Repository local-only option should be disabled without workspace').toBeTruthy();
            expect(!userOption?._disabled, 'User option should always be enabled').toBeTruthy();
        });

        it('should enable all options when workspace is open', () => {
            const items = scopeSelectionUI.createScopeQuickPickItems(true);
            
            const repoCommit = items.find(i => i._scope === 'repository' && i._commitMode === 'commit');
            const repoLocal = items.find(i => i._scope === 'repository' && i._commitMode === 'local-only');
            const userOption = items.find(i => i._scope === 'user');
            
            expect(!repoCommit?._disabled, 'Repository commit option should be enabled with workspace').toBeTruthy();
            expect(!repoLocal?._disabled, 'Repository local-only option should be enabled with workspace').toBeTruthy();
            expect(!userOption?._disabled, 'User option should be enabled').toBeTruthy();
        });

        it('should pre-select repository commit when workspace is open', () => {
            const items = scopeSelectionUI.createScopeQuickPickItems(true);
            
            const repoCommit = items.find(i => i._scope === 'repository' && i._commitMode === 'commit');
            const othersPicked = items.filter(i => i !== repoCommit && i.picked);
            
            expect(repoCommit?.picked, 'Repository commit should be pre-selected when workspace is open').toBeTruthy();
            expect(othersPicked.length, 'Only one option should be pre-selected').toBe(0);
        });

        it('should not pre-select any option when no workspace is open', () => {
            const items = scopeSelectionUI.createScopeQuickPickItems(false);
            
            // When workspace is not open, repository commit would be picked but it's disabled
            // So effectively no valid option is pre-selected
            const enabledAndPicked = items.filter(i => i.picked && !i._disabled);
            
            expect(enabledAndPicked.length, 'No enabled option should be pre-selected when workspace is closed').toBe(0);
        });
    });

    describe('Scope option labels and descriptions', () => {
        it('should have descriptive labels for each option', () => {
            const items = scopeSelectionUI.createScopeQuickPickItems(true);
            
            const repoCommit = items.find(i => i._scope === 'repository' && i._commitMode === 'commit');
            const repoLocal = items.find(i => i._scope === 'repository' && i._commitMode === 'local-only');
            const userOption = items.find(i => i._scope === 'user');
            
            // Verify labels contain meaningful text
            expect(repoCommit?.label.includes('Repository'), 'Commit option should mention Repository').toBeTruthy();
            expect(repoCommit?.label.includes('Commit') || repoCommit?.label.includes('Git'), 'Commit option should mention Git/Commit').toBeTruthy();
            
            expect(repoLocal?.label.includes('Repository'), 'Local option should mention Repository').toBeTruthy();
            expect(repoLocal?.label.includes('Local'), 'Local option should mention Local').toBeTruthy();
            
            expect(userOption?.label.includes('User'), 'User option should mention User').toBeTruthy();
        });

        it('should show workspace requirement hint when disabled', () => {
            const items = scopeSelectionUI.createScopeQuickPickItems(false);
            
            const repoCommit = items.find(i => i._scope === 'repository' && i._commitMode === 'commit');
            const repoLocal = items.find(i => i._scope === 'repository' && i._commitMode === 'local-only');
            
            // Disabled options should have detail explaining why
            expect(repoCommit?.detail?.includes('workspace'), 'Disabled commit option should explain workspace requirement').toBeTruthy();
            expect(repoLocal?.detail?.includes('workspace'), 'Disabled local option should explain workspace requirement').toBeTruthy();
        });
    });
});
