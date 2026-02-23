'use client';

import { useState } from 'react';
import { db, LocalTask } from '@/lib/db';
import { Box, Button, Container, List, ListItem, ListItemText, TextField, Typography, Checkbox } from '@mui/material';
import { useSession, signOut } from 'next-auth/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSync } from '@/hooks/useSync';
import { v4 as uuidv4 } from 'uuid';

export default function DashboardPage() {
  const { data: session } = useSession();
  const [newTaskTitle, setNewTaskTitle] = useState('');

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
      // 既にcreatedの場合はcreatedのまま、それ以外はupdatedにする等の制御が本来必要
      _syncStatus: 'updated',
    });
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
        <Button variant="outlined" color="inherit" onClick={() => signOut()}>
          ログアウト
        </Button>
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
              />
              <ListItemText primary={task.title} sx={{ textDecoration: task.isCompleted ? 'line-through' : 'none' }} />
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
    </Container>
  );
}
