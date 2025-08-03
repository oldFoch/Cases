const mongoose = require("mongoose");

const caseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: String, // ссылка на изображение кейса
  price: { type: Number, required: true },
  items: [
    {
      name: String,
      image: String,
      price: Number,
      chance: Number // шанс выпадения (в %)
    }
  ]
});

module.exports = mongoose.model("Case", caseSchema);
