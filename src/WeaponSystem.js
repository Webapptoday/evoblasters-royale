export const WEAPONS = [
  // Required
  { level: 1, name: "Basic Blaster", damage: 10, fireRateMs: 260, magSize: 10, reloadMs: 3000, bulletSpeed: 750 },
  // Required
  { level: 2, name: "Rapid Blaster", damage: 12, fireRateMs: 240, magSize: 10, reloadMs: 3000, bulletSpeed: 800 },
];

export function getWeaponByLevel(level) {
  return WEAPONS.find(w => w.level === level) ?? WEAPONS[0];
}
