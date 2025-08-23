import { ModelMessage } from "ai";

type Message = ModelMessage & {
  ts?: string;
};

type Data = {
  threadId: string;
  messages: Message[];
};

export type { Message, Data };
