const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: {
    type: String,
    enum: ["deposit", "case_open", "sell", "withdraw"],
    required: true
  },
  amount: Number, // сумма списания/пополнения
  item: {
    caseName: String,  // название кейса
    name: String,      // название выпавшего предмета
    image: String,     // ссылка на изображение предмета
    price: Number      // цена выпавшего предмета
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Transaction", transactionSchema);
