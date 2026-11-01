import { Kafka, logLevel, type Producer, type Consumer } from 'kafkajs';

// General-purpose event bus (APPROACH.md §22) — a deliberate infra choice
// beyond what any single module strictly needs today, so this stays
// deliberately minimal: two operations (publish/registerConsumer), no
// module-specific logic here. KAFKA_BROKERS/KAFKA_CLIENT_ID are validated
// lazily (only when something actually publishes or consumes), same
// pattern as lib/mailer.ts/lib/crypto.ts — a deployment that never
// touches Kafka shouldn't fail to boot over it.

// Topic names are "<module>.<event>", dot-namespaced in Kafka's flat
// topic namespace — each module owns its own first segment, so a future
// module's topic can't collide with another's. DLQs are "<topic>.dlq".
export const TOPICS = {
  REMINDERS_SEND: 'reminders.send',
  REMINDERS_SEND_DLQ: 'reminders.send.dlq',
} as const;

let kafka: Kafka | null = null;
let producer: Producer | null = null;
const consumers: Consumer[] = [];

function getKafka(): Kafka {
  if (kafka) return kafka;
  const brokers = process.env.KAFKA_BROKERS;
  if (!brokers) {
    throw new Error('KAFKA_BROKERS must be set to use the event bus');
  }
  kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID ?? 'sovereign-api',
    brokers: brokers.split(',').map((b) => b.trim()),
    logLevel: logLevel.WARN,
  });
  return kafka;
}

// Connect once, reuse — same "don't open a fresh connection per call"
// reasoning as mailer.ts's pooled SMTP transport.
async function getProducer(): Promise<Producer> {
  if (producer) return producer;
  producer = getKafka().producer();
  await producer.connect();
  return producer;
}

export async function publish(topic: string, key: string, payload: unknown): Promise<void> {
  const p = await getProducer();
  await p.send({
    topic,
    messages: [{ key, value: JSON.stringify(payload) }],
  });
}

export interface TopicHandler<T> {
  topic: string;
  // One consumer group per logical handler, never shared — so two
  // unrelated modules consuming the same topic never fight over offsets.
  groupId: string;
  onMessage: (payload: T, raw: { key: string | null }) => Promise<void>;
}

export async function registerConsumer<T>(handler: TopicHandler<T>): Promise<void> {
  const consumer = getKafka().consumer({ groupId: handler.groupId });
  await consumer.connect();
  await consumer.subscribe({ topic: handler.topic, fromBeginning: false });
  await consumer.run({
    eachMessage: async ({ message }) => {
      const payload = message.value ? (JSON.parse(message.value.toString()) as T) : (null as T);
      await handler.onMessage(payload, { key: message.key?.toString() ?? null });
    },
  });
  consumers.push(consumer);
}

export async function shutdownKafka(): Promise<void> {
  await Promise.all(consumers.map((c) => c.disconnect()));
  if (producer) await producer.disconnect();
}
