import * as usersRepository from '../modules/users/repository.js';
import { publish, TOPICS } from '../lib/kafka.js';

const TICK_MS = 60_000; // check every minute; actual send cadence is per-user intervalMinutes
export const MIN_PROD_INTERVAL_MINUTES = 360; // 6 hours — see APPROACH.md §21

// Shared with reminders-consumer.ts — both run in the same Node process
// (modular monolith, APPROACH.md §2), so a plain in-memory Set is enough
// to stop the scanner from re-enqueuing a user whose previous message is
// still being processed. Exported rather than duplicated so the consumer
// clears the same Set the scanner checks (APPROACH.md §22's "known
// simplification" note — this would NOT be correct across multiple API
// instances).
export const inFlightUserIds = new Set<string>();

function minIntervalMinutes(): number {
  return process.env.NODE_ENV === 'production' ? MIN_PROD_INTERVAL_MINUTES : 1;
}

// Finds due users and hands them off to the event bus — sending the
// actual email is entirely the consumer's job now (reminders-consumer.ts).
async function tick(): Promise<void> {
  const users = await usersRepository.listUsersWithRemindersEnabled();
  const now = Date.now();

  for (const user of users) {
    if (inFlightUserIds.has(user.id)) continue; // previous message not processed yet

    const intervalMinutes = Math.max(user.notification_prefs.intervalMinutes, minIntervalMinutes());
    const lastSentAt = user.notification_prefs.lastSentAt ? new Date(user.notification_prefs.lastSentAt).getTime() : 0;
    if (now - lastSentAt < intervalMinutes * 60_000) continue;

    // Claimed optimistically, at enqueue time — not after the consumer
    // finishes. The scanner is the only thing that knows "is this user
    // due," on a fixed clock; if it waited for the consumer before
    // advancing lastSentAt, a slow/backed-up consumer would leave the
    // timestamp stale and the very next tick would enqueue the same user
    // again before the first message is even processed. Advancing it
    // here means a failed send just waits a full interval before the
    // scanner reconsiders the user — retries for THAT one message live
    // entirely inside the consumer instead (APPROACH.md §22).
    inFlightUserIds.add(user.id);
    try {
      await usersRepository.updateNotificationPrefs(user.id, { lastSentAt: new Date().toISOString() });
      await publish(TOPICS.REMINDERS_SEND, user.id, { userId: user.id, email: user.email });
    } catch (err) {
      inFlightUserIds.delete(user.id); // never got published — don't block this user forever
      console.error(`Reminder enqueue failed for user ${user.id}:`, err);
    }
  }
}

// setInterval does NOT wait for an async callback to finish before firing
// again — a tick that runs long (many users, a slow publish) would
// otherwise overlap with the one still running. This guard makes ticks
// strictly sequential: a slow tick delays the next one, it never stacks.
let tickInFlight = false;

async function runTick(): Promise<void> {
  if (tickInFlight) {
    console.warn('Reminder scanner tick skipped — previous tick still running');
    return;
  }
  tickInFlight = true;
  try {
    await tick();
  } catch (err) {
    console.error('Reminder scanner tick failed:', err);
  } finally {
    tickInFlight = false;
  }
}

export function startReminderJob(): void {
  setInterval(() => {
    void runTick();
  }, TICK_MS);
}
