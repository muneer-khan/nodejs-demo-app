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

module.exports = {
  searchPlaces
};
