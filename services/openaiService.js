const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function getAIResponse(messages) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages
  });
  const content = completion.choices[0].message.content;

  console.log(content);
  
  try {
    const json = JSON.parse(content);
    return json;
  } catch (error) {
    console.error('Failed to parse JSON:', error);
    console.log('Raw content:', content);
    return null;
  }
}

async function getDemoNewOrderResponses(messages) {

  const demo = {
  "intent": "pickup",
  "pickupPlace": "Pizza Hut",
  "items": [
    {"item": "medium pepperoni pizza", "qty": 2},
    {"item": "coke", "qty": 2}
  ]
  }
  const demo_pickup = {
    "intent": "pickup",
    "pickupPlace": "Pizza Pizza",
    "items": [{item: "peparoni medium pizza", quantity: 1}, {item: "cheese pizza", quantity: 1}, {item: "coke", quantity: 2}],
    "notes": "Please pick up the order from Pizza Pizza and deliver it to my home address.",
    "topic": "Pickup request"
  }
  const demo_dropoff = {
    "intent": "dropoff",
    "dropoffPlace": "Staples",
    "items": [{item: "package", quantity: 1}],
    "notes": "Please drop off the package at Staples.",
    "topic": "Dropoff request"
  }

  const demo_pickup_full_address = {
    "intent": "pickup",
    "pickupAddress": "2235 Sheppard Ave, E, Scarborough, ON",
    "items": [{item: "package", quantity: 1}],
    "notes": "Please pick up the package from 2235 Sheppard Ave, E, Scarborough, ON and deliver it to my home address.",
    "topic": "Pickup request"
  }
  const demo_dropoff_full_address = {
    "intent": "dropoff",
    "dropoffAddress": "564 Pharmacy Ave, Scarborough, ON",
    "items": [{item: "package", quantity: 1}],
    "notes": "Please drop off the package at 564 Pharmacy Ave, Scarborough, ON.",
    "topic": "Dropoff request"
  }

  const demo_suggestion_pickup = {
    "intent": "suggestPickup",
    "items": [{item: "Pizza", quantity: 1}],
    "notes": "Suggesting a pizza place near the user's location",
    "topic": "Food suggestion"
  }

    const demo_suggestion = {
    "intent": "suggestion",
    "items": [{item: "Pizza", quantity: 1}],
    "notes": "Suggesting a pizza place near the user's location",
    "topic": "Food suggestion"
  }

  const demo_suggestion_dropoff = {
    "intent": "suggestDropoff",
    "items": [{item: "package", quantity: 1}],
    "notes": "Suggesting staples near the user's location",
    "topic": "Amazon package dropoff suggestion"
  }

  const demo_information = {
    "intent": "info",
    "items": [{item: "Burger", quantity: 1}],
    "notes": "Dietry information",
    "topic": "Nutritional information"
  }
  const demo_out_of_scope = {
    "intent": "oos"
  }
  if( messages.includes("pickup address")) {
    return demo_pickup_full_address ;
  }
  if( messages.includes("dropoff address")) {
    return demo_dropoff_full_address ;
  }
  if( messages.includes("suggest pickup")) {
    return demo_suggestion_pickup ;
  }
  if( messages.includes("suggest dropoff")) {
    return demo_suggestion_dropoff ;
  }
  if( messages.includes("pickup")) {
    return  demo_pickup;
  }
  if( messages.includes("dropoff")) {
    return demo_dropoff ;
  }
  if( messages.includes("suggestion")) {
    return demo_suggestion ;
  }
  if( messages.includes("information")) {
    return demo_information ;
  }
  if( messages.includes("out of scope")) {
    return demo_out_of_scope ;
  }
  if( messages.includes("demo")) {
    return demo;
  }
  return demo_out_of_scope ;
}

async function getDemoExistingOrderResponse(params) {
  const demo_replace_item = {
    "action": "modify",
    "items": [{type: "replace", item: "garlic bread", newItem: "pizza"}],
  }

  const demo_add_item = {
    "action": "modify",
    "items": [{type: "add", item: "garlic bread", quantity: 1}],
  }

  const demo_remove_item = {
    "action": "modify",
    "items": [{type: "remove", item: "pizza", quantity: 1}],
  }

  const new_order = {
    "action": "newOrder"
  }

const cancel_order = {
  "action": "cancel",
}

const confirm_order = {
  "action": "confirm",
}

const modify_pickup_place = {
  "action": "modify",
  "pickupPlace": "Joe’s Pizza",
}

const demo_modify_address = {
  "action": "modify",
  "pickupAddress": "2235 Sheppard Ave, E, Scarborough, ON"
}

const information = {
  "action": "info",
  "notes": "It looks like you're asking about your order status. Please contact support or check your tracking link."
}


const out_of_scope = {
  "action": "oos",
}
  if( params.includes("add") ) {
    return demo_add_item ;
  }
  if( params.includes("replace") ) {
    return demo_replace_item ;
  }
  if( params.includes("remove") ) {
    return demo_remove_item ;
  }
  if( params.includes("cancel") ) {
    return cancel_order ;
  }
  if( params.includes("modify place") ) {
    return modify_pickup_place ;
  }
  if( params.includes("change address") ) {
    return demo_modify_address ;
  }
  if( params.includes("information") ) {
    return information ;
  }
  if( params.includes("out of scope")) {
    return out_of_scope ;
  }
  if( params.includes("new order")) {
    return new_order ;
  }
  if( params.includes("confirm")) {
    return confirm_order ;
  }
  return out_of_scope ;
}

module.exports = { getDemoNewOrderResponses, getAIResponse, getDemoExistingOrderResponse};
