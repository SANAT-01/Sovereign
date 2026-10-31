import 'dotenv/config';
import { createServer } from './server.js';

const PORT = Number(process.env.PORT ?? 4000);

const app = createServer();

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});
