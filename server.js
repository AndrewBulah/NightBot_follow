const express = require('express');
const axios = require('axios');
const app = express();

// Конфиг из переменных окружения
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const CHANNEL = process.env.CHANNEL.toLowerCase(); // Логин всегда в lowercase

// Получаем токен Twitch с обработкой ошибок
async function getToken() {
  try {
    const response = await axios.post(
      `https://id.twitch.tv/oauth2/token`,
      null,
      {
        params: {
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: 'client_credentials'
        }
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error('Ошибка получения токена:', error.response?.data);
    throw error;
  }
}

// Конвертируем логин в ID пользователя
async function getUserId(login) {
  try {
    const token = await getToken();
    const response = await axios.get('https://api.twitch.tv/helix/users', {
      params: { login },
      headers: {
        'Client-ID': CLIENT_ID,
        'Authorization': `Bearer ${token}`
      }
    });
    return response.data.data[0]?.id;
  } catch (error) {
    console.error('Ошибка получения ID:', error);
    return null;
  }
}

app.get('/followage', async (req, res) => {
  try {
    const userLogin = req.query.user?.trim();
    if (!userLogin) return res.status(400).send('Укажите параметр ?user=ник');

    // Получаем ID пользователя и канала
    const [userId, channelId] = await Promise.all([
      getUserId(userLogin),
      getUserId(CHANNEL)
    ]);

    if (!userId || !channelId) {
      return res.status(404).send('Пользователь не найден');
    }

    // Запрос данных о фолловере
    const token = await getToken();
    const response = await axios.get('https://api.twitch.tv/helix/users/follows', {
      params: {
        from_id: userId,
        to_id: channelId
      },
      headers: {
        'Client-ID': CLIENT_ID,
        'Authorization': `Bearer ${token}`
      }
    });

    // Обработка результата
    if (!response.data.data.length) {
      return res.send(`${userLogin} не подписан на канал.`);
    }

    const followDate = new Date(response.data.data[0].followed_at);
    const now = new Date();
    const diff = now - followDate;
    
    const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365));
    const months = Math.floor((diff % (1000 * 60 * 60 * 24 * 365)) / (1000 * 60 * 60 * 24 * 30));

    res.send(`${userLogin} фолловит канал уже ${years} лет и ${months} месяцев.`);
  } catch (error) {
    console.error('Ошибка:', error.response?.data || error.message);
    res.status(500).send('Ошибка сервера');
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server started on port ${port}`));
