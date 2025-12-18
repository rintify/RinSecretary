import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface MarkdownDisplayProps {
    children: string;
}

export default function MarkdownDisplay({ children }: MarkdownDisplayProps) {
    return (
        <div style={{ overflowWrap: 'anywhere', wordBreak: 'break-word', lineHeight: 1.6 }}>
            <ReactMarkdown
                remarkPlugins={[remarkMath, remarkGfm, remarkBreaks]}
                rehypePlugins={[rehypeKatex]}
                components={{
                    a: ({node, ...props}) => <a {...props} style={{ color: '#1976d2', textDecoration: 'underline' }} target="_blank" rel="noopener noreferrer" />,
                    img: (props) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img 
                            {...props} 
                            style={{ 
                                maxWidth: '100%', 
                                maxHeight: '80vh',
                                objectFit: 'contain',
                                display: 'block',
                                marginRight: 'auto',
                                marginLeft: 0,
                                marginBlock: '0.5rem'
                            }} 
                        />
                    ),
                    p: ({node, ...props}) => <p {...props} style={{ margin: 0, marginBottom: '0.5em' }} />,
                    pre: ({node, ...props}) => (
                        <pre 
                            {...props} 
                            style={{ 
                                backgroundColor: '#0d0d0d', 
                                color: '#fff', 
                                padding: '1rem', 
                                borderRadius: '0.5rem', 
                                overflowX: 'auto',
                                marginBlock: '0.5rem',
                                fontFamily: 'monospace'
                            }} 
                        />
                    ),
                    code: ({node, className, children, ...props}) => {
                        const match = /language-(\w+)/.exec(className || '')
                        const isInline = !match && !String(children).includes('\n')
                        return isInline ? (
                            <code 
                                {...props} 
                                className={className} 
                                style={{ 
                                    backgroundColor: '#f3f3f3', 
                                    color: '#333',
                                    borderRadius: '0.2rem',
                                    padding: '0.2em 0.4em',
                                    fontFamily: 'monospace',
                                    fontSize: '0.9em'
                                }}
                            >
                                {children}
                            </code>
                        ) : (
                            <code {...props} className={className} style={{ fontFamily: 'monospace', fontSize: '0.9em' }}>
                                {children}
                            </code>
                        )
                    },
                    ol: ({node, ...props}) => <ol {...props} style={{ paddingLeft: '1.2rem', marginBlock: '0.5rem' }} />,
                    ul: ({node, ...props}) => <ul {...props} style={{ paddingLeft: '1.2rem', marginBlock: '0.5rem' }} />,
                    li: ({node, ...props}) => <li {...props} style={{ marginBottom: '0.2rem' }} />
                }}
            >
                {children}
            </ReactMarkdown>
        </div>
    );
}
