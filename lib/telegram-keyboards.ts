// lib/telegram-keyboards.ts — Inline keyboard builders for @IntegraWatchBot

type InlineButton = {
  text: string;
  callback_data?: string;
  url?: string;
};
type InlineKeyboard = { inline_keyboard: InlineButton[][] };

export function overviewKeyboard(
  categoryCounts: Record<string, { up: number; total: number }>,
): InlineKeyboard {
  const catEmojis: Record<string, string> = {
    blockchain: "\uD83D\uDFE2",
    validators: "\u26A1",
    apis: "\uD83D\uDD27",
    frontends: "\uD83C\uDF10",
    external: "\uD83D\uDD17",
  };

  const buttons: InlineButton[] = Object.entries(categoryCounts).map(
    ([cat, { up, total }]) => ({
      text: `${catEmojis[cat] ?? "\uD83D\uDCE6"} ${capitalize(cat)} (${up}/${total})`,
      callback_data: `cat:${cat}`,
    }),
  );

  // 2-column layout + refresh button
  const rows: InlineButton[][] = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }
  rows.push([{ text: "\uD83D\uDD04 Refresh", callback_data: "refresh" }]);
  return { inline_keyboard: rows };
}

export function categoryKeyboard(
  category: string,
  results: Array<{ id: string; name: string; status: string }>,
): InlineKeyboard {
  const rows: InlineButton[][] = results.map((r) => [
    {
      text: `${r.status === "UP" ? "\uD83D\uDFE2" : r.status === "DEGRADED" ? "\uD83D\uDFE1" : "\uD83D\uDD34"} ${r.name}`,
      callback_data: `ep:${r.id}`,
    },
  ]);
  rows.push([
    { text: "\u25C0 Back to Overview", callback_data: "back:overview" },
    { text: "\uD83D\uDD04 Refresh", callback_data: "refresh" },
  ]);
  return { inline_keyboard: rows };
}

export function endpointKeyboard(
  _endpointId: string,
  links: { endpoint: string; docs?: string; repo?: string },
  category: string,
): InlineKeyboard {
  const topRow: InlineButton[] = [
    { text: "\uD83D\uDD17 Open Endpoint", url: links.endpoint },
  ];
  if (links.docs) topRow.push({ text: "\uD83D\uDCC4 Docs", url: links.docs });
  if (links.repo) topRow.push({ text: "\uD83D\uDCBB Repo", url: links.repo });

  return {
    inline_keyboard: [
      topRow,
      [
        {
          text: `\u25C0 Back to ${capitalize(category)}`,
          callback_data: `back:cat:${category}`,
        },
        {
          text: "\uD83D\uDD04 Re-check",
          callback_data: `recheck:${_endpointId}`,
        },
      ],
    ],
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
