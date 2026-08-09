async function generate(userPrompt: string): Promise<{ text: string }> {
  // ステップ1：会話ループの開始（5.3節）
  let messages: Message[] = [
    { role: 'system', content: "あなたはファイル操作ができるアシスタントです。" },
    { role: 'user', content: userPrompt },
  ];

  let finalText = '';

  while (true) {
    // ステップ1: LLMを呼び出す
    const response = await generateText({ model, messages, tools });

    if (response.text) {
      finalText = response.text;
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
          console.log(`[ツール実行] ${toolCall.name}(${JSON.stringify(toolCall.args)})`);

        // ステップ3：ツールを検索して実行
        const tool = tools.find(t => t.name === toolCall.name);
        if (!tool) {
          throw new Error(`Unknown tool: ${toolCall.name}`);
        }
        const result = await executeTool(tool, toolCall.args);

        // ステップ4: toolメッセージを会話履歴に追加
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
    break;
  }

  if (response.finishReason === 'stop') {
    break;
  }

  return {
    text: finalText,
  };
}
