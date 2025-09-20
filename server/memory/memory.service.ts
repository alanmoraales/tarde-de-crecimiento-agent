import { JSONFilePreset } from "lowdb/node";
import type { Data, Message } from "@/memory.types";

const getDb = async () =>
  await JSONFilePreset<Data>("db.json", {
    // Legacy structure
    threadId: "",
    messages: [],
    talkInfoGathererThreadId: "",
    nextWeekTalkSpeakerSlackId: "",
    talkInfoGathererMessages: [],

    // New structure
    threads: [],
    nextWeekTalk: {
      speaker: {
        name: "",
        slackUserId: "",
      },
      talk: {
        name: "",
        description: "",
        date: "",
      },
      conversation: {
        speakerMessagesThreadId: "",
        organizationMessagesThreadId: "",
      },
    },
  });

// Talk info gatherer memory
const clearTalkInfoGathererMemory = async () => {
  const db = await getDb();
  db.data.talkInfoGathererThreadId = "";
  db.data.nextWeekTalkSpeakerSlackId = "";
  db.data.talkInfoGathererMessages = [];
  await db.write();
};

const addTalkInfoGathererMessages = async (messages: Message[]) => {
  const db = await getDb();
  db.data.talkInfoGathererMessages.push(...messages);
  await db.write();
};

const getTalkInfoGathererMessages = async () => {
  const db = await getDb();
  return db.data.talkInfoGathererMessages;
};

const setTalkInfoGathererThreadId = async (threadId: string) => {
  const db = await getDb();
  db.data.talkInfoGathererThreadId = threadId;
  await db.write();
};

const getTalkInfoGathererThreadId = async () => {
  const db = await getDb();
  return db.data.talkInfoGathererThreadId;
};

const setNextWeekTalkSpeakerSlackId = async (slackId: string) => {
  const db = await getDb();
  db.data.nextWeekTalkSpeakerSlackId = slackId;
  await db.write();
};

const getNextWeekTalkSpeakerSlackId = async () => {
  const db = await getDb();
  return db.data.nextWeekTalkSpeakerSlackId;
};

// Talk announcement memory
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
  clearTalkInfoGathererMemory,
  addTalkInfoGathererMessages,
  getTalkInfoGathererMessages,
  setTalkInfoGathererThreadId,
  getTalkInfoGathererThreadId,
  setNextWeekTalkSpeakerSlackId,
  getNextWeekTalkSpeakerSlackId,
};

export default memory;
