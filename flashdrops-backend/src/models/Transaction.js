const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: {
    type: String,
    enum: ["deposit", "case_open", "sell", "withdraw"],
    required: true
  },
  amount: Number, // сумма пополнения / продажи
  item: {
    name: String,
    image: String,
    price: Number
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Transaction", transactionSchema);
