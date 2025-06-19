async function generateCustomMessage({
  intent,
  role = null,
  status = null,
  placeName = '',
  items = '',
}) {

  switch (intent) {
    case 'pickup':
    case 'dropoff':
      const roleLabel = role;
      const oppositeRole = role === 'pickup' ? 'dropoff' : 'pickup';

      switch (status) {
        case 'complete':
          return "Would you like to confirm the " + roleLabel + "?";

        case 'suggested':
          return `There are a few ${placeName} near your selected ${oppositeRole} location. Where would you like to ${roleLabel}?`;

        case 'not_found':
          return `I couldn't find a nearby ${placeName}. Where would you like to ${roleLabel === 'pickup' ? 'get' : 'send'} the ${items}?`;

        case 'missing_name':
          return `Where would you like to ${roleLabel === 'pickup' ? 'get' : 'send'} the ${items}? I can suggest some nearby places.`;

        default:
          return null;
      }

      case 'suggestion':
      if (items) {
        return `Here are some places for ${items} near you. `;
      }
      return `What kind of item or place are you looking for suggestions about?`;

    case 'out-of-scope':
      return `I'm sorry, but I’m not able to help with that. I can assist with pickups, drop-offs, or finding items. What would you like to do?`;
    case 'new-order':
      return `I can help you with a new order. Please provide the details of what you need, including pickup and drop-off locations, items, and any notes.`;  
    case 'modify-order':
      if(status === "not_modifiable") {
        return `Your order cannot be modified at this time. It may already be confirmed or cancelled. If you need help with anything else, just let me know!`;
      } else if(status === "error") {
        return `Error modifying your order`
      } else {
        return `Your order has been modified successfully. If you need help with anything else, just let me know!`;  
      }
    case 'cancel-order':
      if(status === "not_cancellable") {
        return `Your order cannot be cancelled at this time. It may already be confirmed or cancelled. If you need help with anything else, just let me know!`;
      } else if(status === "error") {
        return `Error cancelling your order`
      } else {
        return `You have cancelled your order. If you need help with anything else, just let me know!`;  
      }
      
    default:
      return `I'm here to help you with orders or deliveries. What would you like to do?`;
  }
}

module.exports = {
  generateCustomMessage
};
