const { v4: uuidv4 } = require('uuid');
const { db } = require('../services/firebase');

const fieldMap = {
  pickupAddress: 'pickup_address',
  dropoffAddress: 'dropoff_address',
  driverNotes: 'driver_notes',
  pickupPlace: 'pickup_place',
  dropoffPlace: 'dropoff_place',
};

async function modifyOrder(orderId, updates = {}) {
  try {
    const orderRef = await db.collection('orders').doc(orderId);
    const orderSnapshot = await orderRef.get();

   const validation = await validateOrderBeforeModification(orderSnapshot);
    if (!validation.valid) {
      return { success: false, reason: validation.reason, message: validation.message };
    }
    const orderData = orderSnapshot.data();

    const updatePayload = mapRequestToDbFields(updates);
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

function mapRequestToDbFields(requestData) {
  const mappedData = {};

  for (const [reqKey, dbKey] of Object.entries(fieldMap)) {
    if (requestData.hasOwnProperty(reqKey)) {
      mappedData[dbKey] = requestData[reqKey];
    }
  }

  return mappedData;
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

async function getOrderData(orderId) {
  const orderRef = db.collection('orders').doc(orderId);
  const snapshot = await orderRef.get();
  if (!snapshot.exists) return null;

  return snapshot.data();
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

async function itemExists(orderId, itemName) {
  const data = await getOrderData(orderId);
  return data.items?.some(i => i.item.toLowerCase() === itemName.toLowerCase());
}

async function validateOrderBeforeModification(orderSnapshot) {
  if (!orderSnapshot.exists) {
    return {
      valid: false,
      reason: 'order_not_found',
      message: 'Order not found',
    };
  }

  const order = orderSnapshot.data();

  if (order.status === 'cancelled' || (order.status === 'confirmed' && order.payment_status === 'success')) {
    return {
      valid: false,
      reason: 'not_modifiable',
      message: 'Order cannot be modified after confirmation or cancellation',
      order,
    };
  }

  return { valid: true, order };
}


async function modifyItem(orderId, itemName, value) {
  const orderRef = db.collection('orders').doc(orderId);
  const snapshot = await orderRef.get();

  const validation = await validateOrderBeforeModification(snapshot);
  if (!validation.valid) {
    return { success: false, reason: validation.reason, message: validation.message };
  }

  let items = snapshot.data().items || [];
  const index = items.findIndex(i => i.item.toLowerCase() === itemName.toLowerCase());

  if (index > -1) {
    if (typeof value === 'string') {
      // replace item name
      items[index].item = value;
    } else if (typeof value === 'number') {
      items[index].quantity += value;
      if (items[index].quantity <= 0) items.splice(index, 1); 
    }
    await orderRef.update({ items });
    const hasAllRequired = checkHasAllRequired(snapshot.data(), items);
    return { success: true, hasAllRequired: hasAllRequired };
  }
}

async function addItem(orderId, newItem) {
    
    const orderRef = db.collection('orders').doc(orderId);
    const snapshot = await orderRef.get();

    const validation = await validateOrderBeforeModification(snapshot);
    if (!validation.valid) {
      return { success: false, reason: validation.reason, message: validation.message };
    }
  let items = snapshot.data().items || [];
  items.push(newItem);
  await orderRef.update({ items });
  const hasAllRequired = checkHasAllRequired(snapshot.data(), items);
  return { success: true, hasAllRequired: hasAllRequired };
}

function checkHasAllRequired(order, items) {
  return (
    typeof order.pickup_address === 'string' &&
    typeof order.dropoff_address === 'string' &&
    Array.isArray(items) &&
    items.length > 0
  );
}


module.exports = {
  createOrder, modifyOrder, isOrderActive, getOrderIntent, getOrderData,
  updateOrderStatus, updatePaymentStatus, addItem, modifyItem, itemExists
};