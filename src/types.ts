// 第3章で定義： LLMが理解するツール定義の型（JSONスキーマ + 実行関数）
export type Tool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema相当（型チェックは実行時）
  execute: (args: Record<string, unknown>) => Promise<string>;
};

// 第3章で定義：LLMが発行するツール呼び出しの型
export type ToolCall = {
  toolCallId: string;
  name: string;
  args: Record<string, unknown>;
};

// 第3章で定義：会話に追加されるツール実行結果の型
export type ToolResult = {
  toolCallId: string;
  result: string;
};

// 第3章で定義：モデルとやりとりするメッセージ構造の型（会話の最小単位）
export type Message =
  | { role: 'user' | 'system'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCall[] }
  | { role: 'tool'; toolCallId: string; name: string; content: string };

// 使用量メタデータの型（プロバイダ依存）
export type Usage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

// 各プロバイダーで共通して使う終了理由。
export type FinishReason = 'stop' | 'length' | 'content_filter' | 'tool_calls' | 'error';

// 統一されたLLMレスポンス
export type GenerateTextResult = {
  text: string;
  finishReason: FinishReason;
  toolCalls?: ToolCall[];
  usage?: Usage;
};

// generateTextに渡すパラメータ
export type GenerateParams = {
  messages: Message[];
  tools?: Tool[];         // 利用可能なツールの配列
  temperature?: number;
  maxTokens?: number;     // 省略時はプロバイダーのデフォルト値を使用
  signal?: AbortSignal;   // タイムアウトやキャンセル用
};

// 各プロバイダが実装する言語モデルのインタフェース
export interface LanguageModel {
  doGenerate(params: GenerateParams): Promise<GenerateTextResult>;
}

// モデルIDに紐づいた言語モデルを返すプロバイダファクトリ
export type Provider = (modelId: string) => LanguageModel;

// LLM APIエラーの統一型
export class LLMApiError extends Error {
  constructor(
    public status: number,
    public provider: string,
    public code?: string,
    message?: string,
    public raw?: unknown
  ) {
    super(message || `LLM API Error: ${provider} returned ${status}`);
    this.name = 'LLMApiError';
  }
}
