export interface RetentionPolicy {
  enabled: boolean;
  retentionDays: number;
}

export interface PlatformSettings {
  _id?: string;
  retention: {
    syncHistory: RetentionPolicy;
    posts: RetentionPolicy;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export const DEFAULT_PLATFORM_SETTINGS: Omit<PlatformSettings, 'createdAt' | 'updatedAt'> = {
  retention: {
    syncHistory: { enabled: false, retentionDays: 90 },
    posts: { enabled: false, retentionDays: 90 },
  },
};
