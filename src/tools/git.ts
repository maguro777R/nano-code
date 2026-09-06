import { execCommand } from './execCommand';

// ブランチ名の検証（引数インジェクション対策）
function validateBranchName(name: string): void {
    if (name.startsWith('-') || name.startsWith(':')) {
        throw new Error('無効なブランチ名形式です');
    }
}

export const createBranch = {
    name: 'createBranch',
    description: '新しいGitブランチを作成。既存ブランチがある場合は強制リセット',
    needsApproval: true,
    parameters: {
      type: 'object',
      properties: {
        branchName: {
          type: 'string',
          description: "作成するブランチ名（例: 'fix/error-handling'）"
        }
    },
      required: ['branchName']
    },
    execute: async (args: { branchName: string }) => {
        const branchName = args.branchName;
        validateBranchName(branchName);
        // -B オプション: ブランチが存在すればリセット、なければ新規作成
        const result = await execCommand.execute({
          command: `git checkout -B ${args.branchName}`
        });
        return `ブランチを作成しました: ${branchName}\n${result}`;
    }
};   

export const commit = {
    name: 'commitChanges',
    description: '変更をコミット',
    needsApproval: true,
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'コミットメッセージ'
        },
        files: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'コミットするファイルのパスのリスト'
        }
      },
      required: ['message', 'files']
    },
    execute: async (args: { message: string; files: string[] }) => {
      // 変更があるか確認（空コミット防止）
      const status = await execCommand.execute({
        command: 'git status --porcelain'
      });
      if (!status.trim()) {
        return 'コミットする変更がありません';
      }

      for (const file of args.files) {
        await execCommand.execute({ command: `git add "${file}"` });
      }
      const result = await execCommand.execute({
        command: `git commit -m "${args.message}"`
      });
      return `コミットしました: ${args.message}¥n${result}`;
    }
};

export const pushBranch = {
  name: 'pushBranch',
  description: 'ブランチをリモートにプッシュ',
  needsApproval: true,
    parameters: {
      type: 'object',
      properties: {
        branchName: {
          type: 'string',
          description: 'プッシュするブランチ名'
        }
      },
      required: ['branchName']
  },
  execute: async (args: { branchName: string }) => {
    validateBranchName(args.branchName);
    const result = await execCommand.execute({
      command: `git push -u origin ${args.branchName}`
    });
    return `ブランチをプッシュしました: ${args.branchName}\n${result}`;
  }
};
