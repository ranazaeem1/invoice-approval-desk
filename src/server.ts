import path from 'path';
import express from 'express';
import { createApp } from './app';

const port = process.env.PORT || 3000;
const app = createApp();
const publicDir = path.join(process.cwd(), 'public');

app.use(express.static(publicDir));

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(publicDir, 'index.html'));
});

const server = app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

export { server, app };
