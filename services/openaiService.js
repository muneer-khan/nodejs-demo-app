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

module.exports = getAIResponse;
