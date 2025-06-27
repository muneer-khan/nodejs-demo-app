// services/mapsService.js

async function searchPlaces({ query, nearLocation, type = 'place' }) {
    console.log(`Searching for ${type} with query: ${query} near location: ${nearLocation}`);
    
  // Simulated data
  const mockPlacesDB = [
    { name: 'Pizza Pizza', type: 'place', item: 'pizza', address: '123 Main St' },
    { name: 'Pizza Hut', type: 'place', item: 'pizza', address: '456 Central Ave' },
    { name: 'Blaze Pizza', type: 'place', item: 'pizza', address: '789 Broad St' },
    { name: 'Pizza Pizza', type: 'place', item: 'pasta', address: '321 Olive Blvd' },
    { name: 'Cheesy Slice', type: 'place', item: 'pizza', address: '654 Maple Lane' },
    { name: 'Burger Town', type: 'place', item: 'burger', address: '888 King Street' },
    { name: 'Staples', type: 'place', item: 'package', address: '654 Maple Lane' },
    { name: 'Staples', type: 'place', item: 'package', address: '888 Maple Lane' },
  ];

  // Filter logic
  const results = mockPlacesDB.filter(place => {
    if (type === 'place') {
      return place.name.toLowerCase().includes(query.toLowerCase());
    } else if (type === 'item') {
      return place.item.toLowerCase() === query.toLowerCase();
    }
    return false;
  });

  // Limit results
  const limit = type === 'place' ? 3 : 5;
  return results.slice(0, limit);
}

function isValidAddress(address) {
  if (!address || typeof address !== 'string') return false;

  // Trim and normalize
  address = address.trim();

  // A very basic rule: starts with a number, followed by 2 or more words with letters
  const addressRegex = /^\d{1,6}[\w\s\-\,\.]{3,}$/i;

  // Must have at least 2 letter-based words (not just numbers or noise)
  const wordParts = address.match(/[a-zA-Z]{2,}/g);

  return addressRegex.test(address) && wordParts && wordParts.length >= 2;
}

async function getFullAddress(address) {
  return address
}

module.exports = {
  searchPlaces, isValidAddress, getFullAddress
};
