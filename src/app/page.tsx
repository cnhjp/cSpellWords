"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus,
  Trash2,
  Search,
  Copy,
  ExternalLink,
  Lock,
  Unlock,
  RefreshCw,
  BookOpen,
  Check,
  Globe,
  Laptop,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

export default function Home() {
  const [words, setWords] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [singleWord, setSingleWord] = useState("");
  const [bulkWords, setBulkWords] = useState("");
  const [activeTab, setActiveTab] = useState<"single" | "bulk">("single");

  // 密码与授权状态
  const [password, setPassword] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("cspell_admin_password") || "";
    }
    return "";
  });
  const [isAuthSaved, setIsAuthSaved] = useState(() => {
    if (typeof window !== "undefined") {
      return !!localStorage.getItem("cspell_admin_password");
    }
    return false;
  });

  // 页面状态
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isGitHub, setIsGitHub] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const wordsPerPage = 48;

  // 复制反馈状态
  const [copiedLink, setCopiedLink] = useState(false);

  // 加载单词表列表
  const loadWords = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const response = await fetch("/api/words");
      const data = await response.json();

      if (response.ok) {
        setWords(data.words || []);
        setIsGitHub(data.isGitHub || false);
      } else {
        setErrorMsg(data.error || "获取单词表失败");
      }
    } catch (_err) {
      setErrorMsg("网络异常，无法连接到 API 服务");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初始化加载
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadWords 是异步数据获取，setState 在 await 之后调用，不会产生级联渲染
    loadWords();
  }, [loadWords]);

  // 过滤单词（使用 useMemo 代替 useEffect + setState）
  const filteredWords = useMemo(() => {
    return words.filter((word) =>
      word.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [searchQuery, words]);

  // 搜索变化时重置分页
  const prevSearchRef = React.useRef(searchQuery);
  useEffect(() => {
    if (prevSearchRef.current !== searchQuery) {
      prevSearchRef.current = searchQuery;
      setCurrentPage(1);
    }
  }, [searchQuery]);

  // 保存密码到本地
  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("cspell_admin_password", password);
    setIsAuthSaved(true);
    showSuccess("管理员密码已保存在本地浏览器中");
  };

  // 清除本地保存的密码
  const handleClearPassword = () => {
    localStorage.removeItem("cspell_admin_password");
    setPassword("");
    setIsAuthSaved(false);
    showSuccess("已清除本地保存的密码");
  };

  // 提示信息处理
  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 5000);
  };

  // 添加单个单词
  const handleAddSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleWord.trim()) return;

    setIsSyncing(true);
    setErrorMsg(null);
    try {
      const response = await fetch("/api/words", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${password}`,
        },
        body: JSON.stringify({ words: singleWord.trim() }),
      });

      const data = await response.json();
      if (response.ok) {
        setSingleWord("");
        showSuccess(data.message || "添加成功");
        await loadWords();
      } else {
        showError(data.error || "添加失败");
      }
    } catch (_err) {
      showError("网络错误，请稍后再试");
    } finally {
      setIsSyncing(false);
    }
  };

  // 批量添加单词
  const handleAddBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkWords.trim()) return;

    setIsSyncing(true);
    setErrorMsg(null);
    try {
      const response = await fetch("/api/words", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${password}`,
        },
        body: JSON.stringify({ words: bulkWords }),
      });

      const data = await response.json();
      if (response.ok) {
        setBulkWords("");
        showSuccess(data.message || "批量导入成功");
        await loadWords();
      } else {
        showError(data.error || "批量导入失败");
      }
    } catch (_err) {
      showError("网络错误，请稍后再试");
    } finally {
      setIsSyncing(false);
    }
  };

  // 删除单词
  const handleDeleteWord = async (wordToDelete: string) => {
    if (!window.confirm(`确定要从单词表中删除单词 "${wordToDelete}" 吗？`))
      return;

    setIsSyncing(true);
    setErrorMsg(null);
    try {
      const response = await fetch("/api/words", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${password}`,
        },
        body: JSON.stringify({ word: wordToDelete }),
      });

      const data = await response.json();
      if (response.ok) {
        showSuccess(data.message || "单词已成功删除");
        await loadWords();
      } else {
        showError(data.error || "删除失败");
      }
    } catch (_err) {
      showError("网络错误，请稍后再试");
    } finally {
      setIsSyncing(false);
    }
  };

  // 复制纯文本 API 链接
  const handleCopyLink = () => {
    const rawUrl = `${window.location.origin}/cspell-words.txt`;
    navigator.clipboard.writeText(rawUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // 分页计算
  const indexOfLastWord = currentPage * wordsPerPage;
  const indexOfFirstWord = indexOfLastWord - wordsPerPage;
  const currentWords = filteredWords.slice(indexOfFirstWord, indexOfLastWord);
  const totalPages = Math.ceil(filteredWords.length / wordsPerPage);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white antialiased">
      {/* 炫酷背景光效 */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 right-1/4 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* 头部导航 */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 group">
            <div className="p-2 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-xl shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-300">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-xl bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-300 bg-clip-text text-transparent tracking-tight">
                cSpellWords
              </span>
              <span className="text-xs text-slate-500 block -mt-1 font-medium tracking-wide">
                WORDSLIST MANAGER
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* 存储类型标记 */}
            <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800/70 border border-slate-700/50 rounded-full text-xs font-semibold text-slate-300">
              {isGitHub ? (
                <>
                  <Globe className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                  <span>GitHub 实时托管</span>
                </>
              ) : (
                <>
                  <Laptop className="h-3.5 w-3.5 text-indigo-400" />
                  <span>本地文件存储</span>
                </>
              )}
            </div>

            <button
              onClick={loadWords}
              disabled={isLoading}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent hover:border-slate-700/40 rounded-lg transition-all duration-200 disabled:opacity-50"
              title="刷新数据"
            >
              <RefreshCw
                className={`h-4.5 w-4.5 ${isLoading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>
      </header>

      {/* 主体内容 */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* 全局通知 */}
        {errorMsg && (
          <div className="p-4 bg-red-950/40 border border-red-800/50 text-red-200 rounded-2xl flex items-start space-x-3 shadow-lg shadow-red-950/20 animate-in fade-in slide-in-from-top-4 duration-300">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-sm font-medium">{errorMsg}</div>
          </div>
        )}
        {successMsg && (
          <div className="p-4 bg-emerald-950/40 border border-emerald-800/50 text-emerald-200 rounded-2xl flex items-start space-x-3 shadow-lg shadow-emerald-950/20 animate-in fade-in slide-in-from-top-4 duration-300">
            <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-sm font-medium">{successMsg}</div>
          </div>
        )}

        {/* 顶部格栅板：安全配置与链接分发 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 安全口令校验卡片 */}
          <div className="lg:col-span-5 bg-slate-900/40 border border-slate-800/60 rounded-3xl p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2.5 mb-3">
                <div
                  className={`p-2 rounded-lg ${isAuthSaved ? "bg-indigo-500/10 text-indigo-400" : "bg-amber-500/10 text-amber-400"}`}
                >
                  {isAuthSaved ? (
                    <Unlock className="h-5 w-5" />
                  ) : (
                    <Lock className="h-5 w-5" />
                  )}
                </div>
                <h2 className="text-base font-bold text-slate-200">
                  管理员安全授权
                </h2>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                为防止未经授权的增删，更新单词表时需校验管理员口令。密码已保存在您的本地浏览器中，无需重复输入。
              </p>
            </div>

            <form onSubmit={handleSavePassword} className="space-y-3">
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入管理密码"
                  className="w-full bg-slate-950/60 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 text-slate-100 placeholder-slate-600 rounded-xl px-4 py-2.5 text-sm transition-all duration-200 outline-none"
                />
              </div>
              <div className="flex space-x-2">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold py-2.5 rounded-xl transition-all duration-200 shadow-md shadow-indigo-950/50 hover:shadow-indigo-500/10 active:scale-98"
                >
                  保存口令
                </button>
                {isAuthSaved && (
                  <button
                    type="button"
                    onClick={handleClearPassword}
                    className="px-3 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 text-xs font-bold rounded-xl transition-all duration-200 active:scale-98"
                  >
                    清除
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* 直达获取链接卡片 */}
          <div className="lg:col-span-7 bg-slate-900/40 border border-slate-800/60 rounded-3xl p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
                <h2 className="text-base font-bold text-slate-200">
                  纯文本单词表直达链接
                </h2>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                可以通过以下链接直接获取纯文本（一行一个单词）格式的单词表。支持
                cspell 工具直接作为外部词库引用。
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 justify-between group">
                <code className="text-xs text-indigo-400 break-all select-all font-mono">
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/cspell-words.txt`
                    : "/cspell-words.txt"}
                </code>
                <div className="flex items-center space-x-1.5 ml-3 shrink-0">
                  <button
                    onClick={handleCopyLink}
                    className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-transparent hover:border-slate-700/50 rounded-lg transition-all duration-150"
                    title="复制链接"
                  >
                    {copiedLink ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                  <a
                    href="/cspell-words.txt"
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-transparent hover:border-slate-700/50 rounded-lg transition-all duration-150"
                    title="新窗口打开"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 leading-normal">
                提示：每次在此系统添加或删除单词，该直达链接的内容均会自动实时同步更新。
              </p>
            </div>
          </div>
        </div>

        {/* 单词管理主板 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* 左侧：输入/添加区域 */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900/40 border border-slate-800/60 rounded-3xl p-6 backdrop-blur-xl shadow-xl space-y-5">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h2 className="text-base font-bold text-slate-200">
                  单词录入维护
                </h2>
                <div className="flex bg-slate-950/80 p-0.5 rounded-lg border border-slate-800">
                  <button
                    onClick={() => setActiveTab("single")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all duration-200 ${activeTab === "single" ? "bg-slate-800 text-slate-100 shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    单个录入
                  </button>
                  <button
                    onClick={() => setActiveTab("bulk")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all duration-200 ${activeTab === "bulk" ? "bg-slate-800 text-slate-100 shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    批量导入
                  </button>
                </div>
              </div>

              {activeTab === "single" ? (
                <form onSubmit={handleAddSingle} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-400">
                      单个单词名称
                    </label>
                    <input
                      type="text"
                      value={singleWord}
                      onChange={(e) => setSingleWord(e.target.value)}
                      placeholder="例如: vuedraggable"
                      disabled={isSyncing}
                      className="w-full bg-slate-950/60 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 text-slate-100 placeholder-slate-600 rounded-xl px-4 py-3 text-sm outline-none transition-all duration-200"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSyncing || !singleWord.trim()}
                    className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-indigo-950 disabled:to-purple-950 text-white font-bold py-3 rounded-xl transition-all duration-200 shadow-md shadow-indigo-950/50 hover:shadow-indigo-500/10 active:scale-98 disabled:pointer-events-none disabled:opacity-50 text-sm"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin text-indigo-300" />
                        <span>正在同步仓库...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 text-indigo-200" />
                        <span>添加到单词表</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleAddBulk} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-400">
                      批量单词数据
                    </label>
                    <textarea
                      value={bulkWords}
                      onChange={(e) => setBulkWords(e.target.value)}
                      placeholder="支持空格、逗号或新换行分隔多个单词。例如:&#10;qrcode, hztech&#10;pptxgenjs, minzheng"
                      rows={6}
                      disabled={isSyncing}
                      className="w-full bg-slate-950/60 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 text-slate-100 placeholder-slate-600 rounded-xl px-4 py-3 text-sm outline-none transition-all duration-200 font-mono resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSyncing || !bulkWords.trim()}
                    className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-indigo-950 disabled:to-purple-950 text-white font-bold py-3 rounded-xl transition-all duration-200 shadow-md shadow-indigo-950/50 hover:shadow-indigo-500/10 active:scale-98 disabled:pointer-events-none disabled:opacity-50 text-sm"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin text-indigo-300" />
                        <span>正在同步仓库...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 text-indigo-200" />
                        <span>开始导入单词列表</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* 配置参考说明 */}
            <div className="bg-slate-900/20 border border-slate-800/40 rounded-3xl p-6 backdrop-blur-xl space-y-4">
              <h3 className="text-xs font-bold text-slate-300 tracking-wider uppercase">
                CSpell 环境集成指南
              </h3>
              <div className="text-xs text-slate-400 space-y-4 leading-relaxed">
                <div>
                  <span className="font-semibold text-slate-300 block mb-1">
                    1. 在 .vscode/settings.json 中加入：
                  </span>
                  <pre className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-850 overflow-x-auto text-[10px] text-slate-400 font-mono">
                    {`"cSpell.customDictionaries": {
  "project-words": {
    "name": "project-words",
    "path": "./.vscode/cspell-words.txt"
  }
}`}
                  </pre>
                </div>
                <div>
                  <span className="font-semibold text-slate-300 block mb-1">
                    2. 创建 .vscode/tasks.json，内容为：
                  </span>
                  <pre className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-850 overflow-x-auto text-[10px] text-slate-400 font-mono">
                    {`{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "更新 cSpell 远程词表",
      "type": "shell",
      "command": "Invoke-WebRequest -Uri 'https://cspell-words.vercel.app/cspell-words.txt' -OutFile '\${workspaceFolder}/.vscode/cspell-words.txt'",
      "problemMatcher": [],
      "presentation": {
        "reveal": "silent",
        "close": true
      },
      "runOptions": {
        "runOn": "folderOpen"
      }
    }
  ]
}`}
                  </pre>
                </div>
                <div className="text-[10px] text-slate-500 leading-normal">
                  提示：通过上述配置，每次使用 VS Code
                  打开该项目文件夹时，系统都会全自动静默下载云端最新词库，并在本地进行极速校对。
                </div>
              </div>
            </div>
          </div>

          {/* 右侧：列表检索与删除区域 */}
          <div className="lg:col-span-7 bg-slate-900/40 border border-slate-800/60 rounded-3xl p-6 backdrop-blur-xl shadow-xl flex flex-col min-h-[580px]">
            {/* 顶栏：搜索过滤 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-850 gap-4 mb-5">
              <div>
                <h2 className="text-base font-bold text-slate-200 flex items-center space-x-2">
                  <span>已维护单词表</span>
                  <span className="px-2 py-0.5 bg-slate-800 text-[10px] text-slate-400 font-bold rounded-full border border-slate-700/30">
                    {filteredWords.length} / {words.length}
                  </span>
                </h2>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  支持搜索查询和单个删除
                </p>
              </div>

              <div className="relative w-full sm:w-60">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索已有单词..."
                  className="w-full bg-slate-950/60 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 text-slate-100 placeholder-slate-600 rounded-xl pl-9 pr-4 py-2 text-xs outline-none transition-all duration-200"
                />
                <Search className="absolute left-3.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
              </div>
            </div>

            {/* 单词主网格区 */}
            <div className="flex-1">
              {isLoading ? (
                <div className="h-64 flex flex-col items-center justify-center space-y-3">
                  <RefreshCw className="h-7 w-7 text-indigo-500 animate-spin" />
                  <span className="text-xs text-slate-400">
                    正在载入在线单词表数据...
                  </span>
                </div>
              ) : currentWords.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {currentWords.map((word, index) => (
                    <div
                      key={index}
                      className="group flex items-center justify-between px-3 py-2 bg-slate-950/40 hover:bg-slate-900/80 border border-slate-800/50 hover:border-indigo-500/30 rounded-xl transition-all duration-200 select-all"
                    >
                      <span className="text-xs font-mono text-slate-300 group-hover:text-slate-100 truncate pr-2">
                        {word}
                      </span>
                      <button
                        onClick={() => handleDeleteWord(word)}
                        disabled={isSyncing}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all duration-150 shrink-0 cursor-pointer"
                        title={`从单词表中删除 "${word}"`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center space-y-2 border border-dashed border-slate-800/80 rounded-2xl">
                  <Search className="h-8 w-8 text-slate-600" />
                  <span className="text-xs text-slate-400">
                    未检索到任何符合条件的单词
                  </span>
                </div>
              )}
            </div>

            {/* 底部：分页控制器 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-5 border-t border-slate-850 mt-6 shrink-0">
                <span className="text-[10px] text-slate-500 font-medium">
                  第 {currentPage} / {totalPages} 页
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    disabled={currentPage === 1 || isLoading}
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(prev - 1, 1))
                    }
                    className="px-3 py-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-slate-200 text-[10px] font-bold rounded-lg disabled:opacity-30 disabled:pointer-events-none transition-all duration-150"
                  >
                    上一页
                  </button>
                  <button
                    disabled={currentPage === totalPages || isLoading}
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                    }
                    className="px-3 py-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-slate-200 text-[10px] font-bold rounded-lg disabled:opacity-30 disabled:pointer-events-none transition-all duration-150"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 页脚 */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 mt-16">
        <div className="max-w-7xl mx-auto px-4 text-center text-[10px] text-slate-600 tracking-wide font-medium flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            © {new Date().getFullYear()} cSpellWords. Crafted for elite
            developer tooling workflow.
          </div>
          <div className="flex items-center space-x-4">
            <span>Power of Gemini 3.5 & Next.js App Router</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
