export interface AgentConfig {
  id: string;
  name: string;
  icon: string;
  color: string;
  enabled: boolean;
  models: {
    fast: string;
    default: string;
    heavy: string;
  };
  commandTemplate: string;
  flags: string[];
}

export type ForkStatus = 'queued' | 'spawning' | 'running' | 'completed' | 'failed' | 'cancelled' | 'terminated';

export interface Fork {
  id: string;
  agent: string;
  model: string;
  modelTier: 'fast' | 'default' | 'heavy';
  status: ForkStatus;
  task: string;
  prompt: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  progress: number;
  pid?: number;
  output: Array<{ time: Date; text: string }>;
  includeSummary: boolean;
  workflowId?: string;
}

export interface QueueItem {
  id: number;
  agent: string;
  modelTier: 'fast' | 'default' | 'heavy';
  prompt: string;
  includeSummary: boolean;
}

export interface WorkflowFork {
  agent: string;
  modelTier: 'fast' | 'default' | 'heavy';
  prompt: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  forks: WorkflowFork[];
}

export interface AppSettings {
  autoFocus: boolean;
  soundEnabled: boolean;
  maxConcurrent: number;
  defaultModel: 'fast' | 'default' | 'heavy';
  theme: 'cyberpunk' | 'minimal' | 'matrix';
}

export interface TerminalLine {
  type: 'system' | 'info' | 'success' | 'error' | 'warning' | 'spawn' | 'workflow';
  text: string;
  time: Date;
}

export interface ForkStats {
  totalForks: number;
  completedForks: number;
  avgDuration: number;
  agentUsage: Record<string, number>;
}

export interface ForkCreateRequest {
  agent: string;
  modelTier: 'fast' | 'default' | 'heavy';
  prompt: string;
  includeSummary: boolean;
  autoFocus?: boolean;
  conversationHistory?: ConversationMessage[];
}

export interface ConversationMessage {
  role: 'user' | 'agent';
  content: string;
}

export interface Preset {
  name: string;
  icon: string;
  agent: string;
  prompt: string;
}

export interface WebSocketMessage {
  type: 'fork_update' | 'fork_output' | 'fork_completed' | 'fork_failed' | 'config_update';
  forkId?: string;
  data: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
