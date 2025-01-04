import amqp from "amqplib";
import * as deleteShopConsumer from "./consumers/delete-shop.server";
import * as generateRecoConsumer from "./consumers/generate-reco.server";
import * as scopesUpdateConsumer from "./consumers/scopes-update.server";

declare global {
  var rabbitmqConnection: amqp.Connection | undefined;
}

type RABBITMQ_QUEUE = "delete_shop" | "generate_reco" | "scopes_update";

let connection: amqp.Connection;
const channels: Record<RABBITMQ_QUEUE, amqp.Channel> = {
  delete_shop: null as unknown as amqp.Channel,
  generate_reco: null as unknown as amqp.Channel,
  scopes_update: null as unknown as amqp.Channel,
};

export async function getRabbitMQConnection(): Promise<amqp.Connection> {
  if (!connection) {
    const url = process.env.RABBITMQ_URL;
    if (!url) throw new Error("RABBITMQ_URL is not set");

    connection = await amqp.connect(url);
    console.log("RabbitMQ connected successfully");

    // Handle connection close gracefully
    connection.on("close", () => {
      console.error("RabbitMQ connection closed");
      connection = undefined as unknown as amqp.Connection; // Reset connection
    });

    // Handle connection errors
    connection.on("error", (error) => {
      console.error("RabbitMQ connection error:", error);
    });

    await startQueueConsumers();
  }
  return connection;
}

async function getChannel(
  queue: RABBITMQ_QUEUE,
): Promise<amqp.Channel> {
  if (!channels[queue]) {
    const conn = await getRabbitMQConnection();
    const channel = await conn.createChannel();
    await channel.assertQueue(queue, { durable: true });
    channels[queue] = channel;
    console.log(`Channel created and queue asserted for "${queue}"`);
  }
  return channels[queue];
}

export async function sendToQueue(
  queue: RABBITMQ_QUEUE,
  message: string,
): Promise<void> {
  const channel = await getChannel(queue);
  channel.sendToQueue(queue, Buffer.from(message));
  console.log(`Message sent to queue "${queue}": ${message}`);
}

export async function consumeFromQueue(
  queue: RABBITMQ_QUEUE,
  onMessage: (message: amqp.ConsumeMessage | null) => void,
): Promise<void> {
  const channel = await getChannel(queue);
  await channel.consume(queue, (msg) => {
    onMessage(msg);
    if (msg) channel.ack(msg);
  });
  console.log(`Started consuming from queue "${queue}"`);
}

async function startQueueConsumers() {
  try {
    await deleteShopConsumer.consume();
    await generateRecoConsumer.consume();
    await scopesUpdateConsumer.consume();
    console.log('Queue consumers started successfully');
  } catch (error) {
    console.error('Error starting queue consumers:', error);
  }
}
