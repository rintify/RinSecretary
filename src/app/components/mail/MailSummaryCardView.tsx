import React from 'react';
import { 
    Card, CardContent, Box, Typography, Divider, 
    Chip, Link as MuiLink, Paper, Button, CircularProgress 
} from '@mui/material';
import { format } from 'date-fns';
import MailIcon from '@mui/icons-material/Mail';
import OpenIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import BlockIcon from '@mui/icons-material/Block';

// Copy types from page.tsx or define common type
export interface MailSummaryCardProps {
    card: any; // Type 'any' for now, should ideally be Prisma-generated type
    onRegenerate?: (id: string) => void;
    onBlock?: (email: string) => void;
    isRegenerating?: boolean;
    isBlocking?: string; // email currently being blocked
    genStatus?: string;
    onCreateReplyTask?: (title: string, summary: string, senders: any[]) => void;
    onDelete?: (id: string) => void;
}

export function MailSummaryCardView({ 
    card, onRegenerate, onBlock, isRegenerating, isBlocking, genStatus,
    onCreateReplyTask, onDelete 
}: MailSummaryCardProps) {
     if (card.status === 'FAILED') {
         // Error Card View
         return (
            <Paper variant="outlined" sx={{ p: 2, borderColor: 'error.main', bgcolor: '#fff5f5' }}>
                <Typography variant="subtitle1" color="error" fontWeight="bold" gutterBottom>
                    {card.title || "生成エラー"}
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                    {card.summary || card.error}
                </Typography>
                <Typography variant="caption" display="block" color="text.secondary" gutterBottom>
                    対象期間: {format(new Date(card.targetRangeStart), 'MM/dd HH:mm')} - {format(new Date(card.targetRangeEnd), 'MM/dd HH:mm')}
                </Typography>
                {onRegenerate && (
                <Box sx={{ mt: 2, textAlign: 'right' }}>
                    <Button 
                        variant="outlined" 
                        color="error" 
                        size="small" 
                        startIcon={isRegenerating ? <CircularProgress size={16} /> : <RefreshIcon />}
                        disabled={isRegenerating}
                        onClick={() => onRegenerate(card.id)}
                    >
                        {isRegenerating ? (genStatus || "再生成中") : "再生成"}
                    </Button>
                </Box>
                )}
            </Paper>
         );
     }

     // Normal Card
     let senders: any[] = [];
     let relatedLinks: any[] = [];
     try {
         senders = card.senders ? JSON.parse(card.senders) : [];
         relatedLinks = card.relatedLinks ? JSON.parse(card.relatedLinks) : [];
     } catch(e) {}

     return (
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="h6" color="primary">
                        {card.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {format(new Date(card.latestMailReceivedAt), 'MM/dd HH:mm')}
                    </Typography>
                </Box>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                    {card.summary}
                </Typography>
                
                <Divider sx={{ my: 1.5 }} />
                
                {/* Senders */}
                <Box sx={{ mb: 1.5 }}>
                    <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                        送信者:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {senders.map((sender, sIdx) => {
                            const isBlocked = isBlocking === sender.email;
                            return (
                                <Chip 
                                    key={sIdx}
                                    icon={<MailIcon sx={{ fontSize: '1rem !important' }} />}
                                    label={`${sender.name || sender.email}`}
                                    variant="outlined"
                                    size="small"
                                    onClick={() => window.open(`https://mail.google.com/mail/#search/from%3A${encodeURIComponent(`"${sender.email}"`)}`, '_blank')}
                                    onDelete={onBlock ? () => onBlock(sender.email) : undefined}
                                    deleteIcon={
                                        onBlock ? (
                                        <Box component="span" sx={{ display: 'flex' }} title="この送信者を要約から除外">
                                            {isBlocked ? <CircularProgress size={16} /> : <BlockIcon sx={{ fontSize: '1rem !important' }} />}
                                        </Box>
                                        ) : undefined
                                    }
                                    sx={{ 
                                        maxWidth: '100%',
                                        borderColor: isBlocked ? 'error.main' : undefined,
                                        color: isBlocked ? 'error.main' : undefined,
                                        cursor: 'pointer'
                                    }}
                                />
                            );
                        })}
                    </Box>
                </Box>

                {/* Links */}
                {relatedLinks.length > 0 && (
                    <Box>
                        <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                            関連メール:
                        </Typography>
                        <StackLinks links={relatedLinks} />
                    </Box>
                )}
                
                {/* Actions */}
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                     {onDelete && (
                        <Button 
                            variant="text" 
                            color="error"
                            size="small"
                            onClick={() => onDelete(card.id)}
                        >
                            削除
                        </Button>
                     )}
                     {onCreateReplyTask && (
                        <Button 
                            variant="outlined" 
                            size="small" 
                            startIcon={<MailIcon />} // Re-using MailIcon or AddTaskIcon can be imported
                            onClick={() => onCreateReplyTask(card.title, card.summary, senders)}
                        >
                            返信タスクを作成
                        </Button>
                     )}
                </Box>
            </CardContent>
        </Card>
    );
}

function StackLinks({ links }: { links: any[] }) {
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
             {links.map((link: any, lIdx: number) => (
                <MuiLink 
                    key={lIdx} 
                    href={`https://mail.google.com/mail/u/0/#inbox/${link.id}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.875rem' }}
                >
                    <OpenIcon sx={{ fontSize: '0.875rem' }} />
                    {link.text}
                </MuiLink>
            ))}
        </Box>
    );
}

// Export specific interface if needed by consumer
export default MailSummaryCardView;
