import type { NodeHandler } from "./types";

export const handlers: Record<string, NodeHandler> = {
  "action_kafka": async ({ config, ctx }) => {
    const { Kafka, logLevel } = await import("kafkajs");
    const kfAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
    const kfInterp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), kfAllData);
        if (val !== undefined) return String(val);
        if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
        return "";
      });

    const brokers = String(config.brokers || "").split(",").map((b) => b.trim()).filter(Boolean);
    const ssl = String(config.ssl) === "true";
    const saslMechanism = String(config.sasl_mechanism || "none");

    const kafkaConfig: Record<string, unknown> = {
      clientId: String(config.client_id || "workflow-node"),
      brokers,
      ssl,
      logLevel: logLevel.ERROR,
    };
    if (saslMechanism !== "none" && config.sasl_username) {
      kafkaConfig.sasl = {
        mechanism: saslMechanism,
        username: String(config.sasl_username),
        password: String(config.sasl_password || ""),
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kafka = new Kafka(kafkaConfig as any);
    const topic = kfInterp(String(config.topic || ""));
    const action = String(config.action || "produce");

    if (action === "produce") {
      const producer = kafka.producer();
      await producer.connect();
      try {
        const message: Record<string, unknown> = { value: kfInterp(String(config.message || "")) };
        if (config.key) message.key = kfInterp(String(config.key));
        if (config.partition !== undefined && config.partition !== "") message.partition = Number(config.partition);
        const result = await producer.send({ topic, messages: [message as { key?: string; value: string; partition?: number }] });
        return { topic, sent: true, metadata: result };
      } finally {
        await producer.disconnect();
      }
    } else {
      // consume: fetch latest N messages using admin + offset seek
      const consumer = kafka.consumer({ groupId: String(config.group_id || "workflow-consumer") });
      await consumer.connect();
      try {
        await consumer.subscribe({ topic, fromBeginning: false });
        const messages: unknown[] = [];
        const maxMessages = Number(config.num_messages || 10);
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => resolve(), 8000);
          consumer.run({
            eachMessage: async ({ message: msg }) => {
              messages.push({ key: msg.key?.toString(), value: msg.value?.toString(), offset: msg.offset, timestamp: msg.timestamp });
              if (messages.length >= maxMessages) { clearTimeout(timer); resolve(); }
            },
          }).catch((err) => { clearTimeout(timer); reject(err); });
        });
        return { topic, messages, count: messages.length };
      } finally {
        await consumer.disconnect();
      }
    }
  },

  "action_mqtt": async ({ config, ctx }) => {
    const mqttLib = await import("mqtt");
    const mqAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
    const mqInterp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), mqAllData);
        if (val !== undefined) return String(val);
        if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
        return "";
      });

    const brokerUrl = mqInterp(String(config.broker_url || ""));
    const topic = mqInterp(String(config.topic || ""));
    const qos = Number(config.qos || 0) as 0 | 1 | 2;
    const action = String(config.action || "publish");
    const clientOpts: Record<string, unknown> = {};
    if (config.client_id) clientOpts.clientId = mqInterp(String(config.client_id));
    if (config.username) clientOpts.username = String(config.username);
    if (config.password) clientOpts.password = String(config.password);

    const client = mqttLib.connect(brokerUrl, clientOpts as Parameters<typeof mqttLib.connect>[1]);

    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { client.end(true); reject(new Error("MQTT timeout")); }, Number(config.timeout || 10000));

      client.on("error", (err) => { clearTimeout(timeout); client.end(true); reject(err); });
      client.on("connect", () => {
        if (action === "publish") {
          const payload = mqInterp(String(config.payload || ""));
          const retain = String(config.retain) === "true";
          client.publish(topic, payload, { qos, retain }, (err) => {
            clearTimeout(timeout);
            client.end();
            if (err) reject(err);
            else resolve({ topic, published: true, payload });
          });
        } else {
          client.subscribe(topic, { qos }, (err) => {
            if (err) { clearTimeout(timeout); client.end(true); reject(err); return; }
            client.on("message", (t, msg) => {
              clearTimeout(timeout);
              client.end();
              let parsed: unknown = msg.toString();
              try { parsed = JSON.parse(msg.toString()); } catch { /* keep as string */ }
              resolve({ topic: t, payload: parsed, raw: msg.toString() });
            });
          });
        }
      });
    });
  },

  "action_rabbitmq": async ({ config, ctx }) => {
    const amqp = await import("amqplib");
    const rmqAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
    const rmqInterp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), rmqAllData);
        if (val !== undefined) return String(val);
        if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
        return "";
      });

    const url = String(config.url || "amqp://localhost");
    const action = String(config.action || "publish");
    const conn = await amqp.connect(url);
    try {
      const ch = await conn.createChannel();
      const durable = String(config.durable) !== "false";
      const persistent = String(config.persistent) !== "false";

      if (action === "publish") {
        const exchange = rmqInterp(String(config.exchange || ""));
        const routingKey = rmqInterp(String(config.routing_key || ""));
        const body = rmqInterp(String(config.message || "{}"));
        const exchangeType = String(config.exchange_type || "direct");
        await ch.assertExchange(exchange, exchangeType, { durable });
        ch.publish(exchange, routingKey, Buffer.from(body), { persistent });
        await ch.close();
        return { exchange, routingKey, published: true };
      } else if (action === "send_to_queue") {
        const queue = rmqInterp(String(config.queue || ""));
        const body = rmqInterp(String(config.message || "{}"));
        await ch.assertQueue(queue, { durable });
        ch.sendToQueue(queue, Buffer.from(body), { persistent });
        await ch.close();
        return { queue, sent: true };
      } else if (action === "consume") {
        const queue = rmqInterp(String(config.queue || ""));
        await ch.assertQueue(queue, { durable });
        const msg = await ch.get(queue, { noAck: true });
        await ch.close();
        if (msg) {
          const body = msg.content.toString();
          let parsed: unknown = body;
          try { parsed = JSON.parse(body); } catch { /* keep as string */ }
          return { queue, message: parsed, raw: body, fields: msg.fields };
        } else {
          return { queue, message: null, empty: true };
        }
      } else if (action === "assert_queue") {
        const queue = rmqInterp(String(config.queue || ""));
        const info = await ch.assertQueue(queue, { durable });
        await ch.close();
        return { queue: info.queue, messageCount: info.messageCount, consumerCount: info.consumerCount };
      }
      await ch.close();
    } finally {
      await conn.close();
    }
    return undefined;
  },

  "action_nats": async ({ config, ctx }) => {
    const natsLib = await import("nats");
    const ntAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
    const ntInterp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), ntAllData);
        if (val !== undefined) return String(val);
        if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
        return "";
      });

    const servers = String(config.servers || "nats://localhost:4222").split(",").map((s) => s.trim());
    const connOpts: Record<string, unknown> = { servers };
    if (config.username) connOpts.user = String(config.username);
    if (config.password) connOpts.pass = String(config.password);
    if (config.token) connOpts.token = String(config.token);

    const nc = await natsLib.connect(connOpts as Parameters<typeof natsLib.connect>[0]);
    try {
      const sc = natsLib.StringCodec();
      const subject = ntInterp(String(config.subject || ""));
      const payload = ntInterp(String(config.payload || ""));
      const action = String(config.action || "publish");

      if (action === "publish") {
        nc.publish(subject, sc.encode(payload));
        await nc.flush();
        return { subject, published: true, payload };
      } else {
        // request-reply
        const timeoutMs = Number(config.timeout || 5000);
        const msg = await nc.request(subject, sc.encode(payload), { timeout: timeoutMs });
        const replyStr = sc.decode(msg.data);
        let replyParsed: unknown = replyStr;
        try { replyParsed = JSON.parse(replyStr); } catch { /* keep as string */ }
        return { subject, reply: replyParsed, raw: replyStr };
      }
    } finally {
      await nc.drain();
    }
  },
};
