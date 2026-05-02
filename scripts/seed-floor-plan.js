#!/usr/bin/env node
/**
 * Seed a sample floor plan for the "Coffee Clan" restaurant demo.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/seed-floor-plan.js
 *
 * Or with dotenv:
 *   node -r dotenv/config scripts/seed-floor-plan.js
 *
 * Idempotent — safe to run multiple times.
 */

const RESTAURANT_SLUG = 'coffee-clan';

// ─── Floor plan layout ───────────────────────────────────────────────────────

const CANVAS_W = 1400;
const CANVAS_H = 900;

const walls = [
  {
    id: 'wall-outer',
    points: [
      { x: 60, y: 60 },
      { x: 1340, y: 60 },
      { x: 1340, y: 840 },
      { x: 60, y: 840 },
    ],
  },
  {
    id: 'wall-indoor-outdoor',
    points: [
      { x: 920, y: 60 },
      { x: 920, y: 840 },
    ],
  },
];

const counter = {
  x: 400,
  y: 700,
  width: 240,
  height: 80,
  rotation: 0,
};

const doors = [
  { id: 'door-main', x: 120, y: 840, rotation: 0 },
];

const zones = [
  {
    id: 'zone-indoor',
    name: 'Indoor',
    x: 80,
    y: 80,
    width: 820,
    height: 740,
    color: 'blue',
  },
  {
    id: 'zone-outdoor',
    name: 'Outdoor',
    x: 940,
    y: 80,
    width: 380,
    height: 740,
    color: 'green',
  },
];

const labels = [
  { id: 'label-window', text: 'Window Seats', x: 120, y: 130 },
  { id: 'label-main', text: 'Main Dining', x: 300, y: 340 },
  { id: 'label-garden', text: 'Garden', x: 1060, y: 100 },
];

const tables = [
  // Indoor — 3 round 2-seaters near front (window seats)
  { id: 'ft-t1', table_number: 1, display_name: 'T1', x: 120, y: 180, shape: 'round', capacity: 2 },
  { id: 'ft-t2', table_number: 2, display_name: 'T2', x: 300, y: 180, shape: 'round', capacity: 2 },
  { id: 'ft-t3', table_number: 3, display_name: 'T3', x: 480, y: 180, shape: 'round', capacity: 2 },

  // Indoor — 3 square 4-seaters in the middle
  { id: 'ft-t4', table_number: 4, display_name: 'T4', x: 140, y: 380, shape: 'square', capacity: 4 },
  { id: 'ft-t5', table_number: 5, display_name: 'T5', x: 340, y: 380, shape: 'square', capacity: 4 },
  { id: 'ft-t6', table_number: 6, display_name: 'T6', x: 540, y: 380, shape: 'square', capacity: 4 },

  // Indoor — 2 rectangular 6-seaters near back wall
  { id: 'ft-t7', table_number: 7, display_name: 'T7', x: 140, y: 560, shape: 'square', capacity: 6 },
  { id: 'ft-t8', table_number: 8, display_name: 'T8', x: 400, y: 560, shape: 'square', capacity: 6 },

  // Outdoor — 2 round 2-seaters
  { id: 'ft-t9',  table_number: 9,  display_name: 'T9',  x: 980,  y: 180, shape: 'round', capacity: 2 },
  { id: 'ft-t10', table_number: 10, display_name: 'T10', x: 1180, y: 180, shape: 'round', capacity: 2 },

  // Outdoor — 2 square 4-seaters
  { id: 'ft-t11', table_number: 11, display_name: 'T11', x: 980,  y: 380, shape: 'square', capacity: 4 },
  { id: 'ft-t12', table_number: 12, display_name: 'T12', x: 1180, y: 380, shape: 'square', capacity: 4 },

  // Outdoor — 1 rectangular 6-seater
  { id: 'ft-t13', table_number: 13, display_name: 'T13', x: 1020, y: 560, shape: 'square', capacity: 6 },
];

const floorPlan = {
  tables,
  labels,
  walls,
  counter,
  doors,
  zones,
  floorStyle: 'wood',
};

// ─── Supabase client ─────────────────────────────────────────────────────────

async function main() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY (or NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)');
    process.exit(1);
  }

  // Minimal fetch-based Supabase REST client (no SDK dependency)
  async function supabaseRequest(method, path, body) {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: method === 'POST' ? 'resolution=merge-duplicates,return=representation' : 'return=representation',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Supabase ${method} ${path} ${res.status}: ${text}`);
    }
    return text ? JSON.parse(text) : null;
  }

  // 1. Find the restaurant
  console.log(`Looking for restaurant with slug "${RESTAURANT_SLUG}"...`);
  const restaurants = await supabaseRequest('GET', `restaurants?slug=eq.${RESTAURANT_SLUG}&select=id,name,slug`);

  if (!restaurants || restaurants.length === 0) {
    console.error(`Restaurant "${RESTAURANT_SLUG}" not found. Available slugs:`);
    const all = await supabaseRequest('GET', 'restaurants?select=slug,name&limit=20');
    for (const r of (all || [])) console.log(`  - ${r.slug} (${r.name})`);
    process.exit(1);
  }

  const restaurant = restaurants[0];
  console.log(`Found: ${restaurant.name} (${restaurant.id})`);

  // 2. Update floor_plan JSON on the restaurant
  console.log('Setting floor plan...');
  await supabaseRequest(
    'PATCH',
    `restaurants?id=eq.${restaurant.id}`,
    { floor_plan: floorPlan },
  );
  console.log('Floor plan saved.');

  // 3. Upsert table records (idempotent via table_number + restaurant_id)
  console.log('Upserting table records...');
  const tableRows = tables.map(t => ({
    id: t.id,
    restaurant_id: restaurant.id,
    table_number: t.table_number,
    display_name: t.display_name,
  }));
  await supabaseRequest('POST', 'tables', tableRows);
  console.log(`${tableRows.length} table records upserted.`);

  console.log('Done! Open the floor plan editor to see the layout.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
