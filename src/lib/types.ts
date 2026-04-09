export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  tokenUsage?: TokenUsage;
  timestamp: number;
  webSearchEnabled?: boolean;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface Conversation {
  id: string;
  title: string;
  provider: string;
  model: string;
  systemPrompt: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  models: string[];
}

export interface AppConfig {
  providers: Record<string, ProviderConfig>;
}

export interface PanelState {
  conversationId: string | null;
  provider: string;
  model: string;
}

export interface InstructionStep {
  id: string;
  title: string;
  description: string;
}

export interface InstructionsProgress {
  [stepId: string]: boolean;
}
