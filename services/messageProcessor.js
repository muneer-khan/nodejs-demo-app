const { generateCustomMessage } = require("./responseMessageBuilder");
const { modifyOrder, updateOrderStatus, createOrder, updatePaymentStatus } = require("./orderService");
const { searchPlaces, getFullAddress } = require("./mapsService");
const { getPrompt } = require("./promptService");
const { getDemoExistingOrderResponse, getDemoNewOrderResponses} = require('../services/openaiService');

async function handleTextMessage(userMessage, hasActiveOrder) {
  const systemPrompt = await getPrompt(hasActiveOrder ? "active_order" : "new_order");
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage }
  ];

  // Simulated or real response
  // const aiResponse = await getAIResponse(messages);

  const aiResponse = hasActiveOrder
    ? await getDemoExistingOrderResponse(userMessage)
    : await getDemoNewOrderResponses(userMessage);

  const topic = hasActiveOrder ? null : aiResponse.content.topic || "General Inquiry";
  return { aiResponse, topic };
}

async function createOrderFromAIResponse(content, userId, sessionId, address) {
  const { intent, items, notes } = content;
  return await createOrder({
    intent,
    userId,
    pickupAddress: address.pickupAddress || null,
    pickupPlace: address.pickupPlace || null,
    dropoffAddress: address.dropoffAddress || null,
    dropoffPlace: address.dropoffPlace || null,
    items: items || [],
    chatSessionId: sessionId,
    notes: notes || null
  });
}

async function handleAiResponse(data, userLocation, userHasActiveOrder, userId, orderId) {
  console.log('Generating custom response for AI:', data);
  
  if (userHasActiveOrder) {
    return handleActiveOrder(data, userLocation, userId, orderId);
  } else {
    return handleNewOrder(data, userLocation);
  }
}


async function handleActiveOrder(data, userLocation, userId, orderId) {  
  const {
    action,
    "pickup-place": pickupPlace,
    "pickup-address": pickupAddress,
    "dropoff-place": dropoffPlace,
    "dropoff-address": dropoffAddress,
    items,
    notes
  } = data;
  let message;
  let newOrderId = orderId;
  let newSuggestions;
  let newSuggestionType;

  if(action === "modify-order") { 
    const result = await modifyOrder(orderId, data);
    if(result.success) {
      newSuggestions = await getSugestionForCompleteOrder(result.hasAllRequired);
      newSuggestionType = "order-confirmation"
      message = await generateCustomMessage({intent: action, hasAllRequired: result.hasAllRequired});
    } else {
      message = await generateCustomMessage({intent: action, status: result.reason});
    }
  } else if(action === "confirm-order") { 
    return await handleOrderConfirmation("confirm", orderId)
  } else if(action === "cancel-order") {
    return await handleOrderConfirmation("cancel", orderId)
  } else if(action === "information") {
    return {
      reply: notes,
      orderId: newOrderId,
      suggestions: null
    };
  } else if(action === "out-of-scope") {
    message = await generateCustomMessage({intent: action});
  } else if(action === "new-order") {
    message = await generateCustomMessage({intent: action});
    newOrderId = ''
  }
  return {
      reply: message,
      orderId: newOrderId,
      suggestions: newSuggestions,
      suggestionType: newSuggestionType
  };
}

async function getSugestionForCompleteOrder(hasAllRequired) {
  return hasAllRequired
      ? [{ name: "Confirm Order" }, { name: "Cancel Order" }]
      : null
}

async function handleNewOrder(data, userLocation) {
    const {
    intent,
    "pickup-place": aiPickupPlace,
    "pickup-address": aiPickupAddress,
    "dropoff-place": aiDropoffPlace,
    "dropoff-address": aiDropoffAddress,
    items,
    notes
  } = data;

  console.log('Parsed Intent:', data);
  
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
      suggestions: placeResolution.suggestions,
      suggestionType: placeResolution.suggestionType || intent
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

  if (intent === "suggestion" || intent === "suggest-pickup" || intent === "suggest-dropoff") {
    const message = await generateCustomMessage({intent, items: items[0].item});
    if(items.length > 0) {
      const suggestions = await searchPlaces({
        query: items[0].item,
        nearLocation: userLocation,
        type: 'item',
      });
      return {
        reply: message,
        suggestions: suggestions,
        suggestionType: intent
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
      suggestions: getSugestionForCompleteOrder(true),
      suggestionType: "order-confirmation"
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


async function handleSelectionMessage(userSelection, selectedSuggestionType, userId, orderId) {
  switch (selectedSuggestionType) {
    case "order-confirmation":
      const action = await getOrderConfirmationAction(userSelection);
      return handleOrderConfirmation(action, orderId);
    case "payment-types":
      return handlePayment(userSelection, orderId);
    case "suggest-pickup":
    case "suggest-dropoff":
    case "pickup":
    case "dropoff":
      return handleAddressSelection(selectedSuggestionType, userSelection, orderId);
    default:
      return {
        reply: "Sorry, I didn’t understand your selection.",
        suggestions: null
      };
  }
}

async function handleOrderConfirmation(action, orderId) {
  let newMessage;

  if (action.toLowerCase() === "confirm") {
    const result = await confirmOrder(orderId);
    if (result.success) {
      const paymentTypes = [
        { name: "Credit Card" },
        { name: "Debit Card" },
        { name: "Venmo" },
        { name: "Applepay" },
        { name: "Paypal" }
      ];
      newMessage = await generateCustomMessage({ intent: "confirm-order", orderNo: result.orderNo });
      return {
        reply: newMessage,
        suggestions: paymentTypes,
        orderId: orderId,
        suggestionType: "payment-types"
      };
    } else {
      newMessage = await generateCustomMessage({ intent: "confirm-order", status: result.reason });
      return { reply: newMessage, suggestions: null, orderId: null };
    }
  } else if (action.toLowerCase() === "cancel") {
    const result = await cancelOrder(orderId);
    newMessage = await generateCustomMessage({
      intent: "cancel-order",
      status: result.success ? undefined : result.reason
    });
    return { reply: newMessage, suggestions: null };
  }
}

async function getOrderConfirmationAction(userMessage) {
  if(userMessage == "Confirm Order") {
    return "confirm"
  } else if (userMessage == "Cancel Order") {
    return "cancel"
  }
}

async function confirmOrder(orderId) {
  const result = await updateOrderStatus(orderId, "confirmed");
  return result;
}

async function handlePayment(userSelection, orderId) {
  const result = await updatePaymentStatus(orderId, "success", userSelection)
  const newMessage = await generateCustomMessage({ intent: "payment-success", method: userSelection });
  return { reply: newMessage, suggestions: null };
}

async function handleAddressSelection(suggestionType, userSelection, orderId) {
  const fieldMap = {
    'suggest-pickup': 'pickup_address',
    'suggest-dropoff': 'dropoff_address',
    'pickup': 'pickup_address',
    'dropoff': 'dropoff_address'
  };

  const addressField = fieldMap[suggestionType];
  const selectedFullAddress = await getFullAddress(userSelection);
  const updates = { [addressField]: selectedFullAddress };

  const result = await modifyOrder(orderId, updates);

  const newMessage = await generateCustomMessage({
    intent: "address-selection",
    status: result.success
      ? result.hasAllRequired ? "order-complete" : "order-pending"
      : result.reason || "error"
  });
  newSuggestions = await getSugestionForCompleteOrder(result.hasAllRequired);
  return {
    reply: newMessage,
    suggestions: newSuggestions,
    orderId,
    suggestionType: result.hasAllRequired ? "order-confirmation" : suggestionType
  };
}

async function cancelOrder(orderId) {
  const result = await updateOrderStatus(orderId, "cancelled");
  return result;
}

module.exports = {
  handleAiResponse, createOrderFromAIResponse, handleSelectionMessage, handleTextMessage, createOrderFromAIResponse
};