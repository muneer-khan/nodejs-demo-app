const { v4: uuidv4 } = require('uuid');
const { db } = require('../services/firebase');

async function modifyOrder(orderId, updates = {}) {
  try {
    const orderRef = await db.collection('orders').doc(orderId);
    const orderSnapshot = await orderRef.get();

    if (!orderSnapshot.exists) {
      return { success: false, reason: 'order_not_found', hasAllRequired: false };
    }
    
    const orderData = orderSnapshot.data();
    console.log("order found", orderData);
    console.log("updates", updates);
    
    if (orderData.status === 'cancelled' || 
        (orderData.status === 'confirmed' && orderData.payment_status == "success")) {
      return {
        success: false,
        reason: 'not_modifiable',
        hasAllRequired: false,
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

    return { success: true, message: 'Order updated successfully', hasAllRequired: hasAllRequired };
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
    payment_status: null,
    payment_type: null,
    created_from: "chat",
    created_at: createdAt,
    updated_at: updatedAt,
  };

  const orderRef = await db.collection('orders').add(orderData);

  return { orderId: orderRef.id, status, order_number: orderNumber, hasAllRequired: hasAllRequired };
}

async function updateOrderStatus(orderId, status) {
  try {
    const orderRef = await db.collection('orders').doc(orderId);
    const orderSnapshot = await orderRef.get();

    if (!orderSnapshot.exists) {
       return { success: false, reason: "order_not_found" };
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
      status: status,
      updated_at: new Date()
    });

    return { success: true, message: `Order ${status} successfully`, orderNo: orderData.order_number };
  } catch (error) {
    console.error('Error modyfying order status:', error.message);
    return { success: false, reason: 'error', error: error.message };
  }
}

async function updatePaymentStatus(orderId, status, paymentType) {
  try {
    const orderRef = await db.collection('orders').doc(orderId);
    const orderSnapshot = await orderRef.get();

    if (!orderSnapshot.exists) {
       return { success: false, reason: "order_not_found" };
    }

    const orderData = orderSnapshot.data();
    console.log("orderData", orderData);
    

    if (orderData.status != 'confirmed') {
      return {
        success: false,
        reason: 'not_confirmed',
        message: 'Payment cannot be updated until order confirmed'
      };
    }

    await orderRef.update({
      payment_status: status,
      payment_type: paymentType,
      updated_at: new Date()
    });

    return { success: true, message: `Order payment status updated successfully`, orderNo: orderData.order_number };
  } catch (error) {
    console.error('Error modyfying order status:', error.message);
    return { success: false, reason: 'error', error: error.message };
  }
}

async function isOrderActive(orderId) {
  if (!orderId) {
    return false;
  }

  try {
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnapshot = await orderRef.get();

    if (!orderSnapshot.exists) {
      return false;
    }

    const orderData = orderSnapshot.data();

    // Consider the order inactive if it's confirmed or cancelled
    if (orderData.status === 'cancelled') {
      return false;
    }

    if(orderData.status === 'confirmed' && orderData.payment_status === "success") {
      return false;
    }

    return true; // Order is active (e.g., incomplete or pending)
  } catch (error) {
    console.error('Error checking order status:', error.message);
    return false; // Treat errors as non-active status
  }
}

async function getOrderIntent(orderId) {
  try {
    const orderRef = await db.collection('orders').doc(orderId);
    const orderSnapshot = await orderRef.get();

    if (!orderSnapshot.exists) {
      return null;
    }
    
    const orderData = orderSnapshot.data();
    return orderData.intent;
  } catch (error) {
    console.error('Error fetching order intent:', error.message);
    return null; // Treat errors as non-active status
  }
}


module.exports = {
  createOrder, modifyOrder, isOrderActive, getOrderIntent, updateOrderStatus, updatePaymentStatus
};