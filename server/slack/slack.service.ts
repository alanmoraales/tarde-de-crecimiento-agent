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

const sendDirectMessage = async (
  userId: string,
  ts: string,
  message: string
) => {
  console.log("Sending direct message to userId", userId, "with ts", ts);
  return await slack.chat.postMessage({
    channel: userId,
    thread_ts: ts,
    markdown_text: message,
  });
};

const sendNewDirectMessage = async (userId: string, message: string) => {
  console.log("Sending new direct message to userId", userId);
  return await slack.chat.postMessage({
    channel: userId,
    markdown_text: message,
  });
};

const isMessageFromAgent = (userId: string) => {
  return userId === environment.slack.agentUserId;
};

const isDirectMessage = (channelType: string) => {
  return channelType === "im";
};

export default {
  sendMessageToGrowthChannel,
  sendMessageToGrowthSquadChannel,
  isMessageFromAgent,
  isDirectMessage,
  sendDirectMessage,
  sendNewDirectMessage,
};
