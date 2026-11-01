import 'dotenv/config';
import { createServer } from './server.js';
import { startReminderJob } from './jobs/reminders.js';
import { startRemindersConsumer } from './jobs/reminders-consumer.js';

const PORT = Number(process.env.PORT ?? 4000);

const app = createServer();

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
  startReminderJob();
  // Kafka being unreachable shouldn't take the whole API down with it —
  // reminders simply stop flowing until it's back (APPROACH.md §22).
  startRemindersConsumer().catch((err) => console.error('Reminders consumer failed to start:', err));
});
