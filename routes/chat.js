const express = require('express');
const authenticateToken = require('../services/authMiddleware');
const { getAIResponse, getDemoResponses} = require('../services/openaiService');
const { searchPlaces } = require('../services/mapsService');
const { db, fieldValue } = require('../services/firebase');


const router = express.Router();

const NEW_ORDER_PROMPT = `You are a helpful assistant that extracts structured delivery-related details from user input.

Always respond with a JSON object in this format:
{
  "intent": "pickup | dropoff | suggestion | information | out-of-scope | greetings,
  "pickup-address": "<full pickup address or null>",
  "pickup-place": "<pickup location name or null>",
  "dropoff-address": "<full dropoff address or null>",
  "dropoff-place": "<dropoff location name or null>",
  "item": "<item being delivered or null>",
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

router.post('/', authenticateToken, async (req, res) => {
  console.log('Request body:', req.body);

  const reqUserMessage = req.body.userMessage;
  const reqMessageType = req.body.messageType;
  const reqSessionId = req.body.sessionId;
  const reqUserId = req.user.uid;


  if (!reqUserMessage) return res.status(400).json({ error: "Messages are required" });

  const userHasActiveOrder = null;
  const SYSTEM_CONTENT = userHasActiveOrder ? "" : NEW_ORDER_PROMPT;

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
    if(reqMessageType === 'text') {
      const aiResponse = await getDemoResponses(reqUserMessage);
      // const aiResponse = await getAIResponse(reqUserMessage);
      if(aiResponse) {
        topic = aiResponse.content.topic || "General Inquiry";
        const userLocation = req.user.location || "564 Pharmacy Ave, Scarborough, ON"; 
        customResponse = await generateCustomResponseforAI(aiResponse.content, userLocation)
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

async function storeChatConversations(userMessage, systemResponse, userId, sessionId, userMessageType, topic) {
  console.log('Storing chat conversation:', { userMessage, systemResponse, userId });
  const newMessages = [
        { "role": "user", "content": userMessage, "message_type": userMessageType },
        { "role": "system", "content": systemResponse }
      ];
  let chatRef;

  if (sessionId) {
    chatRef = db.collection('chats').doc(sessionId);

    await chatRef.update({
      messages: fieldValue.arrayUnion(...newMessages),
      updated_at: new Date()
    });
  } else {
    const fullChat = {
        user_id: userId,
        messages: newMessages,
        topic: topic,
        status: "active",
        created_at: new Date(),
        updated_at: new Date()
      };
      chatRef = await db.collection('chats').add(fullChat);
  }
  await setUserActiveChatSession(userId, chatRef.id);
  return chatRef.id;
}

async function getUserActiveChatSession(userId) {
  if (!userId) {
    throw new Error('User ID is required to fetch active session');
  }

  try {
    const sessionRef = db.collection('user_active_session').doc(userId);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      return null;
    }

    return sessionDoc.data().chat_session_id; // Includes chat_session_id, order_id, etc.
  } catch (error) {
    console.error('Error fetching active session:', error);
    throw error;
  }
}

async function setUserActiveChatSession(userId, chatSessionId) {
  const userActiveSessionRef = db.collection('user_active_sessions').doc(userId);
  const activeSessionData = {
    user_id: userId,
    chat_session_id: chatSessionId,
    created_at: new Date(),
  };
  await userActiveSessionRef.set(activeSessionData);
}

async function generateCustomResponseforAI(parsedIntent, userLocation) {
  console.log('Generating custom response for AI:', parsedIntent);
  
  const {
    intent,
    "pickup-name": pickupName,
    "pickup-address": pickupAddress,
    "drop-off-name": dropoffName,
    "drop-off-address": dropoffAddress,
    item,
    notes
  } = parsedIntent;

  console.log('Parsed Intent:', parsedIntent);
  console.log('pickupName:', pickupName);
  
  if (intent === "pickup" || intent === "dropoff") {
    const placeResolution = await resolvePlace({
      placeName: pickupName || dropoffName,
      address: pickupAddress || dropoffAddress,
      fallbackLocation: userLocation,
    });
    
    const message = generateCustomMessage({
      intent,
      role: intent,
      status: placeResolution.status,
      placeName: pickupName || dropoffName,
      item: item
    });

    return {
      reply: message,
      suggestions: placeResolution.suggestedAddress
    };
  }

  if (intent === "information" || intent === "greetings") {
    return {
      reply: notes,
      suggestions: null
    };
  }

  if (intent === "out-of-scope") {
    const message = generateCustomMessage({intent});

    return {
      reply: message,
      suggestions: null
    };
  }

  if (intent === "suggestion") {
    const message = generateCustomMessage({intent, item: item});
    if(item) {
      const suggestions = await searchPlaces({
        query: item,
        nearLocation: userLocation,
        type: 'item',
      });
      return {
        reply: message,
        suggestions: suggestions
     };
    } else {
      return {
        reply: message,
        suggestions: null
      };
    }
  }
}

async function resolvePlace({
  placeName,
  address,
  fallbackLocation
}) {
  console.log('Resolving place with:', { placeName, address, fallbackLocation });
  
  if (address) {
    return {
      status: 'complete',
      suggestions: address
    };
  }

  if (!address && placeName) {
    const suggestions = await searchPlaces({
      query: placeName,
      nearLocation: fallbackLocation,
      type: 'place',
    });

    if (suggestions.length > 0) {
      return {
        status: 'suggested',
        suggestions: suggestions
      };
    } else {
      return {
        status: 'not_found',
        suggestions: null
      };
    }
  }

  if (!placeName) {
    return {
      status: 'missing_name',
      suggestions: null
    };
  }
}

function generateCustomMessage({
  intent,
  role = null,
  status = null,
  placeName = '',
  item = '',
}) {
  switch (intent) {
    case 'pickup':
    case 'dropoff':
      const roleLabel = role;
      const oppositeRole = role === 'pickup' ? 'dropoff' : 'pickup';

      switch (status) {
        case 'complete':
          return "Would you like to confirm the " + roleLabel + "?";

        case 'suggested':
          return `There are a few ${placeName} near your selected ${oppositeRole} location. Where would you like to ${roleLabel}?`;

        case 'not_found':
          return `I couldn't find a nearby ${placeName}. Where would you like to ${roleLabel === 'pickup' ? 'get' : 'send'} the ${item}?`;

        case 'missing_name':
          return `Where would you like to ${roleLabel === 'pickup' ? 'get' : 'send'} the ${item}? I can suggest some nearby places.`;

        default:
          return null;
      }

      case 'suggestion':
      if (item) {
        return `Here are some places for ${item} near you. `;
      }
      return `What kind of item or place are you looking for suggestions about?`;


    case 'out-of-scope':
      return `I'm sorry, but I’m not able to help with that. I can assist with pickups, drop-offs, or finding items. What would you like to do?`;

    default:
      return `I'm here to help you with orders or deliveries. What would you like to do?`;
  }
}

async function getChatMessages(sessionId) {
  if (!sessionId) {
    throw new Error('Session ID is required to fetch messages');
  }

  try {
    const chatRef = db.collection('chats').doc(sessionId);
    const chatDoc = await chatRef.get();

    if (!chatDoc.exists) {
      return [];
    }

    return chatDoc.data().messages || [];
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    throw error;
  }
}

router.post('/set-active', authenticateToken, async (req, res) => {
  const { sessionId } = req.body;
  const userId = req.user.uid;

  setUserActiveChatSession(userId, sessionId);

  const messages = await getChatMessages(sessionId);
  res.json({ sessionId, messages });
});

router.get('/history', authenticateToken, async (req, res) => {
  const userId = req.user.uid;

  try {
    const snapshot = await db.collection('chats')
      .where('user_id', '==', userId)
      .select('topic', 'status') 
      .get();

    const history = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({ success: true, history });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ success: false, message: 'Error fetching chat history' });
  }
});



module.exports = router;
