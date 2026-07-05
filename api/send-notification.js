// api/send-notification.js
// Vercel Serverless Function — بتبعت الإشعار الفعلي عن طريق OneSignal REST API.
// المفتاح السري (REST API Key) بيفضل هنا بس على السيرفر، وميظهرش أبدًا في كود المتصفح.
//
// إعداد لازم تعمله في Vercel قبل ما يشتغل:
//   1) روح Settings -> Keys & IDs في لوحة OneSignal وانسخ "REST API Key"
//   2) في مشروعك على vercel.com: Settings -> Environment Variables
//      أضف متغيرين:
//        ONESIGNAL_APP_ID = 29d0183f-e2d9-4d05-bc0c-f364a288763f
//        ONESIGNAL_REST_API_KEY = القيمة اللي نسختها
//   3) لو محتاج تعرف أعضاء الجروب، محتاج كمان:
//        SUPABASE_URL = رابط مشروعك
//        SUPABASE_SERVICE_ROLE_KEY = من Supabase -> Settings -> API -> service_role key
//   4) بعد إضافة المتغيرات، اعمل Redeploy للمشروع من Vercel حتى تُطبَّق.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { toUserId, title, body } = req.body || {};
  if (!toUserId || !body) {
    return res.status(400).json({ error: "Missing toUserId or body" });
  }

  const APP_ID = process.env.ONESIGNAL_APP_ID;
  const REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

  if (!APP_ID || !REST_API_KEY) {
    return res.status(500).json({ error: "OneSignal env vars not configured" });
  }

  try {
    let externalIds = [];

    if (String(toUserId).startsWith("group_")) {
      // رسالة جروب: لازم نجيب كل أعضاء الجروب من Supabase عدا المرسل نفسه
      const groupId = String(toUserId).replace("group_", "");
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!SUPABASE_URL || !SERVICE_KEY) {
        return res.status(500).json({ error: "Supabase env vars not configured" });
      }
      const groupRes = await fetch(
        `${SUPABASE_URL}/rest/v1/groups?id=eq.${groupId}&select=members`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
      );
      const groupData = await groupRes.json();
      externalIds = (groupData?.[0]?.members || []).map(String);
    } else {
      externalIds = [String(toUserId)];
    }

    if (externalIds.length === 0) {
      return res.status(200).json({ skipped: true });
    }

    const oneSignalRes = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Basic ${REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: APP_ID,
        include_aliases: { external_id: externalIds },
        target_channel: "push",
        headings: { en: title || "M-Tech Chat", ar: title || "M-Tech Chat" },
        contents: { en: body, ar: body },
        web_url: "https://mtechchats.vercel.app/",
      }),
    });

    const result = await oneSignalRes.json();
    if (!oneSignalRes.ok) {
      return res.status(oneSignalRes.status).json({ error: result });
    }
    return res.status(200).json({ sent: true, result });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
