// Set test environment flag to prevent UpdateScheduler from running
process.env.NODE_ENV = 'test';

import path from 'path';
import Module from 'module';
import nock from 'nock';

// Intercept dynamic require('vscode') calls in source files.
// Vitest's resolve.alias handles static ESM imports, but dynamic require()
// calls in source code (e.g., OlafAdapter.ts, SkillsAdapter.ts) need this hook.
// Point to the JS mock file since CJS require() can't parse TypeScript.
const originalResolveFilename = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean) {
  if (request === 'vscode') {
    return path.resolve(__dirname, 'mocha.setup.js');
  }
  return originalResolveFilename.call(this, request, parent, isMain);
};

// Mock GitHub API responses to avoid rate limiting in unit tests
const mockRelease = {
  id: 123456,
  tag_name: 'v1.2.3',
  name: 'Test Release v1.2.3',
  published_at: '2025-09-16T08:00:00Z',
  assets: [
    {
      id: 1,
      name: 'vscode-bundle.zip',
      browser_download_url:
        'https://github.com/test-owner/test-repo/releases/download/v1.2.3/vscode-bundle.zip',
      size: 4096,
      content_type: 'application/zip',
    },
  ],
};

const mockRepo = {
  id: 123456,
  name: 'test-repo',
  full_name: 'test-owner/test-repo',
  private: false,
};

// Set up GitHub API mocks
nock.cleanAll();

nock('https://api.github.com')
  .get('/repos/test-owner/test-repo/releases/latest')
  .reply(200, mockRelease)
  .persist();

nock('https://api.github.com')
  .get('/repos/test-owner/test-repo/releases')
  .query(true)
  .reply(200, [mockRelease])
  .persist();

nock('https://api.github.com')
  .get(/\/repos\/test-owner\/test-repo\/releases\/tags\/.+/)
  .reply(200, mockRelease)
  .persist();

nock('https://api.github.com')
  .get('/repos/test-owner/test-repo')
  .reply(200, mockRepo)
  .persist();
