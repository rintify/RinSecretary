'use client';

import { useState } from 'react';
import { db, LocalTask } from '@/lib/db';
import {
  Box,
  Button,
  Container,
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
  Checkbox,
  ListItemButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from '@mui/material';
import { useSession, signOut } from 'next-auth/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSync } from '@/hooks/useSync';
import { v4 as uuidv4 } from 'uuid';
import Link from 'next/link';

export default function DashboardPage() {
  const { data: session } = useSession();
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // 編集ダイアログ用ステート
  const [selectedTask, setSelectedTask] = useState<LocalTask | null>(null);

  // Dexieの変更をリアルタイムに検知して再レンダリングする
  const tasks = useLiveQuery(() => db.tasks.orderBy('createdAt').reverse().toArray()) || [];

  // バックグラウンド・手動同期用フック (10秒間隔で自動同期するデモ設定)
  const { isSyncing, lastSyncTime, triggerSync } = useSync(10000);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask: LocalTask = {
      id: uuidv4(),
      title: newTaskTitle,
      description: null,
      dueDate: null,
      priority: 0,
      isCompleted: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      _syncStatus: 'created',
    };

    // クライアント側DB (IndexedDB) へ保存
    await db.tasks.add(newTask);
    setNewTaskTitle('');
  };

  const handleToggleTask = async (id: string, isCompleted: boolean) => {
    await db.tasks.update(id, {
      isCompleted: !isCompleted,
      // eslint-disable-next-line
      updatedAt: Date.now(),
      _syncStatus: 'updated',
    });
  };

  const handleOpenTask = (task: LocalTask) => {
    setSelectedTask(task);
  };

  const handleCloseTask = () => {
    setSelectedTask(null);
  };

  const handleSaveTask = async () => {
    if (!selectedTask) return;
    await db.tasks.update(selectedTask.id, {
      title: selectedTask.title,
      description: selectedTask.description || null,
      priority: selectedTask.priority,
      dueDate: selectedTask.dueDate || null,
      updatedAt: Date.now(),
      _syncStatus: 'updated',
    });
    setSelectedTask(null);
  };

  const handleClearData = async () => {
    await db.tasks.clear();
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1">
          ホームダッシュボード
        </Typography>
        <Box>
          <Button component={Link} href="/recurring" color="inherit" sx={{ mr: 1 }} data-testid="recurring-link">
            定期タスク
          </Button>
          <Button component={Link} href="/notes" color="inherit" sx={{ mr: 1 }} data-testid="notes-link">
            ノート
          </Button>
          <Button component={Link} href="/settings" color="inherit" sx={{ mr: 1 }} data-testid="settings-link">
            設定
          </Button>
          <Button variant="outlined" color="inherit" onClick={() => signOut()}>
            ログアウト
          </Button>
        </Box>
      </Box>

      {session?.user && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="body1" color="text.secondary">
            ようこそ、{session.user.name || session.user.email} さん
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography
              variant="caption"
              color={isSyncing ? 'primary' : 'text.secondary'}
              data-testid="sync-status-text"
            >
              {isSyncing ? '同期中...' : lastSyncTime ? `最終同期: ${lastSyncTime.toLocaleTimeString()}` : '未同期'}
            </Typography>
            <Button size="small" variant="text" onClick={triggerSync} disabled={isSyncing} data-testid="force-sync-btn">
              今すぐ同期
            </Button>
          </Box>
        </Box>
      )}

      <Box sx={{ p: 3, border: '1px solid #e0e0e0', borderRadius: 2, bgcolor: 'background.paper' }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          ローカルファースト動作テスト (Dexie.js)
        </Typography>

        <Box component="form" onSubmit={handleAddTask} sx={{ display: 'flex', gap: 1, mb: 3 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="新しいタスクを入力..."
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            inputProps={{ 'data-testid': 'new-task-input' }}
          />
          <Button type="submit" variant="contained" data-testid="add-task-btn">
            追加
          </Button>
        </Box>

        <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
          {tasks.map((task) => (
            <ListItem
              key={task.id}
              disablePadding
              data-testid={`task-item-${task.id}`}
              secondaryAction={
                <Typography variant="caption" color="text.secondary">
                  {task._syncStatus}
                </Typography>
              }
            >
              <Checkbox
                edge="start"
                checked={task.isCompleted}
                onChange={() => handleToggleTask(task.id, task.isCompleted)}
                inputProps={{ 'aria-label': 'タスクの完了状態を切り替える' }}
                data-testid={`task-checkbox-${task.id}`}
                sx={{ mr: 1 }}
              />
              <ListItemButton onClick={() => handleOpenTask(task)} data-testid={`task-edit-button-${task.id}`}>
                <ListItemText
                  primary={task.title}
                  secondary={
                    <Box component="span" sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                      {task.priority > 0 && (
                        <Chip
                          size="small"
                          label={['', '低', '中', '高'][task.priority]}
                          color={task.priority === 3 ? 'error' : task.priority === 2 ? 'warning' : 'info'}
                          data-testid={`task-priority-${task.id}`}
                        />
                      )}
                      {task.dueDate && (
                        <Chip
                          size="small"
                          label={`期限: ${new Date(task.dueDate).toLocaleDateString()}`}
                          data-testid={`task-due-${task.id}`}
                        />
                      )}
                    </Box>
                  }
                  sx={{ textDecoration: task.isCompleted ? 'line-through' : 'none' }}
                />
              </ListItemButton>
            </ListItem>
          ))}
          {tasks.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              タスクがありません
            </Typography>
          )}
        </List>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button size="small" color="error" onClick={handleClearData} data-testid="clear-tasks-btn">
            全タスク削除
          </Button>
        </Box>
      </Box>

      {/* タスク詳細編集ダイアログ */}
      {selectedTask && (
        <Dialog open={Boolean(selectedTask)} onClose={handleCloseTask} fullWidth maxWidth="sm">
          <DialogTitle>タスクの編集</DialogTitle>
          <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="タイトル"
              fullWidth
              value={selectedTask.title}
              onChange={(e) => setSelectedTask({ ...selectedTask, title: e.target.value })}
              data-testid="edit-task-title"
            />
            <TextField
              label="詳細メモ"
              fullWidth
              multiline
              rows={3}
              value={selectedTask.description || ''}
              onChange={(e) => setSelectedTask({ ...selectedTask, description: e.target.value })}
              data-testid="edit-task-desc"
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>優先度</InputLabel>
                <Select
                  label="優先度"
                  value={selectedTask.priority}
                  onChange={(e) => setSelectedTask({ ...selectedTask, priority: Number(e.target.value) })}
                  data-testid="edit-task-priority"
                >
                  <MenuItem value={0}>なし</MenuItem>
                  <MenuItem value={1}>低</MenuItem>
                  <MenuItem value={2}>中</MenuItem>
                  <MenuItem value={3}>高</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="期限"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={selectedTask.dueDate ? new Date(selectedTask.dueDate).toISOString().split('T')[0] : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedTask({ ...selectedTask, dueDate: val ? new Date(val).getTime() : null });
                }}
                data-testid="edit-task-due"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseTask}>キャンセル</Button>
            <Button variant="contained" onClick={handleSaveTask} data-testid="save-task-btn">
              保存
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Container>
  );
}
