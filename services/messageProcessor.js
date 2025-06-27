const { generateCustomMessage } = require("./responseMessageBuilder");
const { modifyOrder, updateOrderStatus, createOrder, updatePaymentStatus, itemExists, addItem, modifyItem, getOrderData } = require("./orderService");
const { searchPlaces, getFullAddress } = require("./mapsService");
const { getPrompt } = require("./promptService");
const { getDemoExistingOrderResponse, getDemoNewOrderResponses, getAIResponse} = require('../services/openaiService');
const { ConfirmationLabels, PromptTypes, DefaultLabels, ActionTypes, 
  SuggestionTypes, OrderFields, IntentTypes, 
  AddressSearchTypes, OrderStatus, StatusType} = require("../appStrings");
const { resolveAddress } = require("./utilsService");

const fieldMap = {
  'suggestPickup': 'pickupAddress',
  'suggestDropoff': 'dropoffAddress',
  'pickup': 'pickupAddress',
  'dropoff': 'dropoffAddress'
};

async function handleTextMessage(userMessage, hasActiveOrder) {
  const systemPrompt = await getPrompt(hasActiveOrder ? PromptTypes.ACTIVE_ORDER : PromptTypes.NEW_ORDER);
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage }
  ];

  // Simulated or real response
  // const aiResponse = await getAIResponse(messages);

  const aiResponse = hasActiveOrder
    ? await getDemoExistingOrderResponse(userMessage)
    : await getDemoNewOrderResponses(userMessage);

  const topic = hasActiveOrder ? null : aiResponse.topic || DefaultLabels.TOPIC;
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
    pickupPlace,
    pickupAddress,
    dropoffPlace,
    dropoffAddress,
    items,
    notes
  } = data;
  let message;
  let newOrderId = orderId;
  let newSuggestions;
  let newSuggestionType;
  if(action === ActionTypes.MODIFY) { 
    const result = await updateOrderData(orderId, data);
    if(result.success) {
      const suggestionData = await getSugestions(result.hasAllRequired, orderId);
      newSuggestions = suggestionData.suggestions;
      newSuggestionType = suggestionData.suggestionType;
      message = await generateCustomMessage({intent: action, hasAllRequired: result.hasAllRequired});
    } else {
      message = await generateCustomMessage({intent: action, status: "failed", reason});
    }
  } else if(action === ActionTypes.CONFIRM) { 
    return await handleOrderConfirmation(action, orderId)
  } else if(action === ActionTypes.CANCEL) {
    return await handleOrderConfirmation(action, orderId)
  } else if(action === ActionTypes.INFO) {
    return {
      reply: notes,
      orderId: newOrderId,
      suggestions: null
    };
  } else if(action === ActionTypes.OUT_OF_SCOPE) {
    message = await generateCustomMessage({intent: action});
  } else if(action === ActionTypes.NEW_ORDER) {
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

async function getSugestions(hasAllRequired, orderId='') {
  const userLocation = "564 Pharmacy Ave, Scarborough, ON";

  if(hasAllRequired) {
    const suggestions =  [{ name: ConfirmationLabels.CONFIRM }, { name: ConfirmationLabels.CANCEL }]  
    return { suggestions: suggestions, suggestionType: SuggestionTypes.ORDER_CONFIRMATION };
  } else {
    const orderData = await getOrderData(orderId);
    const missingField = getMissingFields(orderData);
    console.log(missingField);
    console.log(orderData);
    
    
    if(missingField != 'item') {
      const placeResolution = await resolvePlace({
        placeName: missingField == OrderFields.PICKUP_ADDRESS ? orderData.pickup_place : orderData.dropoff_place,
        fallbackLocation: userLocation,
      });
      const suggestionType = missingField == OrderFields.PICKUP_ADDRESS ? SuggestionTypes.SUGGEST_PICKUP : SuggestionTypes.SUGGEST_DROPOFF;
      
      return { suggestions: placeResolution.suggestions, suggestionType: suggestionType }
    }
  }
}

function getMissingFields(order) {
  if (order.pickup_place && !order.pickup_address) return OrderFields.pickupAddress;
  if (order.dropoff_place && !order.dropoff_address) return OrderFields.DROPOFF_ADDRESS;
  if (!Array.isArray(order.items) || order.items.length === 0) return OrderFields.ITEMS;
}

async function handleNewOrder(data, userLocation) {
    const {
    intent,
    pickupPlace,
    pickupAddress,
    dropoffPlace,
    dropoffAddress,
    items,
    notes
  } = data;

  console.log('Parsed Intent:', data);
  
  if (intent === IntentTypes.PICKUP || intent === IntentTypes.DROPOFF) {
    const placeResolution = await resolvePlace({
      placeName: pickupPlace || dropoffPlace,
      address: pickupAddress || dropoffAddress,
      fallbackLocation: userLocation,
    });
    
    const message = await generateCustomMessage({
      intent,
      role: intent,
      status: placeResolution.status,
      placeName: pickupPlace || dropoffPlace,
      items: items[0].item
    });

    return {
      reply: message,
      suggestions: placeResolution.suggestions,
      suggestionType: placeResolution.suggestionType || intent
    };
  }

  if (intent === IntentTypes.INFO || intent === IntentTypes.GREETINGS) {
    return {
      reply: notes,
      suggestions: null
    };
  }

  if (intent === IntentTypes.OUT_OF_SCOPE) {
    const message = await generateCustomMessage({intent});

    return {
      reply: message,
      suggestions: null
    };
  }

  if (intent === IntentTypes.SUGGEST_PICKUP || intent === IntentTypes.SUGGEST_DROPOFF) {
    const message = await generateCustomMessage({intent, items: items[0].item});
    if(items.length > 0) {
      const suggestions = await searchPlaces({
        query: items[0].item,
        nearLocation: userLocation,
        type: AddressSearchTypes.ITEM,
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

  if(intent == IntentTypes.SUGGESTION) {
    return {
        reply: "Here some suggestions, would you like to pickup or dropoff?"
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
    const orderConfirmSuggestion = await getSugestions(true);
    return {
      status: OrderStatus.COMPLETE,
      suggestions: orderConfirmSuggestion.suggestions,
      suggestionType: orderConfirmSuggestion.suggestionType,
    };
  }

  if (!address && placeName) {
    const suggestions = await searchPlaces({
      query: placeName,
      nearLocation: fallbackLocation,
      type: AddressSearchTypes.PLACE,
    });

    if (suggestions.length > 0) {
      return {
        status: AddressSearchTypes.SUGGESTED,
        suggestions: suggestions
      };
    } else {
      return {
        status: AddressSearchTypes.NOT_FOUND,
        suggestions: null
      };
    }
  }

  if (!placeName) {
    return {
      status: AddressSearchTypes.MISSING_NAME,
      suggestions: null
    };
  }
}


async function handleSelectionMessage(userSelection, selectedSuggestionType, userId, orderId) {
  switch (selectedSuggestionType) {
    case SuggestionTypes.ORDER_CONFIRMATION:
      const action = await getOrderConfirmationAction(userSelection);
      return handleOrderConfirmation(action, orderId);
    case SuggestionTypes.PAYMENT_TYPES:
      return handlePayment(userSelection, orderId);
    case SuggestionTypes.SUGGEST_PICKUP:
    case SuggestionTypes.SUGGEST_DROPOFF:
    case IntentTypes.PICKUP:
    case IntentTypes.DROPOFF:
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

  if (action.toLowerCase() === ActionTypes.CONFIRM) {
    const result = await confirmOrder(orderId);
    if (result.success) {
      const paymentTypes = [
        { name: "Credit Card" },
        { name: "Debit Card" },
        { name: "Venmo" },
        { name: "Applepay" },
        { name: "Paypal" }
      ];
      newMessage = await generateCustomMessage({ intent: "confirmOrder", orderNo: result.orderNo });
      return {
        reply: newMessage,
        suggestions: paymentTypes,
        orderId: orderId,
        suggestionType: "paymentTypes"
      };
    } else {
      newMessage = await generateCustomMessage({ intent: action, status: result.reason });
      return { reply: newMessage, suggestions: null, orderId: null };
    }
  } else if (action.toLowerCase() === ActionTypes.CANCEL) {
    const result = await cancelOrder(orderId);
    newMessage = await generateCustomMessage({
      intent: action,
      status: result.success ? undefined : result.reason
    });
    return { reply: newMessage, suggestions: null };
  }
}

async function getOrderConfirmationAction(userMessage) {
  if(userMessage == ConfirmationLabels.CONFIRM) {
    return ActionTypes.CONFIRM;
  } else if (userMessage == ConfirmationLabels.CANCEL) {
    return ActionTypes.CANCEL;
  }
}

async function confirmOrder(orderId) {
  const result = await updateOrderStatus(orderId, OrderStatus.CONFIRMED);
  return result;
}

async function handlePayment(userSelection, orderId) {
  const result = await updatePaymentStatus(orderId, StatusType.SUCCESS, userSelection)
  const newMessage = await generateCustomMessage({ intent: "paymentSuccess", method: userSelection });
  return { reply: newMessage, suggestions: null };
}

async function handleAddressSelection(suggestionType, userSelection, orderId) {
  const addressField = fieldMap[suggestionType];
  const selectedFullAddress = await getFullAddress(userSelection);
  const updates = { [addressField]: selectedFullAddress };

  const result = await updateOrderData(orderId, updates);

  const newMessage = await generateCustomMessage({
    intent: ActionTypes.MODIFY,
    status: result.reason
  });
  const newSuggestions = await getSugestions(result.hasAllRequired, orderId);
  return {
    reply: newMessage,
    suggestions: newSuggestions.suggestions,
    orderId,
    suggestionType: newSuggestions.suggestionType
  };
}

async function cancelOrder(orderId) {
  const result = await updateOrderStatus(orderId, OrderStatus.CANCELLED);
  return result;
}

async function updateOrderData(orderId, modifications) {
  if(modifications?.items) {
    for (const mod of modifications.items) {
      const { type, item, quantity = 1, newItem } = mod;
      const exists = await itemExists(orderId, item);

      if (exists) {
        if (type === ActionTypes.ADD || type === ActionTypes.REMOVE) {
          const value = type === ActionTypes.REMOVE ? quantity : -quantity;
          return await modifyItem(orderId, item, value);
        } else if (type === ActionTypes.REPLACE) {
          return await modifyItem(orderId, item, newItem);
        }
      } else {
        if (type === ActionTypes.ADD) {
          return await addItem(orderId, { item: newItem || item, quantity });
        } else if (type === ActionTypes.REPLACE) {
          const newItemExists = await itemExists(orderId, newItem);
          if(newItemExists) {
            return {success: false, reason: "item_already_exists"};
          } else {
            return await addItem(orderId, { item: newItem || item, quantity });
          }
        }else {
          return {success: false, reason: "item_not_found"};
        }
      }
    }
  }  

  if (Object.keys(modifications).some(key => key !== OrderFields.ITEMS)) {
    console.log(modifications);
    return await modifyOrder(orderId, modifications);
  }
}

module.exports = {
  handleAiResponse, createOrderFromAIResponse, handleSelectionMessage, handleTextMessage, createOrderFromAIResponse
};