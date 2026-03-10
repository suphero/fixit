import amqp from "amqplib";
import * as bulkResultConsumer from "./consumers/bulk-result.server";
import * as deleteShopConsumer from "./consumers/delete-shop.server";
import * as generateRecoConsumer from "./consumers/generate-reco.server";
import * as scopesUpdateConsumer from "./consumers/scopes-update.server";
import * as subscriptionUpdateConsumer from "./consumers/subscription-update.server";

declare global {
  var rabbitmqConnection: amqp.Connection | undefined;
  var rabbitmqConnectionPromise: Promise<amqp.Connection> | undefined;
}

type RABBITMQ_QUEUE = "bulk_result" | "delete_shop" | "generate_reco" | "scopes_update" | "subscription_update";

const channels: Record<string, amqp.Channel> = {};

export async function getRabbitMQConnection(): Promise<amqp.Connection> {
  if (global.rabbitmqConnection) {
    return global.rabbitmqConnection;
  }

  if (global.rabbitmqConnectionPromise) {
    return global.rabbitmqConnectionPromise;
  }

  const url = process.env.RABBITMQ_URL;
  if (!url) {
    throw new Error("RABBITMQ_URL is not set");
  }

  // Log URL (obfuscating password)
  const sanitizedUrl = url.replace(/:([^:@]+)@/, ':****@');
  console.log(`Attempting to connect to RabbitMQ at: ${sanitizedUrl}`);

  global.rabbitmqConnectionPromise = (async () => {

    try {
      // Add timeout to connection attempt (10 seconds)
      const connectPromise = amqp.connect(url);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('RabbitMQ connection timeout after 10s')), 10000)
      );

      const conn = await Promise.race([connectPromise, timeoutPromise]);
      console.log("RabbitMQ connected successfully");

      conn.on("close", () => {
        console.error("RabbitMQ connection closed");
        global.rabbitmqConnection = undefined;
        global.rabbitmqConnectionPromise = undefined;
        // Clear channels on close
        Object.keys(channels).forEach(key => delete channels[key]);
      });

      conn.on("error", (error) => {
        console.error("RabbitMQ connection error:", error);
      });

      global.rabbitmqConnection = conn;

      // Start consumers in the background after connection is established
      // We don't await this to avoid potential circular dependency deadlocks during init
      startQueueConsumers().catch(err => {
        console.error("Failed to start queue consumers:", err);
      });

      return conn;
    } catch (error) {
      global.rabbitmqConnectionPromise = undefined;
      console.error("Failed to connect to RabbitMQ:", error);
      throw error;
    }
  })();

  return global.rabbitmqConnectionPromise;
}

async function getChannel(queue: RABBITMQ_QUEUE): Promise<amqp.Channel> {
  if (!channels[queue]) {
    const conn = await getRabbitMQConnection();
    const channel = await conn.createChannel();
    await channel.assertQueue(queue, { durable: true });
    channels[queue] = channel;
    console.log(`Channel created and queue asserted for "${queue}"`);

    channel.on("close", () => {
      console.log(`Channel for "${queue}" closed`);
      delete channels[queue];
    });

    channel.on("error", (err) => {
      console.error(`Channel for "${queue}" error:`, err);
      delete channels[queue];
    });
  }
  return channels[queue];
}

export async function sendToQueue(
  queue: RABBITMQ_QUEUE,
  message: string,
): Promise<void> {
  try {
    const channel = await getChannel(queue);
    const sent = channel.sendToQueue(queue, Buffer.from(message), { persistent: true });
    if (!sent) {
      throw new Error(`Failed to send message to queue "${queue}": sendToQueue returned false`);
    }
    console.log(`Message sent to queue "${queue}": ${message}`);
  } catch (error) {
    console.error(`Error sending to queue "${queue}":`, error);
    throw error;
  }
}

export async function consumeFromQueue(
  queue: RABBITMQ_QUEUE,
  onMessage: (message: amqp.ConsumeMessage | null) => void,
): Promise<void> {
  try {
    const channel = await getChannel(queue);
    // Set prefetch to handle messages one by one (optional but recommended)
    await channel.prefetch(1);
    await channel.consume(queue, (msg) => {
      try {
        onMessage(msg);
        if (msg) channel.ack(msg);
      } catch (err) {
        console.error(`Error processing message from queue "${queue}":`, err);
        if (msg) channel.nack(msg, false, true); // Requeue on error
      }
    });
    console.log(`Started consuming from queue "${queue}"`);
  } catch (error) {
    console.error(`Error starting consumption from queue "${queue}":`, error);
    throw error;
  }
}

async function startQueueConsumers() {
  console.log('Starting queue consumers...');
  // Use Promise.allSettled to ensure we try to start all consumers even if one fails
  await Promise.allSettled([
    bulkResultConsumer.consume(),
    deleteShopConsumer.consume(),
    generateRecoConsumer.consume(),
    scopesUpdateConsumer.consume(),
    subscriptionUpdateConsumer.consume(),
  ]);
  console.log('Queue consumers start attempt finished');
}
