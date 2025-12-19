'use client';

import Editor, { loader, OnMount } from '@monaco-editor/react';
import { useEffect, useRef } from 'react';
import { Box, alpha } from '@mui/material';
import { MEMO_COLOR } from '@/app/utils/colors';

// Define custom theme colors based on MEMO_COLOR
const THEME_NAME = 'memo-theme';

interface SharedEditorProps {
    value: string;
    onChange?: (value: string) => void;
    readOnly?: boolean;
    language?: string;
    showLineNumbers?: boolean;
    height?: string | number;
    theme?: 'vs' | 'vs-dark';
    onMount?: OnMount;
    paddingBottom?: number;
    paddingTop?: number;
    backgroundColor?: string;
}

export default function SharedEditor({
    value,
    onChange,
    readOnly = false,
    language = 'plaintext',
    showLineNumbers = false,
    height = '100%',
    theme = 'vs',
    onMount,
    paddingBottom = 80,
    paddingTop = 8,
    backgroundColor,
}: SharedEditorProps) {
    const editorRef = useRef<any>(null);

    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;

        // Define a custom theme
        const colors: any = {};
        if (backgroundColor) {
            colors['editor.background'] = backgroundColor;
        }

        monaco.editor.defineTheme(THEME_NAME, {
            base: theme,
            inherit: true,
            rules: [],
            colors: colors
        });

        // Apply completion and other options if needed
        if (onMount) {
            onMount(editor, monaco);
        }
    };

    return (
        <Box sx={{ width: '100%', height: height }}>
            <Editor
                height="100%"
                language={language}
                value={value}
                theme={THEME_NAME}
                onChange={(v) => onChange?.(v || '')}
                onMount={handleEditorDidMount}
                options={{
                    readOnly,
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: showLineNumbers ? 'on' : 'off',
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    automaticLayout: true,
                    contextmenu: true,
                    selectionHighlight: false,
                    occurrencesHighlight: 'off',
                    renderLineHighlight: 'none',
                    lineDecorationsWidth: showLineNumbers ? 10 : 0,
                    unicodeHighlight: {
                        ambiguousCharacters: false,
                        invisibleCharacters: false,
                    },
                    renderWhitespace: 'none',
                    renderControlCharacters: false,
                    padding: { 
                        bottom: paddingBottom,
                        top: paddingTop
                    },
                    scrollbar: {
                        verticalScrollbarSize: 6,
                        horizontalScrollbarSize: 6,
                    },
                    // Disable fixed overflow for better mobile feel if possible
                    fixedOverflowWidgets: true,
                }}
            />
        </Box>
    );
}
