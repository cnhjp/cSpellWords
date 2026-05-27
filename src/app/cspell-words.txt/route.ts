import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO; // 格式: owner/repo
  const filePath = process.env.GITHUB_PATH || 'cspell-words.txt';
  const branch = process.env.GITHUB_BRANCH || 'main';

  let content = '';

  // 优先从 GitHub API 实时代理获取
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
          cache: 'no-store', // 禁用缓存，确保实时性
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.content && data.encoding === 'base64') {
          // 解码 Base64
          content = Buffer.from(data.content, 'base64').toString('utf8');
        } else {
          throw new Error('GitHub 返回的内容格式不正确');
        }
      } else {
        throw new Error(`GitHub API 返回错误码: ${response.status}`);
      }
    } catch (error) {
      console.error('从 GitHub 获取失败，降级读取本地文件:', error);
      content = readLocalFile();
    }
  } else {
    // 环境变量未配置时，直接读取本地文件（用于零配置本地开发调试）
    content = readLocalFile();
  }

  // 返回纯文本格式响应
  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    },
  });
}

function readLocalFile(): string {
  try {
    const localPath = path.join(process.cwd(), 'cspell-words.txt');
    if (fs.existsSync(localPath)) {
      return fs.readFileSync(localPath, 'utf8');
    }
    return '';
  } catch (err) {
    console.error('读取本地单词表文件失败:', err);
    return '';
  }
}
