// src/components/chat/CodeBlock.tsx
import React from 'react';
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { IoCopyOutline, IoCheckmarkDoneOutline } from 'react-icons/io5';

interface CodeBlockProps {
    inline?: boolean;
    className?: string;
    children?: React.ReactNode;
    enableSynthaxHighlight?: boolean;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ inline, className, children, enableSynthaxHighlight = true }) => {
    const [isCopied, setIsCopied] = React.useState(false);
    const match = /language-(\w+)/.exec(className || '');
    const language = match && match[1] ? match[1] : '';
    const codeString = String(children).replace(/\n$/, '');

    const handleCopy = () => {
        navigator.clipboard.writeText(codeString).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }).catch(err => {
            console.error('Falha ao copiar o código:', err);
        });
    };

    if (inline) {
        return (
            <code className={`${className || ''} px-1.5 py-0.5 bg-slate-700/70 text-pink-400 rounded-md text-[0.85em]`}>
                {children}
            </code>
        );
    }

    return (
        <div className="code-block-wrapper relative my-3 rounded-lg shadow-md bg-[#1e1e1e] w-full">
            <div className="flex justify-between items-center px-3 py-1.5 bg-slate-800/70 border-b border-slate-700/50 rounded-t-lg">
                <span className="text-xs text-slate-400 font-mono select-none">
                    {language || 'código'}
                </span>
                <button
                    onClick={handleCopy}
                    className="p-1 text-slate-400 hover:text-slate-100 rounded-md hover:bg-slate-700 transition-colors"
                    title={isCopied ? "Copiado!" : "Copiar código"}
                    aria-label={isCopied ? "Código copiado para a área de transferência" : "Copiar código para a área de transferência"}
                >
                    {isCopied ? <IoCheckmarkDoneOutline size={16} className="text-green-400" /> : <IoCopyOutline size={16} />}
                </button>
            </div>
            {enableSynthaxHighlight ? (
                <SyntaxHighlighter
                    style={vscDarkPlus}
                    language={language}
                    PreTag="div" // PreTag como div é importante para que o customStyle com overflow funcione
                    showLineNumbers={false}
                    wrapLines={false} // CORREÇÃO: Para permitir rolagem horizontal
                    wrapLongLines={false} // CORREÇÃO: Para permitir rolagem horizontal
                    customStyle={{
                        margin: 0,
                        padding: '1rem',
                        fontSize: '0.875rem',
                        lineHeight: '1.6',
                        borderRadius: '0 0 0.5rem 0.5rem',
                        overflowX: 'auto', // Isto permitirá a rolagem
                        // whiteSpace: 'pre' // Adicionado para garantir que não quebre, SyntaxHighlighter deve lidar com isso internamente
                                         // mas pode ser útil se houver problemas com algumas linguagens ou configurações.
                                         // Normalmente, wrapLines=false e wrapLongLines=false são suficientes.
                    }}
                    codeTagProps={{
                        style: { 
                            fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)',
                            // whiteSpace: 'pre' // Garante que o conteúdo interno da tag code não quebre as linhas
                                               // Esta propriedade na tag code é crucial.
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
                        whiteSpace: 'pre', // CORREÇÃO: Permite preservar espaços e causa overflow para scroll
                        // wordWrap: 'break-word' // REMOVIDO: Isso quebraria as palavras
                    }}
                >
                    <code>
                        {codeString}
                    </code>
                </pre>
            )}
        </div>
    );
};

export default CodeBlock;