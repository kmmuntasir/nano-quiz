import express from 'express';

const app = express();
const PORT = 3000;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  process.stdout.write(`NanoQuiz backend listening on http://localhost:${PORT}\n`);
});
