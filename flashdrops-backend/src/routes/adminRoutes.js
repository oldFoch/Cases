const express = require("express");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const Case = require("../models/Case");
const WithdrawRequest = require("../models/WithdrawRequest");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

const router = express.Router();

router.post("/cases", auth, admin, async (req, res) => {
  try {
    const newCase = new Case(req.body);
    await newCase.save();
    res.json({ message: "✅ Case created", case: newCase });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/cases/:id", auth, admin, async (req, res) => {
  try {
    await Case.findByIdAndDelete(req.params.id);
    res.json({ message: "🗑 Case deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/withdrawals", auth, admin, async (req, res) => {
  try {
    const requests = await WithdrawRequest.find().populate("userId", "username email");
    res.json({ withdrawals: requests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/withdrawals/:id/status", auth, admin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const request = await WithdrawRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: "Withdraw request not found" });

    request.status = status;
    await request.save();

    res.json({ message: "✅ Status updated", request });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/stats", auth, admin, async (req, res) => {
  try {
    const [usersCount, withdrawsCount] = await Promise.all([
      User.countDocuments(),
      WithdrawRequest.countDocuments()
    ]);

    const [deposits, sells, transactions] = await Promise.all([
      Transaction.aggregate([
        { $match: { type: "deposit" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),
      Transaction.aggregate([
        { $match: { type: "sell" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),
      Transaction.find({ type: "case_open" })
    ]);

    const totalDeposited = deposits[0]?.total || 0;
    const totalSold = sells[0]?.total || 0;

    const caseStats = {};
    for (const tx of transactions) {
      const item = tx.item;
      const name = item?.case || "Unknown";
      if (!caseStats[name]) {
        caseStats[name] = { opens: 0, totalPaid: 0, totalDropValue: 0 };
      }
      caseStats[name].opens += 1;
      caseStats[name].totalPaid += item?.price || 0;
      caseStats[name].totalDropValue += item?.dropPrice || 0;
    }

    const caseDetails = Object.entries(caseStats).map(([name, stats]) => ({
      case: name,
      opens: stats.opens,
      revenue: stats.totalPaid,
      dropped: stats.totalDropValue,
      profit: stats.totalPaid - stats.totalDropValue
    }));

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [dailyTxs, dailyUsers] = await Promise.all([
      Transaction.find({ type: "case_open", createdAt: { $gte: dayAgo } }),
      Transaction.distinct("userId", { createdAt: { $gte: dayAgo } })
    ]);

    const dailyCases = {};
    for (const tx of dailyTxs) {
      const name = tx.item?.case || "Unknown";
      dailyCases[name] = (dailyCases[name] || 0) + 1;
    }

    res.json({
      users: usersCount,
      withdrawals: withdrawsCount,
      totalDeposited,
      totalSold,
      profit: totalDeposited - totalSold,
      cases: caseDetails,
      daily: {
        activeUsers: dailyUsers.length,
        caseOpens: dailyCases
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.put("/cases/:id", auth, admin, async (req, res) => {
  try {
    const updatedCase = await Case.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedCase) return res.status(404).json({ error: "Case not found" });
    res.json({ message: "✏️ Case updated", case: updatedCase });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
