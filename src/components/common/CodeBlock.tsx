// src/components/chat/CodeBlock.tsx
import React, { useCallback, useMemo, useState } from 'react';
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import RSHLightAsync from 'react-syntax-highlighter/dist/esm/light-async';
import { vs } from 'react-syntax-highlighter/dist/esm/styles/prism'; // Changed from vscDarkPlus to vs
import { IoCopyOutline, IoCheckmarkDoneOutline } from 'react-icons/io5';

import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import { useAppSettings } from '../../contexts/AppSettingsContext';

RSHLightAsync.registerLanguage('jsx', jsx);
RSHLightAsync.registerLanguage('javascript', javascript);
RSHLightAsync.registerLanguage('typescript', typescript);
RSHLightAsync.registerLanguage('python', python);
RSHLightAsync.registerLanguage('css', css);
RSHLightAsync.registerLanguage('json', json);
RSHLightAsync.registerLanguage('bash', bash);
RSHLightAsync.registerLanguage('markdown', markdown);

interface CodeBlockProps {
    inline?: boolean;
    className?: string;
    children?: React.ReactNode;
    enableSynthaxHighlight?: boolean; 
}

const CodeBlockComponent: React.FC<CodeBlockProps> = ({ 
    inline, 
    className, 
    children,
}) => {
    const [isCopied, setIsCopied] = useState(false);
    const { settings } = useAppSettings();

    const language = useMemo(() => {
        const match = /language-(\w+)/.exec(className || '');
        return match && match[1] ? match[1] : '';
    }, [className]);

    const codeString = useMemo(() => String(children).replace(/\n$/, ''), [children]);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(codeString).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }).catch(err => {
            console.error('Falha ao copiar o código:', err);
        });
    }, [codeString]);

    if (inline) {
        return (
            <code className={`${className || ''} px-1 py-0.5 bg-[var(--color-inline-code-bg-alt)] text-[var(--color-inline-code-text-alt)] rounded text-[0.85em] font-mono`}>
                {children}
            </code>
        );
    }

    return (
        <div className="code-block-wrapper group relative my-3 rounded-lg shadow-md bg-[var(--color-code-block-wrapper-bg)] border border-[var(--color-code-block-wrapper-border)] w-full">
            <div className="flex justify-between items-center px-3 py-1.5 bg-[var(--color-code-block-header-bg)] border-b border-[var(--color-code-block-header-border)] rounded-t-lg">
                <span className="text-xs text-[var(--color-code-block-language-text)] font-mono select-none">
                    {language || 'code'} {/* Changed from 'código' to 'code' for consistency */}
                </span>
                <button
                    onClick={handleCopy}
                    className="p-1 text-[var(--color-code-block-copy-button-text)] hover:text-[var(--color-code-block-copy-button-hover-text)] rounded-md hover:bg-[var(--color-code-block-copy-button-hover-bg)] transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title={isCopied ? "Copied!" : "Copy code"} // Translated to English
                    aria-label={isCopied ? "Code copied to clipboard" : "Copy code to clipboard"} // Translated to English
                >
                    {isCopied ? <IoCheckmarkDoneOutline size={16} className="text-[var(--color-code-block-copy-button-copied-icon)]" /> : <IoCopyOutline size={16} />}
                </button>
            </div>
            {settings.codeSynthaxHighlightEnabled && language ? (
                <SyntaxHighlighter
                    style={vs} // Changed to light theme
                    language={language}
                    PreTag="div"
                    showLineNumbers={false}
                    wrapLines={false}
                    wrapLongLines={false}
                    customStyle={{
                        margin: 0,
                        padding: '1rem',
                        fontSize: '0.875rem',
                        lineHeight: '1.6',
                        borderRadius: '0 0 0.5rem 0.5rem',
                        overflowX: 'auto',
                        // backgroundColor will be set by the 'vs' theme (typically white)
                    }}
                    codeTagProps={{
                        style: { 
                            fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)',
                        }
                    }}
                >
                    {codeString}
                </SyntaxHighlighter>
            ) : (
                <pre
                    className="m-0 p-4 text-[0.875rem] leading-[1.6] rounded-b-lg overflow-x-auto scrollbar-thin scrollbar-thumb-[var(--color-code-block-no-highlight-scrollbar-thumb)] scrollbar-track-[var(--color-code-block-no-highlight-scrollbar-track)] bg-[var(--color-code-block-no-highlight-bg)] text-[var(--color-code-block-no-highlight-text)]"
                    style={{ 
                        fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)', 
                        whiteSpace: 'pre',
                    }}
                >
                    <code className="whitespace-pre" style={{ color: 'inherit' }}>
                        {codeString}
                    </code>
                </pre>
            )}
        </div>
    );
};

export const CodeBlock = React.memo(CodeBlockComponent);

export default CodeBlock;
