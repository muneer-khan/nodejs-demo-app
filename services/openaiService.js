const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function getAIResponse(messages) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages
  });

  return completion.choices[0].message;
}

async function getDemoNewOrderResponses(messages) {
  const demo_pickup = {
    "intent": "pickup",
    "pickup-address": null,
    "pickup-place": "Pizza Pizza",
    "dropoff-address": null,
    "dropoff-place": null,
    "items": [{item: "peparoni medium pizza", quantity: 1}, {item: "cheese pizza", quantity: 1}, {item: "coke", quantity: 2}],
    "notes": "Please pick up the order from Pizza Pizza and deliver it to my home address.",
    "topic": "Pickup request"
  }
  const demo_dropoff = {
    "intent": "dropoff",
    "pickup-address": null,
    "pickup-place": null,
    "dropoff-address": null,
    "dropoff-place": "Staples",
    "items": [{item: "package", quantity: 1}],
    "notes": "Please drop off the package at Staples.",
    "topic": "Dropoff request"
  }

  const demo_pickup_full_address = {
    "intent": "pickup",
    "pickup-address": "2235 Sheppard Ave, E, Scarborough, ON",
    "pickup-place": "",
    "dropoff-address": null,
    "dropoff-place": null,
    "items": [{item: "package", quantity: 1}],
    "notes": "Please pick up the package from 2235 Sheppard Ave, E, Scarborough, ON and deliver it to my home address.",
    "topic": "Pickup request"
  }
  const demo_dropoff_full_address = {
    "intent": "dropoff",
    "pickup-address": null,
    "pickup-place": null,
    "dropoff-address": "564 Pharmacy Ave, Scarborough, ON",
    "dropoff-place": "",
    "items": [{item: "package", quantity: 1}],
    "notes": "Please drop off the package at 564 Pharmacy Ave, Scarborough, ON.",
    "topic": "Dropoff request"
  }

  const demo_suggestion = {
    "intent": "suggestion",
    "pickup-address": null,
    "pickup-place": null,
    "dropoff-address": null,
    "dropoff-place": null,
    "items": [{item: "Pizza", quantity: 1}],
    "notes": "Suggesting a pizza place near the user's location",
    "topic": "Food suggestion"
  }
  const demo_information = {
    "intent": "information",
    "pickup-address": null,
    "pickup-place": null,
    "dropoff-address": null,
    "dropoff-place": null,
    "items": [{item: "Burger", quantity: 1}],
    "notes": "Dietry information",
    "topic": "Nutritional information"
  }
  const demo_out_of_scope = {
    "intent": "out-of-scope",
    "pickup-address": null,
    "pickup-place": null,
    "dropoff-address": null,
    "dropoff-place": null,
    "item": null,
    "notes": null,
    "topic": "Out of scope"
  }
  if( messages.includes("pickup address")) {
    return { content: demo_pickup_full_address };
  }
  if( messages.includes("dropoff address")) {
    return { content: demo_dropoff_full_address };
  }
  if( messages.includes("pickup")) {
    return { content: demo_pickup };
  }
  if( messages.includes("dropoff")) {
    return { content: demo_dropoff };
  }
  if( messages.includes("suggest")) {
    return { content: demo_suggestion };
  }
  if( messages.includes("information")) {
    return { content: demo_information };
  }
  if( messages.includes("out of scope")) {
    return {content: demo_out_of_scope };
  }
  return null;
}

async function getDemoExistingOrderResponse(params) {
  const modify_item_pickupaddress = {
    "action": "modify-order",
    "pickup-address": null,
    "pickup-place": null,
    "dropoff-address": "25 Main Street",
    "dropoff-place": null,
    "items": [{item: "garlic bread", quantity: 1}],
    "notes": null
  }

  const new_order = {
    "action": "new-order",
    "pickup-address": null,
    "pickup-place": null,
    "dropoff-address": null,
    "dropoff-place": null,
    "items": [],
    "notes": "User want to create a new order."
  }

const cancel_order = {
  "action": "cancel-order",
  "pickup-address": null,
  "pickup-place": null,
  "dropoff-address": null,
  "dropoff-place": null,
  "items": null,
  "notes": null
}
const modify_pickup_place = {
  "action": "modify-order",
  "pickup-address": null,
  "pickup-place": "Joe’s Pizza",
  "dropoff-address": null,
  "dropoff-place": null,
  "items": null,
  "notes": null
}

const modify_item = {
  "action": "modify-order",
  "pickup-address": null,
  "pickup-place": null,
  "dropoff-address": null,
  "dropoff-place": null,
  "items": [{item: "garlic bread", quantity: 1}],
  "notes": null
}

const information = {
  "action": "information",
  "pickup-address": null,
  "pickup-place": null,
  "dropoff-address": null,
  "dropoff-place": null,
  "items": null,
  "notes": "It looks like you're asking about your order status. Please contact support or check your tracking link."
}


const out_of_scope = {
  "action": "out-of-scope",
  "pickup-address": null,
  "pickup-place": null,
  "dropoff-address": null,
  "dropoff-place": null,
  "items": null,
  "notes": null
}
  if( params.includes("modify item pickup") ) {
    return { content: modify_item_pickupaddress };
  }
  if( params.includes("cancel order") ) {
    return { content: cancel_order };
  }
  if( params.includes("modify place") ) {
    return { content: modify_pickup_place };
  }
  if( params.includes("modify item") ) {
    return { content: modify_item };
  }
  if( params.includes("information") ) {
    return { content: information };
  }
  if( params.includes("out of scope")) {
    return { content: out_of_scope };
  }
  if( params.includes("new order")) {
    return { content: new_order };
  }
  return null;
}

module.exports = { getDemoNewOrderResponses, getAIResponse, getDemoExistingOrderResponse};
