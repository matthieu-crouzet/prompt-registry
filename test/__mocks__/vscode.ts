import * as path from 'path';
import * as fs from 'fs';

export const FileType = {
  Unknown: 0,
  File: 1,
  Directory: 2,
  SymbolicLink: 64,
};

export const workspace = {
  fs: {
    createDirectory: (uri: any) => {
      if (uri.scheme === 'file') {
        return fs.promises.mkdir(uri.fsPath, { recursive: true });
      }
      return Promise.resolve();
    },
    writeFile: (uri: any, content: any) => {
      if (uri.scheme === 'file') {
        return fs.promises.writeFile(uri.fsPath, content);
      }
      return Promise.resolve();
    },
    readFile: (uri: any) => {
      if (uri.scheme === 'file') {
        return fs.promises.readFile(uri.fsPath);
      }
      return Promise.resolve(new Uint8Array());
    },
    stat: (uri: any) => {
      if (uri.scheme === 'file') {
        return fs.promises.stat(uri.fsPath).then((stats: any) => ({
          type: stats.isDirectory() ? 2 : stats.isFile() ? 1 : 0,
          ctime: stats.ctimeMs,
          mtime: stats.mtimeMs,
          size: stats.size,
        }));
      }
      return Promise.resolve({ type: 1, ctime: 0, mtime: 0, size: 0 });
    },
    readDirectory: (uri: any) => {
      if (uri.scheme === 'file') {
        return fs.promises
          .readdir(uri.fsPath, { withFileTypes: true })
          .then((entries: any[]) => entries.map((e: any) => [e.name, e.isDirectory() ? 2 : 1]));
      }
      return Promise.resolve([]);
    },
  },
  createFileSystemWatcher: (_pattern: any) => ({
    onDidChange: (_listener: any) => ({ dispose: () => {} }),
    onDidCreate: (_listener: any) => ({ dispose: () => {} }),
    onDidDelete: (_listener: any) => ({ dispose: () => {} }),
    dispose: () => {},
  }),
  getConfiguration: (section: string) => ({
    get: (key: string, defaultValue?: any) => {
      if (section === 'olaf') {
        const config: any = {
          repositoryOwner: 'test-owner',
          repositoryName: 'test-repo',
          githubToken: 'test-token',
          usePrivateRepository: false,
        };
        return config[key] || defaultValue;
      }
      if (section === 'promptregistry.updateCheck') {
        const config: any = {
          enabled: false,
          frequency: 'manual',
          cacheTTL: 300000,
          notificationPreference: 'all',
        };
        return config[key] || defaultValue;
      }
      if (section === 'promptregistry') {
        const config: any = {
          githubToken: '',
          autoCheckUpdates: false,
          installationScope: 'user',
          defaultVersion: 'latest',
        };
        return config[key] || defaultValue;
      }
      return defaultValue;
    },
    update: async (_key: string, _value: any, _target?: any) => undefined,
  }),
  workspaceFolders: [
    {
      uri: { fsPath: '/mock/workspace' },
      name: 'workspace',
      index: 0,
    },
  ],
};

export const window = {
  showInformationMessage: () => Promise.resolve(),
  showWarningMessage: () => Promise.resolve(),
  showErrorMessage: () => Promise.resolve(),
  showInputBox: (_options?: any) => Promise.resolve(undefined),
  showQuickPick: (_items: any, _options?: any) => Promise.resolve(undefined),
  showSaveDialog: (_options?: any) => Promise.resolve(undefined),
  showOpenDialog: (_options?: any) => Promise.resolve(undefined),
  createQuickPick: () => {
    const quickPick = {
      items: [] as any[],
      selectedItems: [] as any[],
      title: '',
      placeholder: '',
      ignoreFocusOut: false,
      onDidChangeSelection: () => ({ dispose: () => {} }),
      onDidAccept: () => ({ dispose: () => {} }),
      onDidHide: () => ({ dispose: () => {} }),
      show: () => {},
      hide: () => {},
      dispose: () => {},
    };
    return quickPick;
  },
  createOutputChannel: (_name: string) => ({
    appendLine: function () {
      return undefined;
    },
    clear: function () {
      return undefined;
    },
    show: function () {
      return undefined;
    },
    dispose: function () {
      return undefined;
    },
  }),
  withProgress: async (_options: any, task: any) => {
    const progress = { report: () => undefined };
    return await task(progress);
  },
};

export const ProgressLocation = {
  SourceControl: 1,
  Window: 10,
  Notification: 15,
};

export const commands = {
  registerCommand: (_command: string, _callback: any) => ({ dispose: () => {} }),
  executeCommand: (_command: string, ..._args: any[]) => Promise.resolve(undefined),
  getCommands: () => Promise.resolve([]),
};

export const authentication = {
  getSession: async () => undefined,
  onDidChangeSessions: () => ({ dispose: () => {} }),
};

export const Uri = {
  file: (filePath: string) => ({
    fsPath: filePath,
    scheme: 'file',
    authority: '',
    path: filePath,
    query: '',
    fragment: '',
    toString: () => `file://${filePath}`,
  }),
  joinPath: (base: any, ...segments: string[]) => {
    const joined = path.join(base.path, ...segments);
    return {
      fsPath: joined,
      scheme: base.scheme,
      authority: base.authority,
      path: joined,
      query: '',
      fragment: '',
      toString: () => `${base.scheme}://${joined}`,
    };
  },
  parse: (value: string) => ({
    fsPath: value,
    scheme: value.startsWith('http') ? value.split('://')[0] : 'file',
    path: value,
    toString: () => value,
  }),
};

export class EventEmitter {
  listeners: any[] = [];
  get event() {
    return (listener: any) => {
      this.listeners.push(listener);
      return {
        dispose: () => {
          const index = this.listeners.indexOf(listener);
          if (index !== -1) {
            this.listeners.splice(index, 1);
          }
        },
      };
    };
  }
  fire(data: any) {
    this.listeners.forEach((listener) => listener(data));
  }
  dispose() {
    this.listeners = [];
  }
}

export const env = {
  appName: 'Visual Studio Code',
  appRoot: '/mock/app/root',
  language: 'en',
  machineId: 'mock-machine-id',
  sessionId: 'mock-session-id',
  remoteName: undefined,
  shell: '/bin/bash',
  isTelemetryEnabled: true,
  openExternal: (_uri: any) => Promise.resolve(true),
  createTelemetryLogger: (sender: any, _options?: any) => {
    let _isUsageEnabled = true;
    return {
      get isUsageEnabled() {
        return _isUsageEnabled;
      },
      set isUsageEnabled(v: boolean) {
        _isUsageEnabled = v;
      },
      get isErrorsEnabled() {
        return _isUsageEnabled;
      },
      onDidChangeEnableStates: () => ({ dispose: () => {} }),
      logUsage: (eventName: string, data: any) => {
        if (_isUsageEnabled) {
          sender.sendEventData(eventName, data);
        }
      },
      logError: (eventNameOrError: any, data: any) => {
        if (_isUsageEnabled) {
          if (eventNameOrError instanceof Error) {
            sender.sendErrorData(eventNameOrError, data);
          } else {
            sender.sendEventData(eventNameOrError, data);
          }
        }
      },
      dispose: () => {
        if (sender.flush) {
          sender.flush();
        }
      },
    };
  },
};

export const ConfigurationTarget = {
  Global: 1,
  Workspace: 2,
  WorkspaceFolder: 3,
};

export const QuickPickItemKind = {
  Separator: -1,
  Default: 0,
};

export class TreeItem {
  label: string;
  collapsibleState: number;
  constructor(label: string, collapsibleState?: number) {
    this.label = label;
    this.collapsibleState = collapsibleState || 0;
  }
}

export const TreeItemCollapsibleState = {
  None: 0,
  Collapsed: 1,
  Expanded: 2,
};

export class ThemeIcon {
  id: string;
  color: any;
  constructor(id: string, color?: any) {
    this.id = id;
    this.color = color;
  }
}

export class ThemeColor {
  id: string;
  constructor(id: string) {
    this.id = id;
  }
}

export const extensions = {
  getExtension: () => undefined,
  all: [] as any[],
};

export class RelativePattern {
  base: any;
  pattern: string;
  constructor(base: any, pattern: string) {
    this.base = base;
    this.pattern = pattern;
  }
}
