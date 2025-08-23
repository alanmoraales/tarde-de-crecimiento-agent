import { JSONFilePreset } from "lowdb/node";
import { ModelMessage } from "ai";

type Message = ModelMessage & {
  ts?: string;
};

type Data = {
  threadId: string;
  messages: Message[];
};

export const getDb = async () =>
  await JSONFilePreset<Data>("db.json", { threadId: "", messages: [] });

export const clearMemory = async () => {
  const db = await getDb();
  db.data.messages = [];
  db.data.threadId = "";
  await db.write();
};

export const addMessages = async (messages: Message[]) => {
  const db = await getDb();
  db.data.messages.push(...messages);
  await db.write();
};

export const getMessages = async () => {
  const db = await getDb();
  return db.data.messages;
};

export const setThreadId = async (threadId: string) => {
  const db = await getDb();
  db.data.threadId = threadId;
  await db.write();
};

export const getThreadId = async () => {
  const db = await getDb();
  return db.data.threadId;
};
