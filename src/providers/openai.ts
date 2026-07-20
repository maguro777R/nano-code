import OpenAI from 'openai';
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

export function createOpenAI(config?: {
    apiKey?: string;
    baseURL?: string;
    maxRetries?: number;
}): Provider {
    // SDK初期化（認証はSDKが担当）
    const client = new OpenAI({
        apiKey: config?.apiKey, // 省略時は環境変数OPENAI_API_KEYを自動参照
        baseURL: config?.baseURL,
        maxRetries: config?.maxRetries ?? 0, // nano-code-coreがリトライを制御
    });

    // Nano Code Message → OpenAI形式へ変換
    function convertMessages(messages: Message[]) {
        return messages.map((m) => {
            if (m.role === 'tool') {
                return {
                    role: 'tool' as const,
                    tool_call_id: m.toolCallId,
                    content: m.content,
                };
            }
            if (m.role === 'assistant' && m.toolCalls) {
                return {
                    role: 'assistant' as const,
                    content: m.content,
                    tool_calls: m.toolCalls.map((tc) => ({
                        id: tc.toolCallId,
                        type: 'function' as const,
                        function: { name: tc.name, arguments: JSON.stringify(tc.args) },
                    })),
                };
            }
            return { role: m.role, content: m.content };
        });
    }

    // finishReasonマッピング
    function mapFinishReason(
        reason: string | null
    ): FinishReason {
        switch (reason) {
            case 'stop':
                return 'stop';
            case 'length':
                return 'length';
            case 'content_filter':
                return 'content_filter';
            case 'tool_calls':
                return 'tool_calls';
            default:
                return 'stop';
        }
    }

    // OpenAI API が返すツール引数を安全にパースし、壊れた JSON では空オブジェクトにフォールバックする。
    function parseToolCallArgs(argsText: string | undefined): Record<string, unknown> {
        if (!argsText) return {};
        try {
            return JSON.parse(argsText);
        } catch {
            // 不正な JSON では SyntaxError を伝播させない。
            return {};
        }
    }

    return (modelId: string): LanguageModel => ({
        async doGenerate(params: GenerateParams): Promise<GenerateTextResult> {
            // ツール定義をOpenAI形式に変換
            const tools = params.tools?.map((tool) => ({
                type: 'function' as const,
                function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters,
                },
            }));

            try {
                // 1. SDKで生成を実行
                const completion = await client.chat.completions.create(
                    {
                        model: modelId,
                        messages: convertMessages(params.messages) as OpenAI.ChatCompletionMessageParam[],
                        temperature: params.temperature,
                        max_completion_tokens: params.maxTokens,
                        ...(tools && tools.length > 0 && { tools }),
                    },
                    { signal: params.signal }
                );

                // 3. SDKの応答を統一型に変換
                const choice = completion.choices[0];
                if (!choice) {
                    throw new LLMApiError(
                        500,
                        'openai',
                        undefined,
                        'APIからの応答がありません'
                    );
                }
                const message = choice.message;

                const toolCalls: ToolCall[] | undefined = message.tool_calls?.map(
                    (tc: any) => ({
                        toolCallId: tc.id,
                        name: tc.function.name,
                        args: parseToolCallArgs(tc.function.arguments),
                    })
                );

                return {
                    text: message.content ?? '',
                    finishReason: mapFinishReason(choice.finish_reason),
                    toolCalls,
                    usage: completion.usage
                        ? {
                              promptTokens: completion.usage.prompt_tokens,
                              completionTokens: completion.usage.completion_tokens,
                              totalTokens: completion.usage.total_tokens,
                          }
                        : undefined,
                };
            } catch (error) {
                // 2. SDKの例外をLLMApiErrorに変換
                if (error instanceof OpenAI.APIError) {
                    throw new LLMApiError(
                        error.status ?? 500,
                        'openai',
                        error.code ?? undefined,
                        error.message,
                        error
                    );
                }
                throw error;
            }
        },
    });
  }

