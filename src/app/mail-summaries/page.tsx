'use client';

import React, { useState, useEffect } from 'react';
import { 
    Box, Typography, List, ListItem, 
    IconButton, Paper, Container, AppBar, Toolbar, 
    Button, Dialog, DialogContent, DialogActions, Chip, CircularProgress,
    Card, CardContent, Divider, Link as MuiLink, Stack, Snackbar
} from '@mui/material';
import MailSummaryCardView from '@/app/components/mail/MailSummaryCardView';
import MailSummaryResultModal from '@/app/components/mail/MailSummaryResultModal';
import GenerationProgressModal from '@/app/components/GenerationProgressModal';
import { 
    ArrowBack as ArrowBackIcon, 
    Mail as MailIcon,
    OpenInNew as OpenIcon,
    Block as BlockIcon,
    AddTask as AddTaskIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { blockSender } from '@/lib/mail-actions';
import { createTask } from '@/lib/task-actions';
import { deleteMyMailSummary } from '@/lib/mail-scheduler-actions';
import { useConfirm } from '@/app/context/ConfirmContext';

export default function MailSummariesPage() {
    const router = useRouter();
    const [summaries, setSummaries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [blocking, setBlocking] = useState<string | null>(null);
    const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
    const [snackbar, setSnackbar] = useState<{ open: boolean, message: string }>({ open: false, message: '' });

    const [generating, setGenerating] = useState(false);
    const [genStatus, setGenStatus] = useState<string>("");
    const { confirm } = useConfirm();
    
    // Result Modal State
    const [resultModalOpen, setResultModalOpen] = useState(false);
    const [resultSummaries, setResultSummaries] = useState<any[]>([]);
    
    // Generation Error State
    const [generationError, setGenerationError] = useState<string | null>(null);
    
    const load = async () => {
        setLoading(true);
        try {
            const { fetchMyMailSummaries } = await import('@/lib/mail-scheduler-actions');
            const list = await fetchMyMailSummaries();
            setSummaries(list);
        } catch(e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => {
        load();
    }, []);

    const handleBlock = async (email: string) => {
        if(!await confirm(`${email} からのメールを今後除外しますか？\n（実際にはブロックされず、AI要約から除外されるだけです）`, { title: '除外確認', severity: 'warning' })) return;
        
        setBlocking(email);
        try {
            await blockSender(email);
            setSnackbar({ open: true, message: `${email} を除外リストに追加しました` });
            // Ideally we should reload or filter locally, but for now just notify
        } catch (e) {
            console.error(e);
            setSnackbar({ open: true, message: 'ブロック設定に失敗しました' });
        } finally {
            setBlocking(null);
        }
    };

    const handleCreateReplyTask = async (title: string, summary: string, senders: any[]) => {
        try {
            const senderInfo = senders.map(s => {
                const searchUrl = `https://mail.google.com/mail/#search/from%3A${encodeURIComponent(`"${s.email}"`)}`;
                return `${s.name || s.email}: ${searchUrl}`;
            }).join('\n');
            await createTask({
                title: `返信: ${title}`,
                memo: `${summary}\n\n送信者:\n${senderInfo}`,
            });
            setSnackbar({ open: true, message: '返信タスクを作成しました' });
        } catch (e) {
            console.error(e);
            setSnackbar({ open: true, message: 'タスク作成に失敗しました' });
        }
    };

    const handleDelete = async (id: string) => {
        if(!await confirm("この要約カードを削除しますか？", { severity: 'error', confirmText: '削除' })) return;
        try {
            await deleteMyMailSummary(id);
            setSummaries(prev => prev.filter(c => c.id !== id));
            setSnackbar({ open: true, message: '削除しました' });
        } catch(e) {
            console.error(e);
            setSnackbar({ open: true, message: '削除に失敗しました' });
        }
    };

    const handleGenerate2Weeks = async () => {
        if(generating) return;
        setGenerating(true);
        setGenerationError(null);
        setGenStatus("メールを取得中...");
        try {
            const { fetchMailDataForTwoWeeks, generateAndSave2WeeksSummary } = await import('@/lib/mail-scheduler-actions');
            
            // Step 1: Fetch
            const fetchRes = await fetchMailDataForTwoWeeks();
            if (!fetchRes.success || !fetchRes.messages) {
               throw new Error(fetchRes.error || "メールの取得に失敗しました");
            }
            
            if (fetchRes.count === 0) {
                 setSnackbar({ open: true, message: '対象期間にメールはありませんでした' });
                 setGenStatus("");
                 setGenerating(false);
                 return;
            }

            // Step 2: Analyze
            setGenStatus(`AIが分析中... (${fetchRes.count}通)`);
            const processRes = await generateAndSave2WeeksSummary(fetchRes.messages);
            
              if(processRes.success) {
                  // Reload list
                  await load();
                  
                  // Show modal with new cards
                  if (processRes.ids && processRes.ids.length > 0) {
                        try {
                            const { getMailSummaries } = await import('@/lib/mail-scheduler-actions');
                            // We ideally fetch just the new ones, but for now we filter from local state or fetch generic?
                            // processRes returns ids. We can fetch using Prisma or just filter from the reloaded list.
                            // But reloading is async and might take time.
                            // Let's rely on the reloaded 'list' if we can, OR implement fetchByIds.
                            // For simplicity, let's filter from the refreshed list (which we await load()).
                            const { fetchMyMailSummaries } = await import('@/lib/mail-scheduler-actions');
                            const refreshedList = await fetchMyMailSummaries();
                            setSummaries(refreshedList);
                            
                            const newCards = refreshedList.filter((c: any) => processRes.ids.includes(c.id));
                            setResultSummaries(newCards);
                            setResultModalOpen(true);
                            setSnackbar({ open: true, message: `生成完了: ${processRes.count}件のカードを作成しました` });
                        } catch(e) { console.error(e); }
                  } else {
                     setSnackbar({ open: true, message: `生成完了: ${processRes.count}件のカードを作成しました` });
                  }
             } else {
                  throw new Error("生成処理に失敗しました");
             }
        } catch (e: any) {
            console.error(e);
            setGenerationError(e.message || '生成に失敗しました');
            // Do NOT close modal here (generating stays true? or we need a way to keep modal open)
            // If we set generating=false, modal closes.
            // But we want to show error in modal.
            // So GeneratingModal should be open if (generating || generationError != null)
            setGenerating(false); 
        } finally {
            if (!generationError) {
                 // Only clear if no error (if error, we want to keep it "technically" not generating but showing error)
                 setGenerating(false);
                 setGenStatus("");
            }
        }
    };

    const handleRegenerate = async (id: string) => {
        setRegeneratingId(id);
        setGenerationError(null);
        const originalStatus = genStatus;
        try {
            const { prepareRegeneration, fetchMailDataInRange, generateAndSaveMailSummary } = await import('@/lib/mail-scheduler-actions');
            
            // Step 0: Prep
            const prep = await prepareRegeneration(id);
            if (!prep.success) throw new Error("再生準備に失敗しました");

            // Step 1: Fetch
            setGenStatus("過去のメールを再取得中...");
            const fetchRes = await fetchMailDataInRange(prep.range.start, prep.range.end);
            if (!fetchRes.success || !fetchRes.messages) throw new Error("メールの再取得に失敗しました");

            // Step 2: Analyze
            setGenStatus(`AIが再分析中... (${fetchRes.count}通)`);
            const processRes = await generateAndSaveMailSummary(fetchRes.messages, prep.range);
            if (!processRes.success) throw new Error("要約の再生成に失敗しました");

            setSnackbar({ open: true, message: '再生成が完了しました' });
            
             // Show result in modal
             if (processRes.ids && processRes.ids.length > 0) {
                 const { fetchMyMailSummaries } = await import('@/lib/mail-scheduler-actions');
                 const refreshedList = await fetchMyMailSummaries();
                 setSummaries(refreshedList);
                 
                 const newCards = refreshedList.filter((c: any) => processRes.ids.includes(c.id));
                 setResultSummaries(newCards);
                 setResultModalOpen(true);
             } else {
                 await load();
             }
        } catch (e: any) {
            console.error(e);
            setGenerationError(e.message || '再生成に失敗しました');
            setRegeneratingId(null);
        } finally {
            if (!generationError) {
                 setRegeneratingId(null);
                 setGenStatus(originalStatus);
            }
        }
    };

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
            <AppBar position="sticky" color="default" elevation={1} sx={{ top: 0, zIndex: 10 }}>
                <Toolbar>
                    <IconButton edge="start" onClick={() => router.push('/')}>
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography variant="h6" sx={{ flexGrow: 1, ml: 2 }}>
                        メール要約カード
                    </Typography>
                    <Button 
                        variant="contained" 
                        color="primary"
                        disabled={generating || loading}
                        onClick={handleGenerate2Weeks}
                        startIcon={generating ? <CircularProgress size={20} color="inherit" /> : <MailIcon />}
                    >
                        {generating ? genStatus : "2週間分生成"}
                    </Button>
                </Toolbar>
            </AppBar>
            
            <Container maxWidth="md" sx={{ py: 3 }}>
                 {loading ? (
                     <Box sx={{ textAlign: 'center', mt: 4 }}>
                         <CircularProgress />
                     </Box>
                 ) : summaries.length === 0 ? (
                     <Box sx={{ textAlign: 'center', mt: 4, color: 'text.secondary' }}>
                         <MailIcon sx={{ fontSize: 60, mb: 1, opacity: 0.3 }} />
                         <Typography>履歴はありません</Typography>
                     </Box>
                  ) : (
                      <Stack spacing={4}>
                          {(Object.entries(
                              summaries.reduce((acc, card) => {
                                  const key = format(new Date(card.latestMailReceivedAt), 'yyyy-MM-dd');
                                  if (!acc[key]) acc[key] = [];
                                  acc[key].push(card);
                                  return acc;
                              }, {} as Record<string, any[]>)
                          ) as [string, any[]][])
                          .sort((a, b) => b[0].localeCompare(a[0]))
                          .map(([dateKey, groupCards]) => (
                              <Box key={dateKey}>
                                  <Divider textAlign="left" sx={{ mb: 2 }}>
                                      <Chip 
                                          label={format(new Date(groupCards[0].latestMailReceivedAt), 'MM月dd日 (EEE)', { locale: ja })} 
                                          size="small" 
                                          sx={{ px: 1, fontWeight: 'bold' }}
                                      />
                                  </Divider>
                                  <Stack spacing={2}>
                                      {groupCards.map((card: any) => (
                                          <MailSummaryCardView 
                                              key={card.id}
                                              card={card}
                                              onRegenerate={handleRegenerate}
                                              onBlock={handleBlock}
                                              isRegenerating={regeneratingId === card.id}
                                              isBlocking={blocking || undefined}
                                              genStatus={genStatus}
                                              onCreateReplyTask={handleCreateReplyTask}
                                              onDelete={handleDelete}
                                          />
                                      ))}
                                  </Stack>
                              </Box>
                          ))}
                      </Stack>
                  )}
            </Container>
            
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                message={snackbar.message}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            />
            
            <MailSummaryResultModal
                open={resultModalOpen}
                onClose={() => setResultModalOpen(false)}
                summaries={resultSummaries}
                title="生成結果"
            />
            
            <GenerationProgressModal
                open={generating || !!regeneratingId || !!generationError}
                step={genStatus}
                error={generationError}
                onClose={() => {
                    setGenerationError(null);
                    setGenerating(false);
                    setRegeneratingId(null);
                    setGenStatus("");
                }}
            />
        </Box>
    );
}
