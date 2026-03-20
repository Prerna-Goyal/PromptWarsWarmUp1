import { HardwareProfile, RegionProfile } from './types';

export const HARDWARE_PROFILES: HardwareProfile[] = [
  { name: 'NVIDIA H100', powerW: 700, embodiedCarbonKg: 2500 },
  { name: 'NVIDIA A100', powerW: 400, embodiedCarbonKg: 1500 },
  { name: 'NVIDIA V100', powerW: 300, embodiedCarbonKg: 1000 },
  { name: 'NVIDIA RTX 4090', powerW: 450, embodiedCarbonKg: 800 },
  { name: 'NVIDIA RTX 3090', powerW: 350, embodiedCarbonKg: 700 },
  { name: 'Google TPU v4', powerW: 200, embodiedCarbonKg: 1200 },
  { name: 'Generic CPU Server', powerW: 150, embodiedCarbonKg: 500 },
];

export const REGION_PROFILES: RegionProfile[] = [
  { name: 'India (Average)', carbonIntensity: 0.750, waterIntensity: 3.5, pue: 1.6 },
  { name: 'India (Karnataka - Green Grid)', carbonIntensity: 0.450, waterIntensity: 3.0, pue: 1.5, isGreen: true },
  { name: 'US East (N. Virginia)', carbonIntensity: 0.367, waterIntensity: 1.8, pue: 1.15 },
  { name: 'US West (Oregon)', carbonIntensity: 0.082, waterIntensity: 1.2, pue: 1.12, isGreen: true },
  { name: 'Europe (Frankfurt)', carbonIntensity: 0.311, waterIntensity: 1.5, pue: 1.2 },
  { name: 'Europe (Sweden)', carbonIntensity: 0.012, waterIntensity: 1.1, pue: 1.1, isGreen: true },
  { name: 'Asia (Singapore)', carbonIntensity: 0.408, waterIntensity: 2.5, pue: 1.3 },
  { name: 'Asia (Tokyo)', carbonIntensity: 0.441, waterIntensity: 2.0, pue: 1.25 },
];
