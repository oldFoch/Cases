const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  steamId: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  avatar: { type: String },
  balance: { type: Number, default: 0 },
  isAdmin: { type: Boolean, default: false }, // поле для администратора
  inventory: [
    {
      name: String,
      image: String,
      price: Number,
      wonAt: { type: Date, default: Date.now }
    }
  ],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", userSchema);
