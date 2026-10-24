import assert from 'node:assert/strict'
import { test } from 'node:test'

import { extractPhone, parseMemory } from './phone'

const ids: [string, string][] = [
  ['Samsung Galaxy A56 (8GB RAM 128GB)', 'samsung-galaxy-a56-8gb-128gb'],
  ['Galaxy A57 5G 8GB / 256GB', 'samsung-galaxy-a57-8gb-256gb'],
  ['Samsung Galaxy A57 5G 12GB RAM 256GB Company Warranty', 'samsung-galaxy-a57-12gb-256gb'],
  ['SAMSUNG Galaxy S26 Ultra 5G 12GB + 256GB', 'samsung-galaxy-s26-ultra-12gb-256gb'],
  ['Samsung Galaxy S24 FE-5G (8GB RAM 256GB)', 'samsung-galaxy-s24-fe-8gb-256gb'],
  ['Samsung Galaxy S24 FE 5G 8GB | 128GB', 'samsung-galaxy-s24-fe-8gb-128gb'],
  ['Samsung Galaxy Z Flip 6 12GB RAM 256GB', 'samsung-galaxy-z-flip-6-12gb-256gb'],
  ['Samsung Galaxy Z Fold 7 (12GB RAM 512GB)', 'samsung-galaxy-z-fold-7-12gb-512gb'],
  ['Samsung Galaxy A14 6+128', 'samsung-galaxy-a14-6gb-128gb'],
  ['Samsung Galaxy A16 5G (8GB RAM 256GB)', 'samsung-galaxy-a16-5g-8gb-256gb'],
  ['Samsung Galaxy A15 4G 8GB RAM 128GB', 'samsung-galaxy-a15-4g-8gb-128gb'],
  // Ruling 5: Redmi Note 13 Pro is sold as both 4G and 5G, so the network stays.
  ['Xiaomi Redmi Note 13 Pro 5G (8GB RAM 256GB)', 'xiaomi-redmi-note-13-pro-5g-8gb-256gb'],
  ['Redmi Note 13 8GB-256GB', 'xiaomi-redmi-note-13-8gb-256gb'],
  ['Redmi 12 6GB+128GB', 'xiaomi-redmi-12-6gb-128gb'],
  ['REDMI 15 6GB + 128GB', 'xiaomi-redmi-15-6gb-128gb'],
  ['Xiaomi Redmi 13 4G 6GB RAM 128GB GENXT Warranty', 'xiaomi-redmi-13-6gb-128gb'],
  ['Xiaomi Mi 13T 5G 12GB RAM 256GB', 'xiaomi-13t-12gb-256gb'],
  ['Xiaomi Poco X6 Pro 5G 8GB RAM 256GB', 'xiaomi-poco-x6-pro-8gb-256gb'],
  ['Apple iPhone 17 Pro Max 256GB', 'apple-iphone-17-pro-max-256gb'],
  ['Apple iphone 18 pro 256GB', 'apple-iphone-18-pro-256gb'],
  ['Apple iPhone 17 <br>256GB', 'apple-iphone-17-256gb'],
  ['Apple iPhone 17 (256GB) E-SIM', 'apple-iphone-17-256gb-esim'],
  ['Apple iPhone 16e 128GB (E-sim) with Apple Care', 'apple-iphone-16e-128gb-esim'],
  ['Apple iPhone 16 Pro Max (E-Sim) 1TB with Apple Care', 'apple-iphone-16-pro-max-1024gb-esim'],
  ['Apple iPhone 17 Air 256GB', 'apple-iphone-air-256gb'],
  ['Apple iPhone Air 256GB with Apple Care', 'apple-iphone-air-256gb'],
  ['Google Pixel 8 Pro (12GB RAM 256GB)', 'google-pixel-8-pro-12gb-256gb'],
  ['Google 10 Pro XL 12GB | 512GB', 'google-pixel-10-pro-xl-12gb-512gb'],
  ['Google Pixel 9 Pro Fold 16GB RAM 256GB', 'google-pixel-9-pro-fold-16gb-256gb'],
  ['HONOR Magic V5 Foldable 16GB RAM 512GB', 'honor-magic-v5-16gb-512gb'],
  ['HONOR X9d – 12GB/256GB', 'honor-x9d-12gb-256gb'],
  ['Honor X7D (8GB / 256GB )', 'honor-x7d-8gb-256gb'],
  ['MOTO G04S 4GB ⎢ 64GB', 'motorola-moto-g04s-4gb-64gb'],
  ['Motorola Moto G06 Power 4GB RAM 64GB', 'motorola-moto-g06-power-4gb-64gb'],
  ['Moto e40 4GB RAM 64GB – Carbon Gray', 'motorola-moto-e40-4gb-64gb'],
  ['Motorola Edge 60 12GB RAM 256GB 5G', 'motorola-edge-60-12gb-256gb'],
  ['Nothing Phone (1) 12GB RAM 256GB', 'nothing-phone-1-12gb-256gb'],
  ['NOTHING Phone ( 3a ) Lite 8GB / 128GB', 'nothing-phone-3a-lite-8gb-128gb'],
  ['CMF Phone 2 Pro 8GB / 128GB', 'nothing-cmf-phone-2-pro-8gb-128gb'],
  ['OnePlus Nord N20 SE 4GB RAM 128GB', 'oneplus-nord-n20-se-4gb-128gb'],
  ['Infinix Hot 60 Pro+ 8GB | 256GB', 'infinix-hot-60-pro-plus-8gb-256gb'],
  ['Infinix Hot 60 Pro 8GB | 256GB', 'infinix-hot-60-pro-8gb-256gb'],
  ['Oppo A6x 4G 4GB | 128GB', 'oppo-a6x-4g-4gb-128gb'],
  ['Realme Note 60x 4G (4GB RAM 64GB)', 'realme-note-60x-4g-4gb-64gb'],
  ['Motorola Moto G24 Power 8+8GB RAM 128GB', 'motorola-moto-g24-power-8gb-128gb'],
  ['OnePlus 6 128GB -Mirror Black 8GB RAM', 'oneplus-6-8gb-128gb'],
  // Coverage fixes (2026-10-24 scrape)
  ['Apple iPhone 16 128GB E – Sim with Apple Care', 'apple-iphone-16-128gb-esim'],
  ['Samsung Galaxy S24 Ultra (12GB RAM512GB)', 'samsung-galaxy-s24-ultra-12gb-512gb'],
  ['Apple iPhone 12 Purple – Genxt Warranty 128GB', 'apple-iphone-12-128gb'],
  ['iPhone 12 Purple – Gnext Warranty 128GB', 'apple-iphone-12-128gb'],
  ['Apple iPhone 7 RED 128GB', 'apple-iphone-7-128gb'],
  ['Apple iPhone 8 Product (RED) 256GB', 'apple-iphone-8-256gb'],
  ['Honor Play10 (4GB / 128GB)', 'honor-play-10-4gb-128gb'],
  ['OnePlus Nord CE3 5G 12GB 256GB', 'oneplus-nord-ce-3-12gb-256gb'],
  ['Samsung Galaxy Note10+ 12GB RAM, 256GB', 'samsung-galaxy-note-10-plus-12gb-256gb'],
  ['CMF by Nothing Phone 1 8GB RAM 256GB', 'nothing-cmf-phone-1-8gb-256gb'],
  // Ruling 5: 4G and 5G versions of one name are different phones (5G sells ~15k LKR higher).
  ['Xiaomi Redmi Note 15 4G 8GB RAM 256GB', 'xiaomi-redmi-note-15-4g-8gb-256gb'],
  ['Xiaomi Redmi Note 15 5G 8GB RAM 256GB', 'xiaomi-redmi-note-15-5g-8gb-256gb'],
  ['Tecno Camon 50 Pro 8GB RAM 256GB 5G', 'tecno-camon-50-pro-5g-8gb-256gb'],
  // Fix round 1, I1: a token-less 4G title must not merge with the 5G version.
  ['Xiaomi Redmi Note 10 4GB RAM, 128GB', 'xiaomi-redmi-note-10-4gb-128gb'],
  ['Xiaomi Redmi Note 10 5G 4GB RAM 128GB', 'xiaomi-redmi-note-10-5g-4gb-128gb'],
  ['Xiaomi Mi 11 Lite 6GB RAM, 128GB', 'xiaomi-11-lite-6gb-128gb'],
  ['Xiaomi Mi 11 Lite 5G 6GB RAM 128GB', 'xiaomi-11-lite-5g-6gb-128gb'],
  ['Samsung Galaxy M32 6GB RAM 128GB', 'samsung-galaxy-m32-6gb-128gb'],
  ['Samsung Galaxy M32 5G 6GB RAM 128GB', 'samsung-galaxy-m32-5g-6gb-128gb'],
  ['Samsung Galaxy A13 4GB RAM 64GB', 'samsung-galaxy-a13-4gb-64gb'],
  ['Samsung Galaxy A13 5G 4GB RAM 64GB', 'samsung-galaxy-a13-5g-4gb-64gb'],
  ['Samsung Galaxy A22 6GB RAM 128GB', 'samsung-galaxy-a22-6gb-128gb'],
  ['Samsung Galaxy A22 5G 6GB RAM 128GB', 'samsung-galaxy-a22-5g-6gb-128gb'],
  ['Xiaomi Poco M4 Pro 6GB RAM 128GB', 'xiaomi-poco-m4-pro-6gb-128gb'],
  ['Xiaomi Poco M4 Pro 5G 6GB RAM 128GB', 'xiaomi-poco-m4-pro-5g-6gb-128gb'],
  ['Xiaomi Redmi Note 11 Pro 6GB RAM 128GB', 'xiaomi-redmi-note-11-pro-6gb-128gb'],
  ['Xiaomi Redmi Note 11 Pro 5G 6GB RAM 128GB', 'xiaomi-redmi-note-11-pro-5g-6gb-128gb'],
  ['Google Pixel 4a 6GB RAM, 128GB', 'google-pixel-4a-6gb-128gb'],
  ['Google Pixel 4a 5G 6GB RAM, 128GB', 'google-pixel-4a-5g-6gb-128gb'],
  // I2: "N+" is part of the model name unless it is virtual RAM.
  ['Samsung Galaxy Note 10+ 12GB RAM 256GB', 'samsung-galaxy-note-10-plus-12gb-256gb'],
  ['realme 12+ 5G 8GB 256GB', 'realme-12-plus-8gb-256gb'],
  ['Tecno Spark 20 8+ 8GB RAM 256GB', 'tecno-spark-20-8gb-256gb'],
  ['Tecno Spark 30 4G 8+ 8GB RAM 128GB', 'tecno-spark-30-8gb-128gb'],
  ['Tecno Spark 30C 5G 4+ 4GB RAM 128GB', 'tecno-spark-30c-4gb-128gb'],
  ['ZTE Blade V50 Design 4 + 10GB RAM 256GB', 'zte-blade-v50-design-4gb-256gb'],
  // M1: an accessory after "with" does not make the title not a phone.
  ['Honor 400 Pro 5G 12GB RAM 512GB With Buds', 'honor-400-pro-12gb-512gb'],
  // M3: a dash before non-colour words is part of the name.
  ['Infinix Note 40 Pro -Racing Edition 8GB 256GB', 'infinix-note-40-pro-racing-edition-8gb-256gb'],
]
for (const [title, id] of ids) {
  test(`id: ${title}`, () => {
    const r = extractPhone(title)
    assert.ok('phoneId' in r, `dropped: ${JSON.stringify(r)}`)
    assert.equal(r.phoneId, id)
  })
}

const drops: [string, string][] = [
  ['Samsung Galaxy Tab S6 Lite 2024 (4GB RAM 128GB)', 'not-a-phone'],
  ['Honor Pad X9a 8GB | 256GB', 'not-a-phone'],
  ['Blackview Color 8 8+8GB RAM 128GB', 'brand'],
  ['Softlogic Max 222 2025', 'brand'],
  ['Alcatel 1021', 'brand'],
  ['Nokia 105 with Company Warranty', 'no-storage'],
  ['Samsung Galaxy S21 Ultra 5G with Free Gift', 'no-storage'],
  ['Google Pixel 7 ⎢256', 'no-ram'],
  ['Google Pixel 9a 128GB', 'no-ram'],
  ['iPhone 13 128GB (Used)', 'used'],
  // Ruling 6: Hono is its own feature-phone brand, not a typo for Honor.
  ['Hono H1 Plus', 'brand'],
  // M2: laptops share shelves with phones.
  ['Apple MacBook Air M2 8GB 256GB', 'not-a-phone'],
]
for (const [title, reason] of drops) {
  test(`drop ${reason}: ${title}`, () => {
    assert.deepEqual(extractPhone(title), { drop: reason })
  })
}

test('display fields', () => {
  assert.deepEqual(extractPhone('Galaxy A57 5G 8GB / 256GB'), {
    phoneId: 'samsung-galaxy-a57-8gb-256gb', brand: 'Samsung', model: 'Galaxy A57', ramGb: 8, storageGb: 256, esimOnly: false,
  })
  assert.deepEqual(extractPhone('Apple iPhone 17 (256GB) E-SIM'), {
    phoneId: 'apple-iphone-17-256gb-esim', brand: 'Apple', model: 'iPhone 17', ramGb: null, storageGb: 256, esimOnly: true,
  })
})

const memory: [string, { ramGb: number | null; storageGb: number | null }][] = [
  ['Samsung Galaxy A14 6+128', { ramGb: 6, storageGb: 128 }],
  ['Motorola Moto G24 Power 8+8GB RAM 128GB', { ramGb: 8, storageGb: 128 }],
  ['Google Pixel 7 ⎢256', { ramGb: null, storageGb: 256 }],
  ['Nokia 105 with Company Warranty', { ramGb: null, storageGb: null }],
  ['Apple iPhone 16 Pro Max (E-Sim) 1TB with Apple Care', { ramGb: null, storageGb: 1024 }],
  ['OnePlus 6 128GB -Mirror Black 8GB RAM', { ramGb: 8, storageGb: 128 }],
  ['Samsung Galaxy S24 Ultra (12GB RAM512GB)', { ramGb: 12, storageGb: 512 }],
  ['Samsung Galaxy Note 10+ 12GB RAM 256GB', { ramGb: 12, storageGb: 256 }],
  ['Tecno Spark 20 8+ 8GB RAM 256GB', { ramGb: 8, storageGb: 256 }],
]
for (const [title, expected] of memory) {
  test(`memory: ${title}`, () => {
    assert.deepEqual(parseMemory(title), expected)
  })
}
