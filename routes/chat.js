const express = require('express');
const authenticateToken = require('../services/authMiddleware');
const { getDemoExistingOrderResponse, getDemoNewOrderResponses} = require('../services/openaiService');
const { storeChatConversations, getChatMessages, getChatHistory, setUserActiveChatSession } = require('../services/chatService');
const { generateSystemResponse } = require('../services/systemResponseService');
const { createOrder } = require('../services/orderService');
const { resolveAddress } = require('../services/utilsService');

const router = express.Router();

const NEW_ORDER_PROMPT = `You are a helpful assistant that extracts structured delivery-related details from user input.

Always respond with a JSON object in this format:
{
  "intent": "pickup | dropoff | suggestion | information | out-of-scope | greetings,
  "pickup-address": "<full pickup address or null>",
  "pickup-place": "<pickup location name or null>",
  "dropoff-address": "<full dropoff address or null>",
  "dropoff-place": "<dropoff location name or null>",
  "items": ["<item list>" or null],
  "notes": "<short additional info or null>"
}

Instructions:

1. Use only one of the listed intent values:
   - "pickup": User wants an item picked up from a location and delivered elsewhere.
   - "dropoff": User wants to drop off an item at a location.
   - "suggestion": User asks for a place to get or drop something.
   - "information": User asks about food, restaurants, delivery, or pickup services.
   - "greetings": Greetings only.
   - "out-of-scope": Unrelated to delivery, food, or location-based tasks.

3. Use notes only for greetings or information — keep it short and relevant.

4. Do not include any natural language response outside the JSON.
`;

const ACTIVE_ORDER_PROMPT = `
You help users modify or cancel active delivery orders. Always reply in this JSON format:

{
  "action": "modify-order" | "cancel-order" | "information" | "out-of-scope" | "new-order",
  "pickup-address": "<full address or null>",
  "pickup-place": "<place name or null>",
  "dropoff-address": "<full address or null>",
  "dropoff-place": "<place name or null>",
  "items": ["<item list>" or null],
  "notes": "<short message or null>"
}

Rules:
1. If the user mentions to cancel order → action: "cancel-order".
2. If there's a full address → fill pickup-address or dropoff-address.
3. If there's only a place name (e.g. "Dominos", "work") → use pickup-place-name or dropoff-place-name.
4. If the message includes items to add/remove → fill items.
5. Include both items and address/place if both are mentioned.
6. If there's no useful change info → action: "information" with message in notes.
7. If unrelated to orders → action: "out-of-scope" with a brief note in notes.

Only return JSON. No extra text.
`;

router.post('/', authenticateToken, async (req, res) => {
  console.log('Request body:', req.body);

  const reqUserMessage = req.body.userMessage;
  const reqMessageType = req.body.messageType;
  const reqSessionId = req.body.sessionId;
  const reqOrderId = req.body.orderId;
  const reqUserId = req.user.uid;


  if (!reqUserMessage) return res.status(400).json({ error: "Messages are required" });

  const userHasActiveSession = !!reqSessionId;
  const SYSTEM_CONTENT = userHasActiveSession ? ACTIVE_ORDER_PROMPT : NEW_ORDER_PROMPT;

  const messages = [{
      role: "system",
      content: SYSTEM_CONTENT
    }, { 
      role: "user", 
      content: reqUserMessage 
    }];


  try {
    let customResponse;
    let topic;
    let aiResponse;
    let userLocation;
    if (reqMessageType === 'text') {
      if (userHasActiveSession) {
        aiResponse = await getDemoExistingOrderResponse(reqUserMessage); 
      } else {
        aiResponse = await getDemoNewOrderResponses(reqUserMessage);
        topic = aiResponse.content.topic || "General Inquiry";
      }
      // const aiResponse = await getAIResponse(messages);
      if(aiResponse) {
        userLocation = req.user.location || "564 Pharmacy Ave, Scarborough, ON"; 
        customResponse = await generateSystemResponse(aiResponse.content, userLocation, userHasActiveSession, reqUserId, reqSessionId, reqOrderId)
      }
    } else if(reqMessageType === 'selection') {
      const systemResponse = {
        reply: "Thank you for your selection. We will process your request shortly.",
        suggestions: null
      }
      customResponse =  systemResponse;
    }
    
    if(customResponse) {
      const sessionId = await storeChatConversations(reqUserMessage, customResponse.reply, reqUserId, reqSessionId, reqMessageType, topic);
      const address = await resolveAddress(aiResponse.content, userLocation);
      if(address) {
        const { intent, items, notes } = aiResponse.content;
        const newOrder = await createOrder(
            {
                intent: intent, 
                userId: reqUserId,
                pickupAddress: address.pickupAddress || null,
                pickupPlace: address.pickupPlace || null,
                dropoffAddress: address.dropoffAddress || null,
                dropoffPlace: address.dropoffPlace || null,
                items: items || [],
                chatSessionId: sessionId,
                notes: notes || null
            });
        customResponse.orderId = newOrder.orderId;
      } 
      customResponse.sessionId = sessionId;
      res.json({ aiResponse: customResponse });
    } else {
      const response = {
        reply: "Syatem failed to process your request. Please try again.",
        suggestions: null
      }
      res.json({ aiResponse: response });
    }    
  } catch (error) {
    console.error('OpenAI Error:', error);
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
