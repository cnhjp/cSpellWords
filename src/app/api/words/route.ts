import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// 辅助方法：获取当前的单词表和 GitHub 文件 SHA
async function getRawWordlist() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const filePath = process.env.GITHUB_PATH || 'cspell-words.txt';
  const branch = process.env.GITHUB_BRANCH || 'main';

  if (token && repo) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'Nextjs-Cspell-Words-Manager',
          },
          cache: 'no-store',
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.content && data.encoding === 'base64') {
          const content = Buffer.from(data.content, 'base64').toString('utf8');
          return { content, sha: data.sha, error: null };
        }
      } else if (response.status === 404) {
        return { content: '', sha: null, error: null };
      }
      throw new Error(`GitHub API 返回错误状态码: ${response.status}`);
    } catch (error: any) {
      console.error('GitHub API 请求异常:', error);
      return { content: '', sha: null, error: error.message };
    }
  }

  // 降级本地读取
  try {
    const localPath = path.join(process.cwd(), 'cspell-words.txt');
    if (fs.existsSync(localPath)) {
      const content = fs.readFileSync(localPath, 'utf8');
      return { content, sha: null, error: null };
    }
    return { content: '', sha: null, error: null };
  } catch (err: any) {
    return { content: '', sha: null, error: err.message };
  }
}

// 辅助方法：保存单词表到 GitHub 或本地
async function saveWordlist(newContent: string, sha: string | null) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const filePath = process.env.GITHUB_PATH || 'cspell-words.txt';
  const branch = process.env.GITHUB_BRANCH || 'main';

  // 规范化文件结尾：移除首尾多余空格，并以换行符结尾
  const normalizedContent = newContent.trim() ? newContent.trim() + '\n' : '';

  if (token && repo) {
    const base64Content = Buffer.from(normalizedContent, 'utf8').toString('base64');
    const response = await fetch(
      `https://api.github.com/repos/${repo}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Nextjs-Cspell-Words-Manager',
        },
        body: JSON.stringify({
          message: 'chore: update cspell-words list via Web UI',
          content: base64Content,
          sha: sha || undefined,
          branch,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub 保存失败: ${response.status} - ${errorText}`);
    }
    return { success: true };
  }

  // 降级本地写入
  try {
    const localPath = path.join(process.cwd(), 'cspell-words.txt');
    fs.writeFileSync(localPath, normalizedContent, 'utf8');
    return { success: true };
  } catch (err: any) {
    console.error('本地写入失败:', err);
    if (err.code === 'EROFS' || err.message?.includes('read-only')) {
      throw new Error(
        '检测到云端环境为只读文件系统，且 GITHUB_TOKEN 或 GITHUB_REPO 环境变量缺失。如果您刚刚在 Vercel 平台上配置了这些变量，请执行一次重新部署（Redeploy）以让变量生效。'
      );
    }
    throw new Error(`本地写入降级失败: ${err.message}`);
  }
}

// GET: 获取 JSON 格式的单词列表
export async function GET() {
  const { content, error } = await getRawWordlist();
  if (error && !content) {
    return NextResponse.json({ error: `数据获取失败: ${error}` }, { status: 500 });
  }

  const words = content
    .split(/\r?\n/)
    .map(w => w.trim())
    .filter(w => w.length > 0);

  return NextResponse.json({ words, isGitHub: !!process.env.GITHUB_TOKEN });
}

// POST: 添加单个或批量单词
export async function POST(request: NextRequest) {
  // 安全密码验证
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminPassword) {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (token !== adminPassword) {
      return NextResponse.json({ error: 'Unauthorized: 密码不正确' }, { status: 401 });
    }
  }

  try {
    const { words: wordsInput } = await request.json();
    if (!wordsInput) {
      return NextResponse.json({ error: '请输入有效的单词' }, { status: 400 });
    }

    // 解析输入的单词，支持数组或逗号/空白/换行分割的字符串
    let newWords: string[] = [];
    if (Array.isArray(wordsInput)) {
      newWords = wordsInput.map(w => w.trim()).filter(w => w.length > 0);
    } else if (typeof wordsInput === 'string') {
      newWords = wordsInput
        .split(/[,\s\n\r]+/)
        .map(w => w.trim())
        .filter(w => w.length > 0);
    }

    if (newWords.length === 0) {
      return NextResponse.json({ error: '未识别到有效的单词，请检查格式' }, { status: 400 });
    }

    // 获取当前已有的单词
    const { content, sha } = await getRawWordlist();
    const existingWords = content
      .split(/\r?\n/)
      .map(w => w.trim())
      .filter(w => w.length > 0);

    // 过滤重复词并合并
    const existingSet = new Set(existingWords);
    const addedWords: string[] = [];
    newWords.forEach(word => {
      if (!existingSet.has(word)) {
        existingSet.add(word);
        addedWords.push(word);
      }
    });

    if (addedWords.length === 0) {
      return NextResponse.json({ success: true, message: '所输入的单词已存在，无需添加', addedCount: 0 });
    }

    const updatedWords = [...existingWords, ...addedWords];
    await saveWordlist(updatedWords.join('\n'), sha);

    return NextResponse.json({
      success: true,
      message: `成功添加 ${addedWords.length} 个单词`,
      addedWords,
      addedCount: addedWords.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '操作失败' }, { status: 500 });
  }
}

// DELETE: 删除单个单词
export async function DELETE(request: NextRequest) {
  // 安全密码验证
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminPassword) {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (token !== adminPassword) {
      return NextResponse.json({ error: 'Unauthorized: 密码不正确' }, { status: 401 });
    }
  }

  try {
    const { word } = await request.json();
    if (!word || typeof word !== 'string') {
      return NextResponse.json({ error: '请指定要删除的单词' }, { status: 400 });
    }

    const targetWord = word.trim();

    // 获取当前已有的单词
    const { content, sha } = await getRawWordlist();
    const existingWords = content
      .split(/\r?\n/)
      .map(w => w.trim())
      .filter(w => w.length > 0);

    if (!existingWords.includes(targetWord)) {
      return NextResponse.json({ error: '该单词不存在于单词表中' }, { status: 404 });
    }

    const updatedWords = existingWords.filter(w => w !== targetWord);
    await saveWordlist(updatedWords.join('\n'), sha);

    return NextResponse.json({
      success: true,
      message: `成功删除单词: ${targetWord}`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '操作失败' }, { status: 500 });
  }
}
