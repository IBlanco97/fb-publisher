// ─── Core domain types for Facebook Publisher Tool ───

export type MembershipStatus = 'unknown' | 'member' | 'not_member' | 'pending' | 'error';

export interface FacebookGroup {
  id: string;
  name: string;
  fbGroupId: string; // Facebook's group ID
  url: string;
  category?: string;
  isActive: boolean;
  maxPostsPerDay: number;
  cooldownMinutes: number; // minimum minutes between posts
  lastPublishedAt?: string; // ISO date
  membershipStatus: MembershipStatus;
  membershipCheckedAt?: string; // ISO date of the last check
  createdAt: string;
  updatedAt: string;
}

export interface AdTemplate {
  id: string;
  name: string;
  body: string; // template body with {{variables}}
  variables: TemplateVariable[];
  images?: string[]; // paths to images
  tags?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateVariable {
  name: string;
  type: 'text' | 'number' | 'list' | 'price';
  values: string[]; // possible values for rotation
  format?: string; // e.g., "${{value}}" for prices
}

export interface Publication {
  id: string;
  groupId: string;
  templateId: string;
  content: string; // rendered content that was posted
  status: 'pending' | 'publishing' | 'success' | 'failed' | 'retry';
  publishMethod: 'playwright';
  error?: string;
  fbPostId?: string; // Facebook's post ID if successful
  scheduledAt?: string;
  publishedAt?: string;
  attempts: number;
  createdAt: string;
}

export interface ScheduleRule {
  id: string;
  name: string;
  groupIds: string[]; // groups to publish to
  templateIds: string[]; // templates to rotate through
  cronExpression: string; // e.g., "0 9,14,19 * * *" = 9am, 2pm, 7pm
  rotationIndex: number; // current position in deterministic rotation
  isActive: boolean;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppConfig {
  playwright: {
    email: string;
    password: string;
    headless: boolean;
    userDataDir: string; // persist session
  };
  publishing: {
    retryAttempts: number;
    retryDelayMs: number;
  };
  behavior: {
    jitterMinMinutes: number; // random delay applied after a cron tick fires, before publishing
    jitterMaxMinutes: number;
    globalMinGapMinutes: number; // minimum spacing between ANY two posts, across all groups
    maxPostsPerDayTotal: number; // account-wide daily cap, independent of per-group limits
  };
}

// ─── Publisher interface ───

export interface PublishResult {
  success: boolean;
  postId?: string;
  method: 'playwright';
  error?: string;
  timestamp: string;
}

export interface Publisher {
  name: string;
  publish(groupId: string, content: string, images?: string[]): Promise<PublishResult>;
  isAvailable(): Promise<boolean>;
}

// ─── Template engine types ───

export interface RenderedContent {
  text: string;
  templateId: string;
  variableValues: Record<string, string>;
  rotationIndex: number;
}
