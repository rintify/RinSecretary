'use client';

import { useState } from 'react';
import { db, LocalNote } from '@/lib/db';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActionArea,
  Container,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  Grid,
} from '@mui/material';
import { useSession } from 'next-auth/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSync } from '@/hooks/useSync';
import { v4 as uuidv4 } from 'uuid';
import Link from 'next/link';

export default function NotesPage() {
  const { data: session } = useSession();
  const { isSyncing, triggerSync } = useSync(10000);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  // 編集用
  const [editingNote, setEditingNote] = useState<LocalNote | null>(null);

  // 論理削除されていないノートのみ表示
  const notes =
    useLiveQuery(async () => {
      const all = await db.notes.orderBy('updatedAt').reverse().toArray();
      return all.filter((n) => !n.deletedAt);
    }) || [];

  // --- 新規作成 ---
  const handleCreate = async () => {
    if (!newTitle.trim()) return;

    const now = Date.now();
    const newNote: LocalNote = {
      id: uuidv4(),
      title: newTitle,
      content: newContent,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      _syncStatus: 'created',
    };

    await db.notes.add(newNote);
    setNewTitle('');
    setNewContent('');
    setIsCreateOpen(false);
  };

  // --- 編集 ---
  const handleOpenEdit = (note: LocalNote) => {
    setEditingNote({ ...note });
  };

  const handleSaveEdit = async () => {
    if (!editingNote) return;
    await db.notes.update(editingNote.id, {
      title: editingNote.title,
      content: editingNote.content,
      updatedAt: Date.now(),
      _syncStatus: 'updated',
    });
    setEditingNote(null);
  };

  // --- 削除（論理削除） ---
  const handleDelete = async () => {
    if (!editingNote) return;
    await db.notes.update(editingNote.id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
      _syncStatus: 'updated',
    });
    setEditingNote(null);
  };

  /** 本文のプレビュー用に最初の100文字を表示 */
  const previewContent = (content: string) => {
    if (content.length <= 100) return content;
    return content.substring(0, 100) + '...';
  };

  if (!session) {
    return (
      <Container>
        <Typography sx={{ mt: 5 }}>ログインが必要です</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          ノート
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button component={Link} href="/" variant="outlined" data-testid="back-to-home-btn">
            ホーム
          </Button>
          <Button size="small" variant="text" onClick={triggerSync} disabled={isSyncing} data-testid="notes-sync-btn">
            同期
          </Button>
        </Box>
      </Box>

      <Button
        variant="contained"
        fullWidth
        onClick={() => setIsCreateOpen(true)}
        data-testid="create-note-btn"
        sx={{ mb: 3 }}
      >
        ノートを作成
      </Button>

      <Grid container spacing={2}>
        {notes.map((note) => (
          <Grid key={note.id} size={12}>
            <Card data-testid={`note-card-${note.id}`}>
              <CardActionArea onClick={() => handleOpenEdit(note)} data-testid={`note-open-${note.id}`}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {note.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                    {previewContent(note.content)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    更新: {new Date(note.updatedAt).toLocaleString('ja-JP')}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
        {notes.length === 0 && (
          <Grid size={12}>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              ノートがありません
            </Typography>
          </Grid>
        )}
      </Grid>

      {/* 新規作成ダイアログ */}
      <Dialog open={isCreateOpen} onClose={() => setIsCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>ノートの作成</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="タイトル"
            fullWidth
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            data-testid="note-form-title"
          />
          <TextField
            label="本文"
            fullWidth
            multiline
            rows={8}
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            data-testid="note-form-content"
            placeholder="Markdownで記述可能..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCreateOpen(false)}>キャンセル</Button>
          <Button variant="contained" onClick={handleCreate} data-testid="note-form-submit">
            作成
          </Button>
        </DialogActions>
      </Dialog>

      {/* 編集ダイアログ */}
      {editingNote && (
        <Dialog open={Boolean(editingNote)} onClose={() => setEditingNote(null)} fullWidth maxWidth="sm">
          <DialogTitle>ノートの編集</DialogTitle>
          <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="タイトル"
              fullWidth
              value={editingNote.title}
              onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
              data-testid="note-edit-title"
            />
            <TextField
              label="本文"
              fullWidth
              multiline
              rows={10}
              value={editingNote.content}
              onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
              data-testid="note-edit-content"
            />
          </DialogContent>
          <DialogActions>
            <Button color="error" onClick={handleDelete} data-testid="note-delete-btn">
              削除
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button onClick={() => setEditingNote(null)}>キャンセル</Button>
            <Button variant="contained" onClick={handleSaveEdit} data-testid="note-edit-save">
              保存
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Container>
  );
}
