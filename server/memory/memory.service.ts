import { JSONFilePreset } from "lowdb/node";
import type { Data, Message } from "@/memory.types";

const getDb = async () =>
  await JSONFilePreset<Data>("db.json", { threadId: "", messages: [] });

const clearMemory = async () => {
  const db = await getDb();
  db.data.messages = [];
  db.data.threadId = "";
  await db.write();
};

const addMessages = async (messages: Message[]) => {
  const db = await getDb();
  db.data.messages.push(...messages);
  await db.write();
};

const getMessages = async () => {
  const db = await getDb();
  return db.data.messages;
};

const setThreadId = async (threadId: string) => {
  const db = await getDb();
  db.data.threadId = threadId;
  await db.write();
};

const getThreadId = async () => {
  const db = await getDb();
  return db.data.threadId;
};

const memory = {
  clear: clearMemory,
  addMessages,
  getMessages,
  setThreadId,
  getThreadId,
};

export default memory;
