const express = require('express');
const axios = require('axios');
const app = express();

// Конфиг из переменных окружения Render.com
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const CHANNEL = process.env.CHANNEL; // Например: ninja

// Получаем токен Twitch
async function getToken() {
  const response = await axios.post(`https://id.twitch.tv/oauth2/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`);
  return response.data.access_token;
}

// Проверяем followage
app.get('/followage', async (req, res) => {
  const user = req.query.user;
  const token = await getToken();

  try {
    const response = await axios.get(`https://api.twitch.tv/helix/users/follows?from_id=${user}&to_id=${CHANNEL}`, {
      headers: {
        'Client-ID': CLIENT_ID,
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.data.data.length === 0) {
      return res.send(`${user} не подписан на канал.`);
    }

    const followDate = new Date(response.data.data[0].followed_at);
    const diff = Date.now() - followDate;
    const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365));
    const months = Math.floor((diff % (1000 * 60 * 60 * 24 * 365)) / (1000 * 60 * 60 * 24 * 30));

    res.send(`${user} фолловит канал уже ${years} лет и ${months} месяцев.`);
  } catch (error) {
    res.send('Ошибка :(');
  }
});

// Порт для Render.com
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server started on port ${port}`));