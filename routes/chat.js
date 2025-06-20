const express = require('express');
const authenticateToken = require('../services/authMiddleware');
const { storeChatConversations, getChatMessages, getChatHistory, setUserActiveChatSession } = require('../services/chatService');
const { handleTextMessage, handleSelectionMessage, createOrderFromAIResponse, handleAiResponse } = require('../services/messageProcessor');
const { isOrderActive } = require('../services/orderService');
const { resolveAddress } = require('../services/utilsService');

const router = express.Router();

router.post('/', authenticateToken, async (req, res) => {
  const {
    userMessage,
    messageType,
    sessionId,
    orderId,
    suggestionType
  } = req.body;

  const userId = req.user.uid;
  const userLocation = req.user.location || "564 Pharmacy Ave, Scarborough, ON";

  if (!userMessage) {
    return res.status(400).json({ error: "Messages are required" });
  }

  try {
    let customResponse;
    let aiResponse;
    let topic;

    const hasActiveOrder = await isOrderActive(orderId);

    if (messageType === 'text') {
      const response = await handleTextMessage(userMessage, hasActiveOrder);
      aiResponse = response.aiResponse;
      topic = response.topic;
      customResponse = await handleAiResponse(aiResponse.content, userLocation, hasActiveOrder, userId, orderId);
    }

    if (messageType === 'selection') {
      customResponse = await handleSelectionMessage(userMessage, suggestionType, userId, orderId);
    }

    if (!customResponse) {
      return res.json({ aiResponse: { reply: "System failed to process your request. Please try again.", suggestions: null } });
    }

    const chatSessionId = await storeChatConversations(userMessage, customResponse.reply, userId, sessionId, messageType, topic);
    customResponse.sessionId = chatSessionId;

    if (!hasActiveOrder) {
      const address = await resolveAddress(aiResponse?.content, userLocation);
      if (address) {
        const newOrder = await createOrderFromAIResponse(aiResponse.content, userId, chatSessionId, address);
        customResponse.orderId = newOrder.orderId;
      } else {
        customResponse.orderId = "";
      }
    }

    res.json({ result: customResponse });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: "Failed to get response" });
  }
});



router.post('/set-active', authenticateToken, async (req, res) => {
  const { sessionId } = req.body;
  const userId = req.user.uid;
  try {
    setUserActiveChatSession(userId, sessionId);

    const messages = await getChatMessages(sessionId);
    res.json({ sessionId, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to set active session' });
  }
});

router.get('/history', authenticateToken, async (req, res) => {
  const userId = req.user.uid;

  try {
    const history = await getChatHistory(userId);

    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching chat history' });
  }
});



module.exports = router;
