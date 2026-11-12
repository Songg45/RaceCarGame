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

// Approximate game tuning, not manufacturer performance specifications.
export const ROAD_CARS = Object.freeze([
  { id: 'civic', name: 'Honda Civic', body: 'sedan', maxSpeed: 51, acceleration: 4.8, braking: 9.4, grip: 0.99, mass: 1360, color: '#52b8da', length: 4.5, width: 1.82 },
  { id: 'corolla', name: 'Toyota Corolla', body: 'sedan', maxSpeed: 48, acceleration: 4.2, braking: 8.8, grip: 0.94, mass: 1390, color: '#e8ded0', length: 4.6, width: 1.80 },
  { id: 'camry', name: 'Toyota Camry', body: 'sedan', maxSpeed: 54, acceleration: 4.6, braking: 9.1, grip: 0.98, mass: 1580, color: '#a7adbb', length: 4.9, width: 1.84 },
  { id: 'accord', name: 'Honda Accord', body: 'sedan', maxSpeed: 55, acceleration: 5.0, braking: 9.3, grip: 1.0, mass: 1550, color: '#3670c2', length: 4.9, width: 1.86 },
  { id: 'mustang', name: 'Ford Mustang', body: 'coupe', maxSpeed: 65, acceleration: 6.1, braking: 10.0, grip: 1.08, mass: 1730, color: '#f2bc45', length: 4.8, width: 1.92 },
  { id: 'mazda3', name: 'Mazda3', body: 'hatchback', maxSpeed: 53, acceleration: 4.8, braking: 9.7, grip: 1.05, mass: 1430, color: '#b93846', length: 4.5, width: 1.80 },
  { id: 'golf', name: 'Volkswagen Golf', body: 'hatchback', maxSpeed: 54, acceleration: 5.2, braking: 9.8, grip: 1.06, mass: 1410, color: '#d9e7e7', length: 4.3, width: 1.80 },
  { id: 'f150', name: 'Ford F-150', body: 'pickup', maxSpeed: 46, acceleration: 3.9, braking: 8.0, grip: 0.86, mass: 2250, color: '#6c8c80', length: 5.5, width: 2.04 },
  { id: 'rav4', name: 'Toyota RAV4', body: 'suv', maxSpeed: 47, acceleration: 4.2, braking: 8.4, grip: 0.91, mass: 1720, color: '#ec8157', length: 4.6, width: 1.86 },
  { id: 'charger', name: 'Dodge Charger', body: 'sedan', maxSpeed: 61, acceleration: 5.6, braking: 9.5, grip: 1.02, mass: 1930, color: '#8d7ac7', length: 5.0, width: 1.91 },
].map(Object.freeze));

export const STOCK_CAR = Object.freeze({
  id: 'stock', name: 'V8 Stock Car', body: 'stock', maxSpeed: 89, acceleration: 7.2,
  braking: 12.6, grip: 1.45, mass: 1540, color: '#ff6742', length: 5.0, width: 2.0,
});

export const STOCK_COLORS = Object.freeze(['#ff6742', '#46b8dd', '#f1c84b', '#b59af5', '#dbe2e8', '#51bd9a', '#e568a5', '#ef8d45', '#668cde', '#9ccf5c']);

export const getTrack = (id) => TRACKS.find((track) => track.id === id) || TRACKS[0];
export const getRoadCar = (id) => ROAD_CARS.find((car) => car.id === id) || ROAD_CARS[0];
