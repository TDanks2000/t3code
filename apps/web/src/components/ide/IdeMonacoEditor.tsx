import { useRef, useCallback, useEffect } from "react";
import Editor, { type BeforeMount, type OnMount, type OnChange } from "@monaco-editor/react";
import { useTheme } from "../../hooks/useTheme";
import { cn } from "~/lib/utils";

export type IdeMonacoEditorProps = {
  readonly path: string;
  readonly language: string;
  readonly value: string;
  readonly readOnly?: boolean | undefined;
  readonly revealLine?: number | undefined;
  readonly revealColumn?: number | undefined;
  readonly onChange?: ((value: string) => void) | undefined;
  readonly className?: string | undefined;
};

export const IdeMonacoEditor = ({
  path,
  language,
  value,
  readOnly = true,
  revealLine,
  revealColumn,
  onChange,
  className,
}: IdeMonacoEditorProps) => {
  const { resolvedTheme } = useTheme();
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    const diagnosticsOptions = {
      noSemanticValidation: true,
      noSuggestionDiagnostics: true,
    };

    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions(diagnosticsOptions);
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions(diagnosticsOptions);
  }, []);

  const handleMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || revealLine == null) return;

    editor.revealLineInCenter(revealLine);
    editor.setPosition({
      lineNumber: revealLine,
      column: revealColumn ?? 1,
    });
    editor.focus();
  }, [revealLine, revealColumn]);

  const handleChange: OnChange = useCallback(
    (val) => {
      if (val !== undefined && onChange) {
        onChange(val);
      }
    },
    [onChange],
  );

  const isDark = resolvedTheme === "dark";

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      <Editor
        path={path}
        defaultLanguage={language}
        language={language}
        value={value}
        onChange={handleChange}
        theme={isDark ? "vs-dark" : "light"}
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        options={{
          readOnly,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: "on",
          lineNumbers: "on",
          renderLineHighlight: "line",
          folding: true,
          automaticLayout: true,
          tabSize: 2,
          fontSize: 12,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
          overviewRulerBorder: false,
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
          padding: { top: 8 },
          bracketPairColorization: { enabled: true },
          guides: {
            bracketPairs: true,
            indentation: true,
          },
        }}
      />
    </div>
  );
};
