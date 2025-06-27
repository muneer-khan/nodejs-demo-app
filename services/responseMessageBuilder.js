const { IntentTypes, StatusType, AddressSearchTypes, ActionTypes } = require("../appStrings");

async function generateCustomMessage({
  intent,
  role = null,
  status = null,
  placeName = '',
  items = '',
  orderNo = '',
  reason = '',
  hasAllRequired = false
}) {

  switch (intent) {
    case IntentTypes.PICKUP:
    case IntentTypes.DROPOFF:
      const roleLabel = role;
      const oppositeRole = role === IntentTypes.PICKUP ? IntentTypes.DROPOFF : IntentTypes.PICKUP;

      switch (status) {
        case StatusType.SUCCESS:
          return "Would you like to confirm the " + roleLabel + "?";

        case AddressSearchTypes.SUGGESTED:
          return `There are a few ${placeName} near your selected ${oppositeRole} location. Where would you like to ${roleLabel}?`;

        case AddressSearchTypes.NOT_FOUND:
          return `I couldn't find a nearby ${placeName}. Where would you like to ${roleLabel === 'pickup' ? 'get' : 'send'} the items?`;

        case AddressSearchTypes.NOT_FOUND:
          return `Where would you like to ${roleLabel === 'pickup' ? 'get' : 'send'} the items? I can suggest some nearby places.`;

        default:
          return null;
      }

    case IntentTypes.SUGGESTION:
      return `What kind of item or place are you looking for suggestions about?`;
    case IntentTypes.SUGGEST_PICKUP:
    case IntentTypes.SUGGEST_DROPOFF:
      return `Here are some suggestions near you.`;
    case IntentTypes.OUT_OF_SCOPE:
      return `I'm sorry, but I’m not able to help with that. I can assist with pickups, drop-offs, or finding items. What would you like to do?`;
    case ActionTypes.NEW_ORDER:
      return `I can help you with a new order. Please provide the details of what you need, including pickup and drop-off locations, items, and any notes.`;  
    case ActionTypes.MODIFY:
      if(status === StatusType.FAILED) {
        if(reason === "not_modifiable") {
          return `Your order cannot be modified at this time. It may already be confirmed or cancelled. If you need help with anything else, just let me know!`;
        } else if(reason === "order_not_found") {
          return `You don't have an active order to modify the items, what would you like to order now?`;
        } else if(reason === StatusType.ERROR) {
          return `Error modifying your order`
        } 
      } else {
        return `Your order has been modified successfully. Please confirm your order or modify the items if you need.`;  
      }
    case ActionTypes.CONFIRM:
      if(status === "not_confirmed") {
        return `Your order cannot be confirmed at this time. It may already be confirmed or cancelled. If you need help with anything else, just let me know!`;
      } else if(status === "order_not_found") {
        return `You don't have an active order to confirm, what would you like to order now?`;
      } else if(status === StatusType.ERROR) {
        return `Error confirming your order`
      } else  {
        if(orderNo) {
          return `You have confirmed your order. Your order No: ${orderNo}. How would you like to pay?`;  
        }
      }
    case ActionTypes.CANCEL:
      if(status === "not_cancellable") {
        return `Your order cannot be cancelled at this time. It may already be confirmed or cancelled. If you need help with anything else, just let me know!`;
      } else if(status === "order_not_found") {
        return `You don't have an active order to cancel, what would you like to order now?`;
      } else if(status === StatusType.ERROR) {
        return `Error cancelling your order`
      } else {
        return `You have cancelled your order. If you need help with anything else, just let me know!`;  
      }
    case 'paymentSuccess':
      return `Thank you for ordering with us. Your order status will be updated shortly`;
    default:
      return `I'm here to help you with orders or deliveries. What would you like to do?`;
  }
}

module.exports = {
  generateCustomMessage
};
