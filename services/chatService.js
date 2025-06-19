const { db, fieldValue } = require('../services/firebase');

async function storeChatConversations(userMessage, systemResponse, userId, sessionId, userMessageType, topic) {
  console.log('Storing chat conversation:', { userMessage, systemResponse, userId });
  const newMessages = [
        { "role": "user", "content": userMessage, "message_type": userMessageType, created_at: new Date() },
        { "role": "system", "content": systemResponse, created_at: new Date() }
      ];

  let chatRef;

  if (sessionId) {
    chatRef = await db.collection('chats').doc(sessionId);

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

async function getChatHistory(userId) {
    try {
        const snapshot = await db.collection('chats')
        .where('user_id', '==', userId)
        .select('topic', 'status') 
        .get();

        const history = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
        }));
        return history
    } catch (error) {
        console.error('Error fetching chat messages:', error);
        throw error;
    }
}

module.exports = {
  storeChatConversations, getUserActiveChatSession, setUserActiveChatSession, getChatMessages, getChatHistory
};