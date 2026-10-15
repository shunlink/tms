// Cell-tower / LBS tracking adapter for feature-phone drivers.
// The real provider (e.g. a carrier LBS API) can be plugged in later without
// touching business logic.

export interface CellLocation {
  lat: number;
  lng: number;
  accuracyMeters: number;
  provider: string;
}

export interface CellTrackingAdapter {
  getLocation(phoneNumber: string): Promise<CellLocation | null>;
}

const stubAdapter: CellTrackingAdapter = {
  async getLocation(_phoneNumber: string) {
    // No LBS provider configured — return null so callers fall back gracefully.
    return null;
  },
};

export const cellTrackingAdapter: CellTrackingAdapter = stubAdapter;
