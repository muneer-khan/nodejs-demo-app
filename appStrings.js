const OrderStatus = {
  INCOMPLETE: "incomplete",
  PENDING: "pending",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
  COMPLETE: "complete"
};

const PromptTypes = {
  ACTIVE_ORDER: "active_order",
  NEW_ORDER: "new_order",
};

const ConfirmationLabels = {
  CONFIRM: "Confirm Order",
  CANCEL: "Cancel Order"
};

const DefaultLabels = {
    TOPIC: "General Inquiry",
}

const ActionTypes = {
    MODIFY: "modify",
    CONFIRM: "confirm",
    CANCEL: "cancel",
    INFO: "info",
    OUT_OF_SCOPE: "oos",
    NEW_ORDER: "newOrder",
    ADD: "add",
    REMOVE: "remove",
    REPLACE: "replace"
}

const SuggestionTypes = {
    ORDER_CONFIRMATION: "orderConfirmation",
    SUGGEST_PICKUP: "suggestPickup",
    SUGGEST_DROPOFF: "suggestDropoff",
    PAYMENT_TYPES: "paymentTypes",
}

const OrderFields = {
    PICKUP_ADDRESS: "pickupAddress",
    DROPOFF_ADDRESS: "dropoffAddress",
    ITEMS: "items"
}

const IntentTypes = {
    PICKUP: "pickup",
    DROPOFF: "dropoff",
    INFO: "info",
    GREETINGS: "greetings",
    OUT_OF_SCOPE: "oos",
    SUGGESTION: "suggestion",
    SUGGEST_PICKUP: "suggestPickup",
    SUGGEST_DROPOFF:"suggestDropoff"
}

const AddressSearchTypes = {
    ITEM: "item",
    PLACE: "place",
    SUGGESTED: "suggested",
    NOT_FOUND: "not_found",
    MISSING_NAME: "missing_name"
}

const StatusType = {
    SUCCESS: "success",
    FAILED: "failed",
    ERROR: "error",
}

module.exports = {OrderStatus, OrderFields, StatusType, AddressSearchTypes,
    IntentTypes, SuggestionTypes, PromptTypes, ActionTypes, ConfirmationLabels, DefaultLabels
}