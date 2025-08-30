import { ModelMessage } from "ai";

type Message = ModelMessage & {
  ts?: string;
  threadId?: string;
};

type Data = {
  threadId: string;
  messages: Message[];
  talkInfoGathererThreadId: string;
  nextWeekTalkSpeakerSlackId: string;
  talkInfoGathererMessages: Message[];
};

export type { Message, Data };
