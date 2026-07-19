function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function applyInvitationValues(
  html: string,
  values: Record<string, unknown> | null | undefined,
) {
  const rendered = Object.entries(values ?? {}).reduce(
    (result, [key, value]) => {
      if (typeof value !== "string" && typeof value !== "number") return result;
      const pattern = new RegExp(
        `(<[^>]*data-nimto-field=(["'])${escapeRegExp(key)}\\2[^>]*>)(.*?)(<\\/[^>]+>)`,
        "gis",
      );
      return result.replace(pattern, `$1${escapeHtml(String(value))}$4`);
    },
    html,
  );
  const viewport = /name=["']viewport["']/i.test(rendered)
    ? ""
    : '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">';
  const mobileCss = `<style>html,body{max-width:100%;min-height:100%;overflow-x:hidden}img,video{max-width:100%;height:auto}</style>`;
  return /<\/head>/i.test(rendered)
    ? rendered.replace(/<\/head>/i, `${viewport}${mobileCss}</head>`)
    : `${viewport}${mobileCss}${rendered}`;
}
