import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

// Strictly read-only Supabase client for rolling-stock telemetry
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const supabaseOdourUrl = process.env.SUPABASE_ODOUR_URL || '';
const supabaseOdourKey = process.env.SUPABASE_ODOUR_KEY || '';

// Strictly read-only Supabase client for Bad Odour project
export const supabaseOdour = createClient(supabaseOdourUrl, supabaseOdourKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export function getClientForService(serviceSlug: string) {
  if (serviceSlug === 'bad-odour') {
    return supabaseOdour;
  }
  return supabase;
}

export interface ServiceDefinition {
  slug: string;
  name: string;
  shortCode: string;
  description: string;
  icon: string;
  tableName: string;
  deviceSourceTable: string;
  primaryKey: string;
  defaultConfigs: {
    columnKey: string;
    displayName: string;
    dataType: 'number' | 'string' | 'boolean' | 'timestamp';
    displayStyle: 'card' | 'pill' | 'badge' | 'table-column';
    isVisible: boolean;
    isPrimaryKey?: boolean;
    sortOrder: number;
    gradientEnabled?: boolean;
    minGoodValue?: number;
    maxGoodValue?: number;
    warningValue?: number;
    criticalValue?: number;
    alertTriggerType?: string;
    alertThreshold?: string;
    alertMessage?: string;
  }[];
}

export const SMART_COACH_SERVICES: ServiceDefinition[] = [
  {
    slug: 'brake-binding',
    name: 'Brake Binding Monitoring (SCBB)',
    shortCode: 'SCBB',
    description: 'Brake cylinder pressure anomalies, thermal binding, and pneumatic valve defect detection',
    icon: 'Disc',
    tableName: 'bpc_pressure',
    deviceSourceTable: 'coaches_railway',
    primaryKey: 'coach_no',
    defaultConfigs: [
      { columnKey: 'coach_no', displayName: 'Coach No', dataType: 'string', displayStyle: 'badge', isVisible: true, isPrimaryKey: true, sortOrder: 0 },
      { columnKey: 'device_id', displayName: 'Device ID', dataType: 'string', displayStyle: 'pill', isVisible: true, sortOrder: 1 },
      { columnKey: 'Train_no', displayName: 'Train No', dataType: 'number', displayStyle: 'pill', isVisible: true, sortOrder: 2 },
      { columnKey: 'Location', displayName: 'Zone / Location', dataType: 'string', displayStyle: 'pill', isVisible: true, sortOrder: 3 },
      { columnKey: 'bp', displayName: 'Brake Pipe (kg/cm²)', dataType: 'number', displayStyle: 'card', isVisible: true, sortOrder: 4, gradientEnabled: true, minGoodValue: 4.8, maxGoodValue: 5.2, warningValue: 4.5, criticalValue: 4.0 },
      { columnKey: 'fp', displayName: 'Feed Pipe (kg/cm²)', dataType: 'number', displayStyle: 'card', isVisible: true, sortOrder: 5, gradientEnabled: true, minGoodValue: 5.8, maxGoodValue: 6.2, warningValue: 5.5, criticalValue: 5.0 },
      { columnKey: 'cr', displayName: 'Control Reservoir (kg/cm²)', dataType: 'number', displayStyle: 'card', isVisible: true, sortOrder: 6, gradientEnabled: false },
      { columnKey: 'bc', displayName: 'Brake Cylinder (kg/cm²)', dataType: 'number', displayStyle: 'card', isVisible: true, sortOrder: 7, gradientEnabled: true, minGoodValue: 0.0, maxGoodValue: 0.2, warningValue: 0.6, criticalValue: 1.5, alertTriggerType: 'GREATER_THAN', alertThreshold: '0.8', alertMessage: 'Abnormal Brake Cylinder pressure detected' },
      { columnKey: 'brake_status', displayName: 'Brake State', dataType: 'string', displayStyle: 'pill', isVisible: true, sortOrder: 8 },
      { columnKey: 'brake_duration', displayName: 'Duration (s)', dataType: 'number', displayStyle: 'card', isVisible: true, sortOrder: 9 },
      { columnKey: 'timestamp', displayName: 'Timestamp', dataType: 'timestamp', displayStyle: 'table-column', isVisible: true, sortOrder: 10 },
    ],
  },
  {
    slug: 'hot-axle',
    name: 'Hot Axle Monitoring System (HAMS)',
    shortCode: 'HAMS',
    description: 'Axle box temperature & PT1000 RTD sensor metrics transmitted over wireless LoRa nodes',
    icon: 'Thermometer',
    tableName: 'hams_data',
    deviceSourceTable: 'coaches_hams',
    primaryKey: 'device_id',
    defaultConfigs: [
      { columnKey: 'master_id', displayName: 'Coach LoRa Gateway', dataType: 'string', displayStyle: 'pill', isVisible: true, sortOrder: 0 },
      { columnKey: 'device_id', displayName: 'Axle Node ID', dataType: 'string', displayStyle: 'badge', isVisible: true, isPrimaryKey: true, sortOrder: 1 },
      { columnKey: 'temperature', displayName: 'Axle Temp (°C)', dataType: 'number', displayStyle: 'card', isVisible: true, sortOrder: 2, gradientEnabled: true, minGoodValue: 15.0, maxGoodValue: 55.0, warningValue: 65.0, criticalValue: 80.0, alertTriggerType: 'GREATER_THAN', alertThreshold: '75.0', alertMessage: 'Axle box temperature critical threshold exceeded' },
      { columnKey: 'temp_state', displayName: 'Thermal State', dataType: 'string', displayStyle: 'pill', isVisible: true, sortOrder: 3 },
      { columnKey: 'resistance', displayName: 'RTD Resistance (Ω)', dataType: 'number', displayStyle: 'card', isVisible: true, sortOrder: 4 },
      { columnKey: 'battery_voltage', displayName: 'Node Battery (V)', dataType: 'number', displayStyle: 'card', isVisible: true, sortOrder: 5, gradientEnabled: true, minGoodValue: 3.0, maxGoodValue: 4.2, warningValue: 2.8, criticalValue: 2.5 },
      { columnKey: 'battery_status', displayName: 'Battery Health', dataType: 'string', displayStyle: 'pill', isVisible: true, sortOrder: 6 },
      { columnKey: 'status', displayName: 'Signal Status', dataType: 'string', displayStyle: 'pill', isVisible: true, sortOrder: 7 },
      { columnKey: 'received_timestamp', displayName: 'Received At', dataType: 'timestamp', displayStyle: 'table-column', isVisible: true, sortOrder: 8 },
    ],
  },
  {
    slug: 'emergency-brake',
    name: 'Emergency Brake & ACP',
    shortCode: 'ACP',
    description: 'Alarm Chain Pulling (ACP), sudden pneumatic pressure drops, and distributor valve emergency events',
    icon: 'AlertOctagon',
    tableName: 'brake_fault_event',
    deviceSourceTable: 'coaches_railway',
    primaryKey: 'coach_no',
    defaultConfigs: [
      { columnKey: 'coach_no', displayName: 'Coach Number', dataType: 'string', displayStyle: 'badge', isVisible: true, isPrimaryKey: true, sortOrder: 0 },
      { columnKey: 'device_id', displayName: 'Device ID', dataType: 'string', displayStyle: 'pill', isVisible: true, sortOrder: 1 },
      { columnKey: 'fault_name', displayName: 'Fault / Event Type', dataType: 'string', displayStyle: 'card', isVisible: true, sortOrder: 2, alertTriggerType: 'EQUALS', alertThreshold: 'EMERGENCY BRAKE', alertMessage: 'Emergency Brake / ACP Event Triggered' },
      { columnKey: 'fault_duration', displayName: 'Duration (s)', dataType: 'number', displayStyle: 'card', isVisible: true, sortOrder: 3 },
      { columnKey: 'event_message', displayName: 'Event Details', dataType: 'string', displayStyle: 'table-column', isVisible: true, sortOrder: 4 },
      { columnKey: 'timestamp', displayName: 'Event Time', dataType: 'timestamp', displayStyle: 'table-column', isVisible: true, sortOrder: 5 },
    ],
  },
  {
    slug: 'bpc-pressure',
    name: 'BPC Pressure & Cycle Analysis',
    shortCode: 'BPC',
    description: 'Charging, discharging, and brake response cycle timing logs per passenger coach',
    icon: 'Gauge',
    tableName: 'pressure_logs',
    deviceSourceTable: 'pressure_logs',
    primaryKey: 'coach_number',
    defaultConfigs: [
      { columnKey: 'coach_number', displayName: 'Coach Number', dataType: 'string', displayStyle: 'badge', isVisible: true, isPrimaryKey: true, sortOrder: 0 },
      { columnKey: 'device_id', displayName: 'Device ID', dataType: 'string', displayStyle: 'pill', isVisible: true, sortOrder: 1 },
      { columnKey: 'current_pressure', displayName: 'Current Pressure (kg/cm²)', dataType: 'number', displayStyle: 'card', isVisible: true, sortOrder: 2 },
      { columnKey: 'charging_time', displayName: 'Charging Time (s)', dataType: 'string', displayStyle: 'card', isVisible: true, sortOrder: 3 },
      { columnKey: 'discharging_time', displayName: 'Discharging Time (s)', dataType: 'string', displayStyle: 'card', isVisible: true, sortOrder: 4 },
      { columnKey: 'brake_response_time', displayName: 'Response Time (s)', dataType: 'string', displayStyle: 'card', isVisible: true, sortOrder: 5 },
      { columnKey: 'battery_percentage', displayName: 'Battery (%)', dataType: 'number', displayStyle: 'card', isVisible: true, sortOrder: 6, gradientEnabled: true, minGoodValue: 70, maxGoodValue: 100, warningValue: 40, criticalValue: 20 },
      { columnKey: 'signal_strength', displayName: 'Signal (RSSI)', dataType: 'number', displayStyle: 'pill', isVisible: true, sortOrder: 7 },
      { columnKey: 'timestamp', displayName: 'Timestamp', dataType: 'timestamp', displayStyle: 'table-column', isVisible: true, sortOrder: 8 },
    ],
  },
  {
    slug: 'bad-odour',
    name: 'Bad Odour & Air Quality (BODR)',
    shortCode: 'BODR',
    description: 'Lavatory air quality, VOC index, Ammonia (NH3), Hydrogen Sulfide (H2S), and occupancy metrics',
    icon: 'Wind',
    tableName: 'bad_odour_data',
    deviceSourceTable: 'coaches_Bad_Odour',
    primaryKey: 'device_ID',
    defaultConfigs: [
      { columnKey: 'Coach_no', displayName: 'Coach Number', dataType: 'string', displayStyle: 'badge', isVisible: true, isPrimaryKey: true, sortOrder: 0 },
      { columnKey: 'device_ID', displayName: 'Sensor Unit ID', dataType: 'string', displayStyle: 'pill', isVisible: true, sortOrder: 1 },
      { columnKey: 'Train_No', displayName: 'Train No', dataType: 'string', displayStyle: 'pill', isVisible: true, sortOrder: 2 },
      { columnKey: 'location', displayName: 'Zone / Location', dataType: 'string', displayStyle: 'pill', isVisible: true, sortOrder: 3 },
      { columnKey: 'voc_index', displayName: 'VOC Index', dataType: 'number', displayStyle: 'card', isVisible: true, sortOrder: 4, gradientEnabled: true, minGoodValue: 0, maxGoodValue: 150, warningValue: 250, criticalValue: 400, alertTriggerType: 'GREATER_THAN', alertThreshold: '250', alertMessage: 'Elevated Volatile Organic Compounds (VOC) detected in coach lavatory' },
      { columnKey: 'nh3_ppm', displayName: 'Ammonia NH3 (ppm)', dataType: 'number', displayStyle: 'card', isVisible: true, sortOrder: 5, gradientEnabled: true, minGoodValue: 0.0, maxGoodValue: 1.0, warningValue: 3.0, criticalValue: 10.0, alertTriggerType: 'GREATER_THAN', alertThreshold: '3.0', alertMessage: 'High Ammonia concentration detected' },
      { columnKey: 'h2s_ppm', displayName: 'H2S Gas (ppm)', dataType: 'number', displayStyle: 'card', isVisible: true, sortOrder: 6, gradientEnabled: true, minGoodValue: 0.0, maxGoodValue: 0.5, warningValue: 1.5, criticalValue: 4.0 },
      { columnKey: 'methane_ppm', displayName: 'Methane CH4 (ppm)', dataType: 'number', displayStyle: 'card', isVisible: true, sortOrder: 7, gradientEnabled: true, minGoodValue: 0.0, maxGoodValue: 20.0, warningValue: 45.0, criticalValue: 80.0 },
      { columnKey: 'temperature', displayName: 'Ambient Temp (°C)', dataType: 'number', displayStyle: 'card', isVisible: true, sortOrder: 8 },
      { columnKey: 'humidity', displayName: 'Humidity (%)', dataType: 'number', displayStyle: 'card', isVisible: true, sortOrder: 9 },
      { columnKey: 'Bad_Odour_generation', displayName: 'Odour Status', dataType: 'string', displayStyle: 'pill', isVisible: true, sortOrder: 10 },
      { columnKey: 'Status_VOC', displayName: 'VOC Status', dataType: 'string', displayStyle: 'pill', isVisible: true, sortOrder: 11 },
      { columnKey: 'Door_Count', displayName: 'Door Usage Count', dataType: 'number', displayStyle: 'card', isVisible: true, sortOrder: 12 },
      { columnKey: 'timestamp', displayName: 'Timestamp', dataType: 'timestamp', displayStyle: 'table-column', isVisible: true, sortOrder: 13 },
    ],
  },
];

// Helper: Get service by slug
export function getServiceDefinition(slug: string): ServiceDefinition | undefined {
  return SMART_COACH_SERVICES.find((s) => s.slug === slug);
}

// Strictly read-only device fetcher
export async function fetchServiceDevices(serviceSlug: string) {
  const service = getServiceDefinition(serviceSlug);
  if (!service) return [];

  if (service.slug === 'brake-binding' || service.slug === 'emergency-brake') {
    const { data, error } = await supabase
      .from('coaches_railway')
      .select('id, technical_id, coach_no, device_id, Train_no, Location, Actual_id')
      .order('id', { ascending: true });
    if (error) {
      console.error('Error fetching coaches_railway:', error);
      return [];
    }
    return (data || []).map((row) => ({
      deviceId: row.device_id,
      coachNumber: row.coach_no,
      technicalId: String(row.technical_id || ''),
      trainNumber: String(row.Train_no || ''),
      location: row.Location || '',
      actualId: row.Actual_id || '',
      serviceSlug,
    }));
  }

  if (service.slug === 'hot-axle') {
    const { data, error } = await supabase
      .from('coaches_hams')
      .select('id, technical_id, coach_no, device_id, train_no, location, actual_id');
    if (error) {
      console.error('Error fetching coaches_hams:', error);
      return [];
    }

    // Also get distinct active sensor node device_ids from recent hams_data
    const { data: activeNodes } = await supabase
      .from('hams_data')
      .select('device_id, master_id')
      .order('id', { ascending: false })
      .limit(30);

    const devicesMap = new Map<string, any>();
    (data || []).forEach((row) => {
      devicesMap.set(row.device_id, {
        deviceId: row.device_id,
        coachNumber: row.coach_no,
        technicalId: row.technical_id,
        trainNumber: row.train_no,
        location: row.location,
        actualId: row.actual_id,
        serviceSlug,
      });
    });

    (activeNodes || []).forEach((node) => {
      if (!devicesMap.has(node.device_id)) {
        devicesMap.set(node.device_id, {
          deviceId: node.device_id,
          coachNumber: `Master ${node.master_id}`,
          technicalId: '',
          trainNumber: '',
          location: 'Axle Bogie',
          actualId: node.device_id,
          serviceSlug,
        });
      }
    });

    return Array.from(devicesMap.values());
  }

  if (service.slug === 'bpc-pressure') {
    // Get unique coaches from pressure_logs
    const { data, error } = await supabase
      .from('pressure_logs')
      .select('device_id, coach_number, coach_type, owning_rly, train_number')
      .limit(100);
    if (error) return [];

    const map = new Map<string, any>();
    (data || []).forEach((row) => {
      if (row.device_id && !map.has(row.device_id)) {
        map.set(row.device_id, {
          deviceId: row.device_id,
          coachNumber: row.coach_number || row.device_id,
          technicalId: row.coach_type || '',
          trainNumber: row.train_number || '',
          location: row.owning_rly || 'Indian Railways',
          actualId: row.device_id,
          serviceSlug,
        });
      }
    });
    return Array.from(map.values());
  }

  if (service.slug === 'bad-odour') {
    const { data, error } = await supabaseOdour
      .from('coaches_Bad_Odour')
      .select('id, Coach_ID, device_ID, Coach_no, Train_No, location')
      .order('id', { ascending: true });
    if (error) {
      console.error('Error fetching coaches_Bad_Odour:', error);
      return [];
    }
    return (data || []).map((row) => ({
      deviceId: row.device_ID,
      coachNumber: row.Coach_no || row.Coach_ID,
      technicalId: row.Coach_ID || '',
      trainNumber: row.Train_No || '',
      location: row.location || 'Indian Railways',
      actualId: row.device_ID,
      serviceSlug,
    }));
  }

  return [];
}
