export interface RetentionPolicy {
  enabled: boolean;
  retentionDays: number;
}

export interface AiProviderConfig {
  models: string[];
}

export interface AiTaskConfig {
  primaryProvider: 'groq' | 'gemini';
  fallbackProvider: 'groq' | 'gemini';
  providers: {
    groq: AiProviderConfig;
    gemini: AiProviderConfig;
  };
}

export interface PlatformSettings {
  _id?: string;
  retention: {
    syncHistory: RetentionPolicy;
    posts: RetentionPolicy;
  };
  sync?: {
    staleRun?: {
      enabled: boolean;
      timeoutMinutes: number;
    };
  };
  ai?: {
    vision: AiTaskConfig;
    caption: AiTaskConfig;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export const DEFAULT_PLATFORM_SETTINGS: Omit<PlatformSettings, 'createdAt' | 'updatedAt'> = {
  retention: {
    syncHistory: { enabled: false, retentionDays: 90 },
    posts: { enabled: false, retentionDays: 90 },
  },
  sync: {
    staleRun: { enabled: true, timeoutMinutes: 30 },
  },
  ai: {
    vision: {
      primaryProvider: 'groq',
      fallbackProvider: 'gemini',
      providers: {
        groq: { models: ['qwen/qwen3.6-27b'] },
        gemini: { models: ['gemini-3.6-flash'] },
      },
    },
    caption: {
      primaryProvider: 'groq',
      fallbackProvider: 'gemini',
      providers: {
        groq: { models: ['openai/gpt-oss-20b'] },
        gemini: { models: [] },
      },
    },
  },
};
