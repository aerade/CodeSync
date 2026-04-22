declare global {
  interface Window {
    electronAPI?: {
      getApiUrl: () => Promise<string>;
      platform: string;
      version: string;
    };
  }
}

export {};
