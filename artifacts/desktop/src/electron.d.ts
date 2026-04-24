declare global {
  interface Window {
    electronAPI?: {
      getApiUrl: () => Promise<string>;
      getApiUrlSync: () => string;
      getInternalTokenSync: () => string;
      getSettings: () => Promise<{ openaiApiKey: string; anthropicApiKey: string; firstRun: boolean }>;
      saveSettings: (settings: { openaiApiKey?: string; anthropicApiKey?: string }) => Promise<{ ok: boolean }>;
      getAppVersion: () => Promise<string>;
      onOpenSettings: (cb: () => void) => () => void;
      onServerReady: (cb: () => void) => () => void;
      onServerError: (cb: (data: { message: string }) => void) => () => void;
      onServerRestarted: (cb: (data: { apiUrl: string }) => void) => () => void;
      onUpdateProgress: (cb: (data: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void) => () => void;
      onUpdateAvailable: (cb: (data: { version: string; releaseNotes: string | null }) => void) => () => void;
      onUpdateDownloaded: (cb: (data: { version: string }) => void) => () => void;
      installUpdate: () => void;
      mockUpdateAvailable: () => Promise<void>;
      platform: string;
      version: string;
      isElectron: boolean;
    };
  }
}

export {};
