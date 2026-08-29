import type { PhoneRegion, SimCardView } from '#/api/msg';

const PHONE_REGION_MARKS: Record<PhoneRegion, string> = {
  hong_kong: '港',
  mainland_china: '内',
  other: '外',
  unknown: '?',
};

export function phoneRegionMark(region: PhoneRegion) {
  return PHONE_REGION_MARKS[region];
}

export function simCardOptionLabel(
  card: Pick<SimCardView, 'phone_number' | 'phone_region'>,
) {
  return `${phoneRegionMark(card.phone_region)} ${card.phone_number || '无号码'}`;
}
