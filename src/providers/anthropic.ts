import Anthropic from '@anthropic-ai/sdk';
import type {
    FinishReason,
    GenerateParams,
    GenerateTextResult,
    LanguageModel,
    Message,
    Provider,
    ToolCall,
} from '../types';
import { LLMApiError } from '../types';

export function createAnthropic(config?: {
    apiKey?: string;
    maxRetries?: number;
}): Provider {
    const client = new Anthropic({
        apiKey: config?.apiKey, // 省略時は環境変数ANTHROPIC_API_KEYを自動参照
        maxRetries: config?.maxRetries ?? 0,
    });

    // systemメッセージを分離して変換
    function convertMessages(messages: Message[]) {
        // 履歴圧縮後も、ツール呼び出しと結果の対応が壊れないように補正する。
        return messages
            .filter((m) => m.role !== 'system')
            .map((m) => {
                // ツール結果はuserロール + tool_resultブロック
                if (m.role === 'tool') {
                    return {
                        role: 'user' as const,
                        content: [
                            {
                                type: 'tool_result' as const,
                                tool_use_id: m.toolCallId,
                                content: m.content,
                            },
                        ],
                    };
                }
                // assistantのツール呼び出し
                if (m.role === 'assistant' && m.toolCalls) {
                    const content: any[] = [];
                    if (m.content) {
                        content.push({ type: 'text', text: m.content });
                    }
                    for (const tc of m.toolCalls) {
                        content.push({
                            type: 'tool_use',
                            id: tc.toolCallId,
                            name: tc.name,
                            input: tc.args,
                        });
                    }
                    return { role: 'assistant' as const, content };
                }
                return {
                    role: m.role as 'user' | 'assistant',
                    content: m.content,
                };
            });
    }

    // finishReasonマッピング
    function mapFinishReason(
        stopReason: string | null
    ): FinishReason {
        switch (stopReason) {
            case 'end_turn':
                return 'stop';
            case 'tool_use':
                return 'tool_calls';
            case 'max_tokens':
                return 'length';
            default:
                return 'stop';
        }
    }

    return (modelId: string): LanguageModel => ({
        async doGenerate(params: GenerateParams): Promise<GenerateTextResult> {
            // systemメッセージを分離
            const systemMessages = params.messages.filter(
                (m) => m.role === 'system'
            );
            const system = systemMessages.map((m) => ({
                type: 'text' as const,
                text: m.content,
            }));

            // ツール定義をAnthropic形式に変換
            const tools = params.tools?.map((tool) => ({
                name: tool.name,
                description: tool.description,
                input_schema: tool.parameters as Anthropic.Tool.InputSchema,
            }));

            try {
                const response = await client.messages.create(
                    {
                        model: modelId,
                        system,
                        messages: convertMessages(params.messages) as Anthropic.MessageParam[],
                        max_tokens: params.maxTokens ?? 4096,
                        temperature: params.temperature,
                        ...(tools && tools.length > 0 && { tools }),
                    },
                    { signal: params.signal }
                );

                // レスポンスからテキストとツール呼び出しを抽出
                const textBlocks = response.content.filter(
                    (b) => b.type === 'text'
                );
                const text = textBlocks.map((b: any) => b.text).join('');

                const toolUseBlocks = response.content.filter(
                    (b) => b.type === 'tool_use'
                );
                const toolCalls: ToolCall[] | undefined =
                    toolUseBlocks.length > 0
                        ? toolUseBlocks.map((b: any) => ({
                              toolCallId: b.id,
                              name: b.name,
                              args: b.input,
                          }))
                        : undefined;

                return {
                    text,
                    finishReason: mapFinishReason(response.stop_reason),
                    toolCalls,
                    usage: {
                        promptTokens: response.usage.input_tokens,
                        completionTokens: response.usage.output_tokens,
                        totalTokens:
                            response.usage.input_tokens +
                            response.usage.output_tokens,
                    },
                };
            } catch (error) {
                if (error instanceof Anthropic.APIError) {
                    throw new LLMApiError(
                        error.status ?? 500,
                        'anthropic',
                        (error.error as any)?.type,
                        error.message,
                        error
                    );
                }
                throw error;
            }
        },
    });
}
