import { parseArgs } from 'util';
import * as path from 'path';
import { Agent } from '../src/core/agent';
import { loadInstructions } from '../src/core/prompt';
import { createModelFromEnv } from '../src/providers/modelFactory';
// 第4章で実装された基本ツール
import { readFile } from '../src/tools/readFile';
import { writeFile } from '../src/tools/writeFile';
import { editFile } from '../src/tools/editFile';
import { execCommand } from '../src/tools/execCommand';
import { createBranch, commit, pushBranch } from '../src/tools/git';
import { createPullRequest, createIssueComment } from '../src/tools/github';

const WORKSPACE_ROOT = path.resolve(process.cwd(), 'workspace');

async function main() {
    const { values, positionals } = parseArgs({
        args: process.argv.slice(2),
        options: { 
            'yolo': { type: 'boolean', default: false},
        },
        allowPositionals: true,
    });

    const yoloMode = values['yolo'];

    const args = process.argv.slice(2);

    if (args.length === 0) {
      console.error('使い方: bun run agent "<タスクの説明>"');
      console.error('例: bun run agent "calculator.ts の関数にテストを追加してください"');
      process.exit(1);
    }

    // タスクの取得: コマンドライン引数 > 環境変数 ISSUE_BODY
    const userPrompt = positionals[0] || process.env.ISSUE_BODY || '';
    // Issueイベントで起動したときだけ、Issue 駆動向けの追加指示に切り替える。
    const isIssueDriven = !userPrompt && process.env.GITHUB_EVENT_NAME === 'issues' && !!process.env.ISSUE_BODY;

    // 環境変数からモデルを生成
    const model = createModelFromEnv();

    // 安全設定: workspaceディレクトリ内のみ操作可能
    const workspaceRoot = path.resolve(process.cwd(), 'workspace');

    // プロンプトを読み込む（ベース + AGENTS.md）
    const instructions = loadInstructions(workspaceRoot);

    // プロンプトを読み込む（ベース + AGENTS.md）（第6章の基本実装）
    const baseInstructions = loadInstructions(WORKSPACE_ROOT);

    // 第7章 GitHub Actions 連携: CI環境（Issue駆動）の場合は指示を拡張する
    const issueDrivenInstructions = `${baseInstructions}
あなたは GitHub Actions で実行される TypeScript コーディングエージェントです。
現在の環境は CI 環境であり、あなたの仕事はコードを修正してプルリクエストを作成することです。
トリガーとなった Issue 番号は ${process.env.ISSUE_NUMBER || '(なし)'} です（もし「(なし)」ならコメントは不要）。

## ワークフロー
以下の手順で作業を進めてください：

1. **TODOリストの作成**: Issueの内容に基づき、以下の項目を含むTODOリストを作成する。
   - [ ] Issue を理解する
   - [ ] 対象ファイルを読み込む
   - [ ] コードを修正する
   - [ ] 修正結果をテストする
   - [ ] Git にコミットしてプッシュする
   - [ ] プルリクエストを作成する
   - [ ] 元の Issue にコメントで報告する

2. **タスクの実行**: TODOリストに従って作業を進める。
   - **重要**: ファイルを修正しただけでは終了ではない。必ず Git コミット、プッシュ、プルリクエスト作成まで行うこと。
   - 最後に createIssueComment を使い、作成したプルリクエストのURLを元のIssueに投稿すること。

3. **完了報告**: すべてのTODOが完了したら、結果をまとめる。
`;

    // エージェントを作成
    const agent = new Agent({
        name: 'nano-code',
        model,
        instructions: isIssueDriven ? issueDrivenInstructions : baseInstructions,
        tools: {
            // 第4章で実装した基本ツール（execCommand は第8章の統合版でサンドボックス対応版に差し替え）
            readFile,
            writeFile,
            editFile,
            execCommand,
            // Git操作ツール
            createBranch,
            commit,
            pushBranch,
            // GitHub操作ツール
            createPullRequest,
            createIssueComment,
        },
        maxSteps: 20,
        // --yolo時は自動承認
        approvalFunc: yoloMode ? async () => true : undefined,
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
