import { ValidationError, NotFoundError } from '../../errors.js';
import * as repository from './repository.js';
import type { ProgressItem, ItemType } from './repository.js';

const STALE_DAYS = 7; // generic item-level staleness (interview/other); daily uses its own at-risk signal
const DUE_SOON_DAYS = 3;

interface Topic {
  id: string;
  title: string;
  status: 'not_started' | 'in_progress' | 'done';
  lastTouchedAt: string | null;
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function newId(): string {
  return crypto.randomUUID();
}

// --- Streak computation (daily items) ---
// Counts consecutive days ending at today (if logged) or yesterday (if
// today isn't logged yet — the streak isn't broken until the day actually
// passes, it's just "at risk"). Also returns the last 30 days as a
// heatmap array — the visual miss is more useful than the number alone.
async function computeStreak(userId: string, itemId: string) {
  const logDates = await repository.getItemLogDates(userId, itemId);
  const logged = new Set(logDates);
  const today = new Date();
  const heatmap: { date: string; completed: boolean }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = toDateString(d);
    heatmap.push({ date: dateStr, completed: logged.has(dateStr) });
  }

  const doneToday = logged.has(toDateString(today));
  let streak = 0;
  const cursor = new Date(today);
  if (!doneToday) cursor.setDate(cursor.getDate() - 1);
  while (logged.has(toDateString(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { streak, doneToday, heatmap };
}

function topicsOf(item: ProgressItem): Topic[] {
  return Array.isArray(item.data.topics) ? (item.data.topics as Topic[]) : [];
}

function studyPlanCoverage(topics: Topic[]): number | null {
  if (topics.length === 0) return null; // distinguish "no topics yet" from "0% done"
  const done = topics.filter((t) => t.status === 'done').length;
  return Math.round((done / topics.length) * 100);
}

function staleTopics(topics: Topic[], staleDays: number): Topic[] {
  return topics.filter((t) => {
    if (t.status === 'done') return false;
    if (!t.lastTouchedAt) return true;
    const days = (Date.now() - new Date(t.lastTouchedAt).getTime()) / 86_400_000;
    return days > staleDays;
  });
}

// --- CRUD ---

export async function listItems(userId: string) {
  const items = await repository.listItems(userId);
  return Promise.all(items.map((item) => enrichItem(userId, item)));
}

async function enrichItem(userId: string, item: ProgressItem) {
  if (item.type === 'daily') {
    const { streak, doneToday, heatmap } = await computeStreak(userId, item.id);
    return { ...item, streak, doneToday, heatmap };
  }
  if (item.type === 'study_plan') {
    const topics = topicsOf(item);
    return { ...item, coveragePercent: studyPlanCoverage(topics), staleTopics: staleTopics(topics, STALE_DAYS) };
  }
  return item;
}

export async function createItem(
  userId: string,
  input: { type: ItemType; title: string; dueAt?: string; data?: Record<string, unknown> },
) {
  if (!input.title.trim()) throw new ValidationError('Title is required');

  const validTypes: ItemType[] = ['daily', 'study_plan', 'interview', 'other'];
  if (!validTypes.includes(input.type)) throw new ValidationError('Invalid item type');

  if (input.type === 'interview') {
    const data = (input.data ?? {}) as { company?: string };
    if (!data.company?.trim()) throw new ValidationError('Company is required for interview items');
  }

  const item = await repository.createItem(userId, {
    type: input.type,
    title: input.title.trim(),
    dueAt: input.dueAt,
    data: {
      ...input.data,
      ...(input.type === 'interview' ? { stage: 'applied', coveragePercent: 0 } : {}),
      ...(input.type === 'study_plan' ? { topics: [] } : {}),
    },
  });
  return enrichItem(userId, item);
}

export async function toggleDailyToday(userId: string, itemId: string, done: boolean) {
  const item = await repository.getItem(userId, itemId);
  if (!item || item.type !== 'daily') throw new NotFoundError('Daily item not found');
  if (done) {
    await repository.logItemToday(userId, itemId);
  } else {
    await repository.unlogItemToday(userId, itemId);
  }
}

export async function addTopic(userId: string, itemId: string, title: string) {
  if (!title.trim()) throw new ValidationError('Topic title is required');
  const item = await repository.getItem(userId, itemId);
  if (!item || item.type !== 'study_plan') throw new NotFoundError('Study plan not found');

  const topics = topicsOf(item);
  const topic: Topic = { id: newId(), title: title.trim(), status: 'not_started', lastTouchedAt: null };
  const updated = await repository.updateItem(userId, itemId, { dataPatch: { topics: [...topics, topic] } });
  return enrichItem(userId, updated!);
}

export async function updateTopicStatus(
  userId: string,
  itemId: string,
  topicId: string,
  status: Topic['status'],
) {
  const item = await repository.getItem(userId, itemId);
  if (!item || item.type !== 'study_plan') throw new NotFoundError('Study plan not found');

  const topics = topicsOf(item).map((t) =>
    t.id === topicId ? { ...t, status, lastTouchedAt: new Date().toISOString() } : t,
  );
  const updated = await repository.updateItem(userId, itemId, { dataPatch: { topics } });
  return enrichItem(userId, updated!);
}

// 'pending' sits between 'interview' and the terminal outcome — waiting to
// hear back after the interview happened, distinct from still being
// scheduled (APPROACH.md §10's stage stepper).
const INTERVIEW_STAGES = ['applied', 'referral_asked', 'interview', 'pending', 'accepted', 'rejected'] as const;

export async function updateInterview(
  userId: string,
  itemId: string,
  patch: { stage?: (typeof INTERVIEW_STAGES)[number]; coveragePercent?: number; dueAt?: string | null },
) {
  const item = await repository.getItem(userId, itemId);
  if (!item || item.type !== 'interview') throw new NotFoundError('Interview not found');

  if (patch.stage && !INTERVIEW_STAGES.includes(patch.stage)) {
    throw new ValidationError('Invalid interview stage');
  }
  if (patch.coveragePercent !== undefined && (patch.coveragePercent < 0 || patch.coveragePercent > 100)) {
    throw new ValidationError('Coverage percent must be between 0 and 100');
  }

  const isTerminal = patch.stage === 'accepted' || patch.stage === 'rejected';
  const updated = await repository.updateItem(userId, itemId, {
    status: isTerminal ? 'done' : undefined,
    dueAt: patch.dueAt,
    dataPatch: {
      ...(patch.stage ? { stage: patch.stage } : {}),
      ...(patch.coveragePercent !== undefined ? { coveragePercent: patch.coveragePercent } : {}),
    },
  });
  return updated;
}

export async function setItemDone(userId: string, itemId: string, done: boolean) {
  const updated = await repository.updateItem(userId, itemId, { status: done ? 'done' : 'active' });
  if (!updated) throw new NotFoundError('Item not found');
  return updated;
}

// Generic edit — title/due date for any type, plus company/role for
// interview items. Previously there was no way to change these after
// creation at all.
export async function editItem(
  userId: string,
  itemId: string,
  patch: { title?: string; dueAt?: string | null; company?: string; role?: string },
) {
  if (patch.title !== undefined && !patch.title.trim()) {
    throw new ValidationError('Title cannot be empty');
  }
  const item = await repository.getItem(userId, itemId);
  if (!item) throw new NotFoundError('Item not found');

  if (item.type === 'interview' && patch.company !== undefined && !patch.company.trim()) {
    throw new ValidationError('Company is required for interview items');
  }

  const updated = await repository.updateItem(userId, itemId, {
    title: patch.title?.trim(),
    dueAt: patch.dueAt,
    dataPatch: {
      ...(patch.company !== undefined ? { company: patch.company.trim() } : {}),
      ...(patch.role !== undefined ? { role: patch.role.trim() } : {}),
    },
  });
  return enrichItem(userId, updated!);
}

// --- Dashboard aggregation — the actual feature (APPROACH.md §10) ---

export async function getDashboard(userId: string) {
  const items = await repository.listItems(userId);

  const dailyItems = items.filter((i) => i.type === 'daily' && i.status === 'active');
  const dailyWithStreaks = await Promise.all(
    dailyItems.map(async (item) => ({ ...item, ...(await computeStreak(userId, item.id)) })),
  );
  const dailyAtRisk = dailyWithStreaks.filter((h) => !h.doneToday && h.streak > 0);

  const studyPlans = items.filter((i) => i.type === 'study_plan' && i.status === 'active');
  const staleStudyTopics = studyPlans.flatMap((plan) =>
    staleTopics(topicsOf(plan), STALE_DAYS).map((t) => ({ ...t, planId: plan.id, planTitle: plan.title })),
  );

  // Generic queries for interview/other staleness + due-soon — daily and
  // study_plan are excluded from these (they have their own, more precise
  // signals above) rather than double-reported here.
  const [staleGeneric, dueSoonGeneric] = await Promise.all([
    repository.listStaleItems(userId, STALE_DAYS),
    repository.listDueSoonItems(userId, DUE_SOON_DAYS),
  ]);
  const staleInterviewsOrOther = staleGeneric.filter((i) => i.type === 'interview' || i.type === 'other');
  const dueSoon = dueSoonGeneric.filter((i) => i.type === 'interview' || i.type === 'other');

  const openOther = items.filter((i) => i.type === 'other' && i.status === 'active');

  return {
    dailyAtRisk,
    staleStudyTopics,
    dueSoon,
    staleInterviewsOrOther,
    openOther,
  };
}
