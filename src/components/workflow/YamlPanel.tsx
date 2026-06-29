"use client";

import { useCallback, useRef, useEffect } from "react";
import { useWorkflowStore } from "@/stores/workflow";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";

const DEFAULT_YAML = `# 企智工作流定义
name: my-workflow
version: "1.0"
description: 示例工作流

steps:
  - id: step_1
    type: llm_task
    label: 数据分析
    model: gpt-4o
    prompt: "分析输入数据"
    input: \${start.output}
    retry:
      max_attempts: 3
      backoff: exponential

  - id: step_2
    type: approval
    label: 主管审批
    depends_on: [step_1]
    assignee: admin
    timeout: 3600

  - id: step_3
    type: tool
    label: 发送通知
    depends_on: [step_2]
    tool: feishu_send_message
    params:
      chat_id: \${context.chat_id}
      content: \${step_2.output}

  - id: step_4
    type: parallel
    label: 并行处理
    depends_on: [step_3]
    branches:
      - id: step_4a
        type: llm_task
        label: 生成报告
        model: claude-sonnet-4-6
        prompt: "生成分析报告"
      - id: step_4b
        type: tool
        label: 存储结果
        tool: supabase_insert
        params:
          table: reports
`;

export function YamlPanel() {
  const { yamlContent, setYamlContent } = useWorkflowStore();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
    if (!yamlContent) {
      setYamlContent(DEFAULT_YAML);
      editor.setValue(DEFAULT_YAML);
    }
  };

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) {
        setYamlContent(value);
      }
    },
    [setYamlContent],
  );

  useEffect(() => {
    if (editorRef.current && yamlContent && editorRef.current.getValue() !== yamlContent) {
      editorRef.current.setValue(yamlContent);
    }
  }, [yamlContent]);

  return (
    <div className="w-80 shrink-0 border-l border-zinc-200 dark:border-zinc-700 flex flex-col bg-white dark:bg-zinc-950">
      <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          YAML 定义
        </h3>
      </div>
      <div className="flex-1">
        <Editor
          height="100%"
          defaultLanguage="yaml"
          theme="vs-dark"
          value={yamlContent}
          onChange={handleChange}
          onMount={handleMount}
          options={{
            fontSize: 12,
            lineNumbers: "on",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: "on",
            tabSize: 2,
            padding: { top: 8 },
            folding: true,
            glyphMargin: false,
            lineDecorationsWidth: 0,
          }}
        />
      </div>
    </div>
  );
}
