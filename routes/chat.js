const express = require('express');
const authenticateToken = require('../services/authMiddleware');
const { getAIResponse, getDemoResponses} = require('../services/openaiService');
const { searchPlaces } = require('../services/mapsService');

const router = express.Router();

const SYSTEM_CONTENT = `You are a helpful assistant that extracts delivery task details from user input.

Always respond with a JSON object in this format:
{
  "intent": "pickup | dropoff | suggestion| information | out-of-scope",
  "pickup-address": "<full pickup address or null>",
  "pickup-name": "<pickup location name or null>",
  "drop-off-address": "<full dropoff address or null>",
  "drop-off-name": "<dropoff location name or null>",
  "item": "<item being delivered or null>",
  "notes": "<any additional notes or null>"
}

The intent is suggestion, only if the user asks for a suggestion of a place to pickup or dropoff an item.
If Intent is pickup or drop off, extract the pickup address or place name and items from the user input.
If Intent is information, add it into the notes. The information must be related to food, restaurents, pickup or dropoff items. 
If no relevant information is found, return "intent": "out-of-scope". Do not include any natural language explanation, only the JSON.`;

router.post('/', authenticateToken, async (req, res) => {
  console.log('Request body:', req.body);

  const userMessage = req.body.userMessage;
  if (!userMessage) return res.status(400).json({ error: "Messages are required" });

  const messages = [{
      role: "system",
      content: SYSTEM_CONTENT
    }, { 
      role: "user", 
      content: userMessage 
    }];


  try {
    const aiResponse = await getDemoResponses(userMessage);
    if(aiResponse) {
      const userLocation = req.user.location || "564 Pharmacy Ave, Scarborough, ON"; 
      const customResponse = await generateCustomResponse(aiResponse.content, userLocation)
      res.json({ aiResponse: customResponse });
    } else {
      const response = {
        reply: "Syatem failed to process your request. Please try again.",
        suggestedAddress: null
      }
      res.json({ aiResponse: response });
    }    
  } catch (error) {
    console.error('OpenAI Error:', error);
    res.status(500).json({ error: "Failed to get response" });
  }
});

async function generateCustomResponse(parsedIntent, userLocation) {
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
      suggestedAddress: placeResolution.suggestedAddress
    };
  }

  if (intent === "information") {
    return {
      reply: notes,
      suggestedAddress: null
    };
  }

  if (intent === "out-of-scope") {
    const message = generateCustomMessage({intent});

    return {
      reply: message,
      suggestedAddress: null
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
        suggestedAddress: suggestions
     };
    } else {
      return {
        reply: message,
        suggestedAddress: null
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
      suggestedAddress: address
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
        suggestedAddress: suggestions[0].address
      };
    } else {
      return {
        status: 'not_found',
        suggestedAddress: null
      };
    }
  }

  if (!placeName) {
    return {
      status: 'missing_name',
      suggestedAddress: null
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
          return `I found some ${placeName} near your ${oppositeRole} location. Please select one from the list below?`;

        case 'not_found':
          return `I couldn't find a nearby ${placeName}. Where would you like to ${roleLabel === 'pickup' ? 'get' : 'send'} the ${item}?`;

        case 'missing_name':
          return `Where would you like to ${roleLabel === 'pickup' ? 'get' : 'send'} the ${item}? I can suggest some nearby places.`;

        default:
          return null;
      }

      case 'suggestion':
      if (item) {
        return `Here are some places for ${item} near you. Please select one from the list below.`;
      }
      return `What kind of item or place are you looking for suggestions about?`;


    case 'out-of-scope':
      return `I'm sorry, but I’m not able to help with that. I can assist with pickups, drop-offs, or finding items. What would you like to do?`;

    default:
      return `I'm here to help you with orders or deliveries. What would you like to do?`;
  }
}


module.exports = router;
