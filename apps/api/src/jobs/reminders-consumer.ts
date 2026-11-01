import { getDashboard } from '../modules/progress/service.js';
import { sendMail } from '../lib/mailer.js';
import { registerConsumer, publish, TOPICS } from '../lib/kafka.js';
import { inFlightUserIds } from './reminders.js';

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000; // 2s, 4s — short/linear, since this blocks only this one message's processing

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Plain-text rendering of the same groups the dashboard page shows — the
// email is a text view of that data, not a separate editorial format.
function buildDigest(dashboard: Awaited<ReturnType<typeof getDashboard>>): string | null {
  const sections: string[] = [];

  if (dashboard.dailyAtRisk.length > 0) {
    sections.push(
      `Not done today:\n${dashboard.dailyAtRisk.map((i) => `  - ${i.title}`).join('\n')}`,
    );
  }
  if (dashboard.dueSoon.length > 0) {
    sections.push(
      `Due soon:\n${dashboard.dueSoon.map((i) => `  - ${i.title} (${formatDate(i.due_at!)})`).join('\n')}`,
    );
  }
  if (dashboard.staleInterviewsOrOther.length > 0) {
    sections.push(
      `Gone stale (no activity in a while):\n${dashboard.staleInterviewsOrOther
        .map((i) => `  - ${i.title}`)
        .join('\n')}`,
    );
  }
  if (dashboard.staleStudyTopics.length > 0) {
    sections.push(
      `Stale study topics:\n${dashboard.staleStudyTopics
        .map((t) => `  - ${t.title} (${t.planTitle})`)
        .join('\n')}`,
    );
  }

  return sections.length > 0 ? sections.join('\n\n') : null;
}

interface ReminderMessage {
  userId: string;
  email: string;
}

async function sendReminder(userId: string, email: string): Promise<void> {
  const dashboard = await getDashboard(userId);
  const digest = buildDigest(dashboard);
  if (digest) {
    await sendMail(email, 'Sovereign reminders', digest);
  }
}

// Retries the single message in place, up to MAX_ATTEMPTS, before giving
// up on it — not rethrown after the last attempt, so the offset commits
// either way and one bad message (e.g. a user whose dashboard query
// always throws) never blocks the rest of the partition forever.
async function processWithRetry(userId: string, email: string, attempt = 1): Promise<void> {
  try {
    await sendReminder(userId, email);
  } catch (err) {
    if (attempt >= MAX_ATTEMPTS) {
      await publish(TOPICS.REMINDERS_SEND_DLQ, userId, {
        userId,
        email,
        error: String(err),
        attempts: attempt,
      });
      console.error(`[DLQ] reminders.send exhausted ${attempt} attempts for user ${userId}:`, err);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * RETRY_DELAY_MS));
    return processWithRetry(userId, email, attempt + 1);
  }
}

export async function startRemindersConsumer(): Promise<void> {
  await registerConsumer<ReminderMessage>({
    topic: TOPICS.REMINDERS_SEND,
    groupId: 'reminders-sender',
    onMessage: async ({ userId, email }) => {
      try {
        await processWithRetry(userId, email);
      } finally {
        inFlightUserIds.delete(userId);
      }
    },
  });
}
