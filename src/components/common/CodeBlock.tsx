// src/components/chat/CodeBlock.tsx
import React, { useCallback, useMemo, useState } from 'react';
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import RSHLightAsync from 'react-syntax-highlighter/dist/esm/light-async';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
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
            <code className={`${className || ''} px-1.5 py-0.5 bg-slate-700/70 text-pink-400 rounded-md text-[0.85em]`}>
                {children}
            </code>
        );
    }

    return (
        <div className="code-block-wrapper group relative my-3 rounded-lg shadow-md bg-[#1e1e1e] w-full">
            <div className="flex justify-between items-center px-3 py-1.5 bg-slate-800/70 border-b border-slate-700/50 rounded-t-lg">
                <span className="text-xs text-slate-400 font-mono select-none">
                    {language || 'código'}
                </span>
                <button
                    onClick={handleCopy}
                    className="p-1 text-slate-400 hover:text-slate-100 rounded-md hover:bg-slate-700 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title={isCopied ? "Copiado!" : "Copiar código"}
                    aria-label={isCopied ? "Código copiado para a área de transferência" : "Copiar código para a área de transferência"}
                >
                    {isCopied ? <IoCheckmarkDoneOutline size={16} className="text-green-400" /> : <IoCopyOutline size={16} />}
                </button>
            </div>
            {settings.codeSynthaxHighlightEnabled && language ? (
                <SyntaxHighlighter
                    style={vscDarkPlus}
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
                    className="m-0 p-4 text-[0.875rem] leading-[1.6] rounded-b-lg overflow-x-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-700/50"
                    style={{ 
                        fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)', 
                        whiteSpace: 'pre',
                    }}
                >
                    <code className="whitespace-pre">
                        {codeString}
                    </code>
                </pre>
            )}
        </div>
    );
};

export const CodeBlock = React.memo(CodeBlockComponent);

export default CodeBlock;