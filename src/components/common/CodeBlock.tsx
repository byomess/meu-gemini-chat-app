// src/components/chat/CodeBlock.tsx
import React from 'react';
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter';
// Escolha um tema de destaque de sintaxe. vscDarkPlus é uma boa opção para temas escuros.
// Outras opções: atomOneDark, dracula, coy, materialDark, okaidia, tomorrow, etc.
// Veja a lista completa aqui: https://github.com/react-syntax-highlighter/react-syntax-highlighter/blob/master/AVAILABLE_STYLES_PRISM.MD
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { IoCopyOutline, IoCheckmarkDoneOutline } from 'react-icons/io5'; // Ícones para copiar

// Opcional: Registrar apenas as linguagens que você mais espera usar para otimizar o bundle.
// Se usar PrismAsyncLight, ele tentará carregar dinamicamente, mas registrar explicitamente
// pode ser mais rápido para linguagens comuns.
// Exemplo:
// import { jsx, javascript, python, css, bash, json, markdown, typescript } from 'react-syntax-highlighter/dist/esm/languages/prism';
// SyntaxHighlighter.registerLanguage('jsx', jsx);
// SyntaxHighlighter.registerLanguage('javascript', javascript);
// SyntaxHighlighter.registerLanguage('python', python);
// SyntaxHighlighter.registerLanguage('css', css);
// SyntaxHighlighter.registerLanguage('bash', bash);
// SyntaxHighlighter.registerLanguage('json', json);
// SyntaxHighlighter.registerLanguage('markdown', markdown);
// SyntaxHighlighter.registerLanguage('typescript', typescript);

interface CodeBlockProps {
    inline?: boolean;
    className?: string;
    children?: React.ReactNode;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ inline, className, children }) => {
    const [isCopied, setIsCopied] = React.useState(false);
    const match = /language-(\w+)/.exec(className || '');
    const language = match && match[1] ? match[1] : ''; // Tenta extrair a linguagem da classe (ex: "language-javascript")
    const codeString = String(children).replace(/\n$/, ''); // Remove a última nova linha, comum em blocos de código

    const handleCopy = () => {
        navigator.clipboard.writeText(codeString).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000); // Resetar o estado de 'copiado' após 2 segundos
        }).catch(err => {
            console.error('Falha ao copiar o código:', err);
            // Poderia mostrar uma mensagem de erro para o usuário aqui
        });
    };

    if (inline) {
        // Código inline (ex: `variavel`)
        return (
            <code className={`${className || ''} px-1.5 py-0.5 bg-slate-700/70 text-pink-400 rounded-md text-[0.85em]`}>
                {children}
            </code>
        );
    }

    // Bloco de Código (ex: ```javascript ... ```)
    return (
        <div className="code-block-wrapper relative my-3 rounded-lg shadow-md bg-[#1e1e1e]"> {/* Cor de fundo correspondente ao tema vscDarkPlus */}
            <div className="flex justify-between items-center px-3 py-1.5 bg-slate-800/70 border-b border-slate-700/50 rounded-t-lg">
                <span className="text-xs text-slate-400 font-mono select-none">
                    {language || 'código'} {/* Mostra a linguagem detectada ou "código" */}
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
            <SyntaxHighlighter
                style={vscDarkPlus}
                language={language}
                PreTag="div" // Usa div em vez de pre para melhor controle de estilo e evitar estilos de user-agent
                showLineNumbers={false} // Desabilitado por padrão, pode ser ativado se desejado
                wrapLines={true}      // Quebra linhas longas que excedem a largura
                wrapLongLines={true}  // Garante que linhas muito longas sejam quebradas
                customStyle={{
                    margin: 0,
                    padding: '1rem',
                    fontSize: '0.875rem', // Equivalente a text-sm do Tailwind
                    lineHeight: '1.6',   // Espaçamento entre linhas
                    borderRadius: '0 0 0.5rem 0.5rem', // Apenas cantos inferiores arredondados, pois o wrapper tem os superiores
                    overflowX: 'auto',   // Scroll horizontal se necessário (embora wrapLongLines tente evitar)
                }}
                codeTagProps={{
                    style: { fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)' } // Garante fonte monoespaçada
                }}
            >
                {codeString}
            </SyntaxHighlighter>
        </div>
    );
};

export default CodeBlock;