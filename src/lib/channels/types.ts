/**
 * 消息渠道 — 统一类型定义
 * 企业微信 / 钉钉 / 微信 / 飞书 / Slack / Telegram
 */

export type ChannelType = "wecom" | "dingtalk" | "wechat" | "feishu" | "slack" | "telegram";

export interface ChannelConfig {
  type: ChannelType;
  name: string;
  enabled: boolean;
  webhookUrl?: string;       // 机器人 Webhook 地址
  agentId?: string;          // 企业微信 AgentID / 钉钉 AgentID
  corpId?: string;           // 企业 ID
  appKey?: string;           // 钉钉 AppKey
  appSecret?: string;        // 钉钉 AppSecret（加密存储）
  token?: string;           // 回调验证 Token
  encodingAesKey?: string;  // 回调加密 Key
  botToken?: string;         // Telegram Bot Token
  slackBotToken?: string;    // Slack Bot Token
  signingSecret?: string;    // Slack Signing Secret
}

export interface IncomingMessage {
  channel: ChannelType;
  channelMsgId: string;     // 渠道原消息 ID
  userId: string;           // 发送者 ID（渠道原生）
  userName: string;
  content: string;          // 消息正文
  raw: Record<string, unknown>; // 渠道原始消息体
  timestamp: number;
}

export interface OutgoingMessage {
  channel: ChannelType;
  userId: string;
  content: string;
  atUsers?: string[];       // 需要 @ 的用户
}

export interface ChannelResponse {
  success: boolean;
  channelMsgId?: string;
  error?: string;
}

// ── 企业微信事件解析 ────────────────────────────────────
export function parseWecomEvent(body: Record<string, unknown>): IncomingMessage | null {
  if (body.msgType === "text" && body.content) {
    return {
      channel: "wecom",
      channelMsgId: String(body.msgId || Date.now()),
      userId: String(body.fromUser || body.userId || ""),
      userName: String(body.fromUsername || ""),
      content: String(body.content),
      raw: body,
      timestamp: Number(body.createTime || Date.now()),
    };
  }
  return null;
}

// ── 钉钉事件解析 ────────────────────────────────────────
export function parseDingtalkEvent(body: Record<string, unknown>): IncomingMessage | null {
  const content = body.text?.content || body.content;
  if (content) {
    return {
      channel: "dingtalk",
      channelMsgId: String(body.msgId || body.messageId || Date.now()),
      userId: String(body.senderNick || body.userId || ""),
      userName: String(body.senderNick || ""),
      content: String(content),
      raw: body,
      timestamp: Number(body.createAt || Date.now()),
    };
  }
  return null;
}

// ── 统一消息入口 ────────────────────────────────────────
export function parseChannelMessage(
  channel: ChannelType,
  body: Record<string, unknown>
): IncomingMessage | null {
  switch (channel) {
    case "wecom": return parseWecomEvent(body);
    case "dingtalk": return parseDingtalkEvent(body);
    default:
      // 通用兜底：尝试取 text/content 字段
      const text = body.text as string || body.content as string || body.message as string;
      if (text) {
        return {
          channel,
          channelMsgId: String(body.msgId || body.messageId || Date.now()),
          userId: String(body.userId || body.fromUser || "unknown"),
          userName: String(body.userName || body.fromUsername || "Unknown"),
          content: text,
          raw: body,
          timestamp: Number(body.timestamp || body.createTime || Date.now()),
        };
      }
      return null;
  }
}
