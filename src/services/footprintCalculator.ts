import { WorkloadInput, FootprintResult } from '../types';
import { HARDWARE_PROFILES, REGION_PROFILES } from '../constants';

export function calculateFootprint(input: WorkloadInput): FootprintResult {
  const hardware = HARDWARE_PROFILES.find(h => h.name === input.hardware) || HARDWARE_PROFILES[0];
  const region = REGION_PROFILES.find(r => r.name === input.region) || REGION_PROFILES[0];

  // Time of day adjustment: Night often has lower carbon intensity (simplified model)
  const timeFactor = input.timeOfDay === 'Night' ? 0.85 : 1.0;
  const effectiveCarbonIntensity = region.carbonIntensity * timeFactor;

  // Operational Energy (kWh)
  const operationalEnergyKWh = (hardware.powerW * input.count * input.durationHours * region.pue * input.utilization) / 1000;

  // Operational Carbon (kg CO2e)
  const operationalCarbonKg = operationalEnergyKWh * effectiveCarbonIntensity;

  // Embodied Carbon (Amortized over 3 years = 26,280 hours)
  const totalEmbodied = hardware.embodiedCarbonKg * input.count;
  const embodiedCarbonKg = (totalEmbodied / 26280) * input.durationHours;

  // Water (L)
  const waterLiters = operationalEnergyKWh * region.waterIntensity;

  const totalCarbonKg = operationalCarbonKg + embodiedCarbonKg;

  // Metrics
  const metrics: FootprintResult['metrics'] = {};
  if (input.type === 'Training' && input.epochs) {
    metrics.perEpoch = totalCarbonKg / input.epochs;
  } else if (input.type === 'Inference' && input.tokensMillion) {
    metrics.perMillionTokens = totalCarbonKg / input.tokensMillion;
    metrics.perInference = totalCarbonKg / (input.tokensMillion * 1000); // Assuming 1000 inferences per 1M tokens avg
  }

  return {
    operationalEnergyKWh,
    operationalCarbonKg,
    embodiedCarbonKg,
    totalCarbonKg,
    waterLiters,
    metrics,
    equivalents: {
      carMiles: totalCarbonKg / 0.4,
      treeYears: totalCarbonKg / 22,
      smartphoneCharges: totalCarbonKg / 0.008,
    }
  };
}

export function getInsights(result: FootprintResult, input: WorkloadInput) {
  const insights = [];

  // Region Suggestion
  if (input.region.includes('India') && input.region !== 'India (Karnataka - Green Grid)') {
    insights.push({
      title: 'Switch to Karnataka Grid',
      description: 'Karnataka has a higher share of renewables. Moving your workload could reduce carbon intensity by ~40%.',
      impact: 'High',
      type: 'region'
    });
  } else if (!REGION_PROFILES.find(r => r.name === input.region)?.isGreen) {
    insights.push({
      title: 'Switch Region',
      description: 'Moving to US West (Oregon) or Europe (Sweden) could reduce operational carbon by up to 90%.',
      impact: 'High',
      type: 'region'
    });
  }

  // Time Suggestion
  if (input.timeOfDay === 'Day') {
    insights.push({
      title: 'Run at Night',
      description: 'Scheduling workloads during off-peak hours (10 PM - 6 AM) can leverage cleaner grid mixes and reduce cooling energy.',
      impact: 'Medium',
      type: 'time'
    });
  }

  // Model Specific
  if (input.type === 'Inference') {
    insights.push({
      title: 'Quantize Model',
      description: 'Using 4-bit or 8-bit quantization can reduce memory bandwidth and energy per token by 2-4x.',
      impact: 'High',
      type: 'model'
    });
    
    if ((input.batchSize || 1) < 8) {
      insights.push({
        title: 'Batch Requests',
        description: 'Increasing batch size improves GPU utilization efficiency, reducing energy per inference.',
        impact: 'Medium',
        type: 'batch'
      });
    }
  }

  if (input.type === 'Training' && (input.parametersBillion || 0) > 10) {
    insights.push({
      title: 'Use Parameter-Efficient Fine-Tuning (PEFT)',
      description: 'Techniques like LoRA can reduce the number of trainable parameters by 10,000x, significantly lowering training energy.',
      impact: 'High',
      type: 'model'
    });
  }

  return insights;
}
