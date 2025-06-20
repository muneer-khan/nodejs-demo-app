async function resolveAddress(aiResponse, userLocation) {
    if(!aiResponse) {
        return null;
    }
    const {
    intent,
    "pickup-place": aiPickupPlace,
    "pickup-address": aiPickupAddress,
    "dropoff-place": aiDropoffPlace,
    "dropoff-address": aiDropoffAddress,
  } = aiResponse;

    let address = {};

    if(intent === "pickup" || intent === "suggest-pickup") {
        address.pickupAddress = aiPickupAddress;
        address.pickupPlace = aiPickupPlace;
        address.dropoffAddress = userLocation;
        address.dropoffPlace = aiDropoffPlace;
    } else if(intent === "dropoff" || intent === "suggest-dropoff") {
        address.pickupAddress = userLocation;
        address.pickupPlace = aiPickupPlace;
        address.dropoffAddress = aiDropoffAddress;
        address.dropoffPlace = aiDropoffPlace;
    } else {
        return null;
    }
    return address;
}

module.exports = {
    resolveAddress
}