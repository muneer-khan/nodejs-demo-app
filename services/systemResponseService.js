const { generateCustomMessage } = require("./messageBuilder");
const { cancelOrder, modifyOrder } = require("./orderService");
const { searchPlaces } = require("./mapsService");

async function generateSystemResponse(aiResponse, userLocation, userHasActiveSession, userId, chatSessionId, orderId) {
  console.log('Generating custom response for AI:', aiResponse);
  
  if (userHasActiveSession == true) {
    return generateResponseForActiveSession(aiResponse, userLocation, userId, orderId);
  } else {
    return generateResponseForNewSession(aiResponse, userLocation);
  }
}

async function generateResponseForActiveSession(aiResponse, userLocation, userId, orderId) {  
  const {
    action,
    "pickup-place": pickupPlace,
    "pickup-address": pickupAddress,
    "dropoff-place": dropoffPlace,
    "dropoff-address": dropoffAddress,
    items,
    notes
  } = aiResponse;
  let message;

  if(action === "modify-order") { 
    const result = await modifyOrder(orderId, aiResponse);
    if(result.success) {
      message = await generateCustomMessage({intent: action});
    } else {
      message = await generateCustomMessage({intent: action, status: result.reason});
    }
  } else if(action === "cancel-order") {
    const result = await cancelOrder(orderId);
    if(result.success == true) {
      message = await generateCustomMessage({intent: action});
    } else {
      message = await generateCustomMessage({intent: action, status: result.reason});
    }
  } else if(action === "information") {
    return {
      reply: notes,
      suggestions: null
    };
  } else if(action === "out-of-scope") {
    message = await generateCustomMessage({intent: action});
  } else if(action === "new-order") {
    message = await generateCustomMessage({intent: action});    
  }
  return {
      reply: message,
      suggestions: null
  };
}

async function generateResponseForNewSession(aiResponse, userLocation) {
    const {
    intent,
    "pickup-place": aiPickupPlace,
    "pickup-address": aiPickupAddress,
    "dropoff-place": aiDropoffPlace,
    "dropoff-address": aiDropoffAddress,
    items,
    notes
  } = aiResponse;

  console.log('Parsed Intent:', aiResponse);
  
  if (intent === "pickup" || intent === "dropoff") {
    const placeResolution = await resolvePlace({
      placeName: aiPickupPlace || aiDropoffPlace,
      address: aiPickupAddress || aiDropoffAddress,
      fallbackLocation: userLocation,
    });
    
    const message = await generateCustomMessage({
      intent,
      role: intent,
      status: placeResolution.status,
      placeName: aiPickupPlace || aiDropoffPlace,
      items: items[0].item
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
    const message = await generateCustomMessage({intent});

    return {
      reply: message,
      suggestions: null
    };
  }

  if (intent === "suggestion") {
    const message = await generateCustomMessage({intent, items: items[0].item});
    if(items) {
      const suggestions = await searchPlaces({
        query: items,
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

module.exports = {
  generateSystemResponse
};