const express = require('express');
const authenticateToken = require('../services/authMiddleware');
const getAIResponse = require('../services/openaiService');

const router = express.Router();

router.post('/', authenticateToken, async (req, res) => {
  const { messages } = req.body; // [{ role: "user", content: "Hi" }, ...]
  if (!messages) return res.status(400).json({ error: "Messages are required" });

  try {
    const aiResponse = await getAIResponse(messages);
    // Optionally save messages + response to DB here

    res.json({ response: aiResponse });
  } catch (error) {
    console.error('OpenAI Error:', error);
    res.status(500).json({ error: "Failed to get response" });
  }
});

module.exports = router;
