// flashdrops-backend/scripts/addCase.js

const mongoose = require('mongoose');
require('dotenv').config();
const Case = require('../src/models/Case');

(async () => {
  // Подключаемся к базе
  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  // Создаём новый кейс
  const newCase = new Case({
    name: "ИЗИ ЛУТ",
    image: "https://sdmntprukwest.oaiusercontent.com/files/00000000-9b24-6243-9998-173334316ee7/raw?se=2025-08-03T20%3A34%3A49Z&sp=r&sv=2024-08-04&sr=b&scid=357142e8-ebb8-5cbd-992a-fb0c7d7d8e6a&skoid=8e0fb8a9-6beb-4b32-9eda-253f61890767&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2025-08-03T20%3A17%3A16Z&ske=2025-08-04T20%3A17%3A16Z&sks=b&skv=2024-08-04&sig=VYprLBz1pFOmwWmWRCgYpzH6gho5Bm%2BZDpFBjj9R1Ss%3D",
    price: 250,
    items: [
      {
        name: "М4A1-S ПИЗДА",
        image: "https://avatars.mds.yandex.net/i?id=eb9ccee07e91f138a7b3c1c73abe88456289d1c6-5508813-images-thumbs&n=13",
        price: 100,
        chance: 50
      },
      {
        name: "AWP УДАР ПО ЯИЦАМ",
        image: "https://avatars.mds.yandex.net/i?id=9d1cccb84ba7c1089af16deb4d61e4daf2c84705-4429870-images-thumbs&n=13",
        price: 200,
        chance: 30
      },
      {
        name: "АК47 ЯИЧНАЯ ЗАЛУПКА",
        image: "https://images.cybersport.ru/images/og-jpg/plain/4f/4f9585b0-dc0d-4218-9b7d-fa5b75b0e1dd.png",
        price: 500,
        chance: 20
      }
    ]
  });

  // Сохраняем в базе
  await newCase.save();
  console.log("✅ Кейс добавлен:", newCase);

  // Отключаемся
  await mongoose.disconnect();
})();
