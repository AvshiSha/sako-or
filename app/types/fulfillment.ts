export type FulfillmentMethod = 'delivery' | 'pickup';

export interface PickupLocation {
  name: string;
  address: string;
  notes?: string;
  etaBusinessDays: [number, number]; // [1, 2]
}

export interface CartFulfillmentState {
  fulfillment: FulfillmentMethod;
  pickupLocation?: PickupLocation;
  deliveryEtaBusinessDays?: [number, number]; // [3, 5]
}

