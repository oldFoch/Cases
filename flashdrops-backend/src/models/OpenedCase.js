// flashdrops-backend/src/models/OpenedCase.js
const mongoose = require("mongoose");

const openedCaseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: "Case", required: true },
  droppedItem: {
    name: String,
    image: String,
    price: Number,
    chance: Number
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("OpenedCase", openedCaseSchema);
