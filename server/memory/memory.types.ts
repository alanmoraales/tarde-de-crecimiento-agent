import { ModelMessage } from "ai";

type Message = ModelMessage & {
  timestamp?: string; // useful to know when the message was sent
  slackUserId?: string; // useful for channel messages in order to know the user
};

type MessagesThread = {
  id: string;
  source: "direct" | "channel";
  threadId: string;
  messages: Message[];
  slackUserId?: string; // useful for direct messages
  channelId?: string; // useful for channel messages
};

type NextWeekTalk = {
  speaker: {
    name: string;
    slackUserId: string;
  };
  talk: {
    name: string;
    description: string;
    date: string;
  };
  conversation: {
    speakerMessagesThreadId: string;
    organizationMessagesThreadId: string;
  };
};

type Data = {
  // Legacy structure
  threadId: string;
  messages: Message[];
  talkInfoGathererThreadId: string;
  nextWeekTalkSpeakerSlackId: string;
  talkInfoGathererMessages: Message[];

  // New structure
  threads: MessagesThread[];
  nextWeekTalk: NextWeekTalk;
};

export type { Message, Data };
