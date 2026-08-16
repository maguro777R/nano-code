import * as path from 'path';
import { Agent } from '../src/core/agent';
import { loadInstructions } from '../src/core/prompt';
import { createModelFromEnv } from '../src/providers/modelFactory';
// 第4章で実装された基本ツール
import { readFile } from '../src/tools/readFile';
import { writeFile } from '../src/tools/writeFile';
import { editFile } from '../src/tools/editFile';
import { execCommand } from '../src/tools/execCommand';

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
      console.error('使い方: bun run agent "<タスクの説明>"');
      console.error('例: bun run agent "calculator.ts の関数にテストを追加してください"');
      process.exit(1);
    }

    const userPrompt = args.join(' ');

    // 環境変数からモデルを生成
    const model = createModelFromEnv();

    // 安全設定: workspaceディレクトリ内のみ操作可能
    const workspaceRoot = path.resolve(process.cwd(), 'workspace');

    // プロンプトを読み込む（ベース + AGENTS.md）
    const instructions = loadInstructions(workspaceRoot);

    // エージェントを作成
    const agent = new Agent({
        name: 'nano-code',
        model,
        instructions, // 外部ファイルから読み込んだプロンプト
        tools: {
            // 第4章で実装した基本ツール（execCommand は第8章の統合版でサンドボックス対応版に差し替え）
            readFile,
            writeFile,
            editFile,
            execCommand,
        },
        maxSteps: 15,
    });

    console.log('エージェント起動\n');
    console.log(`タスク: ${userPrompt}\n`);
    console.log('—'.repeat(60) + '\n');

    try {
        const result = await agent.generate(userPrompt);
        console.log(result.text);
        console.log('\n' + '─'.repeat(60));
        console.log('タスク完了');
    } catch (error) {
        console.error('\n予期しないエラー:', error);
        process.exit(1);
    }
}

main();
