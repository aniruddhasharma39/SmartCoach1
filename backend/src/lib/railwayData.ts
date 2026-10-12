/**
 * Indian Railways Zone -> Division reference data.
 *
 * This is the single source of truth for the Zone/Division dropdowns in the
 * LC Gate (Cluster) module. It is served to the web and mobile clients via
 * `GET /api/v1/lcgate/reference-data` so both clients always show identical
 * options.
 *
 * Ported from the R2P project (`r2p_app/lib/core/constants/railway_data.dart`).
 */
export const RAILWAY_DATA: Record<string, string[]> = {
  'Central Railway': ['Mumbai CST', 'Bhusawal', 'Pune', 'Solapur', 'Nagpur CR'],
  'Western Railway': ['Ratlam', 'Mumbai Central', 'Vadodara', 'Ahmedabad', 'Rajkot', 'Bhavnagar'],
  'Northern Railway': ['Delhi', 'Ambala', 'Firozpur', 'Lucknow NR', 'Moradabad'],
  'North Central Railway': ['Prayagraj', 'Agra', 'Jhansi'],
  'North Western Railway': ['Jaipur', 'Ajmer', 'Bikaner', 'Jodhpur'],
  'West Central Railway': ['Jabalpur', 'Bhopal', 'Kota'],
  'Eastern Railway': ['Howrah', 'Sealdah', 'Asansol', 'Malda'],
  'East Central Railway': [
    'Danapur',
    'Pt. Deen Dayal Upadhyaya',
    'Dhanbad',
    'Samastipur',
    'Sonpur',
  ],
  'North Eastern Railway': ['Lucknow NER', 'Izzatnagar', 'Varanasi'],
  'Northeast Frontier Railway': ['Lumding', 'Katihar', 'Alipurduar', 'Rangiya', 'Tinsukia'],
  'South Central Railway': ['Secunderabad', 'Hyderabad', 'Nanded'],
  'Southern Railway': [
    'Chennai',
    'Tiruchirappalli',
    'Madurai',
    'Palakkad',
    'Salem',
    'Thiruvananthapuram',
  ],
  'South Western Railway': ['Hubballi', 'Bengaluru', 'Mysuru'],
  'South Eastern Railway': ['Kharagpur', 'Chakradharpur', 'Adra', 'Ranchi'],
  'South East Central Railway': ['Bilaspur', 'Raipur', 'Nagpur SEC'],
  'East Coast Railway': ['Khurda Road', 'Sambalpur', 'Rayagada'],
  'South Coast Railway': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Guntakal'],
  'Konkan Railway': ['Ratnagiri', 'Karwar'],
  'Kolkata Metro Railway': ['Headquarters'],
};

/** List of all Railway Zones. */
export const RAILWAY_ZONES: string[] = Object.keys(RAILWAY_DATA);

/** Divisions belonging to a given zone (case-insensitive). */
export function divisionsForZone(zone?: string | null): string[] {
  if (!zone) return [];
  const key = Object.keys(RAILWAY_DATA).find(
    (z) => z.toLowerCase() === zone.trim().toLowerCase()
  );
  return key ? RAILWAY_DATA[key] : [];
}
