'use client';

import { useState } from 'react';
import { db, LocalRecurringTask, LocalRecurringTemplate } from '@/lib/db';
import {
  Box,
  Button,
  Container,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  IconButton,
  Chip,
} from '@mui/material';
import { useSession } from 'next-auth/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSync } from '@/hooks/useSync';
import { v4 as uuidv4 } from 'uuid';
import Link from 'next/link';

/** UI上の頻度選択肢をcron式に変換するユーティリティ */
type FrequencyType = 'daily' | 'weekly' | 'monthly';

const frequencyToCron: Record<FrequencyType, string> = {
  daily: '0 9 * * *',
  weekly: '0 9 * * 1',
  monthly: '0 9 1 * *',
};

const cronToFrequency = (cron: string): FrequencyType => {
  if (cron === '0 9 * * *') return 'daily';
  if (cron === '0 9 * * 1') return 'weekly';
  if (cron === '0 9 1 * *') return 'monthly';
  // カスタムcronの場合はdailyにフォールバック
  return 'daily';
};

const frequencyLabel: Record<FrequencyType, string> = {
  daily: '毎日',
  weekly: '毎週',
  monthly: '毎月',
};

interface NewRecurringTaskForm {
  title: string;
  description: string;
  frequency: FrequencyType;
  templates: { title: string }[];
}

const initialForm: NewRecurringTaskForm = {
  title: '',
  description: '',
  frequency: 'daily',
  templates: [],
};

export default function RecurringTasksPage() {
  const { data: session } = useSession();
  const { isSyncing, triggerSync } = useSync(10000);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState<NewRecurringTaskForm>({ ...initialForm });
  const [newTemplateName, setNewTemplateName] = useState('');

  // 編集用
  const [editingTask, setEditingTask] = useState<LocalRecurringTask | null>(null);
  const [editTemplates, setEditTemplates] = useState<LocalRecurringTemplate[]>([]);
  const [editNewTemplateName, setEditNewTemplateName] = useState('');
  const [editFrequency, setEditFrequency] = useState<FrequencyType>('daily');

  const recurringTasks = useLiveQuery(() => db.recurringTasks.orderBy('createdAt').reverse().toArray()) || [];
  const allTemplates = useLiveQuery(() => db.recurringTemplates.toArray()) || [];

  const getTemplatesForTask = (taskId: string) => allTemplates.filter((t) => t.recurringTaskId === taskId);

  // --- 新規作成 ---
  const handleCreate = async () => {
    if (!form.title.trim()) return;

    const taskId = uuidv4();
    const now = Date.now();

    const newTask: LocalRecurringTask = {
      id: taskId,
      title: form.title,
      description: form.description || null,
      cronExpression: frequencyToCron[form.frequency],
      isActive: true,
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'created',
    };

    await db.recurringTasks.add(newTask);

    // テンプレート追加
    for (let i = 0; i < form.templates.length; i++) {
      const tpl: LocalRecurringTemplate = {
        id: uuidv4(),
        recurringTaskId: taskId,
        title: form.templates[i].title,
        orderIdx: i,
        _syncStatus: 'created',
      };
      await db.recurringTemplates.add(tpl);
    }

    setForm({ ...initialForm });
    setIsCreateOpen(false);
  };

  const handleAddTemplate = () => {
    if (!newTemplateName.trim()) return;
    setForm({ ...form, templates: [...form.templates, { title: newTemplateName }] });
    setNewTemplateName('');
  };

  const handleRemoveTemplate = (idx: number) => {
    setForm({ ...form, templates: form.templates.filter((_, i) => i !== idx) });
  };

  // --- 有効/無効切り替え ---
  const handleToggleActive = async (task: LocalRecurringTask) => {
    await db.recurringTasks.update(task.id, {
      isActive: !task.isActive,
      updatedAt: Date.now(),
      _syncStatus: 'updated',
    });
  };

  // --- 編集 ---
  const handleOpenEdit = (task: LocalRecurringTask) => {
    setEditingTask(task);
    setEditFrequency(cronToFrequency(task.cronExpression));
    setEditTemplates(getTemplatesForTask(task.id));
    setEditNewTemplateName('');
  };

  const handleSaveEdit = async () => {
    if (!editingTask) return;
    await db.recurringTasks.update(editingTask.id, {
      title: editingTask.title,
      description: editingTask.description || null,
      cronExpression: frequencyToCron[editFrequency],
      updatedAt: Date.now(),
      _syncStatus: 'updated',
    });

    // テンプレートの更新: 既存を全削除して再追加（シンプルな実装）
    const existingTemplates = getTemplatesForTask(editingTask.id);
    for (const tpl of existingTemplates) {
      await db.recurringTemplates.delete(tpl.id);
    }
    for (let i = 0; i < editTemplates.length; i++) {
      const tpl: LocalRecurringTemplate = {
        id: uuidv4(),
        recurringTaskId: editingTask.id,
        title: editTemplates[i].title,
        orderIdx: i,
        _syncStatus: 'created',
      };
      await db.recurringTemplates.add(tpl);
    }

    setEditingTask(null);
  };

  const handleEditAddTemplate = () => {
    if (!editNewTemplateName.trim()) return;
    setEditTemplates([
      ...editTemplates,
      {
        id: uuidv4(),
        recurringTaskId: editingTask?.id || '',
        title: editNewTemplateName,
        orderIdx: editTemplates.length,
        _syncStatus: 'created',
      },
    ]);
    setEditNewTemplateName('');
  };

  const handleEditRemoveTemplate = (idx: number) => {
    setEditTemplates(editTemplates.filter((_, i) => i !== idx));
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
          定期タスク
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button component={Link} href="/" variant="outlined" data-testid="back-to-home-btn">
            ホーム
          </Button>
          <Button
            size="small"
            variant="text"
            onClick={triggerSync}
            disabled={isSyncing}
            data-testid="recurring-sync-btn"
          >
            同期
          </Button>
        </Box>
      </Box>

      <Button
        variant="contained"
        fullWidth
        onClick={() => setIsCreateOpen(true)}
        data-testid="create-recurring-btn"
        sx={{ mb: 3 }}
      >
        定期タスクを作成
      </Button>

      <List>
        {recurringTasks.map((task) => (
          <ListItem
            key={task.id}
            data-testid={`recurring-item-${task.id}`}
            disablePadding
            secondaryAction={
              <FormControlLabel
                control={
                  <Switch
                    checked={task.isActive}
                    onChange={() => handleToggleActive(task)}
                    data-testid={`recurring-toggle-${task.id}`}
                  />
                }
                label={task.isActive ? '有効' : '無効'}
              />
            }
          >
            <ListItemButton onClick={() => handleOpenEdit(task)} data-testid={`recurring-edit-${task.id}`}>
              <ListItemText
                primary={task.title}
                secondary={
                  <Box component="span" sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                    <Chip
                      size="small"
                      label={frequencyLabel[cronToFrequency(task.cronExpression)]}
                      color="primary"
                      variant="outlined"
                    />
                    {task.description && (
                      <Typography variant="caption" color="text.secondary">
                        {task.description}
                      </Typography>
                    )}
                  </Box>
                }
                sx={{ opacity: task.isActive ? 1 : 0.5 }}
              />
            </ListItemButton>
          </ListItem>
        ))}
        {recurringTasks.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            定期タスクがありません
          </Typography>
        )}
      </List>

      {/* 新規作成ダイアログ */}
      <Dialog open={isCreateOpen} onClose={() => setIsCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>定期タスクの作成</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="タイトル"
            fullWidth
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            data-testid="recurring-form-title"
          />
          <TextField
            label="説明（任意）"
            fullWidth
            multiline
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            data-testid="recurring-form-desc"
          />
          <FormControl fullWidth>
            <InputLabel>頻度</InputLabel>
            <Select
              label="頻度"
              value={form.frequency}
              onChange={(e) => setForm({ ...form, frequency: e.target.value as FrequencyType })}
              data-testid="recurring-form-frequency"
            >
              <MenuItem value="daily">毎日</MenuItem>
              <MenuItem value="weekly">毎週</MenuItem>
              <MenuItem value="monthly">毎月</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="subtitle2" sx={{ mt: 1 }}>
            チェックリストテンプレート
          </Typography>
          {form.templates.map((tpl, idx) => (
            <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ flex: 1 }}>
                {tpl.title}
              </Typography>
              <IconButton size="small" onClick={() => handleRemoveTemplate(idx)}>
                ✕
              </IconButton>
            </Box>
          ))}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="テンプレート項目を追加..."
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              data-testid="recurring-form-template-input"
            />
            <Button size="small" onClick={handleAddTemplate} data-testid="recurring-form-add-template">
              追加
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCreateOpen(false)}>キャンセル</Button>
          <Button variant="contained" onClick={handleCreate} data-testid="recurring-form-submit">
            作成
          </Button>
        </DialogActions>
      </Dialog>

      {/* 編集ダイアログ */}
      {editingTask && (
        <Dialog open={Boolean(editingTask)} onClose={() => setEditingTask(null)} fullWidth maxWidth="sm">
          <DialogTitle>定期タスクの編集</DialogTitle>
          <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="タイトル"
              fullWidth
              value={editingTask.title}
              onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
              data-testid="recurring-edit-title"
            />
            <TextField
              label="説明（任意）"
              fullWidth
              multiline
              rows={2}
              value={editingTask.description || ''}
              onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
              data-testid="recurring-edit-desc"
            />
            <FormControl fullWidth>
              <InputLabel>頻度</InputLabel>
              <Select
                label="頻度"
                value={editFrequency}
                onChange={(e) => setEditFrequency(e.target.value as FrequencyType)}
                data-testid="recurring-edit-frequency"
              >
                <MenuItem value="daily">毎日</MenuItem>
                <MenuItem value="weekly">毎週</MenuItem>
                <MenuItem value="monthly">毎月</MenuItem>
              </Select>
            </FormControl>

            <Typography variant="subtitle2" sx={{ mt: 1 }}>
              チェックリストテンプレート
            </Typography>
            {editTemplates.map((tpl, idx) => (
              <Box key={tpl.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ flex: 1 }}>
                  {tpl.title}
                </Typography>
                <IconButton size="small" onClick={() => handleEditRemoveTemplate(idx)}>
                  ✕
                </IconButton>
              </Box>
            ))}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="テンプレート項目を追加..."
                value={editNewTemplateName}
                onChange={(e) => setEditNewTemplateName(e.target.value)}
                data-testid="recurring-edit-template-input"
              />
              <Button size="small" onClick={handleEditAddTemplate} data-testid="recurring-edit-add-template">
                追加
              </Button>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditingTask(null)}>キャンセル</Button>
            <Button variant="contained" onClick={handleSaveEdit} data-testid="recurring-edit-save">
              保存
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Container>
  );
}
