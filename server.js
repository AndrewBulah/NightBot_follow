const express = require('express');
const axios = require('axios');
const app = express();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const CHANNEL = process.env.CHANNEL.toLowerCase();

// Улучшенное склонение слов
function pluralize(num, words) {
  const cases = [2, 0, 1, 1, 1, 2];
  return words[(num % 100 > 4 && num % 100 < 20) ? 2 : cases[Math.min(num % 10, 5)]];
}

// Генератор фраз для фолловеров
function generateFollowMessage(months, days) {
  const messages = [
    { days: 0, text: 'Здарова, залётный! Ты только что присоединился!' },
    { days: 1, text: 'Первый день на корабле! Не урони наш челлендж!' },
    { days: 7, text: 'Неделя в эфире! Ты уже местный завсегдатай!' },
    { months: 1, text: 'Месяц херачишь в чате, фрик! Продолжаем!' },
    { months: 3, text: 'Три месяца! Стримерша уже стала твоей подругой?' },
    { months: 6, text: 'Полгода! Тебе пора вводить абонемент!' },
    { years: 1, text: 'Год на цепи в подвале! Красавчик!' },
    { default: 'Спасибо, что отслеживаешь канал!' }
  ];

  const found = messages.find(m => 
    (m.days !== undefined && days >= m.days) ||
    (m.months !== undefined && months >= m.months) ||
    (m.years !== undefined && Math.floor(months/12) >= m.years)
  );
  
  return found ? found.text : messages.find(m => m.default).text;
}

async function getToken() {
  try {
    console.log('Запрос токена с CLIENT_ID:', process.env.CLIENT_ID);
    const response = await axios.post(
      'https://id.twitch.tv/oauth2/token',
      null,
      { 
        params: { 
          client_id: CLIENT_ID, 
          client_secret: CLIENT_SECRET,
          grant_type: 'client_credentials' 
        } 
      }
    );
    console.log('Токен получен:', response.data.access_token);
    return response.data.access_token;
  } catch (error) {
    console.error('Ошибка получения токена:', error.response?.data);
    throw error;
  }
}

async function getUserId(login) {
  try {
    const token = await getToken();
    console.log('Запрос ID для логина:', login);
    const response = await axios.get('https://api.twitch.tv/helix/users', {
      params: { login: login.toLowerCase() },
      headers: { 
        'Client-ID': CLIENT_ID, 
        'Authorization': `Bearer ${token}` 
      }
    });
    console.log('Ответ от Twitch (getUserId):', response.data);
    return response.data.data[0]?.id;
  } catch (error) {
    console.error('Ошибка получения ID:', error.response?.data || error.message);
    return null;
  }
}

app.get('/followage', async (req, res) => {
  try {
    const userLogin = req.query.user?.trim().toLowerCase();
    if (!userLogin) return res.status(400).send('Укажи ник, лузер!');

    const [userId, channelId] = await Promise.all([
      getUserId(userLogin),
      getUserId(CHANNEL)
    ]);

    if (!userId || !channelId) {
      return res.send(`🌀 ${userLogin} ещё не попал на цепь в подвале стримера...`);
    }

    const token = await getToken();
    // Исправленный эндпоинт и параметры
    const response = await axios.get('https://api.twitch.tv/helix/channels/followers', {
      params: { 
        broadcaster_id: channelId,  // Новый параметр
        user_id: userId            // Новый параметр
      },
      headers: { 
        'Client-ID': CLIENT_ID, 
        'Authorization': `Bearer ${token}` 
      }
    });

    if (!response.data.data.length) {
      return res.send(`🌌 ${userLogin} не числится в рядах наших подвальных фанатов!`);
    }

    const followDate = new Date(response.data.data[0].followed_at);
    const diff = Date.now() - followDate.getTime();
    
    const timeUnits = [
      { unit: 'год', divisor: 31536000000 },
      { unit: 'месяц', divisor: 2592000000 },
      { unit: 'недел', divisor: 604800000 },
      { unit: 'день', divisor: 86400000 },
      { unit: 'час', divisor: 3600000 },
      { unit: 'минут', divisor: 60000 }
    ];

    let result = [];
    let remaining = diff;
    
    const totalDays = Math.floor(diff / 86400000);
    const months = Math.floor(totalDays / 30);
    const days = totalDays % 30;

    for (const { unit, divisor } of timeUnits) {
      const value = Math.floor(remaining / divisor);
      if (value > 0) {
        const pluralized = unit === 'месяц' 
          ? pluralize(value, ['месяц', 'месяца', 'месяцев'])
          : pluralize(value, [unit + 'а', unit + 'ы', unit]);
        
        result.push(`${value} ${pluralized}`);
        remaining -= value * divisor;
      }
    }

    const timeString = result.slice(0, 2).join(', ');
    const customMessage = generateFollowMessage(months, days);

    res.send(
      `✨ ${userLogin} в наших сетях уже ${timeString}!\n` +
      `${customMessage}`
    );
    
  } catch (error) {
    console.error('Космическая аномалия:', error.response?.data || error.message);
    res.send('⚠️ Чёт сломалось... Зайди позже, ок?');
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Сервер запущен на порту ${port}`));
