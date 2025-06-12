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

async function getDemoResponses(messages) {
  const demo_pickup = {
    "intent": "pickup",
    "pickup-address": null,
    "pickup-name": "Pizza Pizza",
    "drop-off-address": null,
    "drop-off-name": null,
    "item": "{peparoni medium pizza: 1, cheese pizza: 1, coke: 2}",
    "notes": "Please pick up the order from Pizza Pizza and deliver it to my home address."
  }
  const demo_dropoff = {
    "intent": "dropoff",
    "pickup-address": null,
    "pickup-name": null,
    "drop-off-address": null,
    "drop-off-name": "Staples",
    "item": "{package: 1}",
    "notes": "Please drop off the package at Staples."
  }

  const demo_pickup_full_address = {
    "intent": "pickup",
    "pickup-address": "2235 Sheppard Ave, E, Scarborough, ON",
    "pickup-name": "",
    "drop-off-address": null,
    "drop-off-name": null,
    "item": "{package: 1}",
    "notes": "Please pick up the package from 2235 Sheppard Ave, E, Scarborough, ON and deliver it to my home address."
  }
  const demo_dropoff_full_address = {
    "intent": "dropoff",
    "pickup-address": null,
    "pickup-name": null,
    "drop-off-address": "564 Pharmacy Ave, Scarborough, ON",
    "drop-off-name": "",
    "item": "{package: 1}",
    "notes": "Please drop off the package at 564 Pharmacy Ave, Scarborough, ON."
  }

  const demo_suggestion = {
    "intent": "suggestion",
    "pickup-address": null,
    "pickup-name": null,
    "drop-off-address": null,
    "drop-off-name": null,
    "item": "Pizza",
    "notes": "Suggesting a pizza place near the user's location"
  }
  const demo_information = {
    "intent": "information",
    "pickup-address": null,
    "pickup-name": null,
    "drop-off-address": null,
    "drop-off-name": null,
    "item": "Burger",
    "notes": "Dietry information"
  }
  const demo_out_of_scope = {
    "intent": "out-of-scope",
    "pickup-address": null,
    "pickup-name": null,
    "drop-off-address": null,
    "drop-off-name": null,
    "item": null,
    "notes": null
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
  if( messages.includes("suggestion")) {
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

module.exports = { getDemoResponses };
