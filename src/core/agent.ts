import { generateText } from './generate-text';
import { requestApproval } from './approval';
import type { Message, Tool, LanguageModel } from '../types';

// エージェントの設定
export interface AgentConfig {
  name: string;               // エージェント名
  instructions: string;       // システム指示
  model: LanguageModel;       // 使用するモデル（第3章）
  tools: Record<string, Tool>; // 利用可能なツール（第4章）
  maxSteps?: number;          // 最大実行ステップ数（5.7節）
  verbose?: boolean;          // 詳細ログ出力フラグ
  approvalFunc?: (toolName: string, args: any) => Promise<boolean>; // 承認関数（5.5節）
}

// ============================
// ツール実行関数（5.6節）
// ============================

async function executeTool(tool: Tool, args: any): Promise<string> {
  try {
    return await tool.execute(args);
  } catch (error) {
    // 例外をキャッチし、エラーメッセージを返す（例外をスローしない）
    return `エラー: ${(error as Error).message}`;
  }
}

// ============================
// Agentクラス
// ============================

export class Agent {
  private name: string;
  private instructions: string;
  private model: LanguageModel;
  private tools: Tool[];
  private maxSteps: number;
  private verbose: boolean;
  private approvalFunc: (toolName: string, args: any) => Promise<boolean>;

  constructor(config: AgentConfig) {
    this.name = config.name;
    this.instructions = config.instructions;
    this.model = config.model;
    // オブジェクト形式から配列に変換
    this.tools = Object.values(config.tools);
    this.maxSteps = config.maxSteps ?? 10;
    this.verbose = config.verbose ?? false;
    // approvalFuncが渡されなければデフォルトの対話的承認を使用
    this.approvalFunc = config.approvalFunc ?? requestApproval;
  }

  async generate(userPrompt: string): Promise<{ text: string }> {
    // ステップ1：会話ループの開始（5.3節）
    let messages: Message[] = [
      { role: 'system', content: this.instructions },
      { role: 'user', content: userPrompt },
    ];

    let currentStep = 0;
    let finalText = '';
    let toolCallCount = 0;

    while (currentStep < this.maxSteps) {
      currentStep++;

      if (this.verbose) {
        console.log(`\n=== ステップ ${currentStep}/${this.maxSteps} ===`);
      }

      const response = await generateText({
        model: this.model,
        messages,
        tools: this.tools,
      });

      // テキスト応答の保存と出力
      if (response.text) {
        finalText = response.text;
        if (this.verbose) {
          console.log(`[応答] ${response.text}`);
        }
      }

      // ステップ2：ツール実行（5.4節、5.6節）
      if (response.toolCalls && response.toolCalls.length > 0) {
        messages.push({
          role: 'assistant',
          content: response.text,
          toolCalls: response.toolCalls,
        });

        for (const toolCall of response.toolCalls) {
          const tool = this.tools.find(t => t.name === toolCall.name);

          if (!tool) {
            // ツールが見つからない場合
            messages.push({
              role: 'tool',
              toolCallId: toolCall.toolCallId,
              name: toolCall.name,
              content: `エラー: ツール ${toolCall.name} が見つかりません`,
            });
            continue;
          }

          if (this.verbose) {
            console.log(`[ツール実行] ${toolCall.name}(${JSON.stringify(toolCall.args)})`);
          }

          // ステップ3：承認チェック（5.5節）
          if (tool.needsApproval) {
            const approved = await this.approvalFunc(toolCall.name, toolCall.args);
            if (!approved) {
              messages.push({
                role: 'tool',
                toolCallId: toolCall.toolCallId,
                name: toolCall.name,
                content: 'ユーザーによってキャンセルされました。別の方法を検討してください。',
              });
              continue;
            }
          }

          // ツールを実行（5.6節のexecuteTool関数を使用）
          const result = await executeTool(tool, toolCall.args);
          toolCallCount++;

          if (this.verbose) {
            console.log(`[結果] ${result.slice(0, 200)}${result.length > 200 ? '...' : ''}`);
          }

          messages.push({
            role: 'tool',
            toolCallId: toolCall.toolCallId,
            name: toolCall.name,
            content: result,
          });
        }

        continue; // 次のループへ
      }

      // ツール呼び出しがない場合は完了（5.3節：会話履歴への追加）
      messages.push({
        role: 'assistant',
        content: response.text,
      });
      break;
    }

    // ループ終了後のチェック
    if (currentStep >= this.maxSteps) {
      console.warn('警告: 最大ステップ数に達しました');
    }

    // ツール未使用で終了した場合の警告（5.8節）
    if (toolCallCount === 0 && currentStep === 1) {
      console.warn('警告: ツールが一度も使用されずに終了しました');
    }

    return {
      text: finalText,
    };
  }
}
