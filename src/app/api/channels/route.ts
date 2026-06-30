/**
 * 消息渠道 — Webhook 统一入口
 * POST /api/channels/webhook
 * 负责接收并解析：企业微信 / 钉钉 / 微信（企微）机器人消息
 */

import { NextRequest, NextResponse } from "next/server";
import { parseChannelMessage, type ChannelType, type IncomingMessage } from "@/lib/channels/types";
import { createServer } from "@/lib/supabase/server";

/**
 * 从请求体解析出渠道类型
 */
function detectChannel(body: Record<string, unknown>): ChannelType | null {
  // 企业微信
  if (body.msgType || body.agentType || (body.fromUser && body.toUser)) return "wecom";
  // 钉钉
  const text = body.text as { content?: string } | undefined;
  if (text?.content || body.chatbotCorpId || body.robotCode) return "dingtalk";
  // 飞书
  if (body.schema || body.header) return "feishu";
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServer();
    const body = await req.json();
    const channel = detectChannel(body);

    if (!channel) {
      return NextResponse.json({ error: "未知渠道" }, { status: 400 });
    }

    // 解析消息
    const msg = parseChannelMessage(channel, body);
    if (!msg) {
      return NextResponse.json({ error: "消息解析失败" }, { status: 400 });
    }

    // 消息去重（60s 内同一 msgId 不重复处理）
    const { data: existing } = await supabase
      .from("channel_messages")
      .select("id")
      .eq("channel_msg_id", msg.channelMsgId)
      .eq("channel", channel)
      .gte("created_at", new Date(Date.now() - 60_000).toISOString())
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ status: "duplicate", ignored: true });
    }

    // 存储消息
    const { error: insertError } = await supabase.from("channel_messages").insert({
      channel: channel,
      channel_msg_id: msg.channelMsgId,
      user_id: msg.userId,
      user_name: msg.userName,
      content: msg.content,
      raw: msg.raw,
      created_at: new Date(msg.timestamp).toISOString(),
    });

    if (insertError) {
      console.error("channel_messages insert error:", insertError);
    }

    // TODO: 触发 AI 处理管道（消息 → Agent → 回复）
    // 这部分后续与 OpenClaw Agent 集成

    return NextResponse.json({ status: "received", channel, msgId: msg.channelMsgId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET：验证回调 URL（企业微信/钉钉需要 GET 验证）
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const echostr = searchParams.get("echostr");    // 企业微信
  const msg_signature = searchParams.get("msg_signature"); // 钉钉

  if (echostr) {
    // 企业微信回调验证，直接透传
    return new NextResponse(echostr, { status: 200 });
  }

  if (msg_signature) {
    // 钉钉回调验证
    return NextResponse.json({ status: "ok" });
  }

  return NextResponse.json({ status: "channel webhook endpoint" });
}
