export type SocialChannel = 'facebook' | 'instagram' | 'zalo';

export interface AgentChatInput {
  userId: string;
  channel: SocialChannel;
  channelId: string;
  threadId: string;
  question: string;
}

export interface AgentChatRequest {
  user_id: string;
  channel: SocialChannel;
  channel_id: string;
  thread_id: string;
  session_id: string;
  question: string;
}

export interface AgentChatResponse {
  user_id: string;
  channel: SocialChannel;
  channel_id: string;
  thread_id: string;
  session_id: string;
  answer: string;
}
