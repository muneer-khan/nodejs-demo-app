async function resolveAddress(aiResponse, userLocation) {
    if(!aiResponse) {
        return null;
    }
    const {
    intent,
    pickupPlace,
    pickupAddress,
    dropoffPlace,
    dropoffAddress,
  } = aiResponse;

    let address = {};

    if(intent === "pickup" || intent === "suggestPickup") {
        address.pickupAddress = pickupAddress;
        address.pickupPlace = pickupPlace;
        address.dropoffAddress = userLocation;
        address.dropoffPlace = dropoffPlace;
    } else if(intent === "dropoff" || intent === "suggestDropoff") {
        address.pickupAddress = userLocation;
        address.pickupPlace = pickupPlace;
        address.dropoffAddress = dropoffAddress;
        address.dropoffPlace = dropoffPlace;
    } else {
        return null;
    }
    return address;
}

module.exports = {
    resolveAddress
}