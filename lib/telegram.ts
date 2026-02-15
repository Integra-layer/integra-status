// lib/telegram.ts — Telegram Bot API wrapper for @IntegraWatchBot

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

type InlineKeyboard = {
  inline_keyboard: Array<
    Array<{ text: string; callback_data?: string; url?: string }>
  >;
};

export async function sendMessage(
  chatId: string | number,
  text: string,
  parseMode: "HTML" | "Markdown" = "HTML",
  replyMarkup?: InlineKeyboard,
): Promise<void> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
    disable_web_page_preview: true,
  };
  if (replyMarkup) body.reply_markup = replyMarkup;

  const res = await fetch(`${API_BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`Telegram sendMessage failed: ${err}`);
  }
}

export async function editMessage(
  chatId: string | number,
  messageId: number,
  text: string,
  parseMode: "HTML" | "Markdown" = "HTML",
  replyMarkup?: InlineKeyboard,
): Promise<void> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: parseMode,
    disable_web_page_preview: true,
  };
  if (replyMarkup) body.reply_markup = replyMarkup;

  await fetch(`${API_BASE}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
): Promise<void> {
  await fetch(`${API_BASE}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

export async function setWebhook(
  url: string,
  secret: string,
): Promise<void> {
  await fetch(`${API_BASE}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, secret_token: secret }),
  });
}

export async function deleteWebhook(): Promise<void> {
  await fetch(`${API_BASE}/deleteWebhook`, { method: "POST" });
}

export async function setMyCommands(
  commands: Array<{ command: string; description: string }>,
): Promise<void> {
  await fetch(`${API_BASE}/setMyCommands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commands }),
  });
}
