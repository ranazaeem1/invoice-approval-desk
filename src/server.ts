import path from 'path';
import express from 'express';
import { createApp } from './app';
import { getDatabase } from './db';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const db = getDatabase();
const app = createApp(db);

const publicPath = path.join(process.cwd(), 'public');
app.use(express.static(publicPath));

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(publicPath, 'index.html'));
});

const server = app.listen(PORT, () => {
  console.log(`Invoice Approval Desk server listening on port ${PORT}`);
});

export { server, app };
