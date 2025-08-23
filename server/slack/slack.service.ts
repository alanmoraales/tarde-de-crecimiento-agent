import { WebClient } from "@slack/web-api";
import environment from "@/environment.service";

const slack = new WebClient(environment.slack.agentToken);

const sendMessageToGrowthSquadChannel = async (
  message: string,
  threadId?: string
) => {
  return await slack.chat.postMessage({
    channel: environment.slack.growthSquadChannelId,
    markdown_text: message,
    thread_ts: threadId,
  });
};

const sendMessageToGrowthChannel = async (message: string) => {
  return await slack.chat.postMessage({
    channel: environment.slack.growthChannelId,
    markdown_text: message,
  });
};

const isMessageFromAgent = (userId: string) => {
  return userId === environment.slack.agentUserId;
};

export default {
  sendMessageToGrowthChannel,
  sendMessageToGrowthSquadChannel,
  isMessageFromAgent,
};
