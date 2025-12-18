import { devAuth } from '@/lib/dev-auth';
import { prisma } from '@/lib/prisma';
import { Box, Typography, List, ListItem, ListItemButton, ListItemText, Fab } from '@mui/material';
import { Add as AddIcon, Note as NoteIcon } from '@mui/icons-material';
import Link from 'next/link';
import MemoHeader from '@/app/components/MemoHeader';
import { redirect } from 'next/navigation';

export default async function MemoListPage() {
  const session = await devAuth();
  if (!session?.user?.email) {
    redirect('/'); // or show error
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return <div>User not found</div>;
  }

  const memos = await prisma.memo.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
  });

  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <MemoHeader title="メモ一覧" backUrl="/" />
      
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {memos.length === 0 ? (
           <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="50vh" color="text.secondary">
               <NoteIcon sx={{ fontSize: 60, mb: 2, opacity: 0.5 }} />
               <Typography>メモはありません</Typography>
           </Box>
        ) : (
            <List>
                {memos.map(memo => (
                    <ListItem key={memo.id} disablePadding sx={{ mb: 1, bgcolor: 'background.paper', borderRadius: 2, overflow: 'hidden' }}>
                        <ListItemButton component={Link} href={`/memos/${memo.id}`} sx={{ p: 2 }}>
                            <ListItemText 
                                primary={memo.title} 
                                secondary={new Date(memo.updatedAt).toLocaleDateString()} 
                                primaryTypographyProps={{ fontWeight: 'bold' }}
                            />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
        )}
      </Box>

      <Fab 
        color="primary" 
        aria-label="add" 
        component={Link} 
        href="/memos/new"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
}
