import { generateText } from './generate-text';
import type { Tool, Message, GenerateTextResult } from '../types';
import { requestApproval } from './approval';

async function generate(userPrompt: string): Promise<{ text: string }> {
  // ステップ1：会話ループの開始（5.3節）
  let messages: Message[] = [
    { role: 'system', content: "あなたはファイル操作ができるアシスタントです。" },
    { role: 'user', content: userPrompt },
  ];

  while (true) {
    // ステップ1: LLMを呼び出す
    const response = await generateText({ model, messages, tools });

    if (response.text) {
      console.log(response.text);
    }

    // ステップ2：ツール実行（5.4節、5.6節）
    if (response.toolCalls && response.toolCalls.length > 0) {
      messages.push({
        role: 'assistant',
        content: response.text || "",
        toolCalls: response.toolCalls,
      });

      for (const toolCall of response.toolCalls) {
        const tool = tools.find(t => t.name === toolCall.name);
        
        if (!tool) {
          throw new Error(`Unknown tool: ${toolCall.name}`);
        }

        console.log(`[ツール実行] ${toolCall.name}`);

        // 承認が必要かチェック
        if (tool.needsApproval) {
          const approved = await requestApproval(
            toolCall.name,
            toolCall.args
        )
        
        if (!approved) {
          // ユーザーが拒否した場合、自然言語でLLMに通知
          messages.push({
            role: "tool",
            toolCallId: toolCall.toolCallId,
            name: toolCall.name,
            content: "ユーザーによってキャンセルされました。別の方法を検討してください。"
          });
          continue;
        }
      }

      // 承認された、または承認不要な場合は実行
      const result = await executeTool(tool, toolCall.args);

      messages.push({
        role: 'tool',
        toolCallId: toolCall.toolCallId, // ここでtoolCallIdを紐付け
        name: toolCall.name,             // ツール名も必須
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

  if (response.finishReason === 'stop') {
    break;
  }
  }
}
