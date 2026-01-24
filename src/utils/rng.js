/**
 * Centralized Random Number Generation (RNG) utilities
 * Provides consistent RNG calculations across the application
 */

/**
 * Generates a random number between 0 (inclusive) and 1 (exclusive)
 * @returns {number} Random number between 0 and 1
 */
export function random() {
  return Math.random();
}

/**
 * Generates a random number between 0 (inclusive) and max (exclusive)
 * @param {number} max - Maximum value (exclusive)
 * @returns {number} Random number between 0 and max
 */
export function randomMax(max) {
  return Math.random() * max;
}

/**
 * Generates a random number between min (inclusive) and max (exclusive)
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (exclusive)
 * @returns {number} Random number between min and max
 */
export function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Generates a random integer between 0 (inclusive) and max (exclusive)
 * @param {number} max - Maximum value (exclusive)
 * @returns {number} Random integer between 0 and max
 */
export function randomInt(max) {
  return Math.floor(Math.random() * max);
}

/**
 * Generates a random integer between min (inclusive) and max (inclusive)
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {number} Random integer between min and max
 */
export function randomIntRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generates a random percentage value between 0-100
 * Commonly used for risk-based calculations
 * @returns {number} Random number between 0 and 100
 */
export function randomPercent() {
  return Math.random() * 100;
}

/**
 * Checks if a random event occurs based on a percentage chance
 * @param {number} chance - Percentage chance (0-100)
 * @returns {boolean} True if the event occurs
 */
export function randomChance(chance) {
  return Math.random() * 100 < chance;
}

/**
 * Selects a random element from an array
 * @param {Array} array - Array to select from
 * @returns {*} Random element from the array
 */
export function randomElement(array) {
  if (array.length === 0) return undefined;
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generates a random number in a range with min and max percentages
 * Useful for price adjustments and other percentage-based calculations
 * @param {number} minPercent - Minimum percentage (0-1)
 * @param {number} maxPercent - Maximum percentage (0-1)
 * @returns {number} Random number between minPercent and maxPercent
 */
export function randomPercentRange(minPercent, maxPercent) {
  return minPercent + Math.random() * (maxPercent - minPercent);
}
