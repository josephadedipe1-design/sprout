import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DISTRICT_AREA_NAMES: Record<string, string> = {
  // SE London
  SE1: 'Southwark', SE2: 'Abbey Wood', SE3: 'Blackheath', SE4: 'Brockley',
  SE5: 'Camberwell', SE6: 'Catford', SE7: 'Charlton', SE8: 'Deptford',
  SE9: 'Eltham', SE10: 'Greenwich', SE11: 'Kennington', SE12: 'Lee',
  SE13: 'Lewisham', SE14: 'New Cross', SE15: 'Peckham', SE16: 'Bermondsey',
  SE17: 'Walworth', SE18: 'Woolwich', SE19: 'Crystal Palace', SE20: 'Penge',
  SE21: 'Dulwich', SE22: 'East Dulwich', SE23: 'Forest Hill', SE24: 'Herne Hill',
  SE25: 'South Norwood', SE26: 'Sydenham', SE27: 'West Norwood', SE28: 'Thamesmead',
  // SW London
  SW1: 'Westminster', SW2: 'Brixton', SW3: 'Chelsea', SW4: 'Clapham',
  SW5: "Earl's Court", SW6: 'Fulham', SW7: 'South Kensington', SW8: 'Stockwell',
  SW9: 'Stockwell', SW10: 'Chelsea', SW11: 'Battersea', SW12: 'Balham',
  SW13: 'Barnes', SW14: 'Mortlake', SW15: 'Putney', SW16: 'Streatham',
  SW17: 'Tooting', SW18: 'Wandsworth', SW19: 'Wimbledon', SW20: 'Raynes Park',
  // N London
  N1: 'Islington', N2: 'East Finchley', N3: 'Finchley', N4: 'Finsbury Park',
  N5: 'Highbury', N6: 'Highgate', N7: 'Holloway', N8: 'Hornsey',
  N9: 'Lower Edmonton', N10: 'Muswell Hill', N11: 'New Southgate', N12: 'North Finchley',
  N13: 'Palmers Green', N14: 'Southgate', N15: 'Seven Sisters', N16: 'Stoke Newington',
  N17: 'Tottenham', N18: 'Upper Edmonton', N19: 'Archway', N20: 'Whetstone',
  N21: 'Winchmore Hill', N22: 'Wood Green',
  // NW London
  NW1: 'Camden', NW2: 'Cricklewood', NW3: 'Hampstead', NW4: 'Hendon',
  NW5: 'Kentish Town', NW6: 'Kilburn', NW7: 'Mill Hill', NW8: "St John's Wood",
  NW9: 'Kingsbury', NW10: 'Harlesden', NW11: 'Golders Green',
  // E London
  E1: 'Whitechapel', E2: 'Bethnal Green', E3: 'Bow', E4: 'Chingford',
  E5: 'Clapton', E6: 'East Ham', E7: 'Forest Gate', E8: 'Hackney',
  E9: 'Homerton', E10: 'Leyton', E11: 'Leytonstone', E12: 'Manor Park',
  E13: 'Plaistow', E14: 'Canary Wharf', E15: 'Stratford', E16: 'Canning Town',
  E17: 'Walthamstow', E18: 'South Woodford',
  // W London
  W1: 'Mayfair', W2: 'Paddington', W3: 'Acton', W4: 'Chiswick',
  W5: 'Ealing', W6: 'Hammersmith', W7: 'Hanwell', W8: 'Kensington',
  W9: 'Maida Vale', W10: 'Ladbroke Grove', W11: 'Notting Hill', W12: "Shepherd's Bush",
  W13: 'West Ealing', W14: 'West Kensington',
  // EC / WC
  EC1: 'Clerkenwell', EC2: 'City of London', EC3: 'City of London', EC4: 'City of London',
  WC1: 'Bloomsbury', WC2: 'Covent Garden',
  // Outer London
  BR1: 'Bromley', BR2: 'Bromley', BR3: 'Beckenham', BR4: 'West Wickham', BR5: 'Orpington',
  CR0: 'Croydon', CR4: 'Mitcham',
  DA16: 'Welling', DA18: 'Thamesmead',
  // Birmingham
  B1: 'Birmingham', B2: 'Birmingham', B3: 'Birmingham', B4: 'Birmingham',
  B5: 'Digbeth', B12: 'Balsall Heath', B15: 'Edgbaston', B16: 'Edgbaston', B17: 'Harborne',
  // Manchester
  M1: 'Manchester', M2: 'Manchester', M3: 'Manchester', M4: 'Manchester',
  M8: 'Moston', M12: 'Ardwick', M13: 'Longsight', M14: 'Fallowfield',
  M15: 'Hulme', M16: 'Chorlton', M19: 'Levenshulme', M20: 'Didsbury',
  M21: 'Chorlton', M22: 'Wythenshawe',
  // Leeds
  LS1: 'Leeds', LS2: 'Leeds', LS3: 'Leeds', LS4: 'Burley', LS5: 'Kirkstall',
  LS6: 'Headingley', LS7: 'Chapel Allerton', LS16: 'Adel',
  // Edinburgh
  EH1: 'Edinburgh', EH2: 'Edinburgh', EH3: 'Edinburgh', EH4: 'Edinburgh',
  EH6: 'Leith', EH7: 'Edinburgh', EH8: 'Edinburgh', EH9: 'Morningside',
};

/** Maps a postcode district (e.g. "SE13") to "Area, DISTRICT" format (e.g. "Lewisham, SE13"). */
export function formatLocation(postcode_district: string): string {
  if (!postcode_district) return '';
  const upper = postcode_district.toUpperCase().trim();
  const area = DISTRICT_AREA_NAMES[upper];
  return area ? `${area}, ${upper}` : upper;
}

export const CATEGORY_STYLES: Record<string, { bg: string; color: string }> = {
  Travel:        { bg: '#DBEAFE', color: '#1E40AF' },
  Sleep:         { bg: '#EDE9FE', color: '#6D28D9' },
  Clothing:      { bg: '#FEF3C7', color: '#92400E' },
  Toys:          { bg: '#FEE2E2', color: '#991B1B' },
  Gear:          { bg: '#DCFCE7', color: '#166534' },
  Feeding:       { bg: '#FFEDD5', color: '#9A3412' },
  Furniture:     { bg: '#F3F4F6', color: '#1F2937' },
  Education:     { bg: '#ECFDF5', color: '#065F46' },
  Miscellaneous: { bg: '#F5F0EC', color: '#7a6055' },
};

export function getCategoryStyle(category: string): { bg: string; color: string } {
  return CATEGORY_STYLES[category] ?? { bg: '#f4f3f0', color: '#9a8070' };
}
