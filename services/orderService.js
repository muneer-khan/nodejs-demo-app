const { v4: uuidv4 } = require('uuid');
const { db } = require('../services/firebase');

async function modifyOrder(orderId, updates = {}) {
  try {
    const orderRef = await db.collection('orders').doc(orderId);
    const orderSnapshot = await orderRef.get();

    if (!orderSnapshot.exists) {
      throw new Error('Order not found');
    }
    
    const orderData = orderSnapshot.data();
    console.log("order found", orderData);
    
    if (orderData.status === 'confirmed' || orderData.status === 'cancelled') {
      return {
        success: false,
        reason: 'not_modifiable',
        message: 'Order cannot be modified once confirmed or already cancelled'
      };
    }

    const allowedFields = ['pickup_address', 'dropoff_address', 'items', 'driver_notes', 'status', 'package_status'];
    const updatePayload = {};

    // Only update allowed fields if they are present in the updates
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        updatePayload[key] = updates[key];
      }
    }
    const finalData = {
          ...orderData,
          ...updatePayload
        };

    updatePayload.updated_at = new Date();
    const hasAllRequired = finalData.pickup_address && finalData.dropoff_address && Array.isArray(finalData.items) && finalData.items.length > 0;
    
    if (!updates.status) {
      updatePayload.status = hasAllRequired ? 'pending' : 'incomplete';
    }

    if (!updates.package_status) {
      updatePayload.package_status = updatePayload.status === 'pending' ? 'awaiting confirmation' : null;
    }

    await orderRef.update(updatePayload);

    return { success: true, message: 'Order updated successfully', updates: updatePayload };
  } catch (error) {
    console.error('Error modifying order:', error.message);
    return { success: false, reason: 'error',error: error.message };
  }
}

async function createOrder({
  intent,
  userId,
  pickupAddress,
  pickupPlace,
  dropoffAddress,
  dropoffPlace,
  items = [],
  chatSessionId,
  notes
}) {
  const orderNumber = uuidv4().split('-')[0]; // short UUID
  const createdAt = new Date();
  const updatedAt = new Date();

  const hasAllRequired = pickupAddress && dropoffAddress && items.length > 0;

  const status = hasAllRequired ? 'pending' : 'incomplete';
  const packageStatus = status === 'pending' ? 'awaiting confirmation' : null;

  const orderData = {
    order_number: orderNumber,
    intent: intent,
    user_id: userId,
    pickup_address: pickupAddress || null,
    pickup_place: !pickupAddress ? pickupPlace || null : null,
    dropoff_address: dropoffAddress || null,
    dropoff_place: !dropoffAddress ? dropoffPlace || null : null,
    status, 
    items: items,
    notes, notes,
    chatSessionId: chatSessionId,
    package_status: packageStatus,
    created_from: "chat",
    created_at: createdAt,
    updated_at: updatedAt,
  };

  const orderRef = await db.collection('orders').add(orderData);

  return { orderId: orderRef.id, status, order_number: orderNumber };
}

async function cancelOrder(orderId) {
  try {
    const orderRef = await db.collection('orders').doc(orderId);
    const orderSnapshot = await orderRef.get();

    if (!orderSnapshot.exists) {
      throw new Error('Order not found');
    }

    const orderData = orderSnapshot.data();
    console.log("orderData", orderData);
    

    if (orderData.status === 'confirmed' || orderData.status === 'cancelled') {
      return {
        success: false,
        reason: 'not_cancellable',
        message: 'Order cannot be cancelled once confirmed or already cancelled'
      };
    }

    await orderRef.update({
      status: 'cancelled',
      updated_at: new Date()
    });

    return { success: true, message: 'Order cancelled successfully' };
  } catch (error) {
    console.error('Error cancelling order:', error.message);
    return { success: false, reason: 'error', error: error.message };
  }
}


module.exports = {
  createOrder, modifyOrder, cancelOrder
};