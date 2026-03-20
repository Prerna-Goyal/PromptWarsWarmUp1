export type WorkloadType = 'Training' | 'Inference';

export interface HardwareProfile {
  name: string;
  powerW: number; // Watts
  embodiedCarbonKg: number; // Manufacturing footprint
}

export interface RegionProfile {
  name: string;
  carbonIntensity: number; // kg CO2e / kWh
  waterIntensity: number; // Liters / kWh
  pue: number; // Power Usage Effectiveness
  isGreen?: boolean;
}

export interface WorkloadInput {
  type: WorkloadType;
  modelName: string;
  hardware: string;
  count: number;
  durationHours: number;
  region: string;
  utilization: number; // 0 to 1
  timeOfDay: 'Day' | 'Night'; // Night usually has more renewables or lower load
  
  // Training specific
  epochs?: number;
  parametersBillion?: number;
  
  // Inference specific
  tokensMillion?: number;
  batchSize?: number;
}

export interface FootprintResult {
  operationalEnergyKWh: number;
  operationalCarbonKg: number;
  embodiedCarbonKg: number;
  totalCarbonKg: number;
  waterLiters: number;
  metrics: {
    perEpoch?: number; // kg CO2
    perMillionTokens?: number; // kg CO2
    perInference?: number; // kg CO2
  };
  equivalents: {
    carMiles: number;
    treeYears: number;
    smartphoneCharges: number;
  };
}

export interface Run {
  id: string;
  model_name: string;
  hardware: string;
  region: string;
  type: string;
  status: 'running' | 'finished';
  start_time: string;
  end_time?: string;
  total_energy_kwh: number;
  total_carbon_kg: number;
  total_water_l: number;
}

export interface Metric {
  id: number;
  run_id: string;
  timestamp: string;
  gpu_power_w: number;
  cpu_power_w: number;
}
