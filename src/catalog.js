const MILE = 1609.344;

function circuit(id, name, subtitle, miles, standardLaps, straightRatio, width, banking, accent, source) {
  const referenceMiles = miles;
  const originalLength = referenceMiles * MILE;
  const originalStraightLength = originalLength * straightRatio;
  const radius = (originalLength - 2 * originalStraightLength) / (2 * Math.PI);
  // A 20-car pit row needs 318m of full bay footprints plus entry/exit space.
  // Extend both stadium straights while keeping the original turn radius;
  // never squeeze the pit row onto a bend or pretend the longer lap is .533mi.
  const straightLength = Math.max(600, originalStraightLength);
  const expanded = straightLength > originalStraightLength;
  const length = 2 * straightLength + 2 * Math.PI * radius;
  const actualMiles = length / MILE;
  return Object.freeze({
    id, name, subtitle: expanded ? `${subtitle} · expanded oval` : subtitle,
    miles: actualMiles, length, standardLaps, width, banking, accent,
    referenceMiles, originalStraightLength, expanded, straightLength, radius,
    lapLabel: `${standardLaps} laps · ${(actualMiles * standardLaps).toFixed(1).replace(/\.0$/, '')} miles`,
    source,
  });
}

// Scheduled lap limits follow their inspiration events. Geometry and banking
// are fictional; undersized straights are extended and actual distances updated.
export const TRACKS = Object.freeze([
  circuit('daytona', 'Atlantic Superspeedway', 'Daytona 500 inspired', 2.5, 200, 0.27, 28, 0.20, '#f5ae41',
    'https://www.nascar.com/news-media/2026/02/13/cup-series-2026-what-to-watch-daytona-500-preview/'),
  circuit('talladega', 'Alabama Speedway', 'Talladega 500 inspired', 2.66, 188, 0.28, 30, 0.22, '#4cd7cf',
    'https://www.nascar.com/news-media/2026/04/25/cup-series-2026-talladega-what-to-watch-jack-links-500-preview/'),
  circuit('bristol', 'Thunder Bowl', 'Bristol 500 inspired', 0.533, 500, 0.19, 23, 0.18, '#ba95ff',
    'https://www.nascar.com/news-media/2026/04/11/cup-series-2026-bristol-what-to-watch-food-city-500-preview/'),
]);

// All role values are arcade tuning, not manufacturer or mechanical claims.
export const TRUCK_SAFE_SPEED = 15 * 0.44704;
export const STREET_CLASSES = Object.freeze([
  { id: 'sports', name: 'Sports / Muscle', speedRank: 1, protectionLabel: 'Most vulnerable', potholeFactor: 1.25, description: 'Fastest street class. Powerful acceleration, vulnerable tires and running gear.', maxSpeed: 65, acceleration: 6.1, braking: 10, grip: 1.04, mass: 1770, length: 4.9, width: 1.94, body: 'coupe', color: '#f2bc45', representativeId: 'mustang' },
  { id: 'sedan', name: 'Sedan / Compact', speedRank: 2, protectionLabel: 'Balanced protection', potholeFactor: 1, description: 'Second fastest. Predictable handling and strong braking.', maxSpeed: 55, acceleration: 4.8, braking: 10.4, grip: 1.09, mass: 1500, length: 4.6, width: 1.84, body: 'sedan', color: '#52b8da', representativeId: 'civic' },
  { id: 'suv', name: 'SUV / Van', speedRank: 3, protectionLabel: 'Strong protection', potholeFactor: 0.70, description: 'Durable utility class. Stop anywhere for mobile repairs; pit stops recharge. Contact during repair causes severe damage and loses the crew for the race.', maxSpeed: 47, acceleration: 4.2, braking: 8.4, grip: 0.92, mass: 1800, length: 4.8, width: 1.98, body: 'suv', color: '#ec8157', representativeId: 'rav4' },
  { id: 'truck', name: 'Truck', speedRank: 4, protectionLabel: 'Toughest · protected below 15 mph', potholeFactor: 0.45, description: 'Slowest and toughest. Fully protected from new pothole impacts below 15 mph.', maxSpeed: 44, acceleration: 3.9, braking: 8, grip: 0.86, mass: 2250, length: 5.5, width: 2.04, body: 'pickup', color: '#6c8c80', representativeId: 'f150' },
].map(Object.freeze));
export const getStreetClass = (id) => STREET_CLASSES.find((entry) => entry.id === id) || STREET_CLASSES[1];

// Ten familiar visual identities remain on the grid, but each role has one
// shared performance/physical specification. A sedan-shaped Charger is Sports.
export const ROAD_CARS = Object.freeze([
  { id: 'civic', name: 'Honda Civic', streetClassId: 'sedan', body: 'sedan', color: '#52b8da' },
  { id: 'corolla', name: 'Toyota Corolla', streetClassId: 'sedan', body: 'sedan', color: '#e8ded0' },
  { id: 'camry', name: 'Toyota Camry', streetClassId: 'sedan', body: 'sedan', color: '#a7adbb' },
  { id: 'accord', name: 'Honda Accord', streetClassId: 'sedan', body: 'sedan', color: '#3670c2' },
  { id: 'mustang', name: 'Ford Mustang', streetClassId: 'sports', body: 'coupe', color: '#f2bc45' },
  { id: 'mazda3', name: 'Mazda3', streetClassId: 'sedan', body: 'hatchback', color: '#b93846' },
  { id: 'golf', name: 'Volkswagen Golf', streetClassId: 'sedan', body: 'hatchback', color: '#d9e7e7' },
  { id: 'f150', name: 'Ford F-150', streetClassId: 'truck', body: 'pickup', color: '#6c8c80' },
  { id: 'rav4', name: 'Toyota RAV4', streetClassId: 'suv', body: 'suv', color: '#ec8157' },
  { id: 'charger', name: 'Dodge Charger', streetClassId: 'sports', body: 'sedan', color: '#8d7ac7' },
].map((model) => Object.freeze({ ...getStreetClass(model.streetClassId), ...model, streetClassName: getStreetClass(model.streetClassId).name })));

export const STOCK_CAR = Object.freeze({
  id: 'stock', name: 'V8 Stock Car', body: 'stock', maxSpeed: 89, acceleration: 7.2,
  braking: 12.6, grip: 1.45, mass: 1540, color: '#ff6742', length: 5.0, width: 2.0,
});

export const STOCK_COLORS = Object.freeze(['#ff6742', '#46b8dd', '#f1c84b', '#b59af5', '#dbe2e8', '#51bd9a', '#e568a5', '#ef8d45', '#668cde', '#9ccf5c']);

export const getTrack = (id) => TRACKS.find((track) => track.id === id) || TRACKS[0];
export const getRoadCar = (id) => ROAD_CARS.find((car) => car.id === id) || ROAD_CARS[0];
