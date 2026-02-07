import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());

// Environment variables (Railway me set karna)
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.error("BOT_TOKEN aur CHAT_ID environment variables set karo!");
  process.exit(1);
}

// Multi-user mapping
let userMap = {}; // user -> { message_id, reply }

// -------------------- API Endpoint --------------------
app.get("/ask", async (req, res) => {
  const user = req.query.user || "anonymous";
  const text = req.query.text;

  if (!text) return res.json({ error: "No query provided" });

  try {
    // Send /tg <query> to Telegram group
    const sendRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: `/tg ${text}`
      })
    });

    const sendData = await sendRes.json();
    const messageId = sendData.result.message_id;

    // Store message_id for this user
    userMap[user] = { message_id: messageId, reply: null };

    // Wait for reply (polling)
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;

      const updatesRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`);
      const updatesData = await updatesRes.json();

      if (updatesData.result.length > 0) {
        updatesData.result.forEach((upd) => {
          if (upd.message && upd.message.reply_to_message) {
            const repliedId = upd.message.reply_to_message.message_id;
            for (let u in userMap) {
              if (userMap[u].message_id === repliedId) {
                userMap[u].reply = upd.message.text;
              }
            }
          }
        });
      }

      if (userMap[user].reply || attempts > 10) { // max 20 sec wait
        clearInterval(interval);
        return res.json({ reply: userMap[user].reply || "No reply yet" });
      }

    }, 2000);

  } catch (err) {
    console.error(err);
    res.json({ error: "Something went wrong" });
  }
});

// -------------------- Start Server --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
