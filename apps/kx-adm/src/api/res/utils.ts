export function getRandomHexColor() {
  return `#${Math.floor(Math.random() * 0x1_00_00_00)
    .toString(16)
    .padStart(6, '0')}`;
}
